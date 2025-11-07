/**
 * 图片列表 API
 *
 * GET /api/images - 获取当前用户的图片列表
 */

/// <reference types="@cloudflare/workers-types" />

import { verifySession, getSessionSecret } from '../../lib/auth-helpers';
import { getImagesByUserId, getUserStats } from '../../lib/db-queries';

export async function onRequestGet(context: EventContext<Env, never, Record<string, unknown>>) {
  try {
    // 验证 session
    const secret = getSessionSecret(context.env);
    const session = await verifySession(context.request, secret);

    if (!session) {
      return Response.json({ error: '未授权访问' }, { status: 401 });
    }

    // 获取查询参数
    const url = new URL(context.request.url);
    const rawLimit = url.searchParams.get('limit');
    const rawOffset = url.searchParams.get('offset');
    let limit = Number.parseInt(rawLimit || '50', 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 50;
    limit = Math.min(limit, 100);
    let offset = Number.parseInt(rawOffset || '0', 10);
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    // 并行查询图片和统计信息
    const [images, stats] = await Promise.all([
      getImagesByUserId(context.env.DB, session.userId, limit, offset),
      getUserStats(context.env.DB, session.userId),
    ]);

    return Response.json({
      success: true,
      images,
      pagination: {
        limit,
        offset,
        total: stats.imageCount,
      },
      stats,
    });
  } catch (error) {
    console.error('Get images error:', error);
    return Response.json(
      { error: '获取图片列表失败' },
      { status: 500 }
    );
  }
}
