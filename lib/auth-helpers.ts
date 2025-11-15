/**
 * 认证工具（Session 管理）
 *
 * 使用 Web Crypto API 实现加密的 session cookie
 * 兼容 Cloudflare Workers 和 Next.js
 */

const SESSION_COOKIE_NAME = 'junepic_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
const FALSE_BOOLEAN_VALUE = /^(false|0|no)$/i;

let cachedSecureCookies: boolean | null = null;

interface SessionData {
  userId: string;
  expiresAt: number;
  isAdmin?: boolean;
}

/**
 * 获取 PBKDF2 盐值（向后兼容）
 * 新版本使用固定空字符串，为兼容性保留此函数
 */
function getPBKDF2Salt(
  env?: Partial<Env> | typeof process.env
): string {
  // 检查是否有旧的 SESSION_SALT（向后兼容）
  const candidate =
    env?.SESSION_SALT ??
    (typeof process !== 'undefined' ? process.env?.SESSION_SALT : undefined);

  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate.trim();
  }

  // 新版本使用固定空字符串
  return '';
}

function parseSecureCookiesFlag(value?: string | null): boolean | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return !FALSE_BOOLEAN_VALUE.test(value.trim());
}

function ensureSecureCookiesPreference(
  env?: Partial<Env> | typeof process.env
): boolean {
  const raw =
    env?.SECURE_COOKIES ??
    (typeof process !== 'undefined' ? process.env?.SECURE_COOKIES : undefined);

  const parsed = parseSecureCookiesFlag(raw ?? null);
  if (parsed !== null) {
    cachedSecureCookies = parsed;
    return parsed;
  }

  if (typeof cachedSecureCookies === 'boolean') {
    return cachedSecureCookies;
  }

  cachedSecureCookies = true;
  return cachedSecureCookies;
}

// ============================================================================
// 加密/解密工具
// ============================================================================

/**
 * 从密钥生成 CryptoKey
 */
async function getEncryptionKey(
  secret: string,
  env?: Partial<Env> | typeof process.env
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const salt = getPBKDF2Salt(env);
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
      salt: encoder.encode(salt),
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
  secret: string,
  env?: Partial<Env> | typeof process.env
): Promise<string> {
  const key = await getEncryptionKey(secret, env);
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
  secret: string,
  env?: Partial<Env> | typeof process.env
): Promise<SessionData | null> {
  try {
    const key = await getEncryptionKey(secret, env);
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
  optionsOrEnv?: {
    isSecure?: boolean;
    isAdmin?: boolean;
  } | (Partial<Env> | typeof process.env),
  maybeOptions?: {
    isSecure?: boolean;
    isAdmin?: boolean;
  }
): Promise<string> {
  // 处理参数兼容性：如果第二个参数是对象且包含 isAdmin/isSecure，则视为 options
  let env: Partial<Env> | typeof process.env | undefined;
  let options: { isSecure?: boolean; isAdmin?: boolean } | undefined;

  if (optionsOrEnv && typeof optionsOrEnv === 'object') {
    // 检查是否是 options 对象
    if ('isAdmin' in optionsOrEnv || 'isSecure' in optionsOrEnv) {
      options = optionsOrEnv as { isSecure?: boolean; isAdmin?: boolean };
    } else {
      // 否则视为 env
      env = optionsOrEnv as Partial<Env> | typeof process.env;
    }
  }

  if (maybeOptions) {
    options = maybeOptions;
  }

  const sessionData: SessionData = {
    userId,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
    isAdmin: options?.isAdmin ?? false,
  };

  const encrypted = await encryptSession(sessionData, secret, env);

  const cookie = [
    `${SESSION_COOKIE_NAME}=${encrypted}`,
    `Max-Age=${SESSION_MAX_AGE}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  const isSecure =
    options?.isSecure ?? ensureSecureCookiesPreference(env);
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
  secret: string,
  env?: Partial<Env> | typeof process.env
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

  const sessionData = await decryptSession(sessionCookie, secret, env);
  if (!sessionData) {
    return null;
  }

  return { userId: sessionData.userId, isAdmin: !!sessionData.isAdmin };
}

/**
 * 删除 session cookie
 * 返回 Set-Cookie header 的值
 */
export function deleteSession(
  isSecure?: boolean,
  env?: Partial<Env> | typeof process.env
): string {
  const attrs = ['Max-Age=0', 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  const resolvedSecure =
    typeof isSecure === 'boolean'
      ? isSecure
      : ensureSecureCookiesPreference(env);
  if (resolvedSecure) attrs.push('Secure');
  return `${SESSION_COOKIE_NAME}=; ${attrs.join('; ')}`;
}

export function getSecureCookiePreference(
  env?: Partial<Env> | typeof process.env
): boolean {
  return ensureSecureCookiesPreference(env);
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
  const secret =
    env?.SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error(
      'SESSION_SECRET or NEXTAUTH_SECRET environment variable is required'
    );
  }

  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long');
  }

  ensureSecureCookiesPreference(env);

  return secret;
}
