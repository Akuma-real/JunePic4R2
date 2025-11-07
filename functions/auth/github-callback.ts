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

export async function onRequestGet(context: EventContext<Env, never, Record<string, unknown>>) {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, APP_URL, DB } = context.env;

  // 获取 code 参数
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

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

    // 3. 创建或更新用户
    const user = await upsertUserFromGitHub(DB, {
      email: primaryEmail,
      name: githubUser.name,
      avatar: githubUser.avatar_url,
      providerId: String(githubUser.id),
    });

    // 4. 创建 session
    const secret = getSessionSecret(context.env);
    const sessionCookie = await createSession(
      user.id,
      secret,
      true // secure cookie
    );

    // 5. 重定向到 dashboard
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${APP_URL}/dashboard`,
        'Set-Cookie': sessionCookie,
      },
    });
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return Response.redirect(
      `${APP_URL}/auth/signin?error=${encodeURIComponent('Authentication failed')}`,
      302
    );
  }
}
