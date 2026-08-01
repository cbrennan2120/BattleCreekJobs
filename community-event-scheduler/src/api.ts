export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallback = response.status === 429
      ? "Too many attempts. Please wait and try again."
      : response.status === 413
        ? "That request is too large. Refresh the page and try again."
        : "Something went wrong. Please try again.";
    throw new ApiError(
      typeof payload.error === "string" ? payload.error : fallback,
      response.status,
      payload.details,
    );
  }
  return payload as T;
}
