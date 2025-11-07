# JunePic4R2 - Cloudflare R2 图床管理系统

基于 Cloudflare R2 和 D1 的现代化图床管理系统，支持图片上传、智能压缩、相册管理、API 接口等功能。

![Next.js](https://img.shields.io/badge/Next.js-16.0-black)
![React](https://img.shields.io/badge/React-19.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Cloudflare](https://img.shields.io/badge/Cloudflare-R2%20%26%20D1-orange)

## ✨ 特性

- 🚀 **快速上传** - 支持拖拽、粘贴、批量上传图片
- 🎨 **智能压缩** - 可选 WebP 压缩，自定义质量参数（默认 92%）
- 📁 **相册管理** - 创建相册，分类管理图片
- 🔗 **链接生成** - 支持多种格式（Markdown、HTML、BBCode 等）
- 🔐 **安全认证** - OAuth 登录（GitHub/Google）
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
- **部署**: Vercel / Cloudflare Pages

## 📋 前置要求

1. **Cloudflare 账号**
   - [注册 Cloudflare 账号](https://dash.cloudflare.com/sign-up)
   - 创建 R2 存储桶
   - 创建 D1 数据库

2. **OAuth 应用**
   - [GitHub OAuth App](https://github.com/settings/developers)
   - [Google OAuth App](https://console.cloud.google.com/apis/credentials)（可选）

3. **Node.js 环境**
   - Node.js 18+
   - pnpm (推荐) / npm / yarn

## 🚀 快速开始

### 1. 克隆项目

\`\`\`bash
git clone <your-repo-url>
cd JunePic4R2
pnpm install
\`\`\`

### 2. 配置 Cloudflare R2

```bash
# 登录 Cloudflare
pnpm wrangler login

# 创建 R2 存储桶
pnpm wrangler r2 bucket create junepic-bucket

# 获取 R2 访问密钥
# 访问: https://dash.cloudflare.com/ -> R2 -> 管理 R2 API 令牌
```

### 3. 配置 Cloudflare D1

```bash
# 创建 D1 数据库
pnpm wrangler d1 create junepic_db

# 复制输出的 database_id，填入 wrangler.toml

# 运行数据库迁移
pnpm wrangler d1 execute junepic_db --file=./db/migrations/001_initial_schema.sql
```

### 4. 配置环境变量

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入配置：

```env
# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=junepic-bucket
R2_PUBLIC_URL=https://your-custom-domain.com  # 可选

# D1 数据库
DATABASE_ID=your_d1_database_id

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_generated_secret  # 运行: openssl rand -base64 32

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Google OAuth（可选）
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

提示：Cloudflare Pages Functions 的环境变量来自 wrangler.toml 或 Cloudflare Dashboard 的 Project → Settings → Environment Variables；`.env.local` 仅用于 Next.js 构建/本地界面，不会注入到 Functions 运行时。

### 5. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

## 📝 配置说明

### GitHub OAuth 配置

1. 访问 https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写信息：
   - Application name: `JunePic4R2`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/auth/github-callback`
4. 获取 Client ID 和 Client Secret

### Google OAuth 配置（可选）

1. 访问 https://console.cloud.google.com/apis/credentials
2. 创建 OAuth 2.0 客户端 ID
3. 添加授权重定向 URI: `http://localhost:3000/api/auth/callback/google`
4. 获取 Client ID 和 Client Secret

### 自定义域名配置

在 Cloudflare Dashboard 中为 R2 存储桶绑定自定义域名：

1. R2 -> 你的存储桶 -> Settings -> Public access
2. 添加自定义域名
3. 更新 `.env.local` 中的 `R2_PUBLIC_URL`

## 📦 部署

### Vercel 部署

1. 导入项目到 Vercel
2. 配置环境变量（同上）
3. 部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Cloudflare Pages 部署

Cloudflare Pages 负责托管静态 `out/` 目录，同时通过 Pages Functions 运行 `functions/` 里的 API。建议按下面顺序一次性完成：

1. **登录与初始化**
   ```bash
   pnpm wrangler login
   ```
   确保 `wrangler --version` ≥ 4.46，避免和 D1/R2 新接口不兼容。

2. **准备 R2 存储并绑定**
   ```bash
   pnpm wrangler r2 bucket create junepic-bucket
   ```
   - 在 Cloudflare Dashboard → Workers & Pages → Pages → 你的项目 → Settings → R2 bindings，新增绑定：
     - Variable name：`R2_BUCKET`
     - Bucket：刚创建的 bucket
   - 如果需要自定义 CDN 域名，记得在 R2 Bucket → Public access 中绑定域并把 URL 写入 `R2_PUBLIC_URL`。

3. **准备 D1 数据库并绑定**
   ```bash
   # 创建
   pnpm wrangler d1 create junepic_db
   # 迁移（本地 / 远程均可，推荐 remote 与 Pages 共享同一数据）
   pnpm wrangler d1 execute junepic_db --remote --file=./db/migrations/001_initial_schema.sql
   ```
   Dashboard 中为 Pages 项目添加 D1 binding：
   - Variable name：`DB`
   - Database：`junepic_db`（或你自己的名字）

4. **配置环境变量**
   Cloudflare Pages → Settings → Environment Variables，新增（Production / Preview 都要填）：
   - `APP_URL`：生产站点域名，例如 `https://pic.example.com`
   - `SESSION_SECRET`：长度 ≥ 32 的随机字符串（`openssl rand -base64 32`）
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
   - `ALLOWED_EMAILS`：允许登录的邮箱，逗号分隔
   - `ADMIN_EMAILS`：拥有同步等敏感操作权限的邮箱
   - `R2_PUBLIC_URL`（若使用自定义域）
   - 其它业务相关变量（如 `GOOGLE_*`、`ALLOWED_REFERERS` 等）

5. **构建静态资源**
   ```bash
   pnpm install   # 首次部署需要
   pnpm build     # Next.js 静态导出到 out/
   ```

6. **部署到 Cloudflare Pages**
   ```bash
   pnpm wrangler pages project create junepic4r2 --production-branch main  # 首次创建
   pnpm wrangler pages deploy out --project-name junepic4r2
   ```
   如果仓库托管在 GitHub，也可以直接在 Cloudflare Pages 里创建项目、选择仓库，构建命令填 `pnpm build`，输出目录填 `out`，Wrangler 会自动复用 `functions/`。

7. **上线验证**
   - 打开 `https://<app-url>/auth/signin`，完成 GitHub 登录，确保白名单生效。
   - 在仪表板上传一张图片，确认 R2 与 D1 都写入成功。
   - 若需要 R2 → D1 同步，务必用 `ADMIN_EMAILS` 里的账号登录，仪表板才会显示“从 R2 同步”按钮。

## 🎯 使用指南

### 上传图片

1. 登录后进入仪表板
2. 选择是否启用 WebP 压缩
3. 调整压缩质量（建议 92%）
4. 拖拽或选择文件上传

### 粘贴上传

在上传页面，直接按 `Ctrl+V` 粘贴图片即可上传。

### 链接生成

上传成功后，点击图片可以：
- 复制直接链接
- 复制 Markdown 格式
- 复制 HTML 格式
- 复制 BBCode 格式

### 相册管理

- 创建相册分类图片
- 一张图片可以属于多个相册
- 设置相册封面

### API 接口

访问 `/api/upload` 上传图片：

```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@image.jpg" \
  -F "compress=true" \
  -F "quality=0.92"
```

## 🔧 开发

### 项目结构

```
JunePic4R2/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   ├── auth/              # 认证页面
│   ├── dashboard/         # 仪表板
│   └── page.tsx           # 主页
├── components/            # React 组件
│   ├── ui/               # shadcn/ui 组件
│   └── image-uploader.tsx # 上传组件
├── lib/                   # 工具库
│   ├── auth-helpers.ts   # Session 工具（Workers/Next 通用）
│   ├── r2.ts             # R2 工具
│   ├── db-queries.ts     # D1 查询（纯函数）
│   └── server-upload.ts  # 上传与入库共用逻辑（Workers）
├── db/                    # 数据库
│   ├── migrations/       # SQL 迁移文件
│   └── README.md         # 数据库文档
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

由 [Claude Code](https://claude.com/claude-code) 生成
