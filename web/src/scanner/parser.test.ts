import { describe, expect, it } from 'vitest';
import { extractOrderId } from './parser';

const ulid = '01KCAFFV7M5RZJDXXH7DGKVJ2S';

describe('extractOrderId', () => {
  it('accepts raw ULID and normalizes casing', () => {
    expect(extractOrderId(ulid.toLowerCase())).toBe(ulid);
  });

  it('accepts ticket paths with or without leading slash', () => {
    expect(extractOrderId(`ticket/${ulid}`)).toBe(ulid);
    expect(extractOrderId(`/ticket/${ulid}/extra`)).toBe(ulid);
  });

  it('accepts full HTTP URLs with ticket path', () => {
    expect(extractOrderId(`https://scanner.example.com/ticket/${ulid}?utm=qr`)).toBe(ulid);
  });

  it('rejects unknown paths and invalid characters', () => {
    expect(extractOrderId(`/orders/${ulid}`)).toBeNull();
    expect(extractOrderId('01KCAFFV7M5RZJDXXH7DGKVJ2I')).toBeNull();
  });

  it('rejects empty and oversized payloads', () => {
    expect(extractOrderId('   ')).toBeNull();
    expect(extractOrderId('x'.repeat(513))).toBeNull();
  });
});
