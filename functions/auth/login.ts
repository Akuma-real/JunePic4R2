/**
 * GitHub OAuth 登录端点
 *
 * 重定向用户到 GitHub 授权页面
 */

/// <reference types="@cloudflare/workers-types" />

export async function onRequestGet(context: EventContext<Env, never, Record<string, unknown>>) {
  const { GITHUB_CLIENT_ID, APP_URL } = context.env;

  if (!GITHUB_CLIENT_ID || !APP_URL) {
    return Response.json(
      { error: 'OAuth configuration missing' },
      { status: 500 }
    );
  }

  // GitHub OAuth 授权 URL
  const callbackUrl = `${APP_URL}/auth/github-callback`;
  const authUrl = new URL('https://github.com/login/oauth/authorize');

  authUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('scope', 'read:user user:email');

  // 重定向到 GitHub
  return Response.redirect(authUrl.toString(), 302);
}
