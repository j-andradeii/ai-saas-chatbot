/**
 * Header secrets are masked on read, which means an edit-and-save round trip
 * will happily post the mask back and overwrite the real credential. The mask
 * is therefore defined here once and treated as a sentinel on write: a masked
 * value never replaces a stored one.
 */
export const MASK = '••••••••'

/** Mask a header value for display: keep a short prefix so it stays recognisable. */
export function maskValue(value: string): string {
  return value.length > 4 ? value.slice(0, 4) + MASK : MASK
}

export function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    masked[key] = maskValue(String(value))
  }
  return masked
}

/** True when a submitted value is (or still contains) the display mask. */
export function isMasked(value: string): boolean {
  return value.includes(MASK)
}

/**
 * Merge submitted headers over the stored ones.
 *
 * - A value the user actually typed is written through.
 * - A value still showing the mask keeps whatever is stored under that key.
 * - A masked value under a key with nothing stored is dropped rather than
 *   persisted as literal bullet characters.
 * - Keys absent from the submission are removed, so deleting a header works.
 */
export function mergeMaskedHeaders(
  submitted: Record<string, string>,
  stored: Record<string, string>
): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const [key, value] of Object.entries(submitted)) {
    if (!isMasked(value)) {
      merged[key] = value
      continue
    }
    const existing = stored[key]
    if (typeof existing === 'string' && existing.length > 0) merged[key] = existing
  }
  return merged
}

/**
 * HTTP header values must be representable as latin-1. Node's fetch throws a
 * bare "Cannot convert argument to a ByteString" TypeError otherwise, which is
 * useless to a chatbot owner — so callers check first and say something useful.
 */
export function isSendableHeaderValue(value: string): boolean {
  return !/[^\u0000-\u00ff]/.test(value)
}

/** The first header whose value cannot be sent, if any. */
export function unsendableHeader(
  headers: Record<string, string>
): string | null {
  for (const [key, value] of Object.entries(headers)) {
    if (!isSendableHeaderValue(String(value))) return key
  }
  return null
}
