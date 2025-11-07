/**
 * 纯函数数据库查询层
 *
 * 所有函数接受 D1Database 作为参数，不持有状态
 * 适用于 Cloudflare Pages Functions 和本地 Wrangler 开发
 */

import type { User, Image } from './db-types';

/**
 * D1 接口定义（与 @cloudflare/workers-types 兼容）
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta?: {
    duration?: number;
    rows_read?: number;
    rows_written?: number;
  };
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

// ============================================================================
// User Queries
// ============================================================================

/**
 * 从 GitHub 数据创建或更新用户（UPSERT）
 * 消除了 lib/auth.ts 中的重复代码
 */
export async function upsertUserFromGitHub(
  db: D1Database,
  data: {
    email: string;
    name: string | null;
    avatar: string | null;
    providerId: string;
  }
): Promise<User> {
  const result = await db
    .prepare(
      `INSERT INTO users (id, email, name, avatar, provider, provider_id)
       VALUES (lower(hex(randomblob(16))), ?, ?, ?, 'github', ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         avatar = excluded.avatar,
         updated_at = unixepoch()
       RETURNING *`
    )
    .bind(data.email, data.name, data.avatar, data.providerId)
    .first<User>();

  if (!result) {
    throw new Error('Failed to upsert user');
  }
  return result;
}

/**
 * 通过邮箱查询用户
 */
export async function getUserByEmail(
  db: D1Database,
  email: string
): Promise<User | null> {
  return await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<User>();
}

/**
 * 通过 ID 查询用户
 */
export async function getUserById(
  db: D1Database,
  id: string
): Promise<User | null> {
  return await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<User>();
}

// ============================================================================
// Image Queries
// ============================================================================

/**
 * 创建图片记录
 */
export async function createImage(
  db: D1Database,
  image: Omit<Image, 'created_at'> & { created_at?: number }
): Promise<Image> {
  const result = await db
    .prepare(
      `INSERT INTO images
       (id, user_id, filename, storage_key, file_size, width, height, format, mime_type,
        is_compressed, compression_quality, original_size, url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, unixepoch()))
       RETURNING *`
    )
    .bind(
      image.id,
      image.user_id,
      image.filename,
      image.storage_key,
      image.file_size,
      image.width,
      image.height,
      image.format,
      image.mime_type,
      image.is_compressed,
      image.compression_quality,
      image.original_size,
      image.url,
      image.created_at ?? null
    )
    .first<Image>();

  if (!result) {
    throw new Error('Failed to create image');
  }
  return result;
}

/**
 * 查询用户的图片列表（分页）
 */
export async function getImagesByUserId(
  db: D1Database,
  userId: string,
  limit = 50,
  offset = 0
): Promise<Image[]> {
  const result = await db
    .prepare(
      'SELECT * FROM images WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
    .bind(userId, limit, offset)
    .all<Image>();

  return result.results;
}

/**
 * 通过 ID 查询图片
 */
export async function getImageById(
  db: D1Database,
  id: string
): Promise<Image | null> {
  return await db
    .prepare('SELECT * FROM images WHERE id = ?')
    .bind(id)
    .first<Image>();
}

/**
 * 通过 storage_key 查询图片
 */
export async function getImageByStorageKey(
  db: D1Database,
  storageKey: string
): Promise<Image | null> {
  return await db
    .prepare('SELECT * FROM images WHERE storage_key = ?')
    .bind(storageKey)
    .first<Image>();
}

/**
 * 删除图片记录
 */
export async function deleteImage(
  db: D1Database,
  id: string
): Promise<void> {
  await db
    .prepare('DELETE FROM images WHERE id = ?')
    .bind(id)
    .run();
}

// ============================================================================
// Statistics Queries
// ============================================================================

/**
 * 获取用户的统计信息
 */
export async function getUserStats(
  db: D1Database,
  userId: string
): Promise<{ imageCount: number; totalSize: number }> {
  const result = await db
    .prepare(
      `SELECT
        COUNT(*) as imageCount,
        COALESCE(SUM(file_size), 0) as totalSize
       FROM images
       WHERE user_id = ?`
    )
    .bind(userId)
    .first<{ imageCount: number; totalSize: number }>();

  return result || { imageCount: 0, totalSize: 0 };
}
