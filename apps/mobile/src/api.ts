import { baseUrl, sessionHeaders } from "./credentials";
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  if (!baseUrl)
    throw new ApiError(
      "Set EXPO_PUBLIC_API_URL to your deployed API origin for the native app.",
      503,
    );
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(await sessionHeaders()),
      ...extraHeaders,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await response.json().catch(() => ({
    message: "The server could not be reached. Please try again.",
  }));
  if (!response.ok)
    throw new ApiError(
      json.message ?? "Something went wrong.",
      response.status,
    );
  return json as T;
}
export const requestKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
