/**
 * 密码登录端点
 *
 * 允许通过 Cloudflare Pages Functions 进行密码验证并创建 session
 */

/// <reference types="@cloudflare/workers-types" />

import { createSession, getSessionSecret } from '../../lib/auth-helpers';
import { getUserByEmail } from '../../lib/db-queries';
import type { D1Database } from '../../lib/db-queries';
import type { User } from '../../lib/db-types';

interface PasswordLoginRequest {
  username?: string;
  password?: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

const PASSWORD_HASH_PREFIX = 'pbkdf2_sha256';
const PASSWORD_ITERATIONS = 100000;
const PASSWORD_KEY_LENGTH = 256;
const PASSWORD_SALT_BYTES = 16;

function toBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function derivePasswordBits(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  return await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    PASSWORD_KEY_LENGTH
  );
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const derived = await derivePasswordBits(password, salt, PASSWORD_ITERATIONS);
  return [
    PASSWORD_HASH_PREFIX,
    PASSWORD_ITERATIONS,
    toBase64(salt),
    toBase64(derived),
  ].join('$');
}

async function verifyPasswordHash(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 4) {
    return false;
  }

  const [prefix, iterationsRaw, saltBase64, expectedHash] = parts;
  if (prefix !== PASSWORD_HASH_PREFIX) {
    return false;
  }

  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const salt = fromBase64(saltBase64);
  const derived = await derivePasswordBits(password, salt, iterations);
  return safeCompare(toBase64(derived), expectedHash);
}

function getRequiredOwnerEmail(env: Env): string {
  const ownerEmail = env.OWNER_EMAIL?.trim();
  if (!ownerEmail) {
    throw new Error('Missing OWNER_EMAIL environment variable');
  }
  return ownerEmail;
}

function resolveAdminEmail(username: string, env: Env): string {
  const ownerEmail = (env.OWNER_EMAIL || '').trim();
  if (ownerEmail) {
    return normalize(ownerEmail);
  }
  if (username.includes('@')) {
    return normalize(username);
  }
  return `${normalize(username)}@password-login.local`;
}

async function createAdminUser(
  db: D1Database,
  email: string,
  username: string,
  passwordHash: string
): Promise<User> {
  const providerId = `password:${normalize(username)}`;
  const inserted = await db
    .prepare(
      `INSERT INTO users (id, email, name, avatar, provider, provider_id, password_hash)
       VALUES (lower(hex(randomblob(16))), ?, ?, NULL, 'password', ?, ?)
       RETURNING *`
    )
    .bind(email, username || 'admin', providerId, passwordHash)
    .first<User>();

  if (!inserted) {
    throw new Error('Failed to create admin user');
  }
  return inserted;
}

async function updateUserPasswordHash(
  db: D1Database,
  userId: string,
  passwordHash: string
): Promise<User> {
  const updated = await db
    .prepare(
      `UPDATE users
       SET password_hash = ?, updated_at = unixepoch()
       WHERE id = ?
       RETURNING *`
    )
    .bind(passwordHash, userId)
    .first<User>();

  if (!updated) {
    throw new Error('Failed to update password hash');
  }
  return updated;
}

export async function onRequestPost(
  context: EventContext<Env, never, Record<string, unknown>>
) {
  try {
    let payload: PasswordLoginRequest;
    try {
      payload = (await context.request.json()) as PasswordLoginRequest;
    } catch {
      return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const usernameInput =
      typeof payload.username === 'string' ? payload.username.trim() : '';
    const passwordInput =
      typeof payload.password === 'string' ? payload.password : '';

    if (!usernameInput || passwordInput.length === 0) {
      return Response.json(
        { error: '用户名和密码均为必填项' },
        { status: 400 }
      );
    }

    const normalizedUsername = normalize(usernameInput);
    const ownerEmail = getRequiredOwnerEmail(context.env);
    if (normalizedUsername !== normalize(ownerEmail)) {
      return Response.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const adminEmail = resolveAdminEmail(usernameInput, context.env);
    let user = await getUserByEmail(context.env.DB, adminEmail);

    if (!user) {
      const passwordHash = await hashPassword(passwordInput);
      user = await createAdminUser(
        context.env.DB,
        adminEmail,
        usernameInput,
        passwordHash
      );
    } else {
      if (!user.password_hash) {
        const passwordHash = await hashPassword(passwordInput);
        user = await updateUserPasswordHash(
          context.env.DB,
          user.id,
          passwordHash
        );
      } else {
        const isValid = await verifyPasswordHash(
          passwordInput,
          user.password_hash
        );
        if (!isValid) {
          return Response.json(
            { error: '用户名或密码错误' },
            { status: 401 }
          );
        }
      }
    }

    const secret = getSessionSecret(context.env);
    const sessionCookie = await createSession(user.id, secret, {
      isAdmin: true,
    });

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.append('Set-Cookie', sessionCookie);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Password login error:', error);
    const isConfigError =
      error instanceof Error &&
      /OWNER_EMAIL environment/i.test(error.message);
    const message = isConfigError
      ? (error as Error).message
      : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
