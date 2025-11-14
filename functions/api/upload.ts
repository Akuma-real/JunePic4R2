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
import { processAndSaveImage, ALLOWED_TYPES, MAX_FILE_SIZE } from '../../lib/server-upload';
import { resolveUploadToken } from '../../lib/upload-tokens';
import { resolvePublicBaseUrl } from '../_url';

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
    // 1. 验证 session 或 token
    const auth = await authenticateRequest(context.request, context.env);

    if (!auth) {
      return Response.json({ error: '未授权访问' }, { status: 401 });
    }

    // 2. 解析 FormData
    const formData = await context.request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return Response.json({ error: '未找到文件' }, { status: 400 });
    }

    // 3. 验证文件类型（SVG 已禁用）
    if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
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

    // 5. 处理上传与入库（共用逻辑）
    const publicUrl = resolvePublicBaseUrl(context.env, context.request);
    const result = await processAndSaveImage(
      file,
      auth.userId,
      context.env.R2_BUCKET,
      context.env.DB,
      publicUrl
    );

    // 8. 返回成功响应
    return Response.json({
      success: true,
      image: result,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { error: '上传失败，请稍后重试' },
      { status: 500 }
    );
  }
}
