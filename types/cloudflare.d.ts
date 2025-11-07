/**
 * Cloudflare Workers/Pages Functions 环境变量类型定义
 */

declare global {
  interface Env {
    // D1 数据库
    DB: D1Database;

    // R2 存储
    R2_BUCKET: R2Bucket;

    // 认证相关
    SESSION_SECRET: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;

    // R2 配置（用于 S3 兼容模式）
    R2_ACCOUNT_ID?: string;
    R2_ACCESS_KEY_ID?: string;
    R2_SECRET_ACCESS_KEY?: string;
    R2_BUCKET_NAME?: string;
    R2_PUBLIC_URL?: string;

    // 应用配置
    APP_URL: string; // 应用的公开 URL，用于 OAuth callback

    // 可选：Referer 白名单
    ALLOWED_REFERERS?: string;

    // 可选：允许登录的邮箱白名单（逗号分隔）。未设置时禁止任何登录
    ALLOWED_EMAILS?: string;

    // 可选：管理员邮箱白名单（逗号分隔）。仅这些邮箱被视为管理员
    ADMIN_EMAILS?: string;
  }
}

export {};
