/**
 * 认证工具（Session 管理）
 *
 * 使用 Web Crypto API 实现加密的 session cookie
 * 兼容 Cloudflare Workers 和 Next.js
 */

const SESSION_COOKIE_NAME = 'junepic_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

interface SessionData {
  userId: string;
  expiresAt: number;
  isAdmin?: boolean;
}

// ============================================================================
// 加密/解密工具
// ============================================================================

/**
 * 从密钥生成 CryptoKey
 */
async function getEncryptionKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('junepic-salt'), // 固定 salt（生产环境应该用配置）
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 加密 session 数据
 */
async function encryptSession(
  data: SessionData,
  secret: string
): Promise<string> {
  const key = await getEncryptionKey(secret);
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encoder.encode(JSON.stringify(data))
  );

  // 组合 iv 和加密数据，转为 base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * 解密 session 数据
 */
async function decryptSession(
  encryptedData: string,
  secret: string
): Promise<SessionData | null> {
  try {
    const key = await getEncryptionKey(secret);
    const combined = Uint8Array.from(atob(encryptedData), (c) =>
      c.charCodeAt(0)
    );

    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    const data = JSON.parse(decoder.decode(decrypted)) as SessionData;

    // 检查是否过期
    if (data.expiresAt < Date.now()) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Session decryption failed:', error);
    return null;
  }
}

// ============================================================================
// Session 管理（Cloudflare Workers / Web Standard API）
// ============================================================================

/**
 * 创建 session cookie
 * 返回 Set-Cookie header 的值
 */
export async function createSession(
  userId: string,
  secret: string,
  options?: {
    isSecure?: boolean;
    isAdmin?: boolean;
  }
): Promise<string> {
  const sessionData: SessionData = {
    userId,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
    isAdmin: options?.isAdmin ?? false,
  };

  const encrypted = await encryptSession(sessionData, secret);

  const cookie = [
    `${SESSION_COOKIE_NAME}=${encrypted}`,
    `Max-Age=${SESSION_MAX_AGE}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  const isSecure = options?.isSecure ?? true;
  if (isSecure) {
    cookie.push('Secure');
  }

  return cookie.join('; ');
}

/**
 * 从 Request 中验证并获取 session
 */
export async function verifySession(
  request: Request,
  secret: string
): Promise<{ userId: string; isAdmin: boolean } | null> {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return null;
  }

  // 解析 cookie（对分隔符更宽松，去除空白）
  const cookies = Object.fromEntries(
    cookieHeader
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const [key, ...values] = c.split('=');
        return [key, values.join('=')];
      })
  );

  const sessionCookie = cookies[SESSION_COOKIE_NAME];
  if (!sessionCookie) {
    return null;
  }

  const sessionData = await decryptSession(sessionCookie, secret);
  if (!sessionData) {
    return null;
  }

  return { userId: sessionData.userId, isAdmin: !!sessionData.isAdmin };
}

/**
 * 删除 session cookie
 * 返回 Set-Cookie header 的值
 */
export function deleteSession(isSecure = true): string {
  const attrs = ['Max-Age=0', 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (isSecure) attrs.push('Secure');
  return `${SESSION_COOKIE_NAME}=; ${attrs.join('; ')}`;
}

// ============================================================================
// Session 管理（Next.js 兼容版本）
// ============================================================================

/**
 * 从 Next.js cookies() 中验证 session
 */
export async function verifySessionFromCookies(
  getCookie: (name: string) => { value: string } | undefined,
  secret: string
): Promise<{ userId: string; isAdmin: boolean } | null> {
  const sessionCookie = getCookie(SESSION_COOKIE_NAME);
  if (!sessionCookie) {
    return null;
  }

  const sessionData = await decryptSession(sessionCookie.value, secret);
  if (!sessionData) {
    return null;
  }

  return { userId: sessionData.userId, isAdmin: !!sessionData.isAdmin };
}

// ============================================================================
// 环境变量工具
// ============================================================================

/**
 * 获取 session 密钥
 * 优先从环境变量读取,如果不存在则抛出错误
 * 兼容 Cloudflare Workers (Env) 和 Next.js (process.env)
 */
export function getSessionSecret(env?: Partial<Env> | typeof process.env): string {
  const secret = env?.SESSION_SECRET || process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error(
      'SESSION_SECRET or NEXTAUTH_SECRET environment variable is required'
    );
  }

  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long');
  }

  return secret;
}
