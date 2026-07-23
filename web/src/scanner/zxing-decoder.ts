import { BrowserQRCodeReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

function qrHints(tryHarder: boolean): Map<DecodeHintType, unknown> {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  if (tryHarder) hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
}

export class QRFrameDecoder {
  private readonly normalReader = new BrowserQRCodeReader(qrHints(false));
  private readonly recoveryReader = new BrowserQRCodeReader(qrHints(true));

  decodeNormal(source: HTMLVideoElement | HTMLCanvasElement): string | null {
    return this.decode(this.normalReader, source);
  }

  decodeRecovery(source: HTMLVideoElement | HTMLCanvasElement): string | null {
    return this.decode(this.recoveryReader, source);
  }

  private decode(reader: BrowserQRCodeReader, source: HTMLVideoElement | HTMLCanvasElement): string | null {
    try {
      const result = source instanceof HTMLCanvasElement
        ? reader.decodeFromCanvas(source)
        : reader.decode(source);
      const payload = result.getText();
      return payload.trim() === '' ? null : payload;
    } catch {
      return null;
    }
  }
}
