export function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  if (err.code === "42703" || err.code === "PGRST204") return true;
  return (
    typeof err.message === "string" &&
    /column .* does not exist|Could not find the .* column/i.test(err.message)
  );
}

export function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  return (
    typeof err.message === "string" &&
    /relation .* does not exist|Could not find the table/i.test(err.message)
  );
}

export function omitColumns<T extends Record<string, unknown>>(payload: T, columns: readonly string[]): T {
  const next = { ...payload };
  for (const key of columns) {
    delete next[key];
  }
  return next;
}
