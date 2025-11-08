import { nanoid } from 'nanoid';

export interface UploadTokenRecord {
  id: string;
  user_id: string;
  name: string;
  created_at: number;
  last_used_at: number | null;
  revoked: number;
}

export interface UploadTokenResponse {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
  revoked: boolean;
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function listUploadTokens(db: D1Database, userId: string): Promise<UploadTokenResponse[]> {
  const result = await db
    .prepare(
      `SELECT id, name, created_at, last_used_at, revoked
       FROM upload_tokens
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all<UploadTokenRecord>();

  if (!result.results) return [];

  return result.results.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? null,
    revoked: row.revoked === 1,
  }));
}

export async function createUploadToken(
  db: D1Database,
  userId: string,
  name: string
): Promise<{ token: string; record: UploadTokenResponse }> {
  const id = crypto.randomUUID();
  const token = nanoid(48);
  const tokenHash = await hashToken(token);

  await db
    .prepare(
      `INSERT INTO upload_tokens (id, user_id, name, token_hash)
       VALUES (?, ?, ?, ?)`
    )
    .bind(id, userId, name, tokenHash)
    .run();

  const record = {
    id,
    name,
    createdAt: Math.floor(Date.now() / 1000),
    lastUsedAt: null,
    revoked: false,
  } satisfies UploadTokenResponse;

  return { token, record };
}

export async function revokeUploadToken(db: D1Database, userId: string, tokenId: string) {
  await db
    .prepare(
      `UPDATE upload_tokens
       SET revoked = 1
       WHERE id = ? AND user_id = ?`
    )
    .bind(tokenId, userId)
    .run();
}

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (trimmed.toLowerCase().startsWith('bearer ')) {
    return trimmed.slice(7).trim();
  }
  return trimmed || null;
}

export async function resolveUploadToken(
  request: Request,
  db: D1Database
): Promise<{ userId: string; tokenId: string } | null> {
  const authHeader = request.headers.get('authorization');
  const tokenHeader = request.headers.get('x-upload-token');

  const token = extractBearerToken(authHeader) ?? (tokenHeader ? tokenHeader.trim() : null);

  if (!token) return null;

  const hash = await hashToken(token);
  const record = await db
    .prepare(
      `SELECT id, user_id, revoked
       FROM upload_tokens
       WHERE token_hash = ?`
    )
    .bind(hash)
    .first<{ id: string; user_id: string; revoked: number }>();

  if (!record || record.revoked === 1) return null;

  await db
    .prepare('UPDATE upload_tokens SET last_used_at = unixepoch() WHERE id = ?')
    .bind(record.id)
    .run();

  return { userId: record.user_id, tokenId: record.id };
}
