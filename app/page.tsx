'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Image as ImageIcon, Upload, Shield, Zap } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 如果已登录，重定向到仪表板
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [loading, user, router]);

  // 如果正在加载或已登录，不显示内容
  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* 导航栏 */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <ImageIcon className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                JunePic4R2
              </h1>
            </div>

            <Link href="/auth/signin">
              <Button>登录 / 注册</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Hero 区域 */}
        <div className="text-center mb-20">
          <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            基于 Cloudflare R2 的
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              现代化图床管理系统
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            快速、安全、可靠的图片存储解决方案。支持批量上传、智能压缩、R2 同步等功能。
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/signin">
              <Button size="lg" className="text-lg px-8">
                开始使用
              </Button>
            </Link>
            <Link
              href="https://github.com/akuma/JunePic4R2"
              target="_blank"
            >
              <Button size="lg" variant="outline" className="text-lg px-8">
                查看文档
              </Button>
            </Link>
          </div>
        </div>

        {/* 功能特性 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">便捷上传</h3>
            <p className="text-gray-600 dark:text-gray-400">
              支持拖拽、粘贴、批量上传。Cloudflare Workers 原生支持。
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">安全可靠</h3>
            <p className="text-gray-600 dark:text-gray-400">
              基于 Cloudflare R2，全球 CDN 加速，支持防盗链和 OAuth 认证。
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">强大功能</h3>
            <p className="text-gray-600 dark:text-gray-400">
              R2 同步、链接生成、API 接口，满足各种使用场景。
            </p>
          </Card>
        </div>

        {/* 技术栈 */}
        <Card className="p-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">现代化技术栈</h3>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <span className="px-4 py-2 bg-white/20 rounded-full">
                Next.js 16
              </span>
              <span className="px-4 py-2 bg-white/20 rounded-full">
                React 19
              </span>
              <span className="px-4 py-2 bg-white/20 rounded-full">
                TypeScript
              </span>
              <span className="px-4 py-2 bg-white/20 rounded-full">
                Tailwind CSS
              </span>
              <span className="px-4 py-2 bg-white/20 rounded-full">
                Cloudflare R2
              </span>
              <span className="px-4 py-2 bg-white/20 rounded-full">
                Cloudflare D1
              </span>
              <span className="px-4 py-2 bg-white/20 rounded-full">
                Pages Functions
              </span>
            </div>
          </div>
        </Card>
      </main>

      {/* 页脚 */}
      <footer className="border-t border-gray-200 dark:border-gray-700 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600 dark:text-gray-400">
          <p>由 Claude Code 生成 | 基于 Cloudflare R2 和 D1</p>
        </div>
      </footer>
    </div>
  );
}
