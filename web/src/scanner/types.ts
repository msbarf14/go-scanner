export type CameraScannerState = 'idle' | 'requesting_camera' | 'scanning' | 'recovering' | 'paused' | 'error';

export type CameraPauseReason = 'validating' | 'modal' | 'unsafe' | 'page_hidden';

export type CameraDecodeTier = 'native' | 'zxing' | 'recovery';

export interface CameraZoomCapability {
  min: number;
  max: number;
  step: number;
  value: number;
}

export interface CameraCapabilities {
  torch: boolean;
  torchEnabled: boolean;
  zoom?: CameraZoomCapability;
}

export interface CameraStatus {
  state: CameraScannerState;
  message: string;
  detail: string;
  tier?: CameraDecodeTier;
  canRetry: boolean;
}

export interface CameraScannerCallbacks {
  onPayload: (payload: string) => void;
  onStatus: (status: CameraStatus) => void;
  onCapabilities: (capabilities: CameraCapabilities) => void;
  onFatalError: (message: string) => void;
}

export interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>>;
}

export interface BarcodeDetectorConstructor {
  new(options: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

export type ConstraintRange = {
  min?: number;
  max?: number;
  step?: number;
};

export type CameraTrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: ConstraintRange;
  focusMode?: string[];
};

export type CameraTrackConstraintSet = MediaTrackConstraintSet & {
  torch?: boolean;
  zoom?: number;
  focusMode?: string;
};

export type ScannerWindow = Window & typeof globalThis & {
  BarcodeDetector?: BarcodeDetectorConstructor;
};
