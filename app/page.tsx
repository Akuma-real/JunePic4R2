'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/use-auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Image as ImageIcon, Upload, Shield, Zap, Loader2 } from 'lucide-react';
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
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* 导航栏 */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <ImageIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
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
        <Card className="mb-20 bg-white/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
          <CardHeader className="text-center space-y-4">
            <CardTitle className="text-5xl font-bold text-slate-900 dark:text-white">
              基于 Cloudflare R2 的
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
                现代化图床管理系统
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
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
          </CardContent>
        </Card>

        {/* 功能特性 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <Card className="hover:shadow-lg transition-shadow bg-white/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/60 rounded-lg flex items-center justify-center">
                <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-xl font-semibold">便捷上传</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-400">
                支持拖拽、粘贴、批量上传。Cloudflare Workers 原生支持。
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/60 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-sky-600 dark:text-sky-400" />
              </div>
              <CardTitle className="text-xl font-semibold">安全可靠</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-400">
                基于 Cloudflare R2，全球 CDN 加速，支持防盗链和 OAuth 认证。
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/60 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <CardTitle className="text-xl font-semibold">强大功能</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-400">
                R2 同步、链接生成、API 接口，满足各种使用场景。
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 技术栈 */}
        <Card className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">现代化技术栈</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </main>

      {/* 页脚 */}
      <footer className="border-t border-gray-200 dark:border-gray-700 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600 dark:text-gray-400">
          <p>JunePic4R2 | 基于 Cloudflare R2 和 D1</p>
        </div>
      </footer>
    </div>
  );
}
