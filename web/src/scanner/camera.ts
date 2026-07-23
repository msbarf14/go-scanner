import { createNativeQRDetector, detectNativePayload } from './barcode-detector';
import { FramePreprocessor, nextRecoveryVariants, recoveryVariantCount } from './preprocess';
import type {
  BarcodeDetectorLike,
  CameraCapabilities,
  CameraScannerCallbacks,
  CameraScannerState,
  CameraStatus,
  CameraTrackCapabilities,
  CameraTrackConstraintSet,
} from './types';
import { QRFrameDecoder } from './zxing-decoder';

const normalIntervalMs = 140;
const recoveryIntervalMs = 400;
const startTimeoutMs = 10000;
const nativeMissesBeforeZXing = 3;

const emptyCapabilities: CameraCapabilities = {
  torch: false,
  torchEnabled: false,
};

export class CameraScannerController {
  private readonly callbacks: CameraScannerCallbacks;
  private readonly decoder: QRFrameDecoder;
  private readonly preprocessor: FramePreprocessor;
  private nativeDetector: BarcodeDetectorLike | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private track: MediaStreamTrack | null = null;
  private state: CameraScannerState = 'idle';
  private timer: number | null = null;
  private generation = 0;
  private decodeBusy = false;
  private nativeMisses = 0;
  private lastNormalAt = 0;
  private lastRecoveryAt = 0;
  private recoveryIndex = 0;
  private capabilities: CameraCapabilities = emptyCapabilities;
  private restartAttempted = false;
  private pausedMessage = 'Kamera dijeda sementara.';

  constructor(callbacks: CameraScannerCallbacks, decoder = new QRFrameDecoder(), preprocessor = new FramePreprocessor()) {
    this.callbacks = callbacks;
    this.decoder = decoder;
    this.preprocessor = preprocessor;
  }

  getStatus(): CameraStatus {
    return this.statusForState(this.state);
  }

  isStarting(): boolean {
    return this.state === 'requesting_camera';
  }

  isActive(): boolean {
    return Boolean(this.stream && (this.state === 'scanning' || this.state === 'recovering' || this.state === 'paused'));
  }

  isRecovering(): boolean {
    return this.state === 'recovering';
  }

  attachVideo(video: HTMLVideoElement | null) {
    this.video = video;
    if (video && this.stream) {
      video.srcObject = this.stream;
      void video.play().catch(() => undefined);
    }
  }

  async start(video: HTMLVideoElement) {
    if (this.state === 'requesting_camera' || this.state === 'scanning' || this.state === 'recovering') return;

    const currentGeneration = this.generation + 1;
    this.generation = currentGeneration;
    this.video = video;
    this.restartAttempted = false;
    this.setState('requesting_camera', 'Meminta izin kamera...', 'Browser akan meminta akses kamera belakang.');

    if (!navigator.mediaDevices?.getUserMedia) {
      this.failToScanner('Kamera tidak tersedia di browser/perangkat ini. Scanner/manual diaktifkan.');
      return;
    }

    try {
      const stream = await withTimeout(navigator.mediaDevices.getUserMedia(cameraConstraints()), startTimeoutMs);
      if (this.generation !== currentGeneration) {
        stopStream(stream);
        return;
      }

      this.stream = stream;
      this.track = stream.getVideoTracks()[0] || null;
      this.track?.addEventListener('ended', this.handleTrackEnded);
      this.attachVideo(video);
      await video.play().catch(() => undefined);
      this.nativeDetector = await createNativeQRDetector();
      this.updateCapabilities();
      await this.applyContinuousFocus();
      this.setState('scanning', 'Kamera aktif. Arahkan ke QR tiket.', 'Letakkan QR di dalam kotak dan tahan perangkat tetap stabil.');
      this.scheduleNext(0);
    } catch (caught) {
      const message = caught instanceof DOMException && caught.name === 'NotAllowedError'
        ? 'Izin kamera ditolak. Scanner/manual diaktifkan.'
        : caught instanceof Error && caught.message === 'camera_timeout'
          ? 'Kamera terlalu lama merespons. Scanner/manual diaktifkan.'
          : 'Kamera tidak bisa dibuka. Scanner/manual diaktifkan.';
      this.failToScanner(message);
    }
  }

  pause(message = 'Kamera dijeda sementara.') {
    if (!this.stream || this.state === 'idle' || this.state === 'error') return;
    this.pausedMessage = message;
    this.clearTimer();
    this.setState('paused', message, 'Pemindaian akan dilanjutkan otomatis setelah proses selesai.');
  }

  resume() {
    if (!this.stream || this.state !== 'paused') return;
    this.setState('scanning', 'Kamera aktif. Arahkan ke QR tiket.', 'Letakkan QR di dalam kotak dan tahan perangkat tetap stabil.');
    this.scheduleNext(0);
  }

  stop(message = 'Kamera dimatikan. Scanner/manual aktif.') {
    this.generation += 1;
    this.clearTimer();
    this.decodeBusy = false;
    this.nativeMisses = 0;
    this.lastNormalAt = 0;
    this.lastRecoveryAt = 0;
    if (this.track) this.track.removeEventListener('ended', this.handleTrackEnded);
    if (this.video) this.video.srcObject = null;
    if (this.stream) stopStream(this.stream);
    this.stream = null;
    this.track = null;
    this.nativeDetector = null;
    this.capabilities = emptyCapabilities;
    this.callbacks.onCapabilities(this.capabilities);
    this.setState('idle', message, 'Gunakan scanner USB/Bluetooth atau aktifkan kamera lagi.');
  }

  retry() {
    if (!this.video || this.state === 'requesting_camera') return;
    const video = this.video;
    this.state = 'idle';
    void this.start(video);
  }

  async setTorch(enabled: boolean) {
    if (!this.track || !this.capabilities.torch) return;
    await this.track.applyConstraints({ advanced: [{ torch: enabled } as CameraTrackConstraintSet] });
    this.capabilities = { ...this.capabilities, torchEnabled: enabled };
    this.callbacks.onCapabilities(this.capabilities);
  }

  async setZoom(value: number) {
    if (!this.track || !this.capabilities.zoom) return;
    const zoom = this.capabilities.zoom;
    const next = Math.min(zoom.max, Math.max(zoom.min, value));
    await this.track.applyConstraints({ advanced: [{ zoom: next } as CameraTrackConstraintSet] });
    this.capabilities = { ...this.capabilities, zoom: { ...zoom, value: next } };
    this.callbacks.onCapabilities(this.capabilities);
  }

  private scheduleNext(delay = normalIntervalMs) {
    this.clearTimer();
    if (!this.stream || !this.video || this.state === 'paused' || this.state === 'idle' || this.state === 'error') return;
    this.timer = window.setTimeout(() => void this.decodeCycle(), delay);
  }

  private async decodeCycle() {
    if (!this.video || !this.stream || this.decodeBusy || this.state === 'paused') {
      this.scheduleNext();
      return;
    }

    if (this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.scheduleNext();
      return;
    }

    this.decodeBusy = true;
    const now = Date.now();
    let payload: string | null = null;

    try {
      if (now - this.lastNormalAt >= normalIntervalMs) {
        this.lastNormalAt = now;
        payload = await this.decodeNormalFrame();
      }

      if (!payload && now - this.lastRecoveryAt >= recoveryIntervalMs) {
        this.lastRecoveryAt = now;
        payload = this.decodeRecoveryFrame();
      }

      if (payload) {
        this.pause('Memvalidasi hasil scan...');
        this.callbacks.onPayload(payload);
        return;
      }
    } finally {
      this.decodeBusy = false;
    }

    this.scheduleNext();
  }

  private async decodeNormalFrame(): Promise<string | null> {
    if (!this.video) return null;

    if (this.nativeDetector) {
      const nativePayload = await detectNativePayload(this.nativeDetector, this.video).catch(() => null);
      if (nativePayload) {
        this.nativeMisses = 0;
        return nativePayload;
      }
      this.nativeMisses += 1;
    }

    if (this.nativeDetector && this.nativeMisses < nativeMissesBeforeZXing) return null;

    return this.decoder.decodeNormal(this.video);
  }

  private decodeRecoveryFrame(): string | null {
    if (!this.video) return null;

    this.setState('recovering', 'Mencoba recovery QR...', 'Tahan QR di tengah, kurangi pantulan, dan tunggu sebentar.');

    const selected = nextRecoveryVariants(this.recoveryIndex, 2);
    this.recoveryIndex = (this.recoveryIndex + selected.length) % recoveryVariantCount();

    for (const variant of selected) {
      const canvas = this.preprocessor.makeVariant(this.video, variant);
      if (!canvas) continue;
      const payload = this.decoder.decodeRecovery(canvas);
      if (payload) return payload;
    }

    this.setState('scanning', 'Kamera aktif. Arahkan ke QR tiket.', 'Letakkan QR di dalam kotak dan tahan perangkat tetap stabil.');
    return null;
  }

  private updateCapabilities() {
    if (!this.track?.getCapabilities) {
      this.capabilities = emptyCapabilities;
      this.callbacks.onCapabilities(this.capabilities);
      return;
    }

    const raw = this.track.getCapabilities() as CameraTrackCapabilities;
    const settings = this.track.getSettings();
    const zoom = raw.zoom && typeof raw.zoom.min === 'number' && typeof raw.zoom.max === 'number'
      ? {
          min: raw.zoom.min,
          max: raw.zoom.max,
          step: raw.zoom.step || 0.1,
          value: typeof settings.zoom === 'number' ? settings.zoom : raw.zoom.min,
        }
      : undefined;

    this.capabilities = {
      torch: Boolean(raw.torch),
      torchEnabled: false,
      zoom,
    };
    this.callbacks.onCapabilities(this.capabilities);
  }

  private async applyContinuousFocus() {
    if (!this.track?.getCapabilities) return;
    const raw = this.track.getCapabilities() as CameraTrackCapabilities;
    if (!raw.focusMode?.includes('continuous')) return;
    await this.track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as CameraTrackConstraintSet] }).catch(() => undefined);
  }

  private handleTrackEnded = () => {
    if (this.state === 'idle' || this.state === 'error') return;
    if (this.restartAttempted || !this.video) {
      this.failToScanner('Kamera terputus. Scanner/manual diaktifkan.');
      return;
    }

    const video = this.video;
    this.restartAttempted = true;
    this.stop('Kamera terputus. Mencoba membuka ulang...');
    void this.start(video);
  };

  private failToScanner(message: string) {
    this.stop(message);
    this.setState('error', message, 'Gunakan tombol retry atau kembali ke Scanner/manual.');
    this.callbacks.onFatalError(message);
  }

  private setState(state: CameraScannerState, message: string, detail: string) {
    this.state = state;
    this.callbacks.onStatus({
      state,
      message,
      detail,
      tier: state === 'recovering' ? 'recovery' : state === 'scanning' && this.nativeDetector ? 'native' : 'zxing',
      canRetry: state === 'error',
    });
  }

  private statusForState(state: CameraScannerState): CameraStatus {
    switch (state) {
      case 'requesting_camera':
        return { state, message: 'Meminta izin kamera...', detail: 'Browser akan meminta akses kamera belakang.', canRetry: false };
      case 'scanning':
        return { state, message: 'Kamera aktif. Arahkan ke QR tiket.', detail: 'Letakkan QR di dalam kotak dan tahan perangkat tetap stabil.', canRetry: false };
      case 'recovering':
        return { state, message: 'Mencoba recovery QR...', detail: 'Tahan QR di tengah, kurangi pantulan, dan tunggu sebentar.', tier: 'recovery', canRetry: false };
      case 'paused':
        return { state, message: this.pausedMessage, detail: 'Pemindaian akan dilanjutkan otomatis setelah proses selesai.', canRetry: false };
      case 'error':
        return { state, message: 'Kamera bermasalah.', detail: 'Gunakan tombol retry atau kembali ke Scanner/manual.', canRetry: true };
      case 'idle':
        return { state, message: 'Kamera belum aktif.', detail: 'USB/manual tetap bisa digunakan.', canRetry: false };
    }
  }

  private clearTimer() {
    if (this.timer === null) return;
    window.clearTimeout(this.timer);
    this.timer = null;
  }
}

function cameraConstraints(): MediaStreamConstraints {
  return {
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  };
}

function withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error('camera_timeout')), timeout);
    }),
  ]);
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}
