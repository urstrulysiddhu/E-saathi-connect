/**
 * Safely formats a pickup address into a human-readable string.
 * Handles:
 * - string addresses (e.g. "123 Main St, Sydney")
 * - structured address objects (e.g. { street, city, state, postalCode })
 * - alternate keys (e.g. line1, line2, zip, zipCode, country)
 * - null/undefined or empty values
 */
export function formatAddress(address: unknown, fallback = 'Address on file'): string {
  if (address === null || address === undefined) {
    return fallback;
  }

  if (typeof address === 'string') {
    const trimmed = address.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (typeof address === 'object') {
    const addr = address as Record<string, unknown>;
    const street = addr.street || addr.line1 || addr.addressLine1 || addr.address;
    const parts = [
      street,
      addr.line2 || addr.addressLine2,
      addr.city || addr.suburb,
      addr.state || addr.province || addr.region,
      addr.postalCode || addr.postcode || addr.zip || addr.zipCode,
      addr.country,
    ]
      .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      .map((p) => p.trim());

    if (parts.length > 0) {
      return parts.join(', ');
    }

    // Secondary fallback: if object has any non-empty string properties
    const otherValues = Object.entries(addr)
      .filter(([key, val]) => typeof val === 'string' && (val as string).trim().length > 0 && !key.toLowerCase().includes('id'))
      .map(([, val]) => (val as string).trim());

    if (otherValues.length > 0) {
      return otherValues.join(', ');
    }
  }

  return fallback;
}
