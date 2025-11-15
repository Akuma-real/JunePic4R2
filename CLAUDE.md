# CLAUDE.md

本文档为 Claude Code (claude.ai/code) 在此代码库中工作提供指导。

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式（构建 Next.js 然后在 8788 端口启动 Pages Functions 开发服务器）
pnpm dev

# 或单独运行 Next.js 开发服务器（仅前端）
pnpm dev:next

# 或单独运行 Pages Functions 开发服务器（仅 API，需要已有构建）
pnpm dev:wrangler

# 构建生产版本（Next.js 静态导出到 out/）
pnpm build

# 启动生产服务器
pnpm start

# 部署到 Cloudflare Pages
pnpm deploy

# 代码检查
pnpm lint
```

## 数据库操作

```bash
# 初始化本地 D1 数据库
wrangler d1 create junepic_db

# 在本地数据库上运行迁移
wrangler d1 execute junepic_db --local --file=db/migrations/001_initial_schema.sql

# 在远程数据库上运行迁移
wrangler d1 execute junepic_db --file=db/migrations/001_initial_schema.sql
```

## 架构概述

这是一个基于 **Next.js + Cloudflare Pages Functions** 的混合架构应用，用于在 Cloudflare R2 上进行图像托管，使用 D1 数据库。

### 双环境模式

代码库设计为在两个不同的环境中运行：

1. **Next.js 前端**（`app/` 目录）
   - 通过 `next build` 静态导出到 `out/` 目录
   - 使用 `process.env` 获取环境变量
   - 使用 AWS SDK 调用 R2 S3 兼容 API

2. **Cloudflare Pages Functions**（`functions/` 目录）
   - 通过 Cloudflare Pages 部署
   - 使用 Cloudflare 绑定（`R2_BUCKET`、`DB`）
   - 使用 Web 标准 API（Web Crypto、Workers Runtime）

**关键架构决策**：会话管理和数据库查询实现为纯函数，接受环境/客户端作为参数，使其在两个环境中可重用（`lib/auth-helpers.ts`、`lib/db-queries.ts`、`lib/r2.ts`）。

### 核心数据流

1. **前端**：用户上传 → 浏览器端 WebP 压缩（Canvas API）→ FormData 发送到 API
2. **API**（`functions/api/upload.ts`）：会话/Token 认证 → 上传到 R2 → 创建数据库记录
3. **存储**：文件存储在 Cloudflare R2 中，包含元数据（userId、原始文件名）
4. **数据库**（D1）：包含 R2 storage_key 的图像记录用于检索

### 认证系统

支持两种认证方法：

1. **GitHub OAuth**（主要方式）
   - `functions/auth/login.ts` → GitHub OAuth 流程
   - `functions/auth/github-callback.ts` → 回调处理器
   - 会话存储为使用 Web Crypto API（AES-GCM）加密的 cookie
   - `lib/auth-helpers.ts` 实现会话加密/解密

2. **上传令牌**（API 集成）
   - 基于令牌的身份验证，适用于第三方工具（PicList、PicGo）
   - `lib/upload-tokens.ts` 管理令牌验证
   - 存储在 D1 的 `upload_tokens` 表中

3. **密码登录（管理员）**
   - 仅 `OWNER_EMAIL` 指定的邮箱允许登录
   - 首次成功登录时，系统会基于输入密码生成随机 16 字节 salt 的 PBKDF2（SHA-256，100,000 次迭代）哈希，并写入 `users.password_hash`
   - 后续登录会验证数据库中的哈希，无需在环境变量中存储明文密码
   - 配置项：`SECURE_COOKIES`（是否在 cookie 上添加 `Secure` 标记）

**安全性**：会话加密使用 PBKDF2 派生的 AES-GCM，100,000 次迭代。会话在 30 天后过期。

### 数据库模式（D1）

三个核心表：

1. **users** - GitHub OAuth 用户记录
2. **images** - 包含 R2 storage_key 的图像元数据
3. **upload_tokens** - 基于令牌的 API 访问

关键索引：`idx_images_user_id`（按用户查询）、`idx_images_created_at`（按时间顺序列出）。

查看 `db/migrations/001_initial_schema.sql:1-51` 了解完整模式。

### 关键组件

- `lib/auth-helpers.ts` - 会话管理（Workers/Next 兼容）
- `lib/db-queries.ts` - 纯 D1 查询函数
- `lib/r2.ts` - R2 操作（支持 R2Bucket 绑定和 S3 客户端模式）
- `lib/server-upload.ts` - API 端点间共享的上传逻辑
- `components/image-uploader.tsx` - 拖拽上传 UI，支持 WebP 压缩
- `functions/api/upload.ts` - 主要上传端点（支持会话 + 令牌认证）
- `functions/_url.ts` - URL 解析（APP_URL vs R2_PUBLIC_URL）

### 环境配置

**生产环境（Cloudflare Pages）**：
- `APP_URL` - 站点 URL
- `SESSION_SECRET` - 会话加密密钥（≥32 字符）
- `SECURE_COOKIES` - `true/false`（或 `0/1`）控制是否为 session cookie 添加 `Secure`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - OAuth 凭证
- `OWNER_EMAIL` - 单个管理员邮箱
- 绑定：`R2_BUCKET`、`DB`

**开发环境**：
- 使用 `.dev.vars` 用于本地环境（不提交到 git）
- `wrangler.toml` 包含本地 D1/R2 绑定

查看 `.env.example` 了解完整的变量列表。

## 开发模式

### Cloudflare 环境限制

1. **无原生 Node 模块** - Sharp 不可用。使用上传前的基于浏览器的压缩（Canvas API）。
2. **R2 访问** - 生产环境使用绑定（`R2_BUCKET`），而非 AWS 凭证
3. **仅 Web 标准 API** - 使用 Web Crypto API、Fetch API 等
4. **会话管理** - 必须与 Workers 运行时兼容（参见 `lib/auth-helpers.ts:24-250`）

### 代码组织

- `lib/` 中的纯函数 - 无副作用，接受客户端作为参数
- `functions/api/` 中的 API 路由 - Cloudflare Pages Functions（Workers API）
- `app/` 中的页面 - Next.js 静态导出（前端）
- `lib/` 中的共享工具 - 在两个环境中工作

### 图像处理

**前端压缩**（`components/image-uploader.tsx`）：
- Canvas API 将图像转换为 WebP
- 可调整质量（默认 92%）
- 基于 Worker 的压缩以保持 UI 响应性

**服务器接收**预压缩图像，直接上传到 R2。

### API 集成

通过 API 令牌上传：
1. 在仪表板中生成令牌
2. 在 `Authorization: Bearer <token>` 标头中使用
3. 使用 FormData POST 到 `/api/upload/batch`

支持 PicList、PicGo 和其他第三方工具。

## 常见任务

### 运行测试

此项目中未配置测试。要添加测试：
1. 安装测试框架（`vitest`、`jest`）
2. 在 `package.json:5-13` 中添加测试脚本
3. 创建 `__tests__/` 目录结构

### 添加新的 API 端点

1. 在 `functions/api/` 中创建文件
2. 导出 `onRequestGet`/`onRequestPost`/`onRequestPatch`/`onRequestDelete`
3. 使用 `lib/auth-helpers.ts` 中的 `verifySession` 进行认证
4. 使用 `lib/db-queries.ts` 中的 D1 查询
5. 参考 `functions/api/upload.ts:1-90` 的实现模式

### 修改数据库模式

1. 编辑 `db/migrations/001_initial_schema.sql`
2. 应用到本地：`wrangler d1 execute junepic_db --local --file=db/migrations/001_initial_schema.sql`
3. 应用到远程：`wrangler d1 execute junepic_db --file=db/migrations/001_initial_schema.sql`

### R2 对象元数据

上传到 R2 时，包含：
- `userId` - 所有者用户 ID
- `originalFilename` - 原始文件名
- `uploadedAt` - ISO 时间戳

这些实现了"从 R2 同步"功能，可回填缺失的数据库记录。

## 重要文件

- `README.md` - 部署指南、Cloudflare Pages 设置、OAuth 配置
- `wrangler.toml` - 本地开发绑定
- `next.config.ts` - 静态导出配置
- `components.json` - shadcn/ui 配置
- `.dev.vars` - 本地环境（不在 git 中）

## 部署

生产部署通过 Cloudflare Pages 完成：
1. `pnpm build` 在 `out/` 中创建静态导出
2. Cloudflare Pages 将 `out/` 作为静态站点提供
3. `functions/` 部署为 Pages Functions
4. 在 Cloudflare Dashboard 中配置绑定（而非代码中）

查看 `README.md:88-142` 了解完整的部署步骤。

## 关键限制

- **无服务器端图像处理**（Workers 不支持原生模块）
- **会话密钥必须 ≥32 字符**（代码中强制执行）
- **仅 Next.js 静态导出**（`next.config.ts:3-7` 中的 `output: 'export'`）
- **需要 Web Crypto API** 用于会话加密
- **仅 SQLite (D1)** - 不支持其他数据库
- **仅 GitHub OAuth** - 单个提供商（`.env.example` 中提到的 Google 但未实现）
