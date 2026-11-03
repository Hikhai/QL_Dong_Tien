const amountFormatter = new Intl.NumberFormat("vi-VN");

export function formatVnd(value: number): string {
  const rounded = Math.round(value);
  const negative = rounded < 0;
  return `${negative ? "-" : ""}${amountFormatter.format(Math.abs(rounded))} ₫`;
}

export function formatSignedVnd(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${formatVnd(rounded)}`;
  return formatVnd(rounded);
}

export function formatPlain(value: number): string {
  return amountFormatter.format(Math.round(Math.abs(value)));
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export const MAX_AMOUNT_DIGITS = 12;

export function appendDigits(current: string, extra: string): string {
  const next = digitsOnly(`${current}${extra}`).slice(0, MAX_AMOUNT_DIGITS);
  return next;
}

export function parseAmount(value: string): number | null {
  const digits = digitsOnly(value);
  if (!digits) return null;
  const amount = Number(digits);
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  return amount;
}

export function parseSignedBalance(value: string): number | null {
  const negative = value.trim().startsWith("-");
  const digits = digitsOnly(value);
  if (!digits) return 0;
  const amount = Number(digits);
  if (!Number.isSafeInteger(amount)) return null;
  return negative ? -amount : amount;
}
