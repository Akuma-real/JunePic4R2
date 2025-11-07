/// <reference types="@cloudflare/workers-types" />

/**
 * 服务器端上传与入库的共用逻辑（Cloudflare Pages Functions）
 */

import { createImage } from './db-queries';
import { uploadToR2Bucket, deleteFromR2Bucket } from './r2';
import { nanoid } from 'nanoid';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export interface UploadedImage {
  id: string;
  url: string;
  filename: string;
  size: number;
  format: string;
  createdAt: number;
}

export async function processAndSaveImage(
  file: File,
  userId: string,
  bucket: R2Bucket,
  db: D1Database,
  publicUrl: string
): Promise<UploadedImage> {
  // 类型校验
  if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
    throw new Error(`不支持的文件类型：${file.type}`);
  }

  // 大小校验
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`文件过大：${(file.size / 1024 / 1024).toFixed(2)}MB`);
  }

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

  // 入库
  const imageId = nanoid();
  const rawExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const ext = rawExt === 'jpg' ? 'jpeg' : rawExt;
  const normalizedMime = (file.type || '').toLowerCase() === 'image/jpg' ? 'image/jpeg' : file.type;

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
      mime_type: normalizedMime,
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
    // 数据库失败，回滚 R2
    try {
      await deleteFromR2Bucket(bucket, uploadResult.key);
    } catch (cleanupError) {
      console.error('Failed to cleanup R2:', cleanupError);
    }
    throw dbError;
  }
}
