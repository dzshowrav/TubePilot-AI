/** Public backend origin used by native APKs and GitHub build inputs; never a credential URL. */
export function normalizeApiOrigin(input: string): string {
  const value = input.trim();
  if (!value || value.length > 2048 || /[\s\u0000-\u001f\u007f]/.test(value))
    throw new Error("Enter a valid HTTPS backend origin.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Enter a full HTTPS URL, for example https://studio.example.com.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    value.includes("?") ||
    value.includes("#")
  )
    throw new Error(
      "Use an HTTPS origin only, without a path, credentials, query, or fragment.",
    );
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host.startsWith("127.") ||
    host === "[::1]" ||
    host === "[::]" ||
    host.startsWith("[::ffff:7f")
  )
    throw new Error(
      "A phone cannot use the sandbox’s localhost. Use your deployed HTTPS backend origin.",
    );
  return url.origin;
}

/** A native app session is valid for exactly the backend that issued it, never another origin. */
export function readScopedSession(
  serialized: string | null,
  apiBase: string,
): string | null {
  if (!serialized) return null;
  try {
    const session: unknown = JSON.parse(serialized);
    if (!session || typeof session !== "object") return null;
    const row = session as Record<string, unknown>;
    return row.apiBase === apiBase &&
      typeof row.token === "string" &&
      /^[A-Za-z0-9_-]{43}$/.test(row.token)
      ? row.token
      : null;
  } catch {
    return null;
  }
}
