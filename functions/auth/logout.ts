/**
 * 登出端点
 *
 * 清除 session cookie 并重定向到首页
 */

/// <reference types="@cloudflare/workers-types" />

import { deleteSession } from '../../lib/auth-helpers';
import { resolveAppUrl } from '../_url';

export async function onRequestPost(context: EventContext<Env, never, Record<string, unknown>>) {

  // 清除 session cookie
  const clearCookie = deleteSession(undefined, context.env);

  const appUrl = resolveAppUrl(context.env, context.request);

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${appUrl}/`,
      'Set-Cookie': clearCookie,
    },
  });
}

// GET 请求也支持登出（用于简单的链接跳转）
export async function onRequestGet(context: EventContext<Env, never, Record<string, unknown>>) {
  return onRequestPost(context);
}
