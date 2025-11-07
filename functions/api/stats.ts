/**
 * 统计信息 API
 *
 * GET /api/stats - 获取用户统计信息
 */

/// <reference types="@cloudflare/workers-types" />

import { verifySession, getSessionSecret } from '../../lib/auth-helpers';
import { getUserStats } from '../../lib/db-queries';

export async function onRequestGet(context: EventContext<Env, never, Record<string, unknown>>) {
  try {
    // 验证 session
    const secret = getSessionSecret(context.env);
    const session = await verifySession(context.request, secret);

    if (!session) {
      return Response.json({ error: '未授权访问' }, { status: 401 });
    }

    // 获取统计信息
    const stats = await getUserStats(context.env.DB, session.userId);

    // 转换 totalSize (字节) 为 totalSizeMB (字符串)
    const totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);

    return Response.json({
      success: true,
      stats: {
        imageCount: stats.imageCount,
        totalSizeMB,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return Response.json(
      { error: '获取统计信息失败' },
      { status: 500 }
    );
  }
}
