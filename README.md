# JunePic4R2 - Cloudflare R2 图床管理系统

基于 Cloudflare R2 和 D1 的现代化图床管理系统，支持图片上传、智能压缩、R2 同步、API 接口等功能。

![Next.js](https://img.shields.io/badge/Next.js-16.0-black)
![React](https://img.shields.io/badge/React-19.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Cloudflare](https://img.shields.io/badge/Cloudflare-R2%20%26%20D1-orange)

## ✨ 特性

- 🚀 **快速上传** - 支持拖拽、粘贴、批量上传图片
- 🎨 **智能压缩** - 可选 WebP 压缩，自定义质量参数（默认 92%）
- 🔄 **R2 同步** - 一键从 R2 扫描并回填数据库（管理员）
- 🔗 **链接生成** - 支持多种格式（Markdown、HTML、BBCode 等）
- 🔐 **安全认证** - OAuth 登录（GitHub）
- 🛡️ **防盗链** - Referer 白名单保护
- 🌍 **全球 CDN** - 基于 Cloudflare R2，自动全球加速
- 📦 **API 接口** - 兼容 PicGo 等第三方工具

## 🏗️ 技术栈

- **前端框架**: Next.js 16 + React 19 + TypeScript
- **UI 组件**: Tailwind CSS + shadcn/ui
- **认证**: GitHub OAuth + 自定义 Session（Workers 兼容）
- **存储**: Cloudflare R2 (兼容 S3 API)
- **数据库**: Cloudflare D1 (SQLite)
- **图片处理**: 前端压缩（Canvas/Web Worker）。注意：Workers 不支持 Sharp。
- **部署**: Cloudflare Pages

## 📋 前置要求

1. **Cloudflare 账号**
   - [注册 Cloudflare 账号](https://dash.cloudflare.com/sign-up)
   - 创建 R2 存储桶
   - 创建 D1 数据库

2. **OAuth 应用**
   - [GitHub OAuth App](https://github.com/settings/developers)

3. **Node.js 环境**
   - Node.js 18+
   - pnpm (推荐) / npm / yarn

准备就绪后，请直接参照下文的「[📦 部署：Cloudflare Pages](#-部署cloudflare-pages)」完成部署与发布。

## 💰 Cloudflare 免费额度消耗说明

部署本项目会使用到 Cloudflare R2、D1、Pages Functions 等资源。按照 2024 年 6 月的官方定价与免费额度，常见的消耗情况可参考下列指标（实际以 Cloudflare 控制台显示为准）：

- **R2 存储桶**
  - 免费额度：10 GB 存储容量、100 万次 Class A 请求、1000 万次 Class B 请求。
  - 本项目会在上传、列举对象、同步元数据时分别占用 Class A / Class B 请求。日常图床使用（数百张图片、日均数百次访问）通常仍在免费额度内。
- **R2 外网流量**
  - Cloudflare 官方宣称零 egress 费用，但若通过自定义域名直接暴露 R2，将计入免费 10 GB/月的“Public Bucket Egress”额度。超出后按标准价计费。
  - 通过 Cloudflare Pages Functions 代理访问时，流量归属 Pages，不再占用 R2 egress 配额。
- **D1 数据库**
  - 免费额度：每日 10 万次读取、2.5 万次写入、1 GB 存储空间。
  - 本项目上传图片时会写入一条记录；仪表盘查询、链接生成会产生读取请求。除非高频批量操作，一般处于免费档。
- **Pages Functions**
  - 免费额度：10 万次请求/天（合并生产与预览环境）。
  - 图片读取如果走 Functions 代理，也会计入该请求次数；可根据访问量评估是否需要开启自定义域名直连 R2。

建议在 Cloudflare Dashboard → Billing → Usage 中定期查看实际用量，及时调整使用策略（例如开启 CDN 缓存、适量压缩图片）以避免超出免费额度。

## 📝 配置说明

### GitHub OAuth 配置

1. 访问 https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写信息：
   - Application name: `JunePic4R2`
   - Homepage URL: `https://<app-url>`（与你的 Cloudflare Pages 站点一致）
   - Authorization callback URL: `https://<app-url>/auth/github-callback`
4. 获取 Client ID 和 Client Secret，用于后续部署步骤中的环境变量配置。

<!-- Google OAuth 暂未实现，如需支持请在 Issue 中讨论。 -->

### 自定义域名配置

在 Cloudflare Dashboard 中为 R2 存储桶绑定自定义域名：

1. R2 -> 你的存储桶 -> Settings -> Public access
2. 添加自定义域名
3. 在环境变量配置中更新 `R2_PUBLIC_URL`（可选，仅在你希望通过自定义域名直接生成外链时填写）

## 📦 部署：Cloudflare Pages

Cloudflare Pages 负责托管静态 `out/` 目录，并通过 Pages Functions 运行 `functions/` 中的 API。以下步骤全部在 Cloudflare 官网完成：

1. 连接仓库并设置构建
   - 打开 Cloudflare Dashboard → Workers & Pages → Pages → Create a project。
   - 选择“Connect to GitHub”，关联本仓库。
   - Build command：`pnpm build`（项目会执行 Next.js 导出到 `out/`）。
   - Output directory：`out`
   - Functions 目录：默认识别 `functions/`，无需额外配置（保持开启）。

2. 创建 R2 存储桶（Dashboard）
   - Dashboard → R2 → Create bucket，命名如 `pic`。
   - 若使用自定义 CDN 域名：在该 Bucket → Public access 绑定域名，记录 `https://<your-r2-domain>`，稍后填入 `R2_PUBLIC_URL`（可选）。

3. 创建 D1 数据库与初始化表（Dashboard）
   - Dashboard → D1 → Create database，命名如 `junepic_db`。
   - 进入数据库 → Console，将本仓库 `db/migrations/001_initial_schema.sql` 的内容粘贴执行，完成表结构初始化。

4. 在 Pages 项目绑定 R2 / D1（Dashboard）
   - Pages → 你的项目 → Settings → Functions → Bindings：
     - R2 binding：Variable name 设为 `R2_BUCKET`，选择刚创建的 R2 Bucket。
     - D1 binding：Variable name 设为 `DB`，选择刚创建的 D1 数据库。

5. 配置环境变量（Dashboard）
   - 位置：Pages → 你的项目 → Settings → Environment Variables（建议 Production 与 Preview 都填写一致）。
   - 必填（单用户）：
     - `APP_URL`：站点公开 URL，如 `https://<project>.pages.dev` 或你的自定义域（用于 OAuth 回调与生成链接）。
     - `SESSION_SECRET`：长度 ≥ 32 的随机字符串（`openssl rand -base64 32`）。
     - `GITHUB_CLIENT_ID`：GitHub OAuth 应用的 Client ID。
     - `GITHUB_CLIENT_SECRET`：GitHub OAuth 应用的 Client Secret。
     - `OWNER_EMAIL`：唯一允许登录并拥有管理员权限的邮箱（例如 `you@example.com`）。
   - 绑定（在上一步“Functions → Bindings”中设置，而非 Environment Variables）：
     - `DB`：Cloudflare D1 绑定（选择上文创建的数据库）。
     - `R2_BUCKET`：Cloudflare R2 绑定（选择上文创建的 Bucket）。
   - 可选：
     - `R2_PUBLIC_URL`：若 R2 绑定了自定义域，填其完整 URL（如 `https://img.example.com`）；留空则应用回退到 `APP_URL/<key>`，由 Functions 代理 R2 对象。
     - `ALLOWED_REFERERS`：Referer 白名单，逗号分隔，支持通配 `*.example.com`；留空则不启用防盗链校验。
   - 说明：不需要在 Pages 中配置 `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NAME`。这些变量仅用于 Next.js 服务端或本地 S3 兼容模式；本项目在 Pages Functions 中通过 `R2_BUCKET` 绑定直接访问 R2。

6. 配置 GitHub OAuth 回调（GitHub 官网）
   - GitHub → Settings → Developer settings → OAuth Apps。
   - Homepage URL：`APP_URL`
   - Authorization callback URL：`APP_URL` + `/auth/github-callback`
   - 将获取到的 Client ID/Secret 填回 Pages 的环境变量。

7. 触发构建与发布
   - 回到 Pages 项目，保存配置后将自动构建部署；或推送一次代码触发新构建。
   - 可在 Pages → Deployments 查看日志与预览。

8. 上线验证（Dashboard）
   - 打开 `https://<app-url>/auth/signin` 完成 GitHub 登录（仅 `OWNER_EMAIL` 允许登录）。
   - 进入 `/dashboard`，右侧“系统状态（实时）”应显示 D1/R2/集成状态。
   - 上传一张图片，确认能在列表中显示；仪表盘应显示“从 R2 同步”按钮（OWNER 为管理员）。
   - 同步 R2：如果你的 R2 里有历史文件没有 `userId` 元数据，在单用户模式下会自动归属到当前登录用户并入库（不再报“缺少 userId metadata”）。

## 🎯 使用指南

### 上传图片

1. 登录后进入仪表板
2. 选择是否启用 WebP 压缩
3. 调整压缩质量（建议 92%）
4. 拖拽或选择文件上传

### 粘贴上传

在上传页面，直接按 `Ctrl+V` 粘贴图片即可上传。

### 链接生成

上传成功后，在图片卡片操作区可：
- 复制直接链接
- 复制 Markdown 格式
- 复制 HTML 格式
- 复制 BBCode 格式

<!-- 相册管理为后续规划功能，当前版本未提供。 -->

### API 接口

访问 `/api/upload` 上传图片（需先登录以携带会话 Cookie）：

```bash
curl -X POST https://<app-url>/api/upload \
  -F "file=@image.jpg"

说明：压缩已在前端完成（Canvas/WebP），该接口不处理 `compress`/`quality` 参数。
```

## 🔧 开发

### 项目结构

```
JunePic4R2/
├── app/                    # Next.js App Router（静态导出）
│   ├── auth/              # 认证页面（前端）
│   ├── dashboard/         # 仪表板（前端）
│   └── page.tsx           # 主页
├── functions/             # Cloudflare Pages Functions（API 与鉴权）
│   ├── api/               # /api/* 路由：上传/列表/删除/同步
│   └── auth/              # /auth/* 路由：登录/回调/登出/我
├── components/            # React 组件
│   ├── ui/               # shadcn/ui 组件
│   ├── image-uploader.tsx # 上传组件
│   └── image-gallery.tsx  # 图片列表/复制
├── lib/                   # 工具库
│   ├── auth-helpers.ts   # Session 工具（Workers/Next 通用）
│   ├── r2.ts             # R2 工具
│   ├── db-queries.ts     # D1 查询（纯函数）
│   └── server-upload.ts  # 上传与入库共用逻辑（Workers）
├── db/                    # 数据库
│   └── migrations/       # SQL 迁移文件
└── public/               # 静态资源
```

### 可用脚本

```bash
pnpm dev        # 启动开发服务器
pnpm build      # 构建生产版本
pnpm start      # 启动生产服务器
pnpm lint       # 代码检查
```

## 🐛 故障排除

### 关于图片压缩

Cloudflare Workers 环境不支持 Sharp 等原生 Node 模块。项目采用“前端压缩 + 服务器直传 R2”的方案，无需在 Functions 中使用 Sharp。

### D1 连接问题

确保：
1. `wrangler.toml` 中的 `database_id` 正确
2. 已运行数据库迁移脚本
3. 环境变量配置正确

### R2 上传失败

检查：
1. R2 凭证是否正确
2. 存储桶名称是否匹配
3. Account ID 是否正确

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 🙏 致谢

- [Next.js](https://nextjs.org/)
- [Cloudflare](https://cloudflare.com/)
- [shadcn/ui](https://ui.shadcn.com/)
 

---

本项目：JunePic4R2（Cloudflare R2 + D1 图床管理）
