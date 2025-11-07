/**
 * 获取当前用户信息端点
 *
 * 返回当前登录用户的信息（不包含敏感数据）
 */

/// <reference types="@cloudflare/workers-types" />

import { verifySession, getSessionSecret } from '../../lib/auth-helpers';
import { getUserById } from '../../lib/db-queries';

export async function onRequestGet(context: EventContext<Env, never, Record<string, unknown>>) {
  try {
    // 验证 session
    const secret = getSessionSecret(context.env);
    const session = await verifySession(context.request, secret);

    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取用户信息
    const user = await getUserById(context.env.DB, session.userId);

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // 返回用户信息（不包含敏感数据）
    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        provider: user.provider,
        createdAt: user.created_at,
        isAdmin: session.isAdmin,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
