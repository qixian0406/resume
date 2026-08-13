const encoder = new TextEncoder();
const decoder = new TextDecoder();

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
});

const base64url = (bytes) => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const fromBase64url = (value) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const sign = async (value, secret) => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
};

const safeEqual = (left, right) => {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};

const parseCookies = (request) => Object.fromEntries((request.headers.get("cookie") || "").split(";")
  .map((item) => item.trim().split(/=(.*)/s).slice(0, 2)).filter(([key]) => key));

const createSession = async (secret) => {
  const payload = base64url(encoder.encode(JSON.stringify({ exp: Date.now() + 7 * 86400_000 })));
  return `${payload}.${await sign(payload, secret)}`;
};

const validSession = async (request, secret) => {
  const token = parseCookies(request).resume_session;
  if (!token || !secret) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, await sign(payload, secret))) return false;
  try {
    return JSON.parse(decoder.decode(fromBase64url(payload))).exp > Date.now();
  } catch {
    return false;
  }
};

const sameOrigin = (request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
};

const ensureDatabase = async (env) => {
  if (!env.DB) throw new Error("D1 binding DB is missing");
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_content (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
};

const getContent = async (env) => {
  if (!env.DB) return { content: {}, updatedAt: null, storageReady: false };
  await ensureDatabase(env);
  const row = await env.DB.prepare("SELECT data_json, updated_at FROM site_content WHERE id = 1").first();
  return { content: row ? JSON.parse(row.data_json) : {}, updatedAt: row?.updated_at || null, storageReady: true };
};

const handleApi = async (request, env, path) => {
  if (path === "/api/content" && request.method === "GET") {
    try { return json(await getContent(env)); }
    catch { return json({ content: {}, updatedAt: null, storageReady: false }, 200); }
  }

  if (path === "/api/session" && request.method === "GET") {
    return json({ authenticated: await validSession(request, env.SESSION_SECRET) });
  }

  if (path === "/api/login" && request.method === "POST") {
    if (!sameOrigin(request)) return json({ error: "请求来源无效" }, 403);
    if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: "管理员密码尚未在 Cloudflare 中配置" }, 503);
    let body;
    try { body = await request.json(); } catch { return json({ error: "请求格式无效" }, 400); }
    if (!safeEqual(String(body.password || ""), env.ADMIN_PASSWORD)) return json({ error: "密码不正确" }, 401);
    const token = await createSession(env.SESSION_SECRET);
    return json({ ok: true }, 200, {
      "set-cookie": `resume_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
    });
  }

  if (path === "/api/logout" && request.method === "POST") {
    return json({ ok: true }, 200, {
      "set-cookie": "resume_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
    });
  }

  if (path === "/api/content" && request.method === "PUT") {
    if (!sameOrigin(request)) return json({ error: "请求来源无效" }, 403);
    if (!await validSession(request, env.SESSION_SECRET)) return json({ error: "登录已失效，请重新登录" }, 401);
    let body;
    try { body = await request.json(); } catch { return json({ error: "请求格式无效" }, 400); }
    const content = body?.content;
    if (!content || typeof content !== "object" || Array.isArray(content)) return json({ error: "内容格式无效" }, 400);
    const serialized = JSON.stringify(content);
    if (serialized.length > 180_000) return json({ error: "内容过大" }, 413);
    if (/<script|javascript:|\son\w+\s*=/i.test(serialized)) return json({ error: "内容包含不安全代码" }, 400);
    await ensureDatabase(env);
    const updatedAt = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO site_content (id, data_json, updated_at) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`)
      .bind(serialized, updatedAt).run();
    return json({ ok: true, updatedAt });
  }

  return json({ error: "Not found" }, 404);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await handleApi(request, env, url.pathname); }
      catch (error) { return json({ error: error?.message || "服务器错误" }, 500); }
    }
    const assetResponse = await env.ASSETS.fetch(request);
    const response = new Response(assetResponse.body, assetResponse);
    response.headers.set("x-content-type-options", "nosniff");
    response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
    response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
    response.headers.set("content-security-policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'");
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      response.headers.set("cache-control", "no-store");
      response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    }
    return response;
  }
};
