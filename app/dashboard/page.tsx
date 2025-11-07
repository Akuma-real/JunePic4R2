'use client';

import { useAuth } from '@/lib/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import ImageUploader from '@/components/image-uploader';
import ImageGallery from '@/components/image-gallery';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LogOut, Image as ImageIcon, RefreshCw } from 'lucide-react';

interface Stats {
  imageCount: number;
  totalSizeMB: string;
}

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    imageCount: 0,
    totalSizeMB: '0',
  });
  const [refreshKey, setRefreshKey] = useState(0);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
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
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <ImageIcon className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                JunePic4R2
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {user.avatar && (
                  <Image
                    src={user.avatar}
                    alt={user.name || '用户头像'}
                    width={32}
                    height={32}
                    className="rounded-full"
                    unoptimized
                  />
                )}
                <div className="text-sm">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.name}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    {user.email}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={logout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：上传区域 */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">上传图片</h2>
              </div>
              <ImageUploader
                onUploadComplete={handleUploadComplete}
                onUploadError={(error) => {
                  console.error('上传错误:', error);
                  alert(`上传失败: ${error}`);
                }}
                maxFiles={20}
              />
            </Card>

            {/* 图片列表 */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">我的图片</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRefreshKey((prev) => prev + 1)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  刷新
                </Button>
              </div>
              <ImageGallery
                key={refreshKey}
                onImageDeleted={handleImageDeleted}
                canSync={Boolean(user.isAdmin)}
              />
            </Card>
          </div>

          {/* 右侧：统计和快速操作 */}
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">统计信息</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">总图片数</p>
                  <p className="text-2xl font-bold">{stats.imageCount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">已使用空间</p>
                  <p className="text-2xl font-bold">{stats.totalSizeMB} MB</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-blue-50 dark:bg-blue-950 border-blue-200">
              <h3 className="text-lg font-semibold mb-2 text-blue-900 dark:text-blue-100">
                使用提示
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• 支持拖拽上传多个文件</li>
                <li>• 可以直接粘贴（Ctrl+V）图片</li>
                <li>• 建议启用 WebP 压缩节省空间</li>
                <li>• 质量设置 92% 效果最佳</li>
                <li>• 点击图片可以复制链接</li>
              </ul>
            </Card>

            <Card className="p-6 bg-green-50 dark:bg-green-950 border-green-200">
              <h3 className="text-lg font-semibold mb-2 text-green-900 dark:text-green-100">
                数据库状态
              </h3>
              <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                <p>✅ 本地 SQLite 数据库</p>
                <p>✅ Cloudflare R2 存储</p>
                <p>✅ 完全集成</p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
