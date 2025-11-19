/**
 * 前端认证 Hook
 *
 * 替代 NextAuth 的 useSession()
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  provider: string;
  createdAt: number;
  isAdmin?: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  // 仅用于 status-only 或 status-first 阶段：表示会话存在
  authed?: boolean;
}

type AuthStrategy = 'status-first' | 'me-direct' | 'status-only';

interface UseAuthOptions {
  strategy?: AuthStrategy;
}

/**
 * useAuth - 轻量认证 Hook
 *
 * 语义说明：
 * - 返回的 `hasSession` 表示“存在有效会话”，不等价于 `user` 一定已加载。
 *   - 在 `status-only` 策略下：`hasSession` 可能为 true，但 `user` 为 null（此模式只做跳转判断）。
 *   - 在 `status-first`/`me-direct` 下：当已登录时最终会返回 `user`。
 * - `refetch` 会按当前策略执行：
 *   - `status-only` 仅刷新会话状态，不拉取用户详情。
 *   - `me-direct`/`status-first` 会在确认已登录时拉取用户详情。
 */
export function useAuth(options?: UseAuthOptions) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    authed: false,
  });

  const strategy: AuthStrategy = options?.strategy ?? 'status-first';
  const abortRef = useRef<AbortController | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      // 中止前一个请求，确保只处理最新一次结果
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      const safeSetState = (next: AuthState) => {
        // 只允许最新的一次请求更新状态
        if (abortRef.current?.signal !== signal || signal.aborted) return;
        setState(next);
      };

      setState((prev) => ({ ...prev, loading: true, error: null }));
      
      if (strategy === 'me-direct') {
        // 直接请求用户信息（用于受保护页面），若未登录可能出现 401（可接受）
        const meRes = await fetch('/auth/me', {
          credentials: 'include',
          signal,
        });
        if (meRes.ok) {
          const data = (await meRes.json()) as { user: User };
          safeSetState({ user: data.user, loading: false, error: null, authed: true });
        } else if (meRes.status === 401) {
          safeSetState({ user: null, loading: false, error: null, authed: false });
        } else {
          throw new Error('Failed to fetch user');
        }
        return;
      }

      // 其余策略先探测状态
      const statusRes = await fetch('/auth/status', { credentials: 'include', signal });
      if (!statusRes.ok) {
        safeSetState({ user: null, loading: false, error: null, authed: false });
        return;
      }
      const statusJson = (await statusRes.json()) as { authenticated?: boolean };
      const authed = !!statusJson?.authenticated;

      if (strategy === 'status-only') {
        // 仅需要知道是否已登录，不拉取用户详情
        safeSetState({ user: null, loading: false, error: null, authed });
        return;
      }

      if (!authed) {
        safeSetState({ user: null, loading: false, error: null, authed: false });
        return;
      }

      // status-first：已登录，再拉用户详情
      const meRes = await fetch('/auth/me', { credentials: 'include', signal });
      if (meRes.ok) {
        const data = (await meRes.json()) as { user: User };
        safeSetState({ user: data.user, loading: false, error: null, authed: true });
      } else if (meRes.status === 401) {
        safeSetState({ user: null, loading: false, error: null, authed: false });
      } else {
        throw new Error('Failed to fetch user');
      }
    } catch (error) {
      // fetch 被中止不视为错误
      if (error && typeof error === 'object' && 'name' in (error as any) && (error as any).name === 'AbortError') {
        return;
      }
      console.error('Auth error:', error);
      // 仅在仍是当前请求时更新状态
      if (abortRef.current?.signal) {
        setState({
          user: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          authed: false,
        });
      }
    }
  }, [strategy]);

  useEffect(() => {
    fetchUser();
    return () => {
      // 组件卸载或依赖变化时中止进行中的请求
      abortRef.current?.abort();
    };
  }, [fetchUser]);

  const login = useCallback(() => {
    window.location.href = '/auth/login';
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      // 即使失败也跳转
      window.location.href = '/';
    }
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    // hasSession：存在用户或明确探测到 authed
    hasSession: !!state.user || !!state.authed,
    login,
    logout,
    refetch: fetchUser,
  };
}

/**
 * 用于服务端组件的类型定义
 */
export type { User, UseAuthOptions, AuthStrategy };
