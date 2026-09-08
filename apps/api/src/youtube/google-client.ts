import {
  ANALYTICS_SCOPE,
  YOUTUBE_SCOPE,
  pacificDate,
  shiftDate,
  type YoutubeConfig,
} from "./config.js";
import type {
  YoutubeChannel,
  YoutubeVideo,
  YoutubeMetrics,
  YoutubeReport,
} from "@tubepilot/contracts";

export type GoogleFailure =
  | "revoked"
  | "permission"
  | "quota"
  | "budget"
  | "unavailable"
  | "invalid_response";
export class GoogleError extends Error {
  constructor(
    readonly code: GoogleFailure,
    message: string,
  ) {
    super(message);
  }
}
export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
  refreshExpiresAt?: number;
}
export type QuotaBucket = "data" | "analytics";
const metrics = [
  "views",
  "estimatedMinutesWatched",
  "subscribersGained",
  "subscribersLost",
] as const;
const obj = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const text = (x: unknown, max = 5000) =>
  typeof x === "string" ? x.slice(0, max) : "";
const numeric = (value: unknown): number | null => {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value))
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER
    ? n
    : null;
};
const date = (x: unknown) =>
  typeof x === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  Number.isFinite(Date.parse(x)) &&
  new Date(x).toISOString().slice(0, 10) === x
    ? x
    : null;
export const emptyMetrics = (): YoutubeMetrics => ({
  views: null,
  estimatedMinutesWatched: null,
  subscribersGained: null,
  subscribersLost: null,
});
export const emptyReport = (
  message: string,
  state: YoutubeReport["state"] = "unavailable",
): YoutubeReport => ({
  state,
  message,
  source: "youtube_analytics",
  reportingTimezone: "America/Los_Angeles",
  requestedEndDate: "",
  availableThrough: null,
  periods: [],
  series: [],
});

/** Races even a test/dropped transport that ignores AbortSignal; never log its raw error. */
function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () =>
      reject(
        new GoogleError(
          "unavailable",
          "The Google request was cancelled or timed out.",
        ),
      );
    if (signal.aborted) {
      void promise.catch(() => {});
      cancel();
      return;
    }
    signal.addEventListener("abort", cancel, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", cancel));
  });
}

/** Fixed Google endpoints only. No caller-supplied URLs, redirects, retries, or arbitrary API methods. */
export class GoogleClient {
  constructor(
    private config: YoutubeConfig,
    private reserve: (bucket: QuotaBucket) => void,
    private fetcher: typeof fetch = fetch,
    private now: () => number = Date.now,
  ) {}
  private async json(
    url: URL | string,
    init: RequestInit,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const abort = AbortSignal.any([
      AbortSignal.timeout(15_000),
      ...(signal ? [signal] : []),
    ]);
    let response: Response;
    try {
      abort.throwIfAborted();
      const pending = this.fetcher(url, {
        ...init,
        redirect: "error",
        signal: abort,
      });
      void pending.then(
        (value) => {
          if (abort.aborted) void value.body?.cancel().catch(() => {});
        },
        () => {},
      );
      response = await withAbort(pending, abort);
    } catch {
      throw new GoogleError(
        "unavailable",
        "Google could not be reached. Try again later.",
      );
    }
    let payload: unknown;
    try {
      if (!response.body) throw new Error();
      const reader = response.body.getReader();
      let size = 0;
      const chunks: Buffer[] = [];
      try {
        while (true) {
          const { done, value } = await withAbort(reader.read(), abort);
          if (done) break;
          size += value.byteLength;
          if (size > 1024 * 1024) throw new Error();
          chunks.push(Buffer.from(value));
        }
      } finally {
        void reader.cancel().catch(() => {});
        try {
          reader.releaseLock();
        } catch {}
      }
      payload = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
      );
    } catch {
      throw new GoogleError(
        "invalid_response",
        "Google returned an unreadable response. No new channel data was saved.",
      );
    }
    if (!response.ok) {
      const error = obj(payload).error;
      const reason =
        typeof error === "string"
          ? error
          : text(obj(list(obj(error).errors)[0]).reason, 100);
      if (reason === "invalid_grant" || response.status === 401)
        throw new GoogleError(
          "revoked",
          "Google authorization is no longer valid. Reconnect your channel.",
        );
      if (
        [
          "quotaExceeded",
          "dailyLimitExceeded",
          "rateLimitExceeded",
          "userRateLimitExceeded",
        ].includes(reason) ||
        response.status === 429
      )
        throw new GoogleError(
          "quota",
          "Google’s request quota is unavailable. Try again after the quota resets.",
        );
      if (response.status === 403)
        throw new GoogleError(
          "permission",
          "Google did not allow this read-only report. Check the granted permissions and API configuration.",
        );
      throw new GoogleError(
        "unavailable",
        "Google could not complete this request. No missing metric is treated as zero.",
      );
    }
    return payload;
  }
  private tokens(payload: unknown, previous?: GoogleTokens): GoogleTokens {
    const row = obj(payload),
      accessToken = text(row.access_token, 8192),
      refreshToken =
        text(row.refresh_token, 8192) || previous?.refreshToken || "";
    const expires = Number(row.expires_in),
      scopes =
        typeof row.scope === "string"
          ? row.scope.split(/\s+/).filter(Boolean)
          : (previous?.scopes ?? []);
    if (
      !accessToken ||
      !refreshToken ||
      /[\r\n]/.test(accessToken + refreshToken) ||
      !Number.isFinite(expires) ||
      expires <= 0 ||
      expires > 86400 ||
      text(row.token_type).toLowerCase() !== "bearer"
    )
      throw new GoogleError(
        "invalid_response",
        "Google did not provide valid offline access. Remove the app’s Google authorization and reconnect.",
      );
    const effectiveScopes = previous
      ? scopes.filter((scope) => previous.scopes.includes(scope))
      : scopes;
    if (!effectiveScopes.includes(YOUTUBE_SCOPE))
      throw new GoogleError(
        "permission",
        "YouTube read-only permission was not granted. Your existing connection has not changed.",
      );
    const refreshSeconds = Number(row.refresh_token_expires_in);
    const refreshExpiresAt =
      row.refresh_token_expires_in === undefined
        ? previous?.refreshExpiresAt
        : Number.isFinite(refreshSeconds) && refreshSeconds > 0
          ? this.now() + refreshSeconds * 1000
          : undefined;
    return {
      accessToken,
      refreshToken,
      expiresAt: this.now() + expires * 1000,
      scopes: effectiveScopes,
      ...(refreshExpiresAt === undefined ? {} : { refreshExpiresAt }),
    };
  }
  async exchange(code: string, verifier: string, signal?: AbortSignal) {
    const body = new URLSearchParams({
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    });
    return this.tokens(
      await this.json(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        },
        signal,
      ),
    );
  }
  async refresh(previous: GoogleTokens, signal?: AbortSignal) {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: previous.refreshToken,
      grant_type: "refresh_token",
    });
    return this.tokens(
      await this.json(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        },
        signal,
      ),
      previous,
    );
  }
  async revoke(token: string, signal?: AbortSignal) {
    const abort = AbortSignal.any([
      AbortSignal.timeout(10_000),
      ...(signal ? [signal] : []),
    ]);
    abort.throwIfAborted();
    const pending = this.fetcher("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      redirect: "error",
      signal: abort,
    });
    void pending.then(
      (response) => {
        if (abort.aborted) void response.body?.cancel().catch(() => {});
      },
      () => {},
    );
    const response = await withAbort(pending, abort);
    if (response.ok) {
      void response.body?.cancel().catch(() => {});
      return;
    }
    // Only a documented already-invalid token is terminal. An arbitrary 400 is not proof of revocation.
    if (response.status === 400 && response.body) {
      const reader = response.body.getReader();
      let size = 0;
      const chunks: Buffer[] = [];
      try {
        while (true) {
          const { done, value } = await withAbort(reader.read(), abort);
          if (done) break;
          size += value.byteLength;
          if (size > 16384) throw new Error();
          chunks.push(Buffer.from(value));
        }
        const body = obj(
          JSON.parse(
            new TextDecoder("utf-8", { fatal: true }).decode(
              Buffer.concat(chunks),
            ),
          ),
        );
        if (body.error === "invalid_token") return;
      } catch {
      } finally {
        void reader.cancel().catch(() => {});
        try {
          reader.releaseLock();
        } catch {}
      }
    } else {
      void response.body?.cancel().catch(() => {});
    }
    throw new GoogleError("unavailable", "Google revocation will be retried.");
  }
  private async data(
    resource: "channels" | "playlistItems" | "videos",
    params: Record<string, string>,
    token: string,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    this.reserve("data");
    const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
    url.search = new URLSearchParams(params).toString();
    return obj(
      await this.json(
        url,
        { headers: { Authorization: `Bearer ${token}` } },
        signal,
      ),
    );
  }
  async channels(
    token: string,
    signal?: AbortSignal,
  ): Promise<YoutubeChannel[]> {
    const response = await this.data(
      "channels",
      {
        part: "snippet,statistics,contentDetails",
        mine: "true",
        maxResults: "50",
      },
      token,
      signal,
    );
    return list(response.items)
      .slice(0, 50)
      .flatMap((item) => {
        const row = obj(item),
          snippet = obj(row.snippet),
          stats = obj(row.statistics),
          id = text(row.id, 80);
        if (!/^UC[A-Za-z0-9_-]{22}$/.test(id)) return [];
        const uploads = text(
            obj(obj(row.contentDetails).relatedPlaylists).uploads,
            100,
          ),
          hidden = stats.hiddenSubscriberCount === true;
        return [
          {
            id,
            title: text(snippet.title, 200) || "Untitled channel",
            description: text(snippet.description),
            uploadsPlaylist: /^[A-Za-z0-9_-]{10,100}$/.test(uploads)
              ? uploads
              : null,
            views: numeric(stats.viewCount),
            subscribers: hidden ? null : numeric(stats.subscriberCount),
            subscribersHidden: hidden,
            videos: numeric(stats.videoCount),
          },
        ];
      });
  }
  async videos(
    channel: YoutubeChannel,
    token: string,
    signal?: AbortSignal,
  ): Promise<YoutubeVideo[]> {
    if (!channel.uploadsPlaylist)
      throw new GoogleError(
        "invalid_response",
        "The channel did not expose an uploads playlist.",
      );
    const playlist = await this.data(
      "playlistItems",
      {
        part: "contentDetails",
        playlistId: channel.uploadsPlaylist,
        maxResults: "12",
      },
      token,
      signal,
    );
    const ids = [
      ...new Set(
        list(playlist.items)
          .map((item) => text(obj(obj(item).contentDetails).videoId, 20))
          .filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id)),
      ),
    ];
    if (!ids.length) return [];
    const response = await this.data(
      "videos",
      { part: "snippet,statistics,contentDetails", id: ids.join(",") },
      token,
      signal,
    );
    return list(response.items).flatMap((item) => {
      const row = obj(item),
        id = text(row.id, 20),
        snippet = obj(row.snippet),
        stats = obj(row.statistics);
      if (!ids.includes(id) || snippet.channelId !== channel.id) return [];
      const published = text(snippet.publishedAt, 50);
      return [
        {
          id,
          title: text(snippet.title, 200) || "Untitled video",
          publishedAt: Number.isFinite(Date.parse(published))
            ? published
            : null,
          views: numeric(stats.viewCount),
          likes: numeric(stats.likeCount),
          comments: numeric(stats.commentCount),
          duration: text(obj(row.contentDetails).duration, 100) || null,
        },
      ];
    });
  }
  private async report(
    channelId: string,
    token: string,
    startDate: string,
    endDate: string,
    daily: boolean,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    this.reserve("analytics");
    const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
    url.search = new URLSearchParams({
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: metrics.join(","),
      ...(daily ? { dimensions: "day", sort: "day" } : {}),
    }).toString();
    const response = obj(
      await this.json(
        url,
        { headers: { Authorization: `Bearer ${token}` } },
        signal,
      ),
    );
    const headers = list(response.columnHeaders).map((header) =>
      text(obj(header).name, 100),
    );
    if (!headers.length || new Set(headers).size !== headers.length)
      throw new GoogleError(
        "invalid_response",
        "YouTube Analytics returned unsupported columns.",
      );
    return list(response.rows).map((row) => {
      const values = list(row);
      if (values.length !== headers.length)
        throw new GoogleError(
          "invalid_response",
          "YouTube Analytics returned an incomplete row.",
        );
      const mapped = Object.fromEntries(
        headers.map((key, i) => [key, values[i]]),
      );
      return {
        date: date(mapped.day),
        ...(Object.fromEntries(
          metrics.map((key) => [key, numeric(mapped[key])]),
        ) as unknown as YoutubeMetrics),
      };
    });
  }
  async analytics(
    channelId: string,
    tokens: GoogleTokens,
    signal?: AbortSignal,
  ): Promise<YoutubeReport> {
    if (!tokens.scopes.includes(ANALYTICS_SCOPE))
      return emptyReport(
        "Historical analytics was not enabled or authorized for this connection. Reconnect and choose the optional analytics permission.",
        "missing_scope",
      );
    const endDate = shiftDate(pacificDate(this.now()), -1),
      startDate = shiftDate(endDate, -27);
    const rows = await this.report(
      channelId,
      tokens.accessToken,
      startDate,
      endDate,
      true,
      signal,
    );
    const series = rows
      .flatMap((row) =>
        row.date && row.date >= startDate && row.date <= endDate
          ? [{ ...row, date: row.date }]
          : [],
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    if (new Set(series.map((row) => row.date)).size !== series.length)
      throw new GoogleError(
        "invalid_response",
        "YouTube Analytics returned duplicate days.",
      );
    const availableThrough = series.at(-1)?.date ?? null,
      periods: YoutubeReport["periods"] = [];
    for (const days of [7, 28] as const) {
      const start = shiftDate(endDate, -days + 1);
      let totals = emptyMetrics();
      if (availableThrough && availableThrough >= start) {
        const totalRows = await this.report(
          channelId,
          tokens.accessToken,
          start,
          availableThrough,
          false,
          signal,
        );
        if (totalRows.length > 1)
          throw new GoogleError(
            "invalid_response",
            "YouTube Analytics returned an unexpected total.",
          );
        if (totalRows[0]) {
          const { date: _, ...values } = totalRows[0];
          totals = values;
        }
      }
      periods.push({
        days,
        startDate: start,
        endDate: availableThrough ?? endDate,
        totals,
      });
    }
    return {
      state: series.length ? "ready" : "empty",
      message: series.length
        ? "YouTube reports can lag. Totals stop at the latest returned day; absent days and metrics are not filled with zero."
        : "YouTube did not return daily rows for this period.",
      source: "youtube_analytics",
      reportingTimezone: "America/Los_Angeles",
      requestedEndDate: endDate,
      availableThrough,
      periods,
      series,
    };
  }
}
