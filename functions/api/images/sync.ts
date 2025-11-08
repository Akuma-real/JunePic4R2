/**
 * 同步 API
 *
 * POST /api/images/sync - 从 R2 扫描并回填数据库（管理员）
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
    if (!session.isAdmin) {
      return Response.json({ error: '需要管理员权限' }, { status: 403 });
    }

    // 列出 R2 中的所有对象
    const r2Objects = await listAllFromR2Bucket(context.env.R2_BUCKET);

    let addedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    const publicUrl = context.env.R2_PUBLIC_URL || context.env.APP_URL;

    // 逐个检查并添加
    const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

    const normalizeMime = (mime?: string): string | undefined => {
      if (!mime) return undefined;
      const lower = mime.toLowerCase();
      if (lower === 'image/jpg') return 'image/jpeg';
      return lower;
    };
    for (const obj of r2Objects) {
      try {
        // 单用户模式：若缺少 userId metadata，则默认归属为当前登录用户
        const ownerId = obj.metadata?.userId || session.userId;

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

        // 获取文件扩展名并标准化（jpg -> jpeg）
        const rawExt = originalFilename.split('.').pop()?.toLowerCase() || 'jpg';
        const ext = rawExt === 'jpg' ? 'jpeg' : rawExt;
        const format = ext;
        const mimeType = normalizeMime(obj.contentType) || `image/${ext}`;

        // 过滤非受支持的类型（保持与上传接口一致）
        if (!ALLOWED_TYPES.has(mimeType)) {
          skippedCount++;
          continue;
        }

        const createdAt = (() => {
          const uploadedAtMeta = obj.metadata?.uploadedAt;
          const parsed = uploadedAtMeta ? Date.parse(uploadedAtMeta) : NaN;
          if (!Number.isNaN(parsed)) {
            return Math.floor(parsed / 1000);
          }
          return Math.floor(obj.lastModified.getTime() / 1000);
        })();

        // 创建图片记录
        await createImage(context.env.DB, {
          id: nanoid(),
          user_id: ownerId,
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
          created_at: createdAt,
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
      errors,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ error: '同步失败' }, { status: 500 });
  }
}
