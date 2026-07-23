const maxPayloadLength = 512;
const ulidPart = '[0-9A-HJ-NP-Za-hj-np-z]{26}';
const rawULID = new RegExp(`^(${ulidPart})$`, 'i');
const externalToken = new RegExp(`^external:(${ulidPart})$`, 'i');
const orderPath = new RegExp(`^/ticket/(${ulidPart})(?:/ticket\\.pdf|/[0-9]+/ticket\\.pdf)?/?$`, 'i');
const externalPath = new RegExp(`^/external-participants/(${ulidPart})/ticket\\.pdf/?$`, 'i');

export type ScanTargetType = 'order' | 'external_participant';
export interface ScanTarget { type: ScanTargetType; id: string }

export function extractScanTarget(input: string): ScanTarget | null {
  const payload = input.trim();
  if (payload.length === 0 || payload.length > maxPayloadLength || /\s/.test(payload)) return null;

  let match = externalToken.exec(payload);
  if (match) return { type: 'external_participant', id: match[1].toUpperCase() };
  match = rawULID.exec(payload);
  if (match) return { type: 'order', id: match[1].toUpperCase() };

  const path = pathFromInput(payload);
  if (!path) return null;
  match = externalPath.exec(path);
  if (match) return { type: 'external_participant', id: match[1].toUpperCase() };
  match = orderPath.exec(path);
  if (match) return { type: 'order', id: match[1].toUpperCase() };
  return null;
}

export function extractOrderId(input: string): string | null {
  const target = extractScanTarget(input);
  return target?.type === 'order' ? target.id : null;
}

function pathFromInput(value: string): string | null {
  try {
    if (value.startsWith('/')) return new URL(value, 'https://scanner.invalid').pathname;
    if (value.startsWith('ticket/') || value.startsWith('external-participants/')) {
      return new URL(value, 'https://scanner.invalid').pathname;
    }
    const parsed = new URL(value);
    return parsed.hostname ? parsed.pathname : null;
  } catch {
    return null;
  }
}
