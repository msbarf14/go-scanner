import { describe, expect, it } from 'vitest';
import {
  authFeedback,
  duplicateFeedback,
  offlineFeedback,
  pickupSuccessFeedback,
  scanFeedback,
  unreadableFeedback,
} from './feedback';

describe('camera feedback', () => {
  it('directs a runner to the correct station', () => {
    expect(scanFeedback({
      outcome: 'station_mismatch',
      message: 'Tiket ini dilayani di Station #2. Silakan menuju Station #2.',
      racePackMode: false,
    })).toMatchObject({
      kind: 'error',
      tone: 'danger',
      title: 'Station tidak sesuai',
      persistent: true,
    });
  });

  it('maps valid normal scan to success feedback', () => {
    expect(scanFeedback({
      outcome: 'valid',
      message: 'Tiket valid',
      racePackMode: false,
      bib: '1234',
      name: 'Runner Test',
      category: '10K',
    })).toMatchObject({
      kind: 'scan_success',
      tone: 'success',
      title: '#1234 — Runner Test',
      message: '10K',
      persistent: false,
    });
  });

  it('maps already picked up in race pack mode to persistent danger feedback', () => {
    expect(scanFeedback({
      outcome: 'already_picked_up',
      message: 'Race pack sudah pernah diambil',
      racePackMode: true,
    })).toMatchObject({
      kind: 'duplicate',
      tone: 'danger',
      persistent: true,
    });
  });

  it('provides duplicate and unreadable fallbacks without backend outcomes', () => {
    expect(duplicateFeedback()).toMatchObject({ kind: 'duplicate', tone: 'warning' });
    expect(unreadableFeedback()).toMatchObject({ kind: 'unreadable', tone: 'warning' });
  });

  it('shows pickup success only through explicit pickup feedback', () => {
    expect(pickupSuccessFeedback()).toMatchObject({
      kind: 'pickup_success',
      tone: 'success',
      title: 'Race Pack berhasil',
    });
  });

  it('maps connectivity and auth feedback to persistent danger states', () => {
    expect(offlineFeedback()).toMatchObject({ kind: 'offline', tone: 'danger', persistent: true });
    expect(authFeedback()).toMatchObject({ kind: 'auth', tone: 'danger', persistent: true });
  });
});
