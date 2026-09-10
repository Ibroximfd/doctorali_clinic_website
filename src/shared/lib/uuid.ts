/**
 * Random v4 UUID, used for `Idempotency-Key` headers (backend §11.2).
 *
 * One key is minted when a form starts submitting and reused for EVERY retry of
 * that same submission, so a dropped connection followed by a second tap can
 * never create two orders, treatments, debt payments or appointments.
 */
export function uuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    // These keys need to be unique, not unguessable.
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = (start: number, end: number) =>
    Array.from(bytes.slice(start, end), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}`;
}
