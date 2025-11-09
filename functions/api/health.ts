/**
 * 健康检查 API
 *
 * GET /api/health - 返回 D1 / R2 连通性与集成状态（需登录）
 */

/// <reference types="@cloudflare/workers-types" />

import { getSessionSecret, verifySession } from '../../lib/auth-helpers';

export async function onRequestGet(context: EventContext<Env, never, Record<string, unknown>>) {
  const { env, request } = context;
  try {
    // 可选鉴权：若具备 SESSION_SECRET 则尝试解析 cookie，失败不报错
    const hasSessionSecret =
      typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 32;
    let authenticated = false;
    if (hasSessionSecret) {
      try {
        const secret = getSessionSecret(env);
        const session = await verifySession(request, secret);
        authenticated = !!session;
      } catch {
        authenticated = false;
      }
    }

    if (!authenticated) {
      return Response.json(
        {
          success: false,
          d1: { ok: false, error: '未授权' },
          r2: { ok: false, error: '未授权' },
          integration: { ok: false },
          env: null,
          auth: { authenticated },
        },
        { status: 401 },
      );
    }

    // 环境变量就绪（仅返回布尔，不回显值）
    const envOk = {
      appUrl: typeof env.APP_URL === 'string' && env.APP_URL.trim().length > 0,
      sessionSecret: hasSessionSecret,
      github: {
        clientId: typeof env.GITHUB_CLIENT_ID === 'string' && env.GITHUB_CLIENT_ID.trim().length > 0,
        clientSecret: typeof env.GITHUB_CLIENT_SECRET === 'string' && env.GITHUB_CLIENT_SECRET.trim().length > 0,
      },
      ownerEmail: typeof env.OWNER_EMAIL === 'string' && env.OWNER_EMAIL.trim().length > 0,
      bindings: {
        db: !!env.DB,
        r2: !!env.R2_BUCKET,
      },
    } as const;

    // 检查 D1
    let d1Ok = false;
    let d1Error: string | undefined;
    try {
      const row = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
      d1Ok = !!row && Number(row.ok) === 1;
    } catch (err) {
      d1Ok = false;
      d1Error = err instanceof Error ? err.message : String(err);
    }

    // 检查 R2（列举 1 个对象，失败即视为不可用）
    let r2Ok = false;
    let r2Error: string | undefined;
    try {
      await env.R2_BUCKET.list({ limit: 1 });
      r2Ok = true;
    } catch (err) {
      r2Ok = false;
      r2Error = err instanceof Error ? err.message : String(err);
    }

    const integrationOk = d1Ok && r2Ok;

    return Response.json({
      success: integrationOk,
      d1: { ok: d1Ok, error: d1Error },
      r2: { ok: r2Ok, error: r2Error },
      integration: { ok: integrationOk },
      env: envOk,
      auth: { authenticated },
    });
  } catch (error) {
    console.error('Health error:', error);
    return Response.json({ error: '健康检查失败' }, { status: 500 });
  }
}
