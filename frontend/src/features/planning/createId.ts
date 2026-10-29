/** A short suffix for a copied business ID; the server rejects any duplicate. */
export function createId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (value) =>
    value.toString(16).padStart(2, '0'),
  )
    .join('')
    .toUpperCase();
}
