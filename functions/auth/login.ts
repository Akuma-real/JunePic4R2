/**
 * GitHub OAuth 登录端点
 *
 * 生成并设置 state 防 CSRF，重定向用户到 GitHub 授权页面
 */

/// <reference types="@cloudflare/workers-types" />

function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // base64url
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return b64;
}

export async function onRequestGet(context: EventContext<Env, never, Record<string, unknown>>) {
  const { GITHUB_CLIENT_ID, APP_URL, OWNER_EMAIL } = context.env;

  if (!GITHUB_CLIENT_ID || !APP_URL) {
    return Response.json(
      { error: 'OAuth configuration missing' },
      { status: 500 }
    );
  }

  // 单用户模式：必须配置 OWNER_EMAIL（提前阻断避免无意义的 OAuth 往返）
  const hasOwner = typeof OWNER_EMAIL === 'string' && OWNER_EMAIL.trim().length > 0;
  if (!hasOwner) {
    const headers = new Headers();
    headers.set('Location', `${APP_URL}/auth/signin?error=${encodeURIComponent('登录已禁用：未配置 OWNER_EMAIL')}`);
    return new Response(null, { status: 302, headers });
  }

  const state = generateState();
  const callbackUrl = `${APP_URL}/auth/github-callback`;

  // GitHub OAuth 授权 URL
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('scope', 'read:user user:email');
  authUrl.searchParams.set('state', state);

  // 设置短期 state cookie（10 分钟）
  const isSecure = new URL(context.request.url).protocol === 'https:';
  const parts = [
    `oauth_state=${state}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=600',
  ];
  if (isSecure) parts.splice(4, 0, 'Secure');
  const cookie = parts.join('; ');

  const headers = new Headers();
  headers.set('Location', authUrl.toString());
  headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}
