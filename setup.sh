#!/bin/bash

# JunePic4R2 快速配置脚本
# 此脚本将引导您完成项目的初始配置

set -e

echo "========================================="
echo "   JunePic4R2 快速配置向导"
echo "========================================="
echo ""

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
  echo "📦 正在安装依赖..."
  pnpm install
  echo "✅ 依赖安装完成"
  echo ""
fi

# 检查环境变量文件
if [ ! -f ".env.local" ]; then
  echo "📝 创建环境变量配置文件..."
  cp .env.example .env.local
  echo "✅ 已创建 .env.local 文件"
  echo ""
  echo "⚠️  请编辑 .env.local 文件，填入您的配置（仅用于 Next.js 构建/本地界面）："
  echo "   注意：Pages Functions 的环境变量请在 wrangler.toml 或 Cloudflare Dashboard 配置，\".env.local\" 不会注入 Functions 运行时。"
  echo "   - Cloudflare R2 凭证"
  echo "   - D1 数据库 ID"
  echo "   - NEXTAUTH_SECRET/SESSION_SECRET (运行: openssl rand -base64 32)"
  echo "   - GitHub/Google OAuth 凭证"
  echo ""
  read -p "按 Enter 继续..."
else
  echo "✅ .env.local 文件已存在"
  echo ""
fi

# 询问是否已配置 Cloudflare
echo "🔧 Cloudflare 配置检查"
echo ""
read -p "是否已创建 R2 存储桶？(y/n): " has_r2
if [ "$has_r2" != "y" ]; then
  echo ""
  echo "请运行以下命令创建 R2 存储桶："
  echo "  pnpm wrangler r2 bucket create junepic-bucket"
  echo ""
fi

read -p "是否已创建 D1 数据库？(y/n): " has_d1
if [ "$has_d1" != "y" ]; then
  echo ""
  echo "请运行以下命令创建 D1 数据库："
  echo "  pnpm wrangler d1 create junepic_db"
  echo ""
  echo "然后将输出的 database_id 填入 wrangler.toml"
  echo ""
fi

read -p "是否已运行数据库迁移？(y/n): " has_migration
if [ "$has_migration" != "y" ]; then
  echo ""
  echo "请运行以下命令初始化数据库："
  echo "  pnpm wrangler d1 execute junepic_db --file=./db/migrations/001_initial_schema.sql"
  echo ""
fi

# 检查 OAuth 配置
echo ""
echo "🔐 OAuth 配置检查"
echo ""
read -p "是否已配置 GitHub OAuth？(y/n): " has_github
if [ "$has_github" != "y" ]; then
  echo ""
  echo "请访问 https://github.com/settings/developers 创建 OAuth App"
  echo "回调 URL: http://localhost:3000/auth/github-callback"
  echo ""
fi

read -p "是否需要配置 Google OAuth？(y/n): " want_google
if [ "$want_google" = "y" ]; then
  echo ""
  echo "请访问 https://console.cloud.google.com/apis/credentials"
  echo "创建 OAuth 2.0 客户端 ID"
  echo "回调 URL: http://localhost:3000/api/auth/callback/google"
  echo ""
fi

# 总结
echo ""
echo "========================================="
echo "   配置总结"
echo "========================================="
echo ""
echo "请确保完成以下步骤："
echo ""
echo "1. ✅ 安装依赖: pnpm install"
echo "2. ⚠️  配置 .env.local 文件"
echo "3. ⚠️  创建 R2 存储桶"
echo "4. ⚠️  创建 D1 数据库"
echo "5. ⚠️  运行数据库迁移"
echo "6. ⚠️  配置 OAuth 应用"
echo ""
echo "完成后，运行以下命令启动项目："
echo ""
echo "  pnpm dev"
echo ""
echo "然后访问: http://localhost:3000"
echo ""
echo "========================================="
echo ""
echo "📚 更多帮助，请查看："
echo "   - README.md - 完整文档"
echo "   - SETUP.md - 详细设置指南"
echo "   - db/README.md - 数据库文档"
echo ""
echo "🚀 祝您使用愉快！"
echo ""
