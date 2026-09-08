import test from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "../dist/app.js";
process.env.AI_ENABLE_LIVE = "false";
async function fixture(t) {
  const instance = await createApplication({
    databasePath: ":memory:",
    quiet: true,
    demoDelay: 10,
  });
  await instance.app.listen(0, "127.0.0.1");
  t.after(() => instance.close());
  const address = instance.app.getHttpServer().address();
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  const call = async (path, method = "GET", body, token, extra = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "x-tubepilot-client": "native",
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    return { status: response.status, body: data, headers: response.headers };
  };
  return { ...instance, base, call };
}

test("bootstrap requires a session; demo cookies are HttpOnly and assets are tenant-owned", async (t) => {
  const { call } = await fixture(t);
  assert.equal((await call("/bootstrap")).status, 401);
  assert.equal((await call("/auth/session")).body.authenticated, false);
  const demo = await call("/auth/demo", "POST", {});
  assert.equal(demo.status, 200);
  assert.match(demo.headers.get("set-cookie"), /HttpOnly/);
  assert.match(demo.headers.get("set-cookie"), /SameSite=Lax/i);
  const boot = await call("/bootstrap", "GET", undefined, demo.body.token);
  assert.equal(boot.status, 200);
  assert.equal(boot.body.projects.length, 3);
  assert.equal(boot.body.analytics.source, "demo");
  assert.equal(boot.body.integrations.youtube, "not-configured");
  assert.equal(boot.body.integrations.ai, "demo");
  const other = await call("/auth/demo", "POST", {});
  const forbidden = await call(
    `/projects/${boot.body.projects[0].id}`,
    "GET",
    undefined,
    other.body.token,
  );
  assert.equal(forbidden.status, 404);
});

test("register, upgrade guest workspace, authenticate, and sign out without exposing credentials", async (t) => {
  const { call } = await fixture(t);
  const demo = await call("/auth/demo", "POST", {});
  const token = demo.body.token;
  const project = await call(
    "/projects",
    "POST",
    { title: "Preserve this guest idea" },
    token,
  );
  const register = await call(
    "/auth/register",
    "POST",
    {
      email: "creator@example.com",
      password: "unique-test-password",
      name: "Nadia",
    },
    token,
  );
  assert.equal(register.status, 201);
  assert.equal(register.body.profile.id, demo.body.profile.id);
  assert.equal(
    (
      await call(
        `/projects/${project.body.id}`,
        "GET",
        undefined,
        register.body.token,
      )
    ).status,
    200,
  );
  assert.equal((await call("/bootstrap", "GET", undefined, token)).status, 401);
  const bad = await call("/auth/login", "POST", {
    email: "creator@example.com",
    password: "not-the-password",
  });
  assert.equal(bad.status, 401);
  const login = await call("/auth/login", "POST", {
    email: "creator@example.com",
    password: "unique-test-password",
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.profile.name, "Nadia");
  assert.equal(JSON.stringify(login.body).includes("password"), false);
  await call("/auth/logout", "POST", {}, login.body.token);
  assert.equal(
    (await call("/bootstrap", "GET", undefined, login.body.token)).status,
    401,
  );
});

test("cross-origin writes and sensitive/oversized generation input are rejected", async (t) => {
  const { call } = await fixture(t);
  const demo = await call("/auth/demo", "POST", {});
  assert.equal(
    (
      await call("/projects", "POST", { title: "CSRF" }, demo.body.token, {
        Origin: "https://not-this-app.example",
      })
    ).status,
    403,
  );
  const input = {
    tool: "ideas",
    topic: "A thoughtful AI tutorial",
    apiKey: "do-not-accept",
  };
  assert.equal(
    (
      await call("/ai/tasks", "POST", input, demo.body.token, {
        "Idempotency-Key": "safe-key-one",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/ai/tasks",
        "POST",
        { tool: "ideas", topic: "A thoughtful AI tutorial" },
        demo.body.token,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/projects",
        "POST",
        { title: "Bad date", scheduledFor: "2026-02-30" },
        demo.body.token,
      )
    ).status,
    400,
  );
});

test("a durable generation completes once, reports usage credits, and replays owner-only SSE", async (t) => {
  const { call, base } = await fixture(t);
  const demo = await call("/auth/demo", "POST", {}),
    token = demo.body.token;
  const body = { tool: "ideas", topic: "A practical workflow for creators" };
  const response = await call("/ai/tasks", "POST", body, token, {
    "Idempotency-Key": "generation-key",
  });
  assert.equal(response.status, 202);
  const duplicate = await call("/ai/tasks", "POST", body, token, {
    "Idempotency-Key": "generation-key",
  });
  assert.equal(response.body.id, duplicate.body.id);
  const stream = await fetch(`${base}/ai/tasks/${response.body.id}/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get("content-type"), /text\/event-stream/);
  const events = await stream.text();
  assert.match(events, /event: completed/);
  assert.match(events, /"source":"demo"/);
  const task = await call(
    `/ai/tasks/${response.body.id}`,
    "GET",
    undefined,
    token,
  );
  assert.equal(task.body.status, "completed");
  assert.equal(task.body.result.ideas.length, 5);
  const usage = await call("/billing/usage", "GET", undefined, token);
  assert.equal(usage.body.profile.credits, 97);
  assert.equal(usage.body.ledger.length, 2);
  const replay = await fetch(`${base}/ai/tasks/${response.body.id}/events`, {
    headers: { Authorization: `Bearer ${token}`, "Last-Event-ID": "2" },
  });
  const text = await replay.text();
  assert.equal(text.includes("id: 1\n"), false);
  assert.match(text, /event: completed/);
  const other = await call("/auth/demo", "POST", {});
  assert.equal(
    (
      await call(
        `/ai/tasks/${response.body.id}`,
        "GET",
        undefined,
        other.body.token,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        `/ai/tasks/${response.body.id}/cancel`,
        "POST",
        {},
        other.body.token,
      )
    ).status,
    404,
  );
  const forbidden = await fetch(`${base}/ai/tasks/${response.body.id}/events`, {
    headers: { Authorization: `Bearer ${other.body.token}` },
  });
  assert.equal(forbidden.status, 404);
});

test("API cancellation releases demo credits and is idempotent", async (t) => {
  const { call, generation } = await fixture(t);
  const demo = await call("/auth/demo", "POST", {}),
    token = demo.body.token;
  const task = await call(
    "/ai/tasks",
    "POST",
    { tool: "script", topic: "A practical tutorial" },
    token,
    { "Idempotency-Key": "cancel-key" },
  );
  const cancelled = await call(
    `/ai/tasks/${task.body.id}/cancel`,
    "POST",
    {},
    token,
  );
  assert.equal(cancelled.body.status, "cancelled");
  await call(`/ai/tasks/${task.body.id}/cancel`, "POST", {}, token);
  const usage = await call("/billing/usage", "GET", undefined, token);
  assert.equal(usage.body.profile.credits, 100);
  assert.equal(usage.body.profile.reserved, 0);
});

test("export and deletion cover private workspace data, not password/session material", async (t) => {
  const { call, store } = await fixture(t);
  const demo = await call("/auth/demo", "POST", {}),
    token = demo.body.token;
  const output = await call("/me/export", "GET", undefined, token);
  assert.equal(output.status, 200);
  assert.equal(output.body.projects.length, 3);
  assert.match(output.headers.get("content-disposition"), /attachment/);
  assert.equal(JSON.stringify(output.body).includes(token), false);
  assert.equal((await call("/me", "DELETE", undefined, token)).status, 200);
  assert.equal((await call("/bootstrap", "GET", undefined, token)).status, 401);
  assert.equal(store.one("SELECT COUNT(*) AS n FROM projects").n, 0);
});

test("HTTPS embedded previews get secure partitioned session cookies", async (t) => {
  const { base } = await fixture(t);
  const { request } = await import("node:http");
  const result = await new Promise((resolve, reject) => {
    const req = request(
      new URL(base + "/auth/demo"),
      {
        method: "POST",
        headers: {
          Host: "3000-preview.e2b.app",
          Origin: "https://3000-preview.e2b.app",
          "Content-Type": "application/json",
        },
      },
      (res) => {
        res.resume();
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            cookie: res.headers["set-cookie"]?.join(";") ?? "",
          }),
        );
      },
    );
    req.on("error", reject);
    req.end("{}");
  });
  assert.equal(result.status, 200);
  assert.match(result.cookie, /HttpOnly/);
  assert.match(result.cookie, /Secure/);
  assert.match(result.cookie, /SameSite=None/);
  assert.match(result.cookie, /Partitioned/);
});
