export type RecoveryVariant = 'center_crop' | 'contrast' | 'threshold' | 'inverted' | 'upscale';

const variants: RecoveryVariant[] = ['center_crop', 'contrast', 'threshold', 'inverted', 'upscale'];

export function nextRecoveryVariants(startIndex: number, count = 2): RecoveryVariant[] {
  const selected: RecoveryVariant[] = [];
  for (let i = 0; i < count; i += 1) {
    selected.push(variants[(startIndex + i) % variants.length]);
  }
  return selected;
}

export function recoveryVariantCount(): number {
  return variants.length;
}

export class FramePreprocessor {
  private readonly canvas = document.createElement('canvas');
  private readonly sourceCanvas = document.createElement('canvas');

  makeVariant(video: HTMLVideoElement, variant: RecoveryVariant): HTMLCanvasElement | null {
    if (video.videoWidth <= 0 || video.videoHeight <= 0) return null;

    const source = this.captureCenter(video, variant === 'upscale' ? 1.8 : 1);
    if (!source) return null;

    if (variant === 'center_crop' || variant === 'upscale') return source;

    const ctx = source.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const image = ctx.getImageData(0, 0, source.width, source.height);
    const data = image.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      let value = gray;

      if (variant === 'contrast') {
        value = clamp((gray - 128) * 1.6 + 128);
      } else if (variant === 'threshold') {
        value = gray > 130 ? 255 : 0;
      } else if (variant === 'inverted') {
        value = 255 - gray;
      }

      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }

    ctx.putImageData(image, 0, 0);
    return source;
  }

  private captureCenter(video: HTMLVideoElement, scale: number): HTMLCanvasElement | null {
    const sourceSize = Math.floor(Math.min(video.videoWidth, video.videoHeight) * 0.82);
    if (sourceSize <= 0) return null;

    const sourceX = Math.floor((video.videoWidth - sourceSize) / 2);
    const sourceY = Math.floor((video.videoHeight - sourceSize) / 2);
    const targetSize = Math.min(1200, Math.max(360, Math.floor(sourceSize * scale)));

    this.sourceCanvas.width = targetSize;
    this.sourceCanvas.height = targetSize;
    const ctx = this.sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, sourceX, sourceY, sourceSize, sourceSize, 0, 0, targetSize, targetSize);

    this.canvas.width = targetSize;
    this.canvas.height = targetSize;
    const output = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!output) return null;

    output.drawImage(this.sourceCanvas, 0, 0);
    return this.canvas;
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}
