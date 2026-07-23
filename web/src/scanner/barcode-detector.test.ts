import { describe, expect, it } from 'vitest';
import { createNativeQRDetector, detectNativePayload } from './barcode-detector';
import type { BarcodeDetectorConstructor, ScannerWindow } from './types';

function windowWithFormats(formats: string[]): ScannerWindow {
  const Detector = class {
    static getSupportedFormats = async () => formats;

    detect = async () => [{ rawValue: 'ticket/01KCAFFV7M5RZJDXXH7DGKVJ2S' }];
  } as unknown as BarcodeDetectorConstructor;

  return { BarcodeDetector: Detector } as ScannerWindow;
}

describe('createNativeQRDetector', () => {
  it('creates native detector only when qr_code is supported', async () => {
    await expect(createNativeQRDetector(windowWithFormats(['qr_code']))).resolves.not.toBeNull();
    await expect(createNativeQRDetector(windowWithFormats(['ean_13']))).resolves.toBeNull();
  });

  it('returns raw detector payload without correction', async () => {
    const detector = await createNativeQRDetector(windowWithFormats(['qr_code']));
    await expect(detectNativePayload(detector!, {} as CanvasImageSource)).resolves.toBe('ticket/01KCAFFV7M5RZJDXXH7DGKVJ2S');
  });
});
