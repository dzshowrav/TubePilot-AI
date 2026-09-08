export const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
export const ANALYTICS_SCOPE =
  "https://www.googleapis.com/auth/yt-analytics.readonly";
export const NATIVE_RETURN_URI = "tubepilot://oauth/youtube";
export const FLOW_TTL_MS = 10 * 60_000;
export const DATA_TTL_MS = 6 * 86400_000;
export interface YoutubeConfig {
  clientId: string;
  clientSecret: string;
  appOrigin: string;
  redirectUri: string;
  encryptionKey: Buffer;
  dataUnitsPerDay: number;
  analyticsRequestsPerDay: number;
}
function origin(value: string, production: boolean) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        url.hostname === "localhost" &&
        !production
      ))
  )
    throw new Error(
      "YouTube requires an exact HTTPS APP_ORIGIN (localhost HTTP is development-only).",
    );
  return url.origin;
}
export function youtubeConfig(
  env: NodeJS.ProcessEnv = process.env,
): YoutubeConfig | null {
  if (env.YOUTUBE_ENABLED !== "true") return null;
  if (
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    !env.APP_ORIGIN ||
    !env.GOOGLE_REDIRECT_URI ||
    !env.YOUTUBE_ENCRYPTION_KEY
  )
    throw new Error(
      "YouTube integration requires client credentials, APP_ORIGIN, redirect URI and a 32-byte encryption key.",
    );
  const appOrigin = origin(env.APP_ORIGIN, env.NODE_ENV === "production");
  const redirectUri = appOrigin + "/api/v1/youtube/oauth/callback";
  if (env.GOOGLE_REDIRECT_URI !== redirectUri)
    throw new Error(
      "GOOGLE_REDIRECT_URI must be the exact APP_ORIGIN/api/v1/youtube/oauth/callback URL.",
    );
  const encryptionKey = Buffer.from(env.YOUTUBE_ENCRYPTION_KEY, "base64");
  if (
    encryptionKey.length !== 32 ||
    encryptionKey.toString("base64") !== env.YOUTUBE_ENCRYPTION_KEY
  )
    throw new Error(
      "YOUTUBE_ENCRYPTION_KEY must be canonical base64 encoding of 32 random bytes.",
    );
  const dataUnitsPerDay = Number(env.YOUTUBE_DATA_UNITS_PER_DAY ?? 1000),
    analyticsRequestsPerDay = Number(
      env.YOUTUBE_ANALYTICS_REQUESTS_PER_DAY ?? 500,
    );
  if (
    !Number.isSafeInteger(dataUnitsPerDay) ||
    dataUnitsPerDay < 1 ||
    dataUnitsPerDay > 10000 ||
    !Number.isSafeInteger(analyticsRequestsPerDay) ||
    analyticsRequestsPerDay < 1 ||
    analyticsRequestsPerDay > 10000
  )
    throw new Error(
      "YouTube application request budgets must be integers between 1 and 10000.",
    );
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    appOrigin,
    redirectUri,
    encryptionKey,
    dataUnitsPerDay,
    analyticsRequestsPerDay,
  };
}
export function pacificDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}
export function shiftDate(date: string, days: number) {
  const parsed = new Date(date + "T12:00:00Z");
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
