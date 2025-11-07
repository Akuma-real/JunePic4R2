/**
 * 批量上传 API
 *
 * POST /api/upload-batch - 批量上传图片
 *
 * 注意：Cloudflare Workers 不支持 sharp 库（Node.js native 模块）
 * 图片压缩功能已移除，建议在客户端进行压缩
 */

/// <reference types="@cloudflare/workers-types" />

import { verifySession, getSessionSecret } from '../../../lib/auth-helpers';
import { createImage } from '../../../lib/db-queries';
import { uploadToR2Bucket, deleteFromR2Bucket } from '../../../lib/r2';
import { nanoid } from 'nanoid';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];
const MAX_BATCH_SIZE = 20; // 最多一次上传 20 张图片

interface UploadedImage {
  id: string;
  url: string;
  filename: string;
  size: number;
  format: string;
  createdAt: number;
}

interface UploadError {
  filename: string;
  error: string;
}

async function processImage(
  file: File,
  userId: string,
  bucket: R2Bucket,
  db: D1Database,
  publicUrl: string
): Promise<UploadedImage> {
  // 验证文件类型
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`不支持的文件类型：${file.type}`);
  }

  // 验证文件大小
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `文件过大：${(file.size / 1024 / 1024).toFixed(2)}MB`
    );
  }

  // 读取文件
  const arrayBuffer = await file.arrayBuffer();

  // 上传到 R2
  const uploadResult = await uploadToR2Bucket(
    bucket,
    {
      filename: file.name,
      buffer: arrayBuffer,
      mimeType: file.type,
      metadata: {
        userId,
        originalFilename: file.name,
      },
    },
    publicUrl
  );

  // 保存到数据库
  const imageId = nanoid();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';

  try {
    const savedImage = await createImage(db, {
      id: imageId,
      user_id: userId,
      filename: file.name,
      storage_key: uploadResult.key,
      file_size: file.size,
      width: null,
      height: null,
      format: ext,
      mime_type: file.type,
      is_compressed: 0,
      compression_quality: null,
      original_size: null,
      url: uploadResult.url,
    });

    return {
      id: savedImage.id,
      url: savedImage.url,
      filename: savedImage.filename,
      size: savedImage.file_size,
      format: savedImage.format,
      createdAt: savedImage.created_at,
    };
  } catch (dbError) {
    // 数据库失败，清理 R2
    try {
      await deleteFromR2Bucket(bucket, uploadResult.key);
    } catch (cleanupError) {
      console.error('Failed to cleanup R2:', cleanupError);
    }
    throw dbError;
  }
}

export async function onRequestPost(context: EventContext<Env, never, Record<string, unknown>>) {
  try {
    // 验证 session
    const secret = getSessionSecret(context.env);
    const session = await verifySession(context.request, secret);

    if (!session) {
      return Response.json({ error: '未授权访问' }, { status: 401 });
    }

    // 解析 FormData
    const formData = await context.request.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return Response.json({ error: '未找到文件' }, { status: 400 });
    }

    if (files.length > MAX_BATCH_SIZE) {
      return Response.json(
        { error: `一次最多上传 ${MAX_BATCH_SIZE} 个文件` },
        { status: 400 }
      );
    }

    // 处理所有文件
    const results: UploadedImage[] = [];
    const errors: UploadError[] = [];

    const publicUrl = context.env.R2_PUBLIC_URL || context.env.APP_URL;

    await Promise.allSettled(
      files.map(async (file) => {
        try {
          const result = await processImage(
            file,
            session.userId,
            context.env.R2_BUCKET,
            context.env.DB,
            publicUrl
          );
          results.push(result);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : '上传失败';
          console.error(`Failed to upload ${file.name}:`, error);
          errors.push({
            filename: file.name,
            error: errorMessage,
          });
        }
      })
    );

    return Response.json({
      success: results.length > 0,
      uploaded: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (error) {
    console.error('Batch upload error:', error);
    return Response.json(
      { error: '批量上传失败，请稍后重试' },
      { status: 500 }
    );
  }
}
