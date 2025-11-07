'use client';

/**
 * Providers
 *
 * NextAuth 已移除，认证通过 useAuth() hook 处理
 * 如果需要全局状态管理，可以在这里添加 React Context
 */

import { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
