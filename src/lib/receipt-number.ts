// Generates a short human-friendly receipt number. Uniqueness is enforced per shop
// at the DB level; if there's a collision the caller retries.
export function generateReceiptNumber(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `WK${y}${m}${d}-${rand}`;
}

export function newClientRef(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
