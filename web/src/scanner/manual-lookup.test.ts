import { describe, expect, it } from 'vitest';
import { lookupTypeAllowed, lookupTypeForSource, normalizeManualLookup } from './manual-lookup';

describe('manual lookup input', () => {
  it('normalizes order suffix and bib number', () => {
    expect(normalizeManualLookup('order_suffix', ' gog ')).toBe('GOG');
    expect(normalizeManualLookup('bib_number', 'n0302')).toBe('N0302');
  });

  it('rejects ticket mode and wildcard-like input', () => {
    expect(normalizeManualLookup('ticket', 'GOG')).toBeNull();
    expect(normalizeManualLookup('order_suffix', '260606/GOG')).toBeNull();
    expect(normalizeManualLookup('bib_number', 'N%')).toBeNull();
    expect(normalizeManualLookup('bib_number', 'N 0302')).toBeNull();
  });
});

describe('manual lookup source filter', () => {
  it('keeps Online lookup modes available', () => {
    expect(lookupTypeAllowed('online', 'order_suffix')).toBe(true);
    expect(lookupTypeForSource('online', 'order_suffix')).toBe('order_suffix');
  });

  it('disables VIP order suffix and switches it to BIB', () => {
    expect(lookupTypeAllowed('vip', 'order_suffix')).toBe(false);
    expect(lookupTypeForSource('vip', 'order_suffix')).toBe('bib_number');
  });
});
