'use client';

import { useAuth } from '@/lib/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import ImageUploader from '@/components/image-uploader';
import ImageGallery from '@/components/image-gallery';
import UploadTokenManager from '@/components/upload-token-manager';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface Stats {
  imageCount: number;
  totalSizeMB: string;
}

interface HealthState {
  d1: boolean | null;
  r2: boolean | null;
  integration: boolean | null;
  latencies?: {
    d1?: number;
    r2?: number;
  };
  errors?: {
    d1?: string;
    r2?: string;
  };
}

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    imageCount: 0,
    totalSizeMB: '0',
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [health, setHealth] = useState<HealthState>({ d1: null, r2: null, integration: null });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin');
    }
  }, [loading, user, router]);

  // 获取统计信息的 effect
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        if (response.ok) {
          const data = await response.json() as { stats: Stats };
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, [refreshKey]);

  // 获取健康状态
  useEffect(() => {
    let cancelled = false;

    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json() as {
          d1: { ok: boolean; error?: string; latencyMs?: number };
          r2: { ok: boolean; error?: string; latencyMs?: number };
          integration: { ok: boolean; checkedAt?: number };
        };
        if (cancelled) return;
        setHealth({
          d1: data.d1.ok,
          r2: data.r2.ok,
          integration: data.integration.ok,
          latencies: {
            d1: data.d1.latencyMs,
            r2: data.r2.latencyMs,
          },
          errors: { d1: data.d1.error, r2: data.r2.error },
        });
      } catch (e) {
        console.error('Failed to fetch health:', e);
        if (!cancelled) {
          setHealth({ d1: null, r2: null, integration: null });
        }
      }
    };

    fetchHealth();
    const timer = setInterval(fetchHealth, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6 space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-40 w-full" />
              </Card>
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <Skeleton className="aspect-video w-full" />
                      <div className="p-4 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </Card>
                  ))}
                </div>
              </Card>
            </div>
            <div className="space-y-6">
              <Card className="p-6 space-y-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-8 w-32" />
              </Card>
              <Card className="p-6 space-y-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </Card>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleUploadComplete = () => {
    // 刷新统计和图片列表
    setRefreshKey((prev) => prev + 1);
  };

  const handleImageDeleted = () => {
    // 刷新统计 - 触发 refreshKey 变化来重新获取
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 顶部导航栏 */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-4 sm:py-0">
            <div className="flex items-center gap-3">
              <Image
                src="/favicon.svg"
                alt="JunePic4R2"
                width={32}
                height={32}
                className="w-8 h-8"
                priority
              />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                JunePic4R2
              </h1>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-3 min-w-0">
                {user.avatar && (
                  <Image
                    src={user.avatar}
                    alt={user.name || '用户头像'}
                    width={40}
                    height={40}
                    className="rounded-full flex-shrink-0"
                    unoptimized
                  />
                )}
                <div className="text-sm leading-tight w-full">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {user.name}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="w-full sm:w-auto"
              >
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* 左侧：上传区域 */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-xl font-semibold">上传图片</CardTitle>
              </CardHeader>
              <CardContent>
                <ImageUploader
                  onUploadComplete={handleUploadComplete}
                  onUploadError={(error) => {
                    console.error('上传错误:', error);
                    toast.error('上传失败', { description: String(error) });
                  }}
                  maxFiles={20}
                />
              </CardContent>
            </Card>

            {/* 图片列表 */}
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-xl font-semibold">我的图片</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRefreshKey((prev) => prev + 1)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  刷新
                </Button>
              </CardHeader>
              <CardContent>
                <ImageGallery
                  key={refreshKey}
                  onImageDeleted={handleImageDeleted}
                  canSync={Boolean(user.isAdmin)}
                />
              </CardContent>
            </Card>
          </div>

          {/* 右侧：统计和快速操作 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">统计信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">总图片数</p>
                    <p className="text-2xl font-bold">{stats.imageCount}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-gray-500">已使用空间</p>
                    <p className="text-2xl font-bold">{stats.totalSizeMB} MB</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                  使用提示
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• 支持拖拽上传多个文件</li>
                  <li>• 可以直接粘贴（Ctrl+V）图片</li>
                  <li>• 建议启用 WebP 压缩节省空间</li>
                  <li>• 质量设置 92% 效果最佳</li>
                  <li>• 点击图片可以复制链接</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-950 border-green-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-green-900 dark:text-green-100">
                  系统状态
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Cloudflare D1（SQLite）</span>
                    <Badge
                      variant={
                        health.d1 === null
                          ? 'outline'
                          : health.d1
                            ? 'default'
                            : 'destructive'
                      }
                      className="inline-flex w-28 items-center justify-center gap-1"
                    >
                      <span>{health.d1 === null ? '未知' : health.d1 ? '正常' : '异常'}</span>
                      {typeof health.latencies?.d1 === 'number' && (
                        <span className="text-[10px] opacity-80">
                          · {health.latencies.d1} ms
                        </span>
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Cloudflare R2 存储</span>
                    <Badge
                      variant={
                        health.r2 === null
                          ? 'outline'
                          : health.r2
                            ? 'default'
                            : 'destructive'
                      }
                      className="inline-flex w-28 items-center justify-center gap-1"
                    >
                      <span>{health.r2 === null ? '未知' : health.r2 ? '正常' : '异常'}</span>
                      {typeof health.latencies?.r2 === 'number' && (
                        <span className="text-[10px] opacity-80">
                          · {health.latencies.r2} ms
                        </span>
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>心跳检测</span>
                    <Badge
                      variant={
                        health.integration === null
                          ? 'outline'
                          : health.integration
                            ? 'default'
                            : 'destructive'
                      }
                      className="inline-flex w-28 items-center justify-center gap-1"
                    >
                      <span
                        className={[
                          'inline-flex h-2.5 w-2.5 rounded-full',
                          health.integration === null
                            ? 'bg-gray-400'
                            : health.integration
                              ? 'bg-emerald-500 animate-pulse'
                              : 'bg-red-500',
                        ].join(' ')}
                      />
                      <span className="text-xs">
                        {health.integration === null
                          ? '心跳未知'
                          : health.integration
                            ? '心跳正常'
                            : '心跳异常'}
                      </span>
                    </Badge>
                  </div>
                  {(health.errors?.d1 || health.errors?.r2) && (
                    <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                      {health.errors?.d1 && `D1: ${health.errors.d1} `}
                      {health.errors?.r2 && `R2: ${health.errors.r2}`}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <UploadTokenManager />
          </div>
        </div>
      </main>
    </div>
  );
}
