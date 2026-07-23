export type ManualLookupType = 'ticket' | 'order_suffix' | 'bib_number';

const maxManualLookupLength = 32;

export function normalizeManualLookup(type: ManualLookupType, payload: string): string | null {
  if (type === 'ticket') return null;

  const value = payload.trim().toUpperCase();
  if (value.length === 0 || value.length > maxManualLookupLength) return null;

  for (const char of value) {
    const isLetter = char >= 'A' && char <= 'Z';
    const isDigit = char >= '0' && char <= '9';
    if (!isLetter && !isDigit) return null;
  }

  return value;
}
