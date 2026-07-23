import type { BarcodeDetectorLike, ScannerWindow } from './types';

export async function createNativeQRDetector(win: ScannerWindow = window as ScannerWindow): Promise<BarcodeDetectorLike | null> {
  const Detector = win.BarcodeDetector;
  if (!Detector) return null;

  const formats: string[] = await Detector.getSupportedFormats().catch(() => []);
  if (!formats.includes('qr_code')) return null;

  return new Detector({ formats: ['qr_code'] });
}

export async function detectNativePayload(detector: BarcodeDetectorLike, source: CanvasImageSource): Promise<string | null> {
  const results = await detector.detect(source);
  const payload = results.find((result) => result.rawValue && result.rawValue.trim() !== '')?.rawValue;
  return payload || null;
}
