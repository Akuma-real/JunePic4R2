'use client';

import { useEffect, useState } from 'react';
import NextImage from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Trash2, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import Lightbox from '@/components/lightbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Image {
  id: string;
  url: string;
  filename: string;
  file_size: number;
  width: number | null;
  height: number | null;
  format: string;
  created_at: number;
}

export default function ImageGallery({
  onImageDeleted,
  canSync = false,
}: {
  onImageDeleted?: () => void;
  canSync?: boolean;
}) {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fetchImages = async () => {
    try {
      const response = await fetch('/api/images?limit=50');
      if (response.ok) {
        const data = await response.json() as { images: Image[] };
        setImages(data.images);
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/images/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setImages(images.filter((img) => img.id !== id));
        onImageDeleted?.();
      } else {
        toast.error('删除失败', { description: '服务器未返回成功状态' });
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('删除失败', { description: error instanceof Error ? error.message : '未知错误' });
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('已复制直链');
    } catch (error) {
      console.error('Copy error:', error);
      toast.error('复制失败');
    }
  };

  const copyMarkdown = async (image: Image) => {
    try {
      const md = `![${image.filename}](${image.url})`;
      await navigator.clipboard.writeText(md);
    } catch (error) {
      console.error('Copy markdown error:', error);
    }
  };

  const copyHTML = async (image: Image) => {
    try {
      const html = `<img src="${image.url}" alt="${image.filename}" />`;
      await navigator.clipboard.writeText(html);
    } catch (error) {
      console.error('Copy HTML error:', error);
    }
  };

  const copyBBCode = async (image: Image) => {
    try {
      const bb = `[img]${image.url}[/img]`;
      await navigator.clipboard.writeText(bb);
    } catch (error) {
      console.error('Copy BBCode error:', error);
    }
  };

  const handleSync = async () => {
    if (!canSync) return;

    setSyncing(true);
    try {
      const response = await fetch('/api/images/sync', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json() as {
          stats: { total: number; added: number; skipped: number; errors: number };
          errors?: string[];
        };
        const errorDetails = data.errors && data.errors.length > 0 ? `\n${data.errors.slice(0,5).join('\n')}` : '';
        toast.success('同步完成', {
          description: `总计: ${data.stats.total}，新增: ${data.stats.added}，跳过: ${data.stats.skipped}，错误: ${data.stats.errors}${errorDetails}`,
        });
        // 重新加载图片列表
        fetchImages();
      } else {
        toast.error('同步失败', { description: '服务端返回非 200' });
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('同步失败', { description: error instanceof Error ? error.message : '未知错误' });
    } finally {
      setSyncing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'yyyy-MM-dd HH:mm', {
      locale: zhCN,
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          {canSync && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={syncing}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? '同步中...' : '从 R2 同步'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>从 R2 同步</AlertDialogTitle>
                  <AlertDialogDescription>
                    将扫描 R2 并回填数据库（仅新增缺失记录）。确定继续？
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSync}>确定</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <div className="text-center text-gray-500 py-12">
          暂无图片，开始上传您的第一张图片吧！
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canSync && (
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={syncing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? '同步中...' : '从 R2 同步'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>从 R2 同步</AlertDialogTitle>
                <AlertDialogDescription>
                  将扫描 R2 并回填数据库（仅新增缺失记录）。确定继续？
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleSync}>确定</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{images.map((image, idx) => (
        <Card key={image.id} className="overflow-hidden">
          <div
            className="aspect-video bg-gray-100 dark:bg-gray-800 relative group cursor-zoom-in"
            onClick={() => {
              setLightboxIndex(idx);
              setLightboxOpen(true);
            }}
          >
            <NextImage
              src={image.url}
              alt={image.filename}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              unoptimized
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild variant="outline" size="icon" className="bg-white hover:bg-gray-100"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <a href={image.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink className="w-5 h-5 text-gray-700" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>在新标签打开</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="p-4">
            <div className="mb-3">
              <p className="text-sm font-medium truncate" title={image.filename}>
                {image.filename}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <span>{formatFileSize(image.file_size)}</span>
                <span>•</span>
                {image.width && image.height && (
                  <>
                    <span>
                      {image.width} × {image.height}
                    </span>
                    <span>•</span>
                  </>
                )}
                <span className="uppercase">{image.format}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {formatDate(image.created_at)}
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">复制</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>复制</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => copyToClipboard(image.url)}>
                    <Copy className="w-3 h-3 mr-1" />
                    复制直链
                    <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>复制为…</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => copyMarkdown(image)}>Markdown</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyHTML(image)}>HTML</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyBBCode(image)}>BBCode</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>删除图片</AlertDialogTitle>
                    <AlertDialogDescription>
                      确认删除 “{image.filename}”？此操作不可撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(image.id)}>删除</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </Card>
      ))}
      </div>
      {/* Lightbox viewer */}
      <Lightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        images={images.map((img) => ({
          src: img.url,
          alt: img.filename,
          width: img.width,
          height: img.height,
        }))}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}
