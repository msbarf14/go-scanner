const maxPayloadLength = 512;
const validULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

export function extractOrderId(input: string): string | null {
  const payload = input.trim();
  if (payload.length === 0 || payload.length > maxPayloadLength) return null;

  if (validULID.test(payload)) return payload.toUpperCase();

  const path = payload.startsWith('http://') || payload.startsWith('https://')
    ? pathFromURL(payload)
    : payload;
  if (!path) return null;

  const normalizedPath = path.replace(/^\/+/, '');
  if (!normalizedPath.startsWith('ticket/')) return null;

  const ulid = normalizedPath.slice('ticket/'.length).split('/')[0];
  return validULID.test(ulid) ? ulid.toUpperCase() : null;
}

function pathFromURL(value: string): string | null {
  try {
    return new URL(value).pathname;
  } catch {
    return null;
  }
}
