/**
 * 全局中间件：可选的 Referer 白名单校验
 *
 * - 允许空 Referer（用户直接打开）
 * - 仅当设置了 ALLOWED_REFERERS 时启用
 * - 校验 /api/* 与常见图片后缀的请求
 */

/// <reference types="@cloudflare/workers-types" />

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico'];

function shouldCheck(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true;
  const lower = pathname.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function normalizeHost(input: string): string {
  try {
    const u = new URL(input);
    return u.hostname.toLowerCase();
  } catch {
    return input.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  }
}

function matchHost(host: string, pattern: string): boolean {
  const p = pattern.trim().toLowerCase();
  if (!p) return false;
  const pat = p.startsWith('*.') ? p.slice(1) : p;
  if (p.startsWith('*.')) {
    return host === pat.slice(1) || host.endsWith(pat);
  }
  return host === pat;
}

export async function onRequest(context: EventContext<Env, never, Record<string, unknown>>) {
  const { request, env } = context;
  const url = new URL(request.url);

  const list = env.ALLOWED_REFERERS as string | undefined;
  if (!list || !shouldCheck(url.pathname)) {
    return context.next();
  }

  const referer = request.headers.get('Referer') || request.headers.get('Origin');
  if (!referer) {
    // 允许无 Referer 访问（避免破坏直链/复制链接）
    return context.next();
  }

  const host = normalizeHost(referer);
  const allowed = list
    .split(',')
    .map((s) => normalizeHost(s.trim()))
    .some((pat) => matchHost(host, pat));

  if (!allowed) {
    return new Response('Forbidden', { status: 403 });
  }

  return context.next();
}
