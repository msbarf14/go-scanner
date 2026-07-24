export type CameraFeedbackTone = 'neutral' | 'success' | 'warning' | 'danger';

export type CameraFeedbackKind =
  | 'none'
  | 'loading'
  | 'scan_success'
  | 'duplicate'
  | 'unreadable'
  | 'pickup_success'
  | 'error'
  | 'offline'
  | 'auth';

export interface CameraFeedback {
  kind: CameraFeedbackKind;
  tone: CameraFeedbackTone;
  title: string;
  message: string;
  persistent: boolean;
}

export interface ScanFeedbackInput {
  outcome: string;
  message: string;
  racePackMode: boolean;
  bib?: string;
  name?: string;
  category?: string;
}

export const emptyCameraFeedback: CameraFeedback = {
  kind: 'none',
  tone: 'neutral',
  title: '',
  message: '',
  persistent: false,
};

export function loadingFeedback(message: string): CameraFeedback {
  return {
    kind: 'loading',
    tone: 'neutral',
    title: 'Memproses',
    message,
    persistent: true,
  };
}

export function duplicateFeedback(): CameraFeedback {
  return {
    kind: 'duplicate',
    tone: 'warning',
    title: 'QR baru saja diproses',
    message: 'Arahkan kamera ke QR berikutnya atau tunggu sebentar sebelum scan ulang.',
    persistent: false,
  };
}

export function unreadableFeedback(message = 'QR belum terbaca. Posisikan QR penuh di kotak, kurangi pantulan, atau gunakan Scanner/manual.'): CameraFeedback {
  return {
    kind: 'unreadable',
    tone: 'warning',
    title: 'QR tidak terbaca',
    message,
    persistent: false,
  };
}

export function offlineFeedback(message = 'Koneksi bermasalah. Coba lagi setelah jaringan stabil.'): CameraFeedback {
  return {
    kind: 'offline',
    tone: 'danger',
    title: 'Koneksi bermasalah',
    message,
    persistent: true,
  };
}

export function authFeedback(message = 'Session Race Pack berakhir. Login ulang lalu scan kembali.'): CameraFeedback {
  return {
    kind: 'auth',
    tone: 'danger',
    title: 'Login ulang diperlukan',
    message,
    persistent: true,
  };
}

export function pickupSuccessFeedback(message = 'Race pack berhasil diserahkan'): CameraFeedback {
  return {
    kind: 'pickup_success',
    tone: 'success',
    title: 'Race Pack berhasil',
    message,
    persistent: false,
  };
}

export function scanFeedback(input: ScanFeedbackInput): CameraFeedback {
  const bib = input.bib || '-';
  const name = input.name || '-';
  const category = input.category || '-';

  switch (input.outcome) {
    case 'valid':
      return input.racePackMode
        ? loadingFeedback('Menyiapkan verifikasi penyerahan Race Pack.')
        : {
            kind: 'scan_success',
            tone: 'success',
            title: `#${bib} — ${name}`,
            message: category,
            persistent: false,
          };
    case 'already_picked_up':
      return input.racePackMode
        ? {
            kind: 'duplicate',
            tone: 'danger',
            title: 'Race Pack sudah diambil',
            message: 'Jangan serahkan Race Pack lagi. Arahkan peserta ke supervisor jika ada kendala.',
            persistent: true,
          }
        : {
            kind: 'duplicate',
            tone: 'warning',
            title: `#${bib} — ${name}`,
            message: 'Race Pack peserta ini sudah pernah diambil.',
            persistent: false,
          };
    case 'database_unavailable':
      return offlineFeedback('Server/database bermasalah. Jangan serahkan Race Pack sampai validasi berhasil.');
    case 'station_mismatch':
      return {
        kind: 'error',
        tone: 'danger',
        title: 'Station tidak sesuai',
        message: input.message,
        persistent: true,
      };
    case 'unauthenticated':
    case 'forbidden':
      return authFeedback(input.message);
    default:
      return {
        kind: 'error',
        tone: 'danger',
        title: 'Scan ditolak',
        message: input.message,
        persistent: true,
      };
  }
}
