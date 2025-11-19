/**
 * 认证状态探测端点（轻量）
 *
 * 语义：始终 200，返回 { authenticated: boolean }
 * 用于首页/通用探测，避免未登录时出现 401 噪音。
 */

/// <reference types="@cloudflare/workers-types" />

import { verifySession, getSessionSecret } from '../../lib/auth-helpers';

export async function onRequestGet(context: EventContext<Env, never, Record<string, unknown>>) {
  try {
    const secret = getSessionSecret(context.env);
    const session = await verifySession(context.request, secret);

    return Response.json(
      { authenticated: !!session },
      {
        headers: {
          // 避免缓存导致状态串扰
          'Cache-Control': 'no-store, private',
          Vary: 'Cookie',
        },
      }
    );
  } catch (error) {
    // 对于状态探测端点：即使出错，也返回未登录，降低对 UI 的干扰
    console.warn('Auth status check warning (treated as unauthenticated):', error);
    return Response.json(
      { authenticated: false },
      {
        headers: {
          'Cache-Control': 'no-store, private',
          Vary: 'Cookie',
        },
      }
    );
  }
}
