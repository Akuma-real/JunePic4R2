'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image as ImageIcon, X, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { compressImages, type CompressionResult } from '@/lib/image-compression';
import { useForm } from 'react-hook-form';
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form';

// 与服务端 /api/upload(/batch) 返回结构对齐；
// 兼容保留可选的 originalSize/compressed，便于前端展示。
interface UploadedImage {
  id: string;
  url: string;
  filename: string;
  size: number; // 实际写入的文件大小（压缩后或原始）
  format?: string;
  createdAt?: number;
  // 前端派生信息（可选）：
  originalSize?: number; // 若发生压缩，记录压缩前大小
  compressed?: boolean;  // 是否经过客户端压缩
}

interface ImageUploaderProps {
  // 参数改为可选，兼容仅触发刷新的调用方（不关心具体列表）
  onUploadComplete?: (images?: UploadedImage[]) => void;
  onUploadError?: (error: string) => void;
  maxFiles?: number;
}

export default function ImageUploader({
  onUploadComplete,
  onUploadError,
  maxFiles = 20,
}: ImageUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [compress, setCompress] = useState(false);
  const [quality, setQuality] = useState(92);
  const [uploadResults, setUploadResults] = useState<UploadedImage[]>([]);
  const [compressionStats, setCompressionStats] = useState<CompressionResult[]>([]);
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'compressing' | 'uploading'>('idle');
  const [usedCompression, setUsedCompression] = useState(false);
  const [skippedCompressionFiles, setSkippedCompressionFiles] = useState<string[]>([]);
  const form = useForm<{ compress: boolean; quality: number }>({
    defaultValues: { compress, quality },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles].slice(0, maxFiles));
  }, [maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
    },
    maxFiles,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);
    setCompressionStats([]);
    setSkippedCompressionFiles([]);
    setUsedCompression(false);

    try {
      let filesToUpload = files;
      let performedCompression = false;

      // 第一阶段：如果启用压缩，先在客户端压缩
      if (compress) {
        const compressibleFiles: File[] = [];
        const animatedFiles: File[] = [];

        for (const file of files) {
          if (await shouldSkipCompression(file)) {
            animatedFiles.push(file);
          } else {
            compressibleFiles.push(file);
          }
        }

        setSkippedCompressionFiles(animatedFiles.map((file) => file.name));

        if (compressibleFiles.length > 0) {
          setCurrentPhase('compressing');
          performedCompression = true;
          setUsedCompression(true);

          const compressionResults = await compressImages(
            compressibleFiles,
            {
              maxWidth: 1920,
              maxHeight: 1920,
              quality: quality / 100,
              targetFormat: 'webp',
            },
            (current, total) => {
              setProgress((current / total) * 50); // 压缩阶段占 0-50%
            }
          );

          const compressionMap = new Map<File, CompressionResult>();
          compressionResults.forEach((result, index) => {
            compressionMap.set(compressibleFiles[index], result);
          });

          setCompressionStats(compressionResults);
          filesToUpload = files.map((file) => compressionMap.get(file)?.file ?? file);
        } else {
          setCompressionStats([]);
          filesToUpload = files;
        }
      } else {
        setSkippedCompressionFiles([]);
      }

      // 第二阶段：上传到服务器
      setCurrentPhase('uploading');
      setProgress(performedCompression ? 50 : 0);

      const formData = new FormData();
      filesToUpload.forEach((file) => formData.append('files', file));

      const response = await fetch('/api/upload/batch', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json() as { error: string };
        throw new Error(error.error || '上传失败');
      }

      const data = await response.json() as {
        results: Array<{
          id: string;
          url: string;
          filename: string;
          size: number;
          format?: string;
          createdAt?: number;
        }>;
        errors?: Array<{ filename: string; error: string }>;
      };

      // 将服务端结果与本地压缩统计对齐，补充前端派生信息
      const compressionMapByName = new Map<string, CompressionResult>();
      for (const stat of compressionStats) {
        // stat.file 为实际上传的文件（可能重命名为 .webp）
        compressionMapByName.set(stat.file.name, stat);
      }

      const mergedResults: UploadedImage[] = data.results.map((r) => {
        const stat = compressionMapByName.get(r.filename);
        return {
          id: r.id,
          url: r.url,
          filename: r.filename,
          size: r.size,
          format: r.format,
          createdAt: r.createdAt,
          originalSize: stat?.originalSize ?? r.size,
          compressed: stat ? stat.compressedSize < stat.originalSize : false,
        };
      });

      setProgress(100);
      setUploadResults(mergedResults);
      setFiles([]);
      onUploadComplete?.(mergedResults);

      if (data.errors && data.errors.length > 0) {
        const errorDetails = data.errors
          .map((e) => `${e.filename}: ${e.error}`)
          .join('\n');
        onUploadError?.(
          `${data.errors.length} 个文件上传失败：\n${errorDetails}`
        );
      }
    } catch (error) {
      console.error('Upload error:', error);
      onUploadError?.(error instanceof Error ? error.message : '上传失败');
    } finally {
      setUploading(false);
      setProgress(0);
      setCurrentPhase('idle');
    }
  };

  // 粘贴上传
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      Array.from(items).forEach((item) => {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      });

      if (imageFiles.length > 0) {
        setFiles((prev) => [...prev, ...imageFiles].slice(0, maxFiles));
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [maxFiles]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* 上传选项 */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">上传设置</h3>
        <Form {...form}>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <FormField
              control={form.control}
              name="compress"
              render={() => (
                <FormItem className="flex items-center justify-between gap-4">
                  <FormLabel className="text-sm">WebP 压缩</FormLabel>
                  <FormControl>
                    <Switch
                      checked={compress}
                      onCheckedChange={(next) => {
                        const v = !!next;
                        setCompress(v);
                        form.setValue('compress', v);
                        if (!v) setSkippedCompressionFiles([]);
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {compress && (
              <FormField
                control={form.control}
                name="quality"
                render={() => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm">压缩质量</FormLabel>
                      <span className="text-sm text-gray-500">{quality}%</span>
                    </div>
                    <FormControl>
                      <Slider
                        value={[quality]}
                        onValueChange={(value) => {
                          const v = value[0];
                          setQuality(v);
                          form.setValue('quality', v);
                        }}
                        min={10}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-gray-500">
                      92% 可获得最佳质量与文件大小的平衡
                    </FormDescription>
                    <p className="text-xs text-amber-600 dark:text-amber-300">
                      ⚠️ 启用压缩会将图片转换为静态 WebP，检测到动图会自动跳过并上传原文件。
                    </p>
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>
      </Card>

      {/* 拖拽上传区域 */}
      <Card
        {...getRootProps()}
        className={`p-12 border-2 border-dashed cursor-pointer transition-colors ${isDragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-gray-300 hover:border-gray-400'
          }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-center">
          {isDragActive ? (
            <>
              <Upload className="w-16 h-16 text-blue-500 mb-4" />
              <p className="text-lg font-medium text-blue-600">放开以上传图片</p>
            </>
          ) : (
            <>
              <ImageIcon className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-lg font-medium mb-2">
                拖拽图片到这里，或点击选择文件
              </p>
              <p className="text-sm text-gray-500">
                支持 PNG, JPG, GIF, WebP（最多 {maxFiles} 个文件）
              </p>
              <p className="text-xs text-gray-400 mt-2">
                提示：您也可以直接粘贴（Ctrl+V）图片
              </p>
            </>
          )}
        </div>
      </Card>

      {/* 文件列表 */}
      {files.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              待上传文件 ({files.length})
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiles([])}
              disabled={uploading}
            >
              清空列表
            </Button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <ImageIcon className="w-8 h-8 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {skippedCompressionFiles.length > 0 && (
            <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4" />
                <span>以下文件检测到动画，将以原格式上传：</span>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {skippedCompressionFiles.map((name) => (
                  <li key={name} className="truncate">{name}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            {uploading && (
              <div className="mb-4 space-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-medium">
                      {currentPhase === 'compressing' && '正在压缩图片...'}
                      {currentPhase === 'uploading' && '正在上传到服务器...'}
                    </span>
                    <span>
                      {currentPhase !== 'idle' &&
                        `${(() => {
                          if (currentPhase === 'compressing') {
                            return Math.round(Math.max(0, Math.min(100, progress * 2)));
                          }
                          if (currentPhase === 'uploading') {
                            const value = usedCompression ? (progress - 50) * 2 : progress;
                            return Math.round(Math.max(0, Math.min(100, value)));
                          }
                          return 0;
                        })()}%`}
                    </span>
                  </div>
                  <Progress
                    value={(() => {
                      if (currentPhase === 'compressing') {
                        return Math.max(0, Math.min(100, progress * 2));
                      }
                      if (currentPhase === 'uploading') {
                        const val = usedCompression ? (progress - 50) * 2 : progress;
                        return Math.max(0, Math.min(100, val));
                      }
                      return 0;
                    })()}
                    className="w-full"
                  />
                </div>

                {/* 压缩统计 */}
                {compressionStats.length > 0 && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 max-h-32 overflow-y-auto border-t pt-2">
                    <p className="font-medium text-green-600 dark:text-green-400">✓ 压缩完成</p>
                    {compressionStats.map((stat, idx) => {
                      const ratio = ((1 - stat.compressedSize / stat.originalSize) * 100).toFixed(1);
                      return (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="truncate flex-1">
                            {stat.originalFile.name} → {stat.file.name}
                          </span>
                          <span className="text-green-600 dark:text-green-400 ml-2 whitespace-nowrap">
                            {formatFileSize(stat.originalSize)} → {formatFileSize(stat.compressedSize)}
                            <span className="ml-1">(-{ratio}%)</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? '上传中...' : `上传 ${files.length} 个文件`}
            </Button>
          </div>
        </Card>
      )}

      {/* 上传成功结果 */}
      {uploadResults.length > 0 && (
        <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
              上传成功！
            </h3>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300">
            成功上传 {uploadResults.length} 个文件
          </p>
        </Card>
      )}
    </div>
  );
}

async function shouldSkipCompression(file: File): Promise<boolean> {
  if (file.type === 'image/gif') {
    return true;
  }

  if (file.type === 'image/webp') {
    return await isAnimatedWebP(file);
  }

  return false;
}

async function isAnimatedWebP(file: File): Promise<boolean> {
  try {
    const buffer = await file.slice(0, 1024 * 1024).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length - 3; i++) {
      if (
        bytes[i] === 0x41 &&
        bytes[i + 1] === 0x4e &&
        bytes[i + 2] === 0x4d &&
        bytes[i + 3] === 0x46
      ) {
        return true;
      }
    }
  } catch (error) {
    console.warn('Failed to inspect WebP animation', error);
  }
  return false;
}
