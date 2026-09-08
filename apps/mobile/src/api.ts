import {
  getApiBaseUrl,
  sessionHeaders,
  saveToken,
  requestCredentials,
} from "./credentials";
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
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
  const baseUrl = await getApiBaseUrl();
  if (!baseUrl)
    throw new ApiError(
      "Connect this app to your deployed TubePilot backend to get started.",
      503,
      "API_NOT_CONFIGURED",
    );
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    credentials: requestCredentials,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(await sessionHeaders(baseUrl)),
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
  if ((await getApiBaseUrl()) !== baseUrl)
    throw new ApiError(
      "The backend changed. Please retry on the selected server.",
      409,
    );
  if (path.startsWith("/auth/") && typeof json.token === "string")
    await saveToken(json.token, baseUrl);
  return json as T;
}
export const requestKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
