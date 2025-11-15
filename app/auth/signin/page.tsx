'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ApiResponse {
  error?: string;
  success?: boolean;
}

const isApiResponse = (value: unknown): value is ApiResponse => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if ('error' in record && typeof record.error !== 'string') {
    return false;
  }

  if ('success' in record && typeof record.success !== 'boolean') {
    return false;
  }

  return true;
};

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams?.get('error');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!username.trim() || !password) {
      setFormError('请输入用户名和密码');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/password-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const rawResult: unknown = await response.json().catch(() => ({}));
      const result: ApiResponse = isApiResponse(rawResult) ? rawResult : {};
      if (!response.ok) {
        throw new Error(result?.error || '登录失败');
      }

      router.replace('/dashboard');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubSignIn = () => {
    window.location.href = '/auth/login';
  };

  const decodedUrlError = urlError ? decodeURIComponent(urlError) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white">
              JunePic4R2
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              基于 Cloudflare R2 的图床管理系统
            </CardDescription>
          </CardHeader>
          <CardContent>
            {decodedUrlError && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>登录失败</AlertTitle>
                <AlertDescription>{decodedUrlError}</AlertDescription>
              </Alert>
            )}
            {formError && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>登录失败</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="username">用户名或邮箱</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  disabled={loading}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  disabled={loading}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '登录中...' : '使用密码登录'}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span>或</span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-3"
              onClick={handleGitHubSignIn}
              type="button"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span>使用 GitHub 登录</span>
            </Button>

            <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
              登录即表示您同意我们的服务条款和隐私政策
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="w-full max-w-md">
          <Card className="shadow-xl">
            <CardContent>
              <div className="text-center mb-8 space-y-2 mt-4">
                <Skeleton className="h-8 w-40 mx-auto" />
                <Skeleton className="h-4 w-56 mx-auto" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="mt-8 text-center">
                <Skeleton className="h-4 w-48 mx-auto" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
