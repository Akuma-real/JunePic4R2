/**
 * 同步 API
 *
 * POST /api/sync - 同步 R2 中的文件到数据库
 */

/// <reference types="@cloudflare/workers-types" />

import { verifySession, getSessionSecret } from '../../../lib/auth-helpers';
import {
  getImageByStorageKey,
  createImage,
} from '../../../lib/db-queries';
import { listAllFromR2Bucket } from '../../../lib/r2';
import { nanoid } from 'nanoid';

export async function onRequestPost(context: EventContext<Env, never, Record<string, unknown>>) {
  try {
    // 验证 session
    const secret = getSessionSecret(context.env);
    const session = await verifySession(context.request, secret);

    if (!session) {
      return Response.json({ error: '未授权访问' }, { status: 401 });
    }

    // 列出 R2 中的所有对象
    const r2Objects = await listAllFromR2Bucket(context.env.R2_BUCKET);

    let addedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    const publicUrl = context.env.R2_PUBLIC_URL || context.env.APP_URL;

    // 逐个检查并添加
    for (const obj of r2Objects) {
      try {
        // 检查数据库中是否已存在
        const existingImage = await getImageByStorageKey(
          context.env.DB,
          obj.key
        );

        if (existingImage) {
          skippedCount++;
          continue;
        }

        // 从 metadata 中获取原始文件名
        const originalFilename =
          obj.metadata?.originalFilename || obj.key.split('/').pop() || obj.key;

        // 获取文件扩展名
        const ext = originalFilename.split('.').pop()?.toLowerCase() || 'jpg';
        const format = ext;
        const mimeType = obj.contentType || `image/${ext}`;

        // 创建图片记录
        await createImage(context.env.DB, {
          id: nanoid(),
          user_id: session.userId,
          filename: originalFilename,
          storage_key: obj.key,
          file_size: obj.size,
          width: null,
          height: null,
          format,
          mime_type: mimeType,
          is_compressed: 0,
          compression_quality: null,
          original_size: null,
          url: `${publicUrl}/${obj.key}`,
        });

        addedCount++;
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : String(error);
        console.error(`Error syncing ${obj.key}:`, error);
        errors.push(`${obj.key}: ${errMsg}`);
      }
    }

    return Response.json({
      stats: {
        total: r2Objects.length,
        added: addedCount,
        skipped: skippedCount,
        errors: errors.length,
      },
    });
  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ error: '同步失败' }, { status: 500 });
  }
}
