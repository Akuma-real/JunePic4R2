/**
 * Catch-all 路由 - 从 R2 提供静态文件
 *
 * 只匹配图片文件（.jpg, .png, .gif, .webp 等）
 */

/// <reference types="@cloudflare/workers-types" />

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'];

export async function onRequest(context: EventContext<Env, never, Record<string, unknown>>) {
  const url = new URL(context.request.url);
  const path = url.pathname.slice(1); // 移除开头的 /

  // 检查是否是图片文件
  const isImageFile = IMAGE_EXTENSIONS.some(ext =>
    path.toLowerCase().endsWith(ext)
  );

  // 如果不是图片文件，跳过此路由（让其他处理器处理）
  if (!isImageFile) {
    return context.next();
  }

  try {
    // 尝试从 R2 获取文件
    const object = await context.env.R2_BUCKET.get(path);

    if (!object) {
      return new Response('File not found', { status: 404 });
    }

    // 返回文件内容
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000',
        'ETag': object.httpEtag,
      },
    });
  } catch (error) {
    console.error('R2 proxy error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
