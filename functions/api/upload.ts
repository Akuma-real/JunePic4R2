/**
 * 上传 API
 *
 * POST /api/upload - 上传单个图片
 *
 * 注意：Cloudflare Workers 不支持 sharp 库（Node.js native 模块）
 * 图片压缩功能已移除，建议在客户端进行压缩
 */

/// <reference types="@cloudflare/workers-types" />

import { verifySession, getSessionSecret } from '../../lib/auth-helpers';
import { createImage } from '../../lib/db-queries';
import { uploadToR2Bucket, deleteFromR2Bucket } from '../../lib/r2';
import { nanoid } from 'nanoid';

// 配置
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

export async function onRequestPost(context: EventContext<Env, never, Record<string, unknown>>) {
  try {
    // 1. 验证 session
    const secret = getSessionSecret(context.env);
    const session = await verifySession(context.request, secret);

    if (!session) {
      return Response.json({ error: '未授权访问' }, { status: 401 });
    }

    // 2. 解析 FormData
    const formData = await context.request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return Response.json({ error: '未找到文件' }, { status: 400 });
    }

    // 3. 验证文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        {
          error: `不支持的文件类型。允许的类型：${ALLOWED_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 4. 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: `文件过大。最大允许大小：${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // 5. 读取文件为 ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // 6. 上传到 R2
    const publicUrl = context.env.R2_PUBLIC_URL || context.env.APP_URL;
    const uploadResult = await uploadToR2Bucket(
      context.env.R2_BUCKET,
      {
        filename: file.name,
        buffer: arrayBuffer,
        mimeType: file.type,
        metadata: {
          userId: session.userId,
          originalFilename: file.name,
        },
      },
      publicUrl
    );

    // 7. 保存到数据库（如果失败，清理 R2）
    const imageId = nanoid();
    let savedImage;

    try {
      // 获取文件扩展名作为格式
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';

      savedImage = await createImage(context.env.DB, {
        id: imageId,
        user_id: session.userId,
        filename: file.name,
        storage_key: uploadResult.key,
        file_size: file.size,
        width: null, // Cloudflare Workers 不支持图片元数据提取
        height: null,
        format: ext,
        mime_type: file.type,
        is_compressed: 0,
        compression_quality: null,
        original_size: null,
        url: uploadResult.url,
      });
    } catch (dbError) {
      // 数据库写入失败，清理 R2
      console.error('Database write failed, cleaning up R2:', dbError);
      try {
        await deleteFromR2Bucket(context.env.R2_BUCKET, uploadResult.key);
      } catch (cleanupError) {
        console.error(
          'Failed to cleanup R2 after database error:',
          cleanupError
        );
      }
      throw dbError;
    }

    // 8. 返回成功响应
    return Response.json({
      success: true,
      image: {
        id: savedImage.id,
        url: savedImage.url,
        filename: savedImage.filename,
        size: savedImage.file_size,
        format: savedImage.format,
        createdAt: savedImage.created_at,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { error: '上传失败，请稍后重试' },
      { status: 500 }
    );
  }
}
