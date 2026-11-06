export function maskUsername(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (v.length <= 2) return `${v[0] ?? "*"}*`;
  return `${v.slice(0, 2)}${"*".repeat(Math.min(8, v.length - 2))}`;
}
