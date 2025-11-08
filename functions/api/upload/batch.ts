/**
 * 批量上传 API
 *
 * POST /api/upload/batch - 批量上传图片
 *
 * 注意：Cloudflare Workers 不支持 sharp 库（Node.js native 模块）
 * 图片压缩功能已移除，建议在客户端进行压缩
 */

/// <reference types="@cloudflare/workers-types" />

import { verifySession, getSessionSecret } from '../../../lib/auth-helpers';
import { processAndSaveImage } from '../../../lib/server-upload';
import { resolveUploadToken } from '../../../lib/upload-tokens';

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

async function authenticateRequest(request: Request, env: Env) {
  const secret = getSessionSecret(env);
  const session = await verifySession(request, secret);

  if (session) {
    return { userId: session.userId };
  }

  const tokenResult = await resolveUploadToken(request, env.DB);
  if (tokenResult) {
    return { userId: tokenResult.userId };
  }

  return null;
}

export async function onRequestPost(context: EventContext<Env, never, Record<string, unknown>>) {
  try {
    const auth = await authenticateRequest(context.request, context.env);

    if (!auth) {
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
          const result = await processAndSaveImage(
            file,
            auth.userId,
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
