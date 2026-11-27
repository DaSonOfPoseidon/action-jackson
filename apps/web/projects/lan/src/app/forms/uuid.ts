// A version 4 UUID from crypto.getRandomValues, for an Idempotency-Key. Not crypto.randomUUID: that exists only in a secure
// context, and the LAN edge (http://192.168.1.69:8180) and the e2e edges are plain http. getRandomValues works in both.
//
// `fill` is the source of the 16 random bytes (a test passes its own); the version and variant bits are set over whatever
// it gives.
export function uuidV4(fill: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> = (bytes) => crypto.getRandomValues(bytes)): string {
  const bytes = fill(new Uint8Array(16));
  // Version 4 in the high nibble of byte 6, and the RFC 4122 variant (10xx) in the high bits of byte 8.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
