'use client';

import { useEffect, useState } from 'react';
import NextImage from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

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
}: {
  onImageDeleted?: () => void;
}) {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    if (!confirm('确定要删除这张图片吗？')) return;

    try {
      const response = await fetch(`/api/images/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setImages(images.filter((img) => img.id !== id));
        onImageDeleted?.();
      } else {
        alert('删除失败');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('删除失败');
    }
  };

  const copyToClipboard = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Copy error:', error);
    }
  };

  const handleSync = async () => {
    if (!confirm('确定要从 R2 同步图片到数据库吗？')) return;

    setSyncing(true);
    try {
      const response = await fetch('/api/images/sync', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json() as {
          stats: { total: number; added: number; skipped: number; errors: number }
        };
        alert(
          `同步完成！\n总计: ${data.stats.total}\n新增: ${data.stats.added}\n跳过: ${data.stats.skipped}\n错误: ${data.stats.errors}`
        );
        // 重新加载图片列表
        fetchImages();
      } else {
        alert('同步失败');
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('同步失败');
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
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '同步中...' : '从 R2 同步'}
          </Button>
        </div>
        <div className="text-center text-gray-500 py-12">
          暂无图片，开始上传您的第一张图片吧！
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? '同步中...' : '从 R2 同步'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{images.map((image) => (
        <Card key={image.id} className="overflow-hidden">
          <div className="aspect-video bg-gray-100 dark:bg-gray-800 relative group">
            <NextImage
              src={image.url}
              alt={image.filename}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              unoptimized
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
              <a
                href={image.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
              >
                <ExternalLink className="w-5 h-5 text-gray-700" />
              </a>
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => copyToClipboard(image.url, image.id)}
              >
                {copiedId === image.id ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    复制链接
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(image.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
      </div>
    </div>
  );
}
