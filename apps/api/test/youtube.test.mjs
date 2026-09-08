import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store, hash } from "../dist/store.js";
import { YoutubeService, callbackDocument } from "../dist/youtube/service.js";
import { GoogleClient, GoogleError } from "../dist/youtube/google-client.js";
import { TokenVault } from "../dist/youtube/vault.js";
import {
  youtubeConfig,
  YOUTUBE_SCOPE,
  ANALYTICS_SCOPE,
  FLOW_TTL_MS,
  DATA_TTL_MS,
} from "../dist/youtube/config.js";
import {
  setup,
  authorize,
  connect,
  status,
  CHANNEL,
  OTHER_CHANNEL,
  fakeConfig,
  fakeGoogle,
  json,
} from "./youtube-helpers.mjs";

process.env.YOUTUBE_ENABLED = "false";

test("YouTube configuration is disabled by default and rejects unsafe or incomplete configuration", () => {
  assert.equal(youtubeConfig({}), null);
  assert.throws(() => youtubeConfig({ YOUTUBE_ENABLED: "true" }), /requires/);
  const env = {
    YOUTUBE_ENABLED: "true",
    GOOGLE_CLIENT_ID: "fake-id",
    GOOGLE_CLIENT_SECRET: "fake-secret",
    APP_ORIGIN: "https://studio.example",
    GOOGLE_REDIRECT_URI: "https://studio.example/api/v1/youtube/oauth/callback",
    YOUTUBE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  };
  assert.equal(youtubeConfig(env).appOrigin, "https://studio.example");
  assert.throws(
    () => youtubeConfig({ ...env, APP_ORIGIN: "http://evil.example" }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      youtubeConfig({
        ...env,
        GOOGLE_REDIRECT_URI: "https://evil.example/callback",
      }),
    /exact/,
  );
  assert.throws(
    () =>
      youtubeConfig({
        ...env,
        APP_ORIGIN: "https://user:password@studio.example",
      }),
    /HTTPS/,
  );
  assert.throws(
    () => youtubeConfig({ ...env, YOUTUBE_ENCRYPTION_KEY: "bad-key" }),
    /32 random bytes/,
  );
  assert.throws(
    () => youtubeConfig({ ...env, YOUTUBE_DATA_UNITS_PER_DAY: "10001" }),
    /budgets/,
  );
});

test("credential envelopes are randomized, authenticated and bound to owner / record / purpose", () => {
  const vault = new TokenVault(Buffer.alloc(32, 3)),
    secret = {
      accessToken: "never-store-plaintext",
      refreshToken: "private-refresh",
    };
  const a = vault.seal(secret, "owner:grant:tokens"),
    b = vault.seal(secret, "owner:grant:tokens");
  assert.notEqual(a, b);
  assert.equal(a.includes(secret.accessToken), false);
  assert.deepEqual(vault.open(a, "owner:grant:tokens"), secret);
  assert.throws(
    () => vault.open(a, "other-owner:grant:tokens"),
    /could not be decrypted/,
  );
  assert.throws(
    () => new TokenVault(Buffer.alloc(32, 4)).open(a, "owner:grant:tokens"),
    /could not be decrypted/,
  );
  const parts = a.split(".");
  parts[2] = Buffer.alloc(16, 1).toString("base64url");
  assert.throws(() => vault.open(parts.join("."), "owner:grant:tokens"));
});

test("authorization requests use state, S256 PKCE, exact redirect and minimum read-only scopes", (t) => {
  const c = setup(t),
    flow = c.youtube.start(
      c.user.id,
      c.token,
      { client: "web", analytics: false },
      c.config.appOrigin,
    ),
    url = new URL(flow.authorizationUrl),
    row = c.youtube.repo.flow(flow.id);
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("scope"), YOUTUBE_SCOPE);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("redirect_uri"), c.config.redirectUri);
  assert.equal(row.state_hash, hash(url.searchParams.get("state")));
  assert.notEqual(row.state_hash, url.searchParams.get("state"));
  assert.equal(JSON.stringify(flow).includes(c.config.clientSecret), false);
  const { verifier } = new TokenVault(c.config.encryptionKey).open(
    row.verifier,
    `${c.user.id}:${flow.id}:verifier`,
  );
  assert.equal(
    createHash("sha256").update(verifier).digest("base64url"),
    url.searchParams.get("code_challenge"),
  );
  assert.equal(row.verifier.includes(verifier), false);
  const opted = c.youtube.start(
    c.user.id,
    c.token,
    { client: "web", analytics: true },
    c.config.appOrigin,
  );
  assert.equal(
    new URL(opted.authorizationUrl).searchParams.get("scope"),
    YOUTUBE_SCOPE + " " + ANALYTICS_SCOPE,
  );
});

test("guests, wrong browser origins and expired or replayed state cannot start or claim authorization", async (t) => {
  const c = setup(t),
    guest = c.store.createUser(),
    guestToken = c.store.session(guest.id);
  assert.throws(
    () =>
      c.youtube.start(
        guest.id,
        guestToken,
        { client: "web", analytics: false },
        c.config.appOrigin,
      ),
    status(403),
  );
  assert.throws(
    () =>
      c.youtube.start(
        c.user.id,
        c.token,
        { client: "web", analytics: false },
        "https://attacker.example",
      ),
    status(403),
  );
  await assert.rejects(c.youtube.callback("x".repeat(43), "code"), status(403));
  const flow = c.youtube.start(
    c.user.id,
    c.token,
    { client: "web", analytics: false },
    c.config.appOrigin,
  );
  c.advance(FLOW_TTL_MS + 1);
  await assert.rejects(
    c.youtube.callback(
      new URL(flow.authorizationUrl).searchParams.get("state"),
      "code",
    ),
    status(403),
  );
  assert.equal(c.google.calls.length, 0);
});

test("an OAuth callback cannot automatically link a channel or expose credentials", async (t) => {
  const c = setup(t),
    a = await authorize(c);
  assert.equal(c.youtube.status(c.user.id).state, "not_connected");
  assert.ok(a.result.receipt);
  const row = c.youtube.repo.flow(a.flow.id);
  assert.equal(row.status, "awaiting_confirmation");
  assert.equal(row.receipt_hash, hash(a.result.receipt));
  assert.equal(row.verifier, null);
  assert.equal(row.credentials.includes("fake-access-token"), false);
  assert.equal(
    JSON.stringify(c.youtube.status(c.user.id)).includes("fake-refresh-token"),
    false,
  );
  assert.equal(
    c.google.calls.filter((call) => call.url.pathname.endsWith("/channels"))
      .length,
    0,
    "no private channel information fetched before client receipt proof",
  );
  await assert.rejects(
    c.youtube.callback(a.url.searchParams.get("state"), "replayed-code"),
    status(403),
  );
  const doc = callbackDocument(a.result);
  assert.match(doc.html, /postMessage/);
  assert.match(doc.html, /https:\/\/studio\.example/);
  assert.equal(doc.html.includes("fake-access-token"), false);
  assert.equal(doc.nativeUrl.startsWith("tubepilot://oauth/youtube?"), true);
  assert.equal(new URL(doc.nativeUrl).searchParams.has("receipt"), false);
});

test("receipt proof is required in the original authenticated session, not merely possession of state", async (t) => {
  const c = setup(t),
    a = await authorize(c),
    other = c.store.createUser("other@example.com", "hash"),
    otherToken = c.store.session(other.id),
    sameUserNewSession = c.store.session(c.user.id);
  await assert.rejects(
    c.youtube.review(c.user.id, c.token, a.flow.id, "wrong".padEnd(43, "x")),
    status(403),
  );
  await assert.rejects(
    c.youtube.review(
      c.user.id,
      sameUserNewSession,
      a.flow.id,
      a.result.receipt,
    ),
    status(403),
  );
  await assert.rejects(
    c.youtube.review(other.id, otherToken, a.flow.id, a.result.receipt),
    status(404),
  );
  assert.equal(
    c.google.calls.filter((call) => call.url.pathname.endsWith("/channels"))
      .length,
    0,
  );
  const review = await c.youtube.review(
    c.user.id,
    c.token,
    a.flow.id,
    a.result.receipt,
  );
  assert.equal(review.channels[0].id, CHANNEL);
  await c.youtube.review(c.user.id, c.token, a.flow.id, a.result.receipt);
  assert.equal(
    c.google.calls.filter((call) => call.url.pathname.endsWith("/channels"))
      .length,
    1,
    "review retries use cached authorized channel choices",
  );
  assert.throws(
    () =>
      c.youtube.confirm(
        c.user.id,
        c.token,
        a.flow.id,
        a.result.receipt,
        OTHER_CHANNEL,
      ),
    status(403),
  );
});

test("explicit confirmation performs a read-only sync with nullable direct metrics and no sample mixing", async (t) => {
  const c = setup(t);
  c.google.controls.hidden = true;
  const result = await connect(c),
    snapshot = result.status.snapshot;
  assert.equal(result.status.state, "connected");
  assert.equal(snapshot.source, "youtube");
  assert.equal(snapshot.channel.views, 12345);
  assert.equal(snapshot.channel.subscribers, null);
  assert.equal(snapshot.channel.subscribersHidden, true);
  assert.equal(
    snapshot.videos.items.length,
    1,
    "ignore videos outside the confirmed channel",
  );
  assert.equal(snapshot.videos.items[0].comments, null);
  assert.equal(snapshot.analytics.state, "ready");
  assert.equal(snapshot.analytics.series.length, 2);
  assert.equal(
    snapshot.analytics.series[1].views,
    0,
    "provider-reported zero is retained",
  );
  assert.equal(snapshot.analytics.periods[0].totals.subscribersLost, null);
  assert.ok(
    snapshot.analytics.availableThrough < snapshot.analytics.requestedEndDate,
  );
  assert.equal(snapshot.analytics.reportingTimezone, "America/Los_Angeles");
  assert.equal(
    snapshot.analytics.series.some((row) => row.source === "demo"),
    false,
  );
  for (const call of c.google.calls.filter(
    (call) => call.url.origin === "https://www.googleapis.com",
  )) {
    assert.equal(call.init.method, undefined);
    assert.equal(
      new Headers(call.init.headers).get("Authorization"),
      "Bearer fake-access-token",
    );
    assert.equal(call.url.searchParams.has("key"), false);
  }
  assert.throws(
    () =>
      c.youtube.confirm(
        c.user.id,
        c.token,
        result.flow.id,
        result.result.receipt,
        CHANNEL,
      ),
    status(403),
  );
});

test("no analytics permission makes no Analytics request and leaves that section explicitly unavailable", async (t) => {
  const c = setup(t);
  c.google.controls.scopes = [YOUTUBE_SCOPE];
  const result = await connect(c, false);
  assert.equal(result.status.analyticsGranted, false);
  assert.equal(result.status.snapshot.analytics.state, "missing_scope");
  assert.equal(
    c.google.calls.some(
      (call) => call.url.hostname === "youtubeanalytics.googleapis.com",
    ),
    false,
  );
});

test("optional analytics failure preserves actual channel data without inserting fake report values", async (t) => {
  const c = setup(t);
  c.google.controls.analyticsError = {
    status: 403,
    body: { error: { errors: [{ reason: "insufficientPermissions" }] } },
  };
  const result = await connect(c);
  assert.equal(result.status.snapshot.channel.views, 12345);
  assert.equal(result.status.snapshot.analytics.state, "unavailable");
  assert.deepEqual(result.status.snapshot.analytics.periods, []);
});

test("cancelled consent and missing offline or read-only permission leave an existing connection unchanged", async (t) => {
  const c = setup(t);
  const linked = await connect(c);
  const first = c.youtube.start(
    c.user.id,
    c.token,
    { client: "web", analytics: false },
    c.config.appOrigin,
  );
  const denied = await c.youtube.callback(
    new URL(first.authorizationUrl).searchParams.get("state"),
    undefined,
    "access_denied",
  );
  assert.ok(denied.error);
  assert.equal(
    c.youtube.status(c.user.id).connectionId,
    linked.status.connectionId,
  );
  c.google.controls.missingRefresh = true;
  const second = c.youtube.start(
    c.user.id,
    c.token,
    { client: "web", analytics: false },
    c.config.appOrigin,
  );
  const failed = await c.youtube.callback(
    new URL(second.authorizationUrl).searchParams.get("state"),
    "code",
  );
  assert.match(failed.error, /offline access/);
  assert.equal(
    c.youtube.status(c.user.id).connectionId,
    linked.status.connectionId,
  );
  c.google.controls.missingRefresh = false;
  c.google.controls.scopes = [ANALYTICS_SCOPE];
  const third = c.youtube.start(
    c.user.id,
    c.token,
    { client: "web", analytics: true },
    c.config.appOrigin,
  );
  const scope = await c.youtube.callback(
    new URL(third.authorizationUrl).searchParams.get("state"),
    "code",
  );
  assert.match(scope.error, /read-only permission/);
});

test("a concurrent or stale authorization cannot overwrite a newer channel connection", async (t) => {
  const c = setup(t),
    a = await authorize(c),
    b = await authorize(c);
  await c.youtube.review(c.user.id, c.token, a.flow.id, a.result.receipt);
  await c.youtube.review(c.user.id, c.token, b.flow.id, b.result.receipt);
  c.youtube.confirm(c.user.id, c.token, a.flow.id, a.result.receipt, CHANNEL);
  assert.throws(
    () =>
      c.youtube.confirm(
        c.user.id,
        c.token,
        b.flow.id,
        b.result.receipt,
        CHANNEL,
      ),
    status(409),
  );
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.allSettled([...c.youtube.running]);
});

test("expired access tokens refresh server-side and the refreshed token is persisted encrypted", async (t) => {
  const c = setup(t);
  await connect(c);
  c.advance(3600_000 + 1000);
  c.youtube.sync(c.user.id);
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.allSettled([...c.youtube.running]);
  assert.equal(
    c.google.calls.filter(
      (call) => call.body?.get("grant_type") === "refresh_token",
    ).length,
    1,
  );
  assert.equal(
    new Headers(
      c.google.calls
        .filter((call) => call.url.pathname.endsWith("/channels"))
        .at(-1).init.headers,
    ).get("Authorization"),
    "Bearer fake-refreshed-access",
  );
  assert.equal(
    c.youtube.repo
      .connection(c.user.id)
      .credentials.includes("fake-refreshed-access"),
    false,
  );
});

test("revoked authorization removes cached channel data and does not fall back to sample analytics", async (t) => {
  const c = setup(t);
  await connect(c);
  c.advance(3600_000 + 1000);
  c.google.controls.refreshError = true;
  c.youtube.sync(c.user.id);
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.allSettled([...c.youtube.running]);
  const state = c.youtube.status(c.user.id);
  assert.equal(state.state, "needs_reconnect");
  assert.equal(state.snapshot, null);
  assert.equal(state.channel, null);
  assert.equal(c.youtube.repo.connection(c.user.id).credentials, null);
  assert.equal(state.message.includes("must-not-leak-secret"), false);
});

test("duplicate refreshes join one run and the per-user cooldown is enforced", async (t) => {
  const c = setup(t);
  await connect(c);
  c.advance(60_001);
  let release;
  c.google.controls.blockChannels = new Promise((resolve) => {
    release = resolve;
  });
  const a = c.youtube.sync(c.user.id),
    b = c.youtube.sync(c.user.id);
  assert.equal(a.sync.id, b.sync.id);
  await new Promise((resolve) => setImmediate(resolve));
  release();
  await Promise.allSettled([...c.youtube.running]);
  assert.throws(() => c.youtube.sync(c.user.id), status(429));
});

test("a late sync response cannot resurrect data after disconnect", async (t) => {
  const c = setup(t);
  await connect(c);
  c.advance(60_001);
  let release;
  c.google.controls.blockChannels = new Promise((resolve) => {
    release = resolve;
  });
  c.youtube.sync(c.user.id);
  await new Promise((resolve) => setImmediate(resolve));
  c.youtube.disconnect(c.user.id, false);
  release();
  await Promise.allSettled([...c.youtube.running]);
  assert.equal(c.youtube.status(c.user.id).state, "not_connected");
  assert.equal(c.youtube.status(c.user.id).snapshot, null);
  assert.equal(c.youtube.repo.connection(c.user.id), undefined);
});

test("application quotas are atomic, separate and do not refund rejected provider requests", (t) => {
  const c = setup(t, {
    config: { dataUnitsPerDay: 1, analyticsRequestsPerDay: 2 },
  });
  c.youtube.repo.reserve("data", 1);
  assert.throws(
    () => c.youtube.repo.reserve("data", 1),
    (error) => error.code === "budget",
  );
  c.youtube.repo.reserve("analytics", 2);
  c.youtube.repo.reserve("analytics", 2);
  assert.throws(
    () => c.youtube.repo.reserve("analytics", 2),
    (error) => error.code === "budget",
  );
  assert.equal(
    c.store.one("SELECT used FROM youtube_quota WHERE bucket='data'").used,
    1,
  );
});

test("disconnect deletes local data and retries encrypted revocation without exposing the token", async (t) => {
  const c = setup(t);
  await connect(c);
  c.google.controls.revocationError = true;
  const result = c.youtube.disconnect(c.user.id, true);
  assert.equal(result.revocationPending, true);
  assert.equal(c.youtube.status(c.user.id).channel, null);
  assert.equal(c.youtube.status(c.user.id).snapshot, null);
  await new Promise((resolve) => setImmediate(resolve));
  const queued = c.store.one("SELECT * FROM youtube_revocations");
  assert.ok(queued);
  assert.equal(queued.credentials.includes("fake-refresh-token"), false);
  assert.throws(
    () =>
      c.youtube.start(
        c.user.id,
        c.token,
        { client: "web", analytics: false },
        c.config.appOrigin,
      ),
    status(400),
  );
  c.advance(60_001);
  c.google.controls.revocationError = false;
  await c.youtube.processRevocations();
  assert.equal(
    c.store.one("SELECT COUNT(*) AS n FROM youtube_revocations").n,
    0,
  );
});

test("unrefreshed or time-limited data is purged on expiry rather than served indefinitely", async (t) => {
  const c = setup(t);
  await connect(c);
  c.advance(DATA_TTL_MS + 1);
  const state = c.youtube.status(c.user.id);
  assert.equal(state.state, "needs_reconnect");
  assert.equal(state.snapshot, null);
  assert.equal(state.channel, null);
  assert.equal(c.youtube.repo.connection(c.user.id).channel_id, null);
  assert.equal(c.youtube.repo.connection(c.user.id).credentials, null);
});

test("known time-limited Google authorization caps the cache lifetime", async (t) => {
  const c = setup(t);
  c.google.controls.refreshSeconds = 120;
  await connect(c);
  c.advance(120_001);
  assert.equal(c.youtube.status(c.user.id).snapshot, null);
  assert.equal(c.youtube.status(c.user.id).state, "needs_reconnect");
});

test("account deletion cascades private Google data but retains only a bounded encrypted revocation job", async (t) => {
  const c = setup(t);
  await connect(c);
  c.google.controls.revocationError = true;
  c.youtube.disconnect(c.user.id, true);
  c.store.deleteAccount(c.user.id);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    c.store.one("SELECT COUNT(*) AS n FROM youtube_connections").n,
    0,
  );
  assert.equal(c.store.one("SELECT COUNT(*) AS n FROM youtube_flows").n, 0);
  assert.equal(c.store.one("SELECT COUNT(*) AS n FROM youtube_syncs").n, 0);
  const job = c.store.one("SELECT * FROM youtube_revocations");
  assert.equal(job.user_id, null);
  assert.equal(job.credentials.includes("fake-refresh-token"), false);
  c.advance(48 * 3600_000 + 1);
  c.youtube.repo.prune();
  assert.equal(
    c.store.one("SELECT COUNT(*) AS n FROM youtube_revocations").n,
    0,
  );
});

test("logging out invalidates pending authorization even with a valid state or receipt", async (t) => {
  const c = setup(t),
    a = await authorize(c);
  c.store.signOut(c.token);
  await assert.rejects(
    c.youtube.review(c.user.id, c.token, a.flow.id, a.result.receipt),
    status(404),
  );
  assert.equal(c.youtube.repo.flow(a.flow.id), undefined);
});

test("channel credentials and snapshots persist across a restart while unfinished syncs are not replayed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tubepilot-youtube-"));
  let store, service;
  try {
    const file = join(dir, "workspace.sqlite"),
      google = fakeGoogle();
    store = new Store(file);
    service = new YoutubeService(store, {
      config: fakeConfig,
      fetcher: google.fetcher,
      maintenance: false,
    });
    const user = store.createUser("restart@example.com", "hash"),
      token = store.session(user.id),
      c = { store, youtube: service, user, token, google, config: fakeConfig };
    await connect(c);
    const id = service.status(user.id).connectionId;
    const unfinished = service.repo.admitSync(user.id, id, true);
    const abandoned = service.start(
      user.id,
      token,
      { client: "web", analytics: false },
      fakeConfig.appOrigin,
    );
    service.repo.claimState(
      new URL(abandoned.authorizationUrl).searchParams.get("state"),
    );
    const callCount = google.calls.length;
    await service.close();
    store.close();
    store = new Store(file);
    service = new YoutubeService(store, {
      config: fakeConfig,
      fetcher: google.fetcher,
      maintenance: false,
    });
    assert.equal(service.status(user.id).connectionId, id);
    assert.equal(service.status(user.id).sync.id, unfinished.id);
    assert.equal(service.status(user.id).sync.status, "cancelled");
    assert.equal(service.repo.flow(abandoned.id).status, "failed");
    assert.equal(service.repo.flow(abandoned.id).verifier, null);
    assert.equal(google.calls.length, callCount);
    assert.equal(service.status(user.id).snapshot.channel.id, CHANNEL);
    const row = service.repo.connection(user.id);
    assert.ok(
      new TokenVault(fakeConfig.encryptionKey).open(
        row.credentials,
        `${user.id}:${row.id}:tokens`,
      ).refreshToken,
    );
  } finally {
    if (service) await service.close();
    if (store) store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Google response readers reject oversized data and obey abort even if a transport ignores it", async () => {
  const quota = () => {};
  const tooLarge = new GoogleClient(
    fakeConfig,
    quota,
    async () => new Response("x".repeat(1024 * 1024 + 1)),
  );
  await assert.rejects(
    tooLarge.channels("fake-token"),
    (error) => error.code === "invalid_response",
  );
  const controller = new AbortController();
  let acquired = false;
  const hung = new GoogleClient(fakeConfig, quota, async () => {
    acquired = true;
    return new Response(new ReadableStream({ start() {}, cancel() {} }));
  });
  const operation = hung.channels("fake-token", controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(acquired, true);
  controller.abort();
  await assert.rejects(operation);
});

test("an old broader Google grant does not bypass the analytics checkbox, including after refresh", async (t) => {
  const c = setup(t);
  await connect(c, false);
  assert.equal(c.youtube.status(c.user.id).analyticsGranted, false);
  assert.equal(
    c.google.calls.some(
      (call) => call.url.hostname === "youtubeanalytics.googleapis.com",
    ),
    false,
  );
  c.advance(3600_001);
  c.youtube.sync(c.user.id);
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.allSettled([...c.youtube.running]);
  assert.equal(c.youtube.status(c.user.id).analyticsGranted, false);
  assert.equal(
    c.google.calls.some(
      (call) => call.url.hostname === "youtubeanalytics.googleapis.com",
    ),
    false,
  );
});

test("revocation does not treat an arbitrary HTTP 400 as successful permission removal", async () => {
  const invalid = new GoogleClient(
    fakeConfig,
    () => {},
    async () => json({ error: "invalid_token" }, 400),
  );
  await invalid.revoke("fake-token");
  const failed = new GoogleClient(
    fakeConfig,
    () => {},
    async () => json({ error: "invalid_request" }, 400),
  );
  await assert.rejects(
    failed.revoke("fake-token"),
    (error) => error.code === "unavailable",
  );
});
