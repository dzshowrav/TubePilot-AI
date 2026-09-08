import test from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "../dist/app.js";
import { CHANNEL, fakeConfig, fakeGoogle } from "./youtube-helpers.mjs";
process.env.AI_ENABLE_LIVE = "false";
process.env.YOUTUBE_ENABLED = "false";
async function fixture(t) {
  const google = fakeGoogle();
  const instance = await createApplication({
    databasePath: ":memory:",
    quiet: true,
    youtube: {
      config: fakeConfig,
      fetcher: google.fetcher,
      maintenance: false,
    },
  });
  await instance.app.listen(0, "127.0.0.1");
  t.after(() => instance.close());
  const base = `http://127.0.0.1:${instance.app.getHttpServer().address().port}/api/v1`;
  const profile = instance.store.createUser(
      "http-owner@example.com",
      "test-hash",
    ),
    token = instance.store.session(profile.id);
  const call = async (path, method = "GET", body, auth = token, extra = {}) => {
    const response = await fetch(base + path, {
      method,
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { response, text, json: () => JSON.parse(text) };
  };
  return { ...instance, base, call, google, profile, token };
}
async function callback(c, client = "web") {
  const started = await c.call(
    "/youtube/flows",
    "POST",
    { client, analytics: true },
    c.token,
    { Origin: fakeConfig.appOrigin },
  );
  assert.equal(started.response.status, 201);
  const flow = started.json(),
    state = new URL(flow.authorizationUrl).searchParams.get("state");
  const returned = await c.call(
    "/youtube/oauth/callback?" +
      new URLSearchParams({ state, code: "fake-code" }),
    "GET",
    undefined,
    null,
  );
  return { flow, state, returned };
}

test("YouTube HTTP routes require app auth, strict inputs and the configured web origin", async (t) => {
  const c = await fixture(t);
  assert.equal(
    (await c.call("/youtube", "GET", undefined, null)).response.status,
    401,
  );
  assert.equal(
    (
      await c.call("/youtube/flows", "POST", {
        client: "web",
        analytics: true,
        redirectUri: "https://evil.example",
      })
    ).response.status,
    400,
  );
  assert.equal(
    (await c.call("/youtube/flows", "POST", { client: "web", analytics: true }))
      .response.status,
    403,
  );
  const before = await c.call("/youtube");
  assert.equal(before.json().state, "not_connected");
  assert.equal(c.google.calls.length, 0);
});

test("HTTP OAuth callback, receipt review, explicit confirmation, sync and safe export work end to end", async (t) => {
  const c = await fixture(t),
    { flow, state, returned } = await callback(c);
  assert.equal(returned.response.status, 200);
  assert.match(returned.response.headers.get("content-type"), /text\/html/);
  assert.match(
    returned.response.headers.get("content-security-policy"),
    /default-src 'none'/,
  );
  assert.equal(returned.response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(returned.response.headers.get("cache-control"), "no-store");
  assert.equal(returned.text.includes("fake-access-token"), false);
  assert.equal(returned.text.includes(fakeConfig.clientSecret), false);
  const receipt = JSON.parse(
    returned.text.match(/postMessage\((\{[^]*?\}),/)[1],
  ).receipt;
  assert.equal((await c.call("/youtube")).json().state, "not_connected");
  const reviewed = await c.call(`/youtube/flows/${flow.id}/review`, "POST", {
    receipt,
  });
  assert.equal(reviewed.response.status, 200);
  assert.equal(reviewed.json().channels[0].id, CHANNEL);
  assert.equal(
    (
      await c.call(`/youtube/flows/${flow.id}/confirm`, "POST", {
        receipt,
        channelId: CHANNEL,
      })
    ).response.status,
    200,
  );
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.allSettled([...c.youtube.running]);
  const bootstrap = (await c.call("/bootstrap")).json();
  assert.equal(bootstrap.integrations.youtube, "connected");
  assert.equal(bootstrap.youtube.snapshot.channel.id, CHANNEL);
  assert.equal(bootstrap.youtube.snapshot.source, "youtube");
  const exported = await c.call("/me/export");
  assert.equal(exported.text.includes("fake-refresh-token"), false);
  assert.equal(exported.text.includes("credentials"), false);
  assert.equal(exported.json().youtube.snapshot.channel.id, CHANNEL);
  assert.equal(
    (
      await c.call(
        "/youtube/oauth/callback?" +
          new URLSearchParams({ state, code: "same-code" }),
        "GET",
        undefined,
        null,
      )
    ).response.status,
    403,
  );
  assert.equal(
    (
      await c.call(`/youtube/flows/${flow.id}/confirm`, "POST", {
        receipt,
        channelId: CHANNEL,
      })
    ).response.status,
    403,
  );
});

test("native return locations contain an app-bound receipt, never provider tokens or arbitrary redirects", async (t) => {
  const c = await fixture(t),
    { flow, returned } = await callback(c, "native");
  assert.equal(returned.response.status, 303);
  const location = new URL(returned.response.headers.get("location"));
  assert.equal(location.protocol, "tubepilot:");
  assert.equal(location.host, "oauth");
  assert.equal(location.pathname, "/youtube");
  assert.equal(location.searchParams.get("flow"), flow.id);
  assert.equal(location.searchParams.has("receipt"), false);
  const receipt = new URLSearchParams(location.hash.slice(1)).get("receipt");
  assert.match(receipt, /^[A-Za-z0-9_-]{43}$/);
  const other = c.store.createUser("other@example.com", "hash"),
    otherToken = c.store.session(other.id);
  assert.equal(
    (
      await c.call(
        `/youtube/flows/${flow.id}/review`,
        "POST",
        { receipt },
        otherToken,
      )
    ).response.status,
    404,
  );
  assert.equal(
    returned.response.headers.get("location").includes("fake-refresh-token"),
    false,
  );
});

test("workspace deletion removes Google data and requests revocation, including from the general account route", async (t) => {
  const c = await fixture(t),
    { flow, returned } = await callback(c);
  const receipt = JSON.parse(
    returned.text.match(/postMessage\((\{[^]*?\}),/)[1],
  ).receipt;
  await c.call(`/youtube/flows/${flow.id}/review`, "POST", { receipt });
  await c.call(`/youtube/flows/${flow.id}/confirm`, "POST", {
    receipt,
    channelId: CHANNEL,
  });
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.allSettled([...c.youtube.running]);
  c.google.controls.revocationError = true;
  const removed = await c.call("/me", "DELETE");
  assert.equal(removed.response.status, 200);
  assert.equal(removed.json().youtube.revocationPending, true);
  assert.equal(
    c.store.one("SELECT COUNT(*) AS n FROM youtube_connections").n,
    0,
  );
  assert.equal((await c.call("/youtube")).response.status, 401);
});
