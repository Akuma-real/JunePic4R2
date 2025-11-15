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
    SESSION_SALT?: string; // 向后兼容：已弃用，新版本使用固定空盐值
    SECURE_COOKIES?: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    OWNER_EMAIL: string; // 单用户模式：唯一允许登录且为管理员的邮箱

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
  }
}

export {};
