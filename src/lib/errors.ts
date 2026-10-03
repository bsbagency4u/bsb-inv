export type AppErrorCode =
  | "VALIDATION"
  | "AUTH"
  | "AUTHORIZATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "INTERNAL"
  | "NETWORK"
  | "DATABASE"
  | "UNKNOWN";

export interface AppErrorOptions {
  code?: AppErrorCode;
  status?: number;
  details?: unknown;
  cause?: unknown;
}

const DEFAULT_STATUS_BY_CODE: Record<AppErrorCode, number> = {
  VALIDATION: 422,
  AUTH: 401,
  AUTHORIZATION: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  INTERNAL: 500,
  NETWORK: 0,
  DATABASE: 500,
  UNKNOWN: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly isAppError = true;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = "AppError";
    this.code = options.code ?? "UNKNOWN";
    this.status = options.status ?? DEFAULT_STATUS_BY_CODE[this.code];
    this.details = options.details;
    if (options.cause) {
      this.cause = options.cause;
    }
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(message, { code: "VALIDATION", details });
  }

  static auth(message = "Authentication required."): AppError {
    return new AppError(message, { code: "AUTH" });
  }

  static authorization(message = "You do not have permission to do this."): AppError {
    return new AppError(message, { code: "AUTHORIZATION" });
  }

  static notFound(message = "The requested resource was not found."): AppError {
    return new AppError(message, { code: "NOT_FOUND" });
  }

  static conflict(message = "The resource conflicts with existing data."): AppError {
    return new AppError(message, { code: "CONFLICT" });
  }

  static unprocessable(message = "The request could not be processed."): AppError {
    return new AppError(message, { code: "UNPROCESSABLE" });
  }

  static internal(message = "Something went wrong on our side."): AppError {
    return new AppError(message, { code: "INTERNAL" });
  }

  static network(message = "Network error. Check your connection and try again."): AppError {
    return new AppError(message, { code: "NETWORK" });
  }

  static database(message = "Database operation failed."): AppError {
    return new AppError(message, { code: "DATABASE" });
  }
}

export interface NormalizedError {
  code: AppErrorCode;
  status: number;
  message: string;
  userMessage: string;
}

function asErrorField(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value === null || value === undefined) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatDatabaseError(error: {
  code?: string;
  message?: string;
  details?: unknown;
  hint?: unknown;
}): string {
  const parts: string[] = [];
  if (error.code) parts.push(error.code);
  if (error.message) parts.push(error.message);
  const details = asErrorField(error.details);
  const hint = asErrorField(error.hint);
  if (details) parts.push(details);
  if (hint) parts.push(`Hint: ${hint}`);
  return parts.join(" — ") || "The database could not complete the request.";
}

export function annotateDatabaseError(
  error: unknown,
  table: string,
  operation: string
): unknown {
  if (!error || typeof error !== "object") return error;
  const err = error as { details?: unknown };
  const extra = `table=${table} operation=${operation}`;
  const existing = asErrorField(err.details);
  err.details = existing && existing !== extra ? `${existing} — ${extra}` : extra;
  return error;
}

/**
 * Maps a Supabase-style error to a normalized AppError.
 * Never leaks raw stack traces or internal messages.
 */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof AppError) {
    return {
      code: error.code,
      status: error.status,
      message: error.message,
      userMessage: error.message,
    };
  }

  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    const status = typeof err.status === "number" ? err.status : undefined;
    const code = typeof err.code === "string" ? err.code : undefined;
    const message =
      typeof err.message === "string" ? err.message : undefined;
    const details = err.details;
    const hint = err.hint;

    switch (status) {
      case 401:
        return {
          code: "AUTH",
          status: 401,
          message: message ?? "Authentication failed.",
          userMessage: "Your session is invalid or has expired. Please sign in again.",
        };
      case 403:
        return {
          code: "AUTHORIZATION",
          status: 403,
          message: message ?? "Forbidden.",
          userMessage: "You do not have permission to perform this action.",
        };
      case 404:
        return {
          code: "NOT_FOUND",
          status: 404,
          message: message ?? "Not found.",
          userMessage: "The requested item could not be found.",
        };
      case 409:
        return {
          code: "CONFLICT",
          status: 409,
          message: message ?? "Conflict.",
          userMessage: "This conflicts with existing data. It may already exist.",
        };
      case 422:
        return {
          code: "UNPROCESSABLE",
          status: 422,
          message: message ?? "Unprocessable.",
          userMessage: "Some of the supplied values are invalid.",
        };
    }

    if (code === "PGRST116") {
      return {
        code: "NOT_FOUND",
        status: 404,
        message: message ?? "No matching row found.",
        userMessage: "The requested item could not be found.",
      };
    }
    if (code === "42501") {
      return {
        code: "AUTHORIZATION",
        status: 403,
        message: message ?? "Row-level security denied the write.",
        userMessage: "You do not have permission to save this.",
      };
    }
    if (code === "23505") {
      return {
        code: "CONFLICT",
        status: 409,
        message: message ?? "Unique constraint failed.",
        userMessage: "This conflicts with existing data. It may already exist.",
      };
    }
    if (code === "23503") {
      return {
        code: "UNPROCESSABLE",
        status: 422,
        message: message ?? "Foreign key constraint failed.",
        userMessage: "This could not be saved because a related record is missing.",
      };
    }
    if (code === "23502") {
      return {
        code: "VALIDATION",
        status: 422,
        message: message ?? "Not-null constraint failed.",
        userMessage: "A required value is missing.",
      };
    }
    const looksLikeDatabase =
      (typeof code === "string" && (code.startsWith("PGRST") || /^[0-9]{5}$/.test(code))) ||
      (typeof message === "string" &&
        /column .* does not exist|Could not find the .* column|schema cache|violates .* constraint/i.test(
          message
        ));
    if (looksLikeDatabase) {
      const userMessage = formatDatabaseError({ code, message, details, hint });
      return {
        code: "DATABASE",
        status: 500,
        message: message ?? "Database query failed.",
        userMessage,
      };
    }
    if (
      typeof message === "string" &&
      /fetch|network|failed to connect|ECONNREFUSED|ERR_INTERNET/i.test(message)
    ) {
      return {
        code: "NETWORK",
        status: 0,
        message: "Network failure.",
        userMessage: "Network error. Check your connection and try again.",
      };
    }
  }

  if (error instanceof Error && error.message) {
    const status =
      (error as Error & { status?: number }).status ?? (error as Error & { statusCode?: number }).statusCode;
    return {
      code: status === 500 ? "INTERNAL" : "UNKNOWN",
      status: status ?? 500,
      message: error.message,
      userMessage: "Something went wrong. Please try again.",
    };
  }

  return {
    code: "UNKNOWN",
    status: 500,
    message: "Unknown error.",
    userMessage: "Something unexpected happened. Please try again.",
  };
}
