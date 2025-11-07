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
- **认证**: NextAuth.js (OAuth)
- **存储**: Cloudflare R2 (兼容 S3 API)
- **数据库**: Cloudflare D1 (SQLite)
- **图片处理**: Sharp
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
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
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

```bash
# 构建项目
pnpm build

# 部署到 Cloudflare Pages
pnpm wrangler pages deploy .next
```

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
│   ├── auth.ts           # NextAuth 配置
│   ├── r2.ts             # R2 客户端
│   ├── db.ts             # D1 数据库
│   └── utils.ts          # 工具函数
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

### Sharp 构建问题

如果遇到 Sharp 相关的错误，尝试：

```bash
pnpm rebuild sharp
```

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
- [NextAuth.js](https://next-auth.js.org/)

---

由 [Claude Code](https://claude.com/claude-code) 生成
