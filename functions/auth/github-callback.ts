/**
 * GitHub OAuth 回调端点
 *
 * 处理 GitHub 授权后的回调，创建用户和 session
 */

/// <reference types="@cloudflare/workers-types" />

import { upsertUserFromGitHub } from '../../lib/db-queries';
import { createSession, getSessionSecret } from '../../lib/auth-helpers';

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  header.split(';').forEach((pair) => {
    const [k, ...rest] = pair.trim().split('=');
    out[k] = rest.join('=');
  });
  return out;
}

export async function onRequestGet(context: EventContext<Env, never, Record<string, unknown>>) {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, APP_URL, DB } = context.env;

  // 获取 code 参数
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state');

  if (error) {
    return Response.redirect(
      `${APP_URL}/auth/signin?error=${encodeURIComponent(error)}`,
      302
    );
  }

  if (!code) {
    return Response.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  try {
    // 校验 state（防 CSRF）
    const cookies = parseCookies(context.request.headers.get('Cookie'));
    const stateCookie = cookies['oauth_state'];
    if (!state || !stateCookie || state !== stateCookie) {
      const headers = new Headers();
      headers.set('Location', `${APP_URL}/auth/signin?error=${encodeURIComponent('Invalid state')}`);
      const isSecure = new URL(context.request.url).protocol === 'https:';
      headers.append('Set-Cookie', `oauth_state=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`);
      return new Response(null, { status: 302, headers });
    }

    // 1. 用 code 换取 access_token
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
    };

    if (tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error || 'Failed to get access token');
    }

    const accessToken = tokenData.access_token;

    // 2. 获取用户信息
    const [userResponse, emailsResponse] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'User-Agent': 'JunePic4R2',
        },
      }),
      fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'User-Agent': 'JunePic4R2',
        },
      }),
    ]);

    // 检查响应状态
    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('GitHub user API error:', userResponse.status, errorText);
      throw new Error(`GitHub API error: ${userResponse.status} ${errorText.slice(0, 200)}`);
    }

    if (!emailsResponse.ok) {
      const errorText = await emailsResponse.text();
      console.error('GitHub emails API error:', emailsResponse.status, errorText);
      throw new Error(`GitHub API error: ${emailsResponse.status} ${errorText.slice(0, 200)}`);
    }

    const githubUser = (await userResponse.json()) as GitHubUser;
    const githubEmails = (await emailsResponse.json()) as GitHubEmail[];

    // 找到主邮箱
    const primaryEmail =
      githubUser.email ||
      githubEmails.find((e) => e.primary && e.verified)?.email;

    if (!primaryEmail) {
      throw new Error('No verified email found');
    }

    // 3. 邮箱白名单校验（未配置则禁止任何登录；配置后仅允许白名单）
    const allowRaw = context.env.ALLOWED_EMAILS;
    const allowedList = (allowRaw || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const adminRaw = context.env.ADMIN_EMAILS;
    const adminList = (adminRaw || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (allowedList.length === 0) {
      const headers = new Headers();
      headers.set('Location', `${APP_URL}/auth/signin?error=${encodeURIComponent('登录已禁用：未配置允许的邮箱')}`);
      return new Response(null, { status: 302, headers });
    }

    const normalizedEmail = primaryEmail.toLowerCase();
    if (!allowedList.includes(normalizedEmail)) {
      const headers = new Headers();
      headers.set('Location', `${APP_URL}/auth/signin?error=${encodeURIComponent('该邮箱未被允许登录')}`);
      return new Response(null, { status: 302, headers });
    }
    const isAdmin = adminList.includes(normalizedEmail);

    // 4. 创建或更新用户
    const user = await upsertUserFromGitHub(DB, {
      email: primaryEmail,
      name: githubUser.name,
      avatar: githubUser.avatar_url,
      providerId: String(githubUser.id),
    });

    // 5. 创建 session（本地开发下不加 Secure）
    const secret = getSessionSecret(context.env);
    const isSecure = new URL(context.request.url).protocol === 'https:';
    const sessionCookie = await createSession(user.id, secret, {
      isSecure,
      isAdmin,
    });

    // 6. 清理 state cookie，并重定向到 dashboard
    const headers = new Headers();
    headers.set('Location', `${APP_URL}/dashboard`);
    headers.append('Set-Cookie', sessionCookie);
    headers.append('Set-Cookie', `oauth_state=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`);
    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return Response.redirect(
      `${APP_URL}/auth/signin?error=${encodeURIComponent('Authentication failed')}`,
      302
    );
  }
}
