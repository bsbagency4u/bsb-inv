export function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  if (err.code === "42703" || err.code === "PGRST204") return true;
  return (
    typeof err.message === "string" &&
    /column .* does not exist|Could not find the .* column/i.test(err.message)
  );
}

export function omitColumns<T extends Record<string, unknown>>(payload: T, columns: readonly string[]): T {
  const next = { ...payload };
  for (const key of columns) {
    delete next[key];
  }
  return next;
}
