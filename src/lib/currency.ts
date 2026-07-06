export function formatMoney(value: number | string | null | undefined, currency = "TSh"): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return `${currency} 0`;
  return `${currency} ${Math.round(n).toLocaleString("en-US")}`;
}

export function parseMoney(input: string): number {
  const n = Number(String(input).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export const DEFAULT_CURRENCY = "TSh";
