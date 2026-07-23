import { describe, expect, it } from 'vitest';
import { normalizeManualLookup } from './manual-lookup';

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
