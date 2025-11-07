/**
 * 单个图片 API
 *
 * GET /api/images/[id] - 获取图片信息
 * DELETE /api/images/[id] - 删除图片
 */

/// <reference types="@cloudflare/workers-types" />

import { verifySession, getSessionSecret } from '../../../lib/auth-helpers';
import { getImageById, deleteImage } from '../../../lib/db-queries';
import { deleteFromR2Bucket } from '../../../lib/r2';

export async function onRequestGet(context: EventContext<Env, "id", Record<string, unknown>>) {
  try {
    // 验证 session
    const secret = getSessionSecret(context.env);
    const session = await verifySession(context.request, secret);

    if (!session) {
      return Response.json({ error: '未授权访问' }, { status: 401 });
    }

    // 获取图片 ID
    const imageId = context.params.id as string;

    // 获取图片信息
    const image = await getImageById(context.env.DB, imageId);

    if (!image) {
      return Response.json({ error: '图片不存在' }, { status: 404 });
    }

    // 验证权限
    if (image.user_id !== session.userId) {
      return Response.json({ error: '无权访问此图片' }, { status: 403 });
    }

    return Response.json({
      success: true,
      image,
    });
  } catch (error) {
    console.error('Get image error:', error);
    return Response.json(
      { error: '获取图片信息失败' },
      { status: 500 }
    );
  }
}

export async function onRequestDelete(context: EventContext<Env, "id", Record<string, unknown>>) {
  try {
    // 验证 session
    const secret = getSessionSecret(context.env);
    const session = await verifySession(context.request, secret);

    if (!session) {
      return Response.json({ error: '未授权访问' }, { status: 401 });
    }

    // 获取图片 ID
    const imageId = context.params.id as string;

    // 获取图片信息
    const image = await getImageById(context.env.DB, imageId);

    if (!image) {
      return Response.json({ error: '图片不存在' }, { status: 404 });
    }

    // 验证权限
    if (image.user_id !== session.userId) {
      return Response.json({ error: '无权删除此图片' }, { status: 403 });
    }

    // 先删除 R2 文件
    try {
      await deleteFromR2Bucket(context.env.R2_BUCKET, image.storage_key);
    } catch (error) {
      console.error('Error deleting from R2:', error);
      // 继续删除数据库记录（Linus 会说这里需要事务）
    }

    // 删除数据库记录
    await deleteImage(context.env.DB, imageId);

    return Response.json({
      success: true,
      message: '图片已删除',
    });
  } catch (error) {
    console.error('Delete image error:', error);
    return Response.json(
      { error: '删除图片失败' },
      { status: 500 }
    );
  }
}
