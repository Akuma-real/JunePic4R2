import { getSessionSecret, verifySession } from '../../lib/auth-helpers';
import {
  listUploadTokens,
  createUploadToken,
  revokeUploadToken,
} from '../../lib/upload-tokens';

async function requireSession(request: Request, env: Env) {
  const secret = getSessionSecret(env);
  const session = await verifySession(request, secret);
  if (!session) {
    return null;
  }
  return session.userId;
}

export async function onRequestGet(context: EventContext<Env, never, Record<string, unknown>>) {
  const userId = await requireSession(context.request, context.env);
  if (!userId) {
    return Response.json({ error: '未授权访问' }, { status: 401 });
  }

  const tokens = await listUploadTokens(context.env.DB, userId);
  return Response.json({ tokens });
}

export async function onRequestPost(context: EventContext<Env, never, Record<string, unknown>>) {
  const userId = await requireSession(context.request, context.env);
  if (!userId) {
    return Response.json({ error: '未授权访问' }, { status: 401 });
  }

  const body = await context.request.json<{ name?: string }>().catch(() => null);
  const name = body?.name?.trim() || `Token-${new Date().toISOString().slice(0, 10)}`;

  const { token, record } = await createUploadToken(context.env.DB, userId, name);
  return Response.json({ token, record });
}

export async function onRequestDelete(context: EventContext<Env, never, Record<string, unknown>>) {
  const userId = await requireSession(context.request, context.env);
  if (!userId) {
    return Response.json({ error: '未授权访问' }, { status: 401 });
  }

  const url = new URL(context.request.url);
  const tokenId = url.searchParams.get('id');
  if (!tokenId) {
    return Response.json({ error: '缺少 token id' }, { status: 400 });
  }

  await revokeUploadToken(context.env.DB, userId, tokenId);
  return Response.json({ success: true });
}
