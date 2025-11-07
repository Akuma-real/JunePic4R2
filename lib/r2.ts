/**
 * R2 存储工具（重构版）
 *
 * 删除全局单例，改用工厂函数和纯函数
 * 支持两种模式：
 * 1. Cloudflare R2Bucket binding（生产环境，推荐）
 * 2. S3 兼容 API（本地开发或 Next.js）
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { customAlphabet } from 'nanoid';

// 自定义 nanoid：16位长度，只包含英文大小写和数字
const nanoid = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  16
);

// ============================================================================
// 类型定义
// ============================================================================

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

export interface UploadOptions {
  filename: string;
  buffer: Buffer | ArrayBuffer;
  mimeType: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

export interface R2Object {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
  metadata?: Record<string, string>;
}

// ============================================================================
// 工厂函数：创建 S3 Client（用于 S3 兼容 API 模式）
// ============================================================================

/**
 * 从环境变量创建 R2 配置
 * 仅在需要时调用，不在模块顶层执行
 */
export function getR2ConfigFromEnv(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      'Missing R2 environment variables. Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME'
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl: process.env.R2_PUBLIC_URL || `https://${bucketName}.r2.dev`,
  };
}

/**
 * 创建 S3Client 实例
 * 用于本地开发或 Next.js 环境
 */
export function createR2Client(config: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

// ============================================================================
// R2Bucket 操作（Cloudflare Pages Functions 原生模式）
// ============================================================================

/**
 * 上传文件到 R2（使用 R2Bucket binding）
 * 推荐在 Cloudflare Pages Functions 中使用
 */
export async function uploadToR2Bucket(
  bucket: R2Bucket,
  options: UploadOptions,
  publicUrl: string
): Promise<UploadResult> {
  const { filename, buffer, mimeType, metadata = {} } = options;

  // 生成唯一的文件 key
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const uniqueId = nanoid();
  const key = `${uniqueId}.${ext}`;

  const arrayBuffer =
    buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

  await bucket.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: mimeType,
    },
    customMetadata: {
      originalFilename: filename,
      uploadedAt: new Date().toISOString(),
      ...metadata,
    },
  });

  return {
    key,
    url: `${publicUrl}/${key}`,
    size: arrayBuffer.byteLength,
  };
}

/**
 * 从 R2 删除文件（使用 R2Bucket binding）
 */
export async function deleteFromR2Bucket(
  bucket: R2Bucket,
  key: string
): Promise<void> {
  await bucket.delete(key);
}

/**
 * 批量删除文件（使用 R2Bucket binding）
 */
export async function deleteBatchFromR2Bucket(
  bucket: R2Bucket,
  keys: string[]
): Promise<void> {
  await Promise.all(keys.map((key) => bucket.delete(key)));
}

/**
 * 获取文件（使用 R2Bucket binding）
 */
export async function getFromR2Bucket(
  bucket: R2Bucket,
  key: string
): Promise<ArrayBuffer> {
  const object = await bucket.get(key);
  if (!object) {
    throw new Error(`File not found: ${key}`);
  }
  return await object.arrayBuffer();
}

/**
 * 列出所有对象（使用 R2Bucket binding）
 */
export async function listAllFromR2Bucket(
  bucket: R2Bucket
): Promise<R2Object[]> {
  const objects: R2Object[] = [];
  let cursor: string | undefined;

  do {
    const listed = await bucket.list({ cursor, limit: 1000 });

    for (const obj of listed.objects) {
      objects.push({
        key: obj.key,
        size: obj.size,
        lastModified: obj.uploaded,
        contentType: obj.httpMetadata?.contentType,
        metadata: obj.customMetadata,
      });
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  return objects;
}

// ============================================================================
// S3 Client 操作（兼容模式，用于本地开发或 Next.js）
// ============================================================================

/**
 * 上传文件到 R2（使用 S3Client）
 * 用于本地开发或 Next.js 环境
 */
export async function uploadToR2(
  client: S3Client,
  bucketName: string,
  options: UploadOptions,
  publicUrl: string
): Promise<UploadResult> {
  const { filename, buffer, mimeType, metadata = {} } = options;

  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const uniqueId = nanoid();
  const key = `${uniqueId}.${ext}`;

  const bodyBuffer = buffer instanceof Buffer
    ? buffer
    : Buffer.from(buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: bodyBuffer,
    ContentType: mimeType,
    Metadata: {
      originalFilename: filename,
      uploadedAt: new Date().toISOString(),
      ...metadata,
    },
  });

  await client.send(command);

  return {
    key,
    url: `${publicUrl}/${key}`,
    size: bodyBuffer.length,
  };
}

/**
 * 从 R2 删除文件（使用 S3Client）
 */
export async function deleteFromR2(
  client: S3Client,
  bucketName: string,
  key: string
): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  await client.send(command);
}

/**
 * 批量删除文件（使用 S3Client）
 */
export async function deleteBatchFromR2(
  client: S3Client,
  bucketName: string,
  keys: string[]
): Promise<void> {
  await Promise.all(keys.map((key) => deleteFromR2(client, bucketName, key)));
}

/**
 * 获取文件（使用 S3Client）
 */
export async function getFromR2(
  client: S3Client,
  bucketName: string,
  key: string
): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const response = await client.send(command);

  if (!response.Body) {
    throw new Error('No file body returned');
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * 列出所有对象（使用 S3Client）
 */
export async function listAllFromR2(
  client: S3Client,
  bucketName: string
): Promise<R2Object[]> {
  const objects: R2Object[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
    });

    const response = await client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          // 获取对象的详细信息
          const headCommand = new HeadObjectCommand({
            Bucket: bucketName,
            Key: obj.Key,
          });

          const headResponse = await client.send(headCommand);

          objects.push({
            key: obj.Key,
            size: obj.Size || 0,
            lastModified: obj.LastModified || new Date(),
            contentType: headResponse.ContentType,
            metadata: headResponse.Metadata,
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}
