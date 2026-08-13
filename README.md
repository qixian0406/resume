# 李林个人简历与编辑后台

网站包含两个入口：

- `/`：公开简历；数据库不可用时仍显示仓库中的完整静态内容。
- `/admin`：密码登录的可视化编辑后台；点击预览中的文字即可编辑并发布。

## 推荐部署方式：GitHub + Cloudflare Pages

> 当前 `resume` 是 Direct Upload 项目，Cloudflare 不支持把它直接改成 Git 集成项目。请新建一个 Pages 项目，验证完成后再把 `linli.bbroot.com` 从旧项目迁移到新项目。

### 1. 上传到 GitHub

将本目录中的文件作为仓库根目录上传，必须保证仓库根目录直接包含：

```text
index.html
_worker.js
admin/
styles.css
enhancements.css
content-runtime.js
interactions.js
lin-li.jpg
```

不要把管理员密码写入仓库。

### 2. 创建 Git 集成的 Pages 项目

在 Cloudflare 进入 `Workers 和 Pages → 创建 → Pages → 连接到 Git`：

- 选择刚创建的 GitHub 仓库；
- 框架预设：`无 / None`；
- 构建命令：留空；
- 构建输出目录：`.`；
- 根目录：如果上一步按建议上传，留空。

每次推送 GitHub 后，Cloudflare 会自动部署代码。

### 3. 创建并绑定 D1 数据库

1. 进入 `存储和数据库 → D1 SQL 数据库 → 创建数据库`；
2. 数据库名建议填 `resume-cms`；
3. 回到新 Pages 项目，进入 `设置 → 绑定 → 添加绑定 → D1 数据库`；
4. 变量名称必须填 `DB`，数据库选择 `resume-cms`；
5. 生产环境和预览环境都建议绑定。

数据表会在第一次访问时自动创建；`schema.sql` 也保留了手动建表语句。

### 4. 设置后台密码和会话密钥

在新 Pages 项目的 `设置 → 变量和机密` 添加两个 **加密/Secret** 变量：

- `ADMIN_PASSWORD`：后台登录密码，建议使用密码管理器生成 16 位以上随机密码；
- `SESSION_SECRET`：另一段至少 32 位随机字符，不能与登录密码相同。

两个值都不要提交到 GitHub。变量保存后重新部署一次。

### 5. 测试 pages.dev 临时地址

先打开新项目的 `*.pages.dev` 地址：

1. `/` 应正常显示完整简历；
2. `/admin` 应显示登录页；
3. 登录后改一处不重要的文字并保存；
4. 新开无痕窗口访问 `/`，确认修改已经发布。

### 6. 迁移自定义域

确认新项目正常后：

1. 在旧 `resume` 项目中移除 `linli.bbroot.com` 自定义域；
2. 在新项目中添加 `linli.bbroot.com`；
3. Cloudflare 会再次显示 CNAME 目标；
4. 若目标与当前 `resume-6dd.pages.dev` 不同，在 DNSHE 将 `@` 的 CNAME 修改为新目标；
5. 等新项目显示“有效”后再删除旧项目。

## 日常使用

- 普通文字更新：访问 `https://linli.bbroot.com/admin`，登录、编辑、保存即可，无需修改 GitHub。
- 改布局、样式或增加栏目：修改 GitHub 源码，推送后自动部署。
- 数据库内容优先于 HTML 默认文字；若以后大改 DOM 结构，建议先备份 D1 中的 `site_content` 数据。

## 安全说明

- 后台密码只存在 Cloudflare Secret 中，不在前端源码中；
- 登录 Cookie 使用 `HttpOnly + Secure + SameSite=Strict`；
- 后台页面带有 `noindex`，不会主动被搜索引擎收录；
- `/admin` 地址不是安全措施本身，必须使用强密码；
- 如果需要更高安全性，可再给 `/admin*` 增加 Cloudflare Access 邮箱验证码保护。

## 本地预览

纯页面预览可运行：

```powershell
python -m http.server 8000
```

然后访问 `http://localhost:8000/`。本地静态服务器不提供 D1 和登录接口；完整接口应在 Cloudflare 预览部署中验证。
