/**
 * 客户端图片压缩工具
 * 使用 Canvas API 将图片转换为 WebP 格式并压缩
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  targetFormat?: 'webp' | 'jpeg' | 'png';
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  format: string;
}

/**
 * 压缩图片文件
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.92,
    targetFormat = 'webp',
  } = options;

  // 读取图片
  const img = await loadImage(file);

  // 计算新尺寸（保持宽高比）
  const { width, height } = calculateDimensions(
    img.width,
    img.height,
    maxWidth,
    maxHeight
  );

  // 创建 Canvas 并绘制
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // 高质量绘制
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  // 转换为 Blob
  const blob = await canvasToBlob(canvas, targetFormat, quality);

  // 创建新文件
  const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
  const newFileName = file.name.replace(/\.[^.]+$/, `.${ext}`);
  const compressedFile = new File([blob], newFileName, {
    type: blob.type,
    lastModified: Date.now(),
  });

  return {
    file: compressedFile,
    originalSize: file.size,
    compressedSize: blob.size,
    width,
    height,
    format: targetFormat,
  };
}

/**
 * 批量压缩图片
 */
export async function compressImages(
  files: File[],
  options: CompressionOptions = {},
  onProgress?: (index: number, total: number) => void
): Promise<CompressionResult[]> {
  const results: CompressionResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const result = await compressImage(files[i], options);
    results.push(result);
    onProgress?.(i + 1, files.length);
  }

  return results;
}

/**
 * 加载图片
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * 计算缩放后的尺寸（保持宽高比）
 */
function calculateDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

/**
 * Canvas 转 Blob
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      `image/${format}`,
      quality
    );
  });
}
