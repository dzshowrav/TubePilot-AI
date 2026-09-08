import { createHash } from "node:crypto";
import { Store } from "../dist/store.js";
import { YoutubeService } from "../dist/youtube/service.js";
import {
  YOUTUBE_SCOPE,
  ANALYTICS_SCOPE,
  shiftDate,
} from "../dist/youtube/config.js";
export const CHANNEL = "UC" + "a".repeat(22),
  OTHER_CHANNEL = "UC" + "b".repeat(22);
export const fakeConfig = {
  clientId: "fake-client.apps.googleusercontent.com",
  clientSecret: "fake-google-client-secret",
  appOrigin: "https://studio.example",
  redirectUri: "https://studio.example/api/v1/youtube/oauth/callback",
  encryptionKey: Buffer.alloc(32, 7),
  dataUnitsPerDay: 100,
  analyticsRequestsPerDay: 100,
};
export const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
export function fakeGoogle() {
  const calls = [],
    controls = {
      scopes: [YOUTUBE_SCOPE, ANALYTICS_SCOPE],
      hidden: false,
      missingRefresh: false,
      refreshError: false,
      channelError: null,
      analyticsError: null,
      videoError: null,
      revocationError: false,
      blockChannels: null,
      refreshSeconds: undefined,
    };
  const fetcher = async (input, init = {}) => {
    const url = new URL(String(input)),
      body = init.body ? new URLSearchParams(String(init.body)) : null;
    calls.push({ url, init, body });
    if (
      url.origin === "https://oauth2.googleapis.com" &&
      url.pathname === "/token"
    ) {
      const refresh = body.get("grant_type") === "refresh_token";
      if (refresh && controls.refreshError)
        return json(
          { error: "invalid_grant", error_description: "must-not-leak-secret" },
          400,
        );
      return json({
        access_token: refresh ? "fake-refreshed-access" : "fake-access-token",
        ...(controls.missingRefresh || refresh
          ? {}
          : { refresh_token: "fake-refresh-token" }),
        expires_in: 3600,
        token_type: "Bearer",
        scope: controls.scopes.join(" "),
        ...(controls.refreshSeconds === undefined
          ? {}
          : { refresh_token_expires_in: controls.refreshSeconds }),
      });
    }
    if (
      url.origin === "https://oauth2.googleapis.com" &&
      url.pathname === "/revoke"
    )
      return controls.revocationError
        ? json({ error: "temporarily_unavailable" }, 503)
        : new Response(null, { status: 200 });
    if (
      url.origin === "https://www.googleapis.com" &&
      url.pathname === "/youtube/v3/channels"
    ) {
      if (controls.blockChannels) await controls.blockChannels;
      if (controls.channelError)
        return json(controls.channelError.body, controls.channelError.status);
      return json({
        items: [
          {
            id: CHANNEL,
            snippet: {
              title: "North Studio — authorized channel",
              description:
                "An authorized channel description, never automatically sent to AI.",
            },
            statistics: {
              viewCount: "12345",
              subscriberCount: "54000",
              hiddenSubscriberCount: controls.hidden,
              videoCount: "2",
            },
            contentDetails: {
              relatedPlaylists: { uploads: "UU" + "a".repeat(22) },
            },
          },
        ],
      });
    }
    if (
      url.origin === "https://www.googleapis.com" &&
      url.pathname === "/youtube/v3/playlistItems"
    )
      return json({
        items: [
          { contentDetails: { videoId: "abcDEF12345" } },
          { contentDetails: { videoId: "uvwxyz12345" } },
        ],
      });
    if (
      url.origin === "https://www.googleapis.com" &&
      url.pathname === "/youtube/v3/videos"
    ) {
      if (controls.videoError)
        return json(controls.videoError.body, controls.videoError.status);
      return json({
        items: [
          {
            id: "abcDEF12345",
            snippet: {
              channelId: CHANNEL,
              title: "An actual returned video",
              publishedAt: "2026-09-01T12:00:00Z",
            },
            statistics: { viewCount: "700", likeCount: "25" },
            contentDetails: { duration: "PT4M12S" },
          },
          {
            id: "uvwxyz12345",
            snippet: {
              channelId: OTHER_CHANNEL,
              title: "Must not include a different channel",
            },
            statistics: { viewCount: "100" },
          },
        ],
      });
    }
    if (
      url.origin === "https://youtubeanalytics.googleapis.com" &&
      url.pathname === "/v2/reports"
    ) {
      if (controls.analyticsError)
        return json(
          controls.analyticsError.body,
          controls.analyticsError.status,
        );
      if (url.searchParams.get("dimensions") === "day") {
        const end = url.searchParams.get("endDate");
        return json({
          columnHeaders: [
            { name: "views" },
            { name: "day" },
            { name: "subscribersLost" },
            { name: "estimatedMinutesWatched" },
            { name: "subscribersGained" },
          ],
          rows: [
            [10, shiftDate(end, -4), null, 20, 1],
            [0, shiftDate(end, -2), 0, 0, 0],
          ],
        });
      }
      return json({
        columnHeaders: [
          { name: "estimatedMinutesWatched" },
          { name: "views" },
          { name: "subscribersGained" },
          { name: "subscribersLost" },
        ],
        rows: [[20, 10, 1, null]],
      });
    }
    throw new Error(
      "Unexpected external endpoint in a test. No fallback fetch is allowed.",
    );
  };
  return { calls, controls, fetcher };
}
export function setup(t, options = {}) {
  const store = options.store ?? new Store(":memory:");
  let clock = Date.now();
  const google = fakeGoogle();
  const config = { ...fakeConfig, ...options.config };
  const youtube = new YoutubeService(store, {
    config,
    fetcher: google.fetcher,
    now: () => clock,
    maintenance: false,
  });
  const user = store.createUser(
      "owner@example.com",
      "test-only-password-hash",
      "Owner",
    ),
    token = store.session(user.id);
  t.after(async () => {
    await youtube.close();
    store.close();
  });
  return {
    store,
    youtube,
    user,
    token,
    google,
    config,
    advance: (ms) => {
      clock += ms;
    },
    now: () => clock,
  };
}
export async function authorize(context, analytics = true) {
  const flow = context.youtube.start(
    context.user.id,
    context.token,
    { client: "web", analytics },
    context.config.appOrigin,
  );
  const url = new URL(flow.authorizationUrl),
    result = await context.youtube.callback(
      url.searchParams.get("state"),
      "fake-code",
    );
  if (!result.receipt) throw new Error(result.error ?? "No receipt");
  return { flow, url, result };
}
export async function connect(context, analytics = true) {
  const authorization = await authorize(context, analytics);
  await context.youtube.review(
    context.user.id,
    context.token,
    authorization.flow.id,
    authorization.result.receipt,
  );
  context.youtube.confirm(
    context.user.id,
    context.token,
    authorization.flow.id,
    authorization.result.receipt,
    CHANNEL,
  );
  // Drain the scheduled single-process worker without adding sleep loops or making external calls.
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.allSettled([...context.youtube.running]);
  return { ...authorization, status: context.youtube.status(context.user.id) };
}
export const status = (expected) => (error) => error.getStatus?.() === expected;
