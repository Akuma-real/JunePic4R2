/// <reference types="@cloudflare/workers-types" />

/**
 * Functions 环境下的 URL 解析工具
 *
 * 目标：
 * - 统一 APP_URL 的解析逻辑，避免在各个端点重复 fallback 代码
 * - 在缺失 APP_URL / R2_PUBLIC_URL 时，优雅回退到当前请求的 origin
 * - Never break userspace：已有正确配置不变，更宽容处理误配场景
 */

/**
 * 解析应用对外访问的根 URL
 *
 * 优先级：
 * 1. Env.APP_URL（如配置且非空）
 * 2. 当前请求 URL 的 origin（本地开发 / 漏配时兜底）
 */
export function resolveAppUrl(env: Env, request: Request): string {
  const raw = typeof env.APP_URL === 'string' ? env.APP_URL.trim() : '';
  const origin = new URL(request.url).origin;
  return raw || origin;
}

/**
 * 解析生成图片外链时使用的公共根 URL
 *
 * 优先级：
 * 1. Env.R2_PUBLIC_URL（推荐，绑定到 R2 自定义域名）
 * 2. resolveAppUrl(env, request)（即 APP_URL 或请求 origin）
 */
export function resolvePublicBaseUrl(env: Env, request: Request): string {
  const raw = typeof env.R2_PUBLIC_URL === 'string' ? env.R2_PUBLIC_URL.trim() : '';
  if (raw) return raw;
  return resolveAppUrl(env, request);
}

