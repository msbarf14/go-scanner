import { describe, expect, it } from 'vitest';
import { extractOrderId, extractScanTarget } from './parser';

const orderID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const externalID = '01BX5ZZKBKACTAV9WEVGEMMVRZ';

describe('scan target parser', () => {
  it('accepts canonical and legacy order formats', () => {
    expect(extractScanTarget(`https://event.test/ticket/${orderID}/ticket.pdf?download=true`)).toEqual({ type: 'order', id: orderID });
    expect(extractScanTarget(`/ticket/${orderID}`)).toEqual({ type: 'order', id: orderID });
    expect(extractScanTarget(`/ticket/${orderID}/2/ticket.pdf`)).toEqual({ type: 'order', id: orderID });
    expect(extractOrderId(orderID.toLowerCase())).toBe(orderID);
  });

  it('accepts external participant URL and token', () => {
    expect(extractScanTarget(`https://event.test/external-participants/${externalID}/ticket.pdf`)).toEqual({ type: 'external_participant', id: externalID });
    expect(extractScanTarget(`external:${externalID.toLowerCase()}`)).toEqual({ type: 'external_participant', id: externalID });
  });

  it('rejects partial and malformed paths', () => {
    expect(extractScanTarget(`/external-participants/${externalID}`)).toBeNull();
    expect(extractScanTarget(`/ticket/${orderID}/ticket.pdf/extra`)).toBeNull();
    expect(extractScanTarget(`scan /ticket/${orderID}/ticket.pdf now`)).toBeNull();
    expect(extractScanTarget('external:not-a-ulid')).toBeNull();
  });
});
