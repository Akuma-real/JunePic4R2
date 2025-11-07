/**
 * 前端认证 Hook
 *
 * 替代 NextAuth 的 useSession()
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  provider: string;
  createdAt: number;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const fetchUser = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const response = await fetch('/auth/me', {
        credentials: 'include', // 包含 cookies
      });

      if (response.ok) {
        const data = await response.json() as { user: User };
        setState({ user: data.user, loading: false, error: null });
      } else if (response.status === 401) {
        // 未登录
        setState({ user: null, loading: false, error: null });
      } else {
        throw new Error('Failed to fetch user');
      }
    } catch (error) {
      console.error('Auth error:', error);
      setState({
        user: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, []);

  useEffect(() => {
    fetchUser();
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
    isAuthenticated: !!state.user,
    login,
    logout,
    refetch: fetchUser,
  };
}

/**
 * 用于服务端组件的类型定义
 */
export type { User };
