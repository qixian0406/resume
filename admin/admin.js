(() => {
  const loginView = document.querySelector("#login-view");
  const editorView = document.querySelector("#editor-view");
  const loginForm = document.querySelector("#login-form");
  const loginMessage = document.querySelector("#login-message");
  const preview = document.querySelector("#preview");
  const saveButton = document.querySelector("#save-button");
  const reloadButton = document.querySelector("#reload-button");
  const logoutButton = document.querySelector("#logout-button");
  const saveStatus = document.querySelector("#save-status");
  const linkEditor = document.querySelector("#link-editor");
  const hrefInput = document.querySelector("#href-input");
  let currentLink = null;
  let dirty = false;

  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "请求失败");
    return payload;
  };

  const setDirty = (value) => {
    dirty = value;
    saveStatus.textContent = value ? "有未保存修改" : "内容已同步";
    saveStatus.className = `save-status${value ? " dirty" : ""}`;
  };

  const showLogin = () => {
    loginView.hidden = false;
    editorView.hidden = true;
  };

  const showEditor = () => {
    loginView.hidden = true;
    editorView.hidden = false;
  };

  const preparePreview = async () => {
    const frameWindow = preview.contentWindow;
    const frameDocument = preview.contentDocument;
    if (!frameWindow?.ResumeCMS || !frameDocument) return;
    await frameWindow.ResumeCMS.ready;
    frameDocument.documentElement.classList.add("cms-editing");
    const style = frameDocument.createElement("style");
    style.textContent = `
      .cms-editing [data-admin-editable]{outline:1px dashed #7d9d12;outline-offset:4px;border-radius:2px;cursor:text;transition:outline .15s,background .15s}
      .cms-editing [data-admin-editable]:hover{outline:2px solid #98bd15;background:#dfff6928}
      .cms-editing [data-admin-editable]:focus{outline:3px solid #88aa0b;background:#edffc055}
      .cms-editing .site-header{top:0}
    `;
    frameDocument.head.append(style);
    frameWindow.ResumeCMS.collect().forEach(({ element, key }) => {
      element.dataset.adminEditable = key;
      element.contentEditable = "true";
      element.spellcheck = true;
      element.addEventListener("input", () => setDirty(true));
      element.addEventListener("click", (event) => {
        if (element instanceof frameWindow.HTMLAnchorElement) {
          event.preventDefault();
          currentLink = element;
          hrefInput.value = element.getAttribute("href") || "";
          linkEditor.hidden = false;
        } else {
          currentLink = null;
          linkEditor.hidden = true;
        }
      });
    });
    frameDocument.addEventListener("click", (event) => {
      const anchor = event.target.closest("a");
      if (anchor) event.preventDefault();
    }, true);
    setDirty(false);
  };

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginMessage.textContent = "正在登录…";
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify({ password: loginForm.password.value }) });
      loginForm.reset();
      showEditor();
      preview.src = `/?cms-preview=${Date.now()}`;
      loginMessage.textContent = "";
    } catch (error) {
      loginMessage.textContent = error.message;
    }
  });

  preview.addEventListener("load", preparePreview);
  hrefInput.addEventListener("input", () => {
    if (!currentLink) return;
    currentLink.setAttribute("href", hrefInput.value);
    setDirty(true);
  });

  saveButton.addEventListener("click", async () => {
    const frameWindow = preview.contentWindow;
    if (!frameWindow?.ResumeCMS) return;
    saveButton.disabled = true;
    saveStatus.textContent = "正在保存…";
    try {
      const content = {};
      frameWindow.ResumeCMS.collect().forEach(({ element, key }) => {
        const entry = { html: frameWindow.ResumeCMS.sanitize(element.innerHTML) };
        if (element instanceof frameWindow.HTMLAnchorElement) entry.href = element.getAttribute("href") || "";
        content[key] = entry;
      });
      const result = await api("/api/content", { method: "PUT", body: JSON.stringify({ content }) });
      setDirty(false);
      saveStatus.textContent = `已发布 · ${new Date(result.updatedAt).toLocaleString("zh-CN")}`;
    } catch (error) {
      saveStatus.textContent = error.message;
      saveStatus.className = "save-status error";
    } finally {
      saveButton.disabled = false;
    }
  });

  reloadButton.addEventListener("click", () => {
    if (dirty && !confirm("确定放弃尚未保存的修改吗？")) return;
    preview.src = `/?cms-preview=${Date.now()}`;
  });

  logoutButton.addEventListener("click", async () => {
    await api("/api/logout", { method: "POST", body: "{}" }).catch(() => null);
    showLogin();
  });

  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  api("/api/session").then(({ authenticated }) => {
    if (authenticated) showEditor();
    else showLogin();
  }).catch(showLogin);
})();
