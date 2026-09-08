import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../dist/store.js";
import { demoGeneration } from "../dist/generation.js";
import {
  projectInput,
  projectPatch,
  profileInput,
  taskInput,
  tools,
  toolCosts,
} from "@tubepilot/contracts";
const input = taskInput.parse({
  tool: "ideas",
  topic: "A calmer creative workflow",
});
const result = {
  heading: "Draft",
  content: "An editable sample.",
  source: "demo",
};
const status = (expected) => (error) => error.getStatus?.() === expected;
function fixture(t) {
  const store = new Store(":memory:");
  t.after(() => store.close());
  const user = store.createUser();
  return { store, user };
}

test("workspaces are isolated and session tokens are stored only as hashes", (t) => {
  const { store, user } = fixture(t),
    other = store.createUser();
  const token = store.session(user.id);
  assert.equal(store.authenticate(token), user.id);
  assert.notEqual(
    store.one("SELECT token_hash FROM sessions").token_hash,
    token,
  );
  assert.equal(store.projects(user.id).length, 3);
  const project = store.projects(user.id)[0];
  assert.throws(() => store.project(other.id, project.id), status(404));
  assert.throws(() => store.deleteProject(other.id, project.id), status(404));
  assert.throws(() => store.authenticate("invalid"), status(401));
  assert.throws(() => store.authenticate({ bad: true }), status(401));
  store.signOut(token);
  assert.throws(() => store.authenticate(token), status(401));
});

test("registering from a guest workspace preserves projects and revokes old sessions", (t) => {
  const { store, user } = fixture(t),
    token = store.session(user.id);
  const draft = store.createProject(
    user.id,
    projectInput.parse({ title: "My original idea" }),
  );
  const upgraded = store.registerAccount(
    "creator@example.com",
    "test-hash",
    "Nadia",
    user.id,
  );
  assert.equal(upgraded.id, user.id);
  assert.equal(upgraded.guest, false);
  assert.equal(upgraded.name, "Nadia");
  assert.equal(store.project(user.id, draft.id).title, draft.title);
  assert.throws(() => store.authenticate(token), status(401));
  const second = store.createUser();
  assert.throws(
    () =>
      store.registerAccount(
        "creator@example.com",
        "other-hash",
        "Other",
        second.id,
      ),
    status(409),
  );
  assert.equal(store.profile(second.id).guest, true);
});

test("project edits require the current revision and preserve omitted fields", (t) => {
  const { store, user } = fixture(t);
  const original = store.createProject(
    user.id,
    projectInput.parse({
      title: "An original title",
      script: "Keep this script.",
    }),
  );
  const patch = projectPatch.parse({
    revision: original.revision,
    scheduledFor: "2026-10-03",
  });
  assert.equal(
    Object.hasOwn(patch, "script"),
    false,
    "a partial schema must not inject create defaults",
  );
  const updated = store.updateProject(user.id, original.id, patch);
  assert.equal(updated.script, "Keep this script.");
  assert.equal(updated.revision, 2);
  assert.throws(
    () =>
      store.updateProject(user.id, original.id, {
        revision: 1,
        title: "Stale update",
      }),
    status(409),
  );
});

test("schemas reject invalid calendar dates, timezones and unsafe extra fields", () => {
  assert.equal(
    projectInput.safeParse({ title: "Test", scheduledFor: "2026-02-30" })
      .success,
    false,
  );
  assert.equal(
    projectInput.safeParse({ title: "Test", scheduledFor: "2026-99-12" })
      .success,
    false,
  );
  assert.equal(
    projectInput.safeParse({ title: "Test", scheduledFor: "2028-02-29" })
      .success,
    true,
  );
  assert.equal(
    taskInput.safeParse({ ...input, apiKey: "never-accepted" }).success,
    false,
  );
  assert.equal(
    taskInput.safeParse({ ...input, baseUrl: "http://127.0.0.1" }).success,
    false,
  );
  assert.equal(
    taskInput.safeParse({ ...input, topic: "x".repeat(5000) }).success,
    false,
  );
});

test("duplicate task keys reserve credits only once; changed input conflicts", (t) => {
  const { store, user } = fixture(t);
  const first = store.admitTask(user.id, input, "dedupe-key", "demo");
  const second = store.admitTask(user.id, input, "dedupe-key", "demo");
  assert.equal(first.fresh, true);
  assert.equal(second.fresh, false);
  assert.equal(first.task.id, second.task.id);
  assert.equal(store.profile(user.id).credits, 97);
  assert.equal(store.profile(user.id).reserved, 3);
  assert.throws(
    () =>
      store.admitTask(
        user.id,
        { ...input, topic: "Changed" },
        "dedupe-key",
        "demo",
      ),
    status(409),
  );
  assert.equal(store.ledger(user.id).length, 1);
});

test("concurrent task admission and hard credit caps cannot overspend", (t) => {
  const { store, user } = fixture(t);
  const a = store.admitTask(user.id, input, "request-1", "demo").task,
    b = store.admitTask(user.id, input, "request-2", "demo").task;
  assert.throws(
    () => store.admitTask(user.id, input, "request-3", "demo"),
    status(429),
  );
  assert.equal(store.profile(user.id).reserved, 6);
  store.finishTask(a.id, "completed", result, null);
  store.finishTask(b.id, "completed", result, null);
  for (let i = 0; i < 31; i++) {
    const task = store.admitTask(user.id, input, "spend-" + i, "demo").task;
    store.finishTask(task.id, "completed", result, null);
  }
  assert.equal(store.profile(user.id).credits, 1);
  assert.equal(store.profile(user.id).reserved, 0);
  assert.throws(
    () => store.admitTask(user.id, input, "over-budget", "demo"),
    status(402),
  );
});

test("cancelled demo tasks refund once and late completion cannot overwrite cancellation", (t) => {
  const { store, user } = fixture(t);
  const { task } = store.admitTask(user.id, input, "cancel-key", "demo");
  store.startTask(task.id);
  assert.equal(store.finishTask(task.id, "cancelled", null, "Cancelled"), true);
  assert.equal(
    store.finishTask(task.id, "cancelled", null, "Cancelled"),
    false,
  );
  assert.equal(store.finishTask(task.id, "completed", result, null), false);
  assert.equal(store.profile(user.id).credits, 100);
  assert.equal(store.profile(user.id).reserved, 0);
  assert.equal(store.ledger(user.id).length, 2);
  const events = store.events(user.id, task.id, 0);
  assert.deepEqual(
    events.map((e) => e.sequence),
    [1, 2, 3],
  );
  assert.equal(JSON.parse(events.at(-1).payload).type, "cancelled");
});

test("tasks, SSE history, and project context enforce ownership", (t) => {
  const { store, user } = fixture(t),
    other = store.createUser();
  const task = store.admitTask(user.id, input, "owner-task", "demo").task;
  assert.throws(() => store.task(other.id, task.id), status(404));
  assert.throws(() => store.events(other.id, task.id, 0), status(404));
  assert.throws(
    () =>
      store.admitTask(
        other.id,
        { ...input, projectId: store.projects(user.id)[0].id },
        "foreign-project",
        "demo",
      ),
    status(404),
  );
  assert.equal(store.profile(other.id).credits, 100);
});

test("global provider budget bounds concurrent reservations and preserves unknown accepted costs", (t) => {
  const { store } = fixture(t);
  const user = store.createUser("verified-in-test@example.com", "hash");
  const task = store.admitTask(
    user.id,
    input,
    "provider-1",
    "provider",
    700,
    1000,
  ).task;
  assert.throws(
    () => store.admitTask(user.id, input, "provider-2", "provider", 700, 1000),
    status(429),
  );
  store.startTask(task.id);
  store.finishTask(task.id, "cancelled", null, "Unknown usage");
  const row = store.one("SELECT * FROM provider_budget");
  assert.equal(row.spent, 700);
  assert.equal(row.reserved, 0);
  assert.equal(store.profile(user.id).credits, 97);
});

test("restart persists saved work and cancels, rather than replays, unfinished tasks", () => {
  const dir = mkdtempSync(join(tmpdir(), "tubepilot-store-"));
  try {
    const path = join(dir, "state.sqlite");
    let store = new Store(path);
    const user = store.createUser();
    const project = store.createProject(
      user.id,
      projectInput.parse({ title: "Persist me" }),
    );
    const token = store.session(user.id);
    const task = store.admitTask(user.id, input, "restart-task", "demo").task;
    store.startTask(task.id);
    store.close();
    store = new Store(path);
    assert.equal(store.authenticate(token), user.id);
    assert.equal(store.project(user.id, project.id).title, "Persist me");
    assert.equal(store.task(user.id, task.id).status, "cancelled");
    assert.equal(store.profile(user.id).credits, 100);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("account deletion cascades private data and invalidates sessions", (t) => {
  const { store, user } = fixture(t),
    token = store.session(user.id);
  const task = store.admitTask(user.id, input, "delete-task", "demo").task;
  store.finishTask(task.id, "completed", result, null);
  store.saveTrend(user.id, "trend-ai-agents", true);
  const exported = store.exportUser(user.id);
  assert.equal(exported.generations.length, 1);
  assert.equal(JSON.stringify(exported).includes("password_hash"), false);
  store.deleteAccount(user.id);
  assert.throws(() => store.authenticate(token), status(401));
  for (const table of [
    "sessions",
    "projects",
    "tasks",
    "saved_trends",
    "credit_ledger",
    "notices",
  ])
    assert.equal(store.one(`SELECT COUNT(*) as count FROM ${table}`).count, 0);
  assert.equal(store.one("SELECT COUNT(*) as count FROM task_events").count, 0);
});

test("all seven demo tools produce editable content and disclose their source", (t) => {
  const { store, user } = fixture(t);
  for (const tool of tools) {
    const generated = demoGeneration({ ...input, tool }, user);
    assert.equal(generated.source, "demo");
    assert.ok(generated.content.length > 50);
  }
  const bangla = demoGeneration(
    { ...input, tool: "script" },
    { ...user, language: "bn" },
  );
  assert.match(bangla.content, /শুরু/);
  const invalid = profileInput.safeParse({
    ...Object.fromEntries(
      Object.entries(user).filter(
        ([key]) =>
          ![
            "id",
            "email",
            "guest",
            "credits",
            "reserved",
            "createdAt",
          ].includes(key),
      ),
    ),
    timezone: "Not/A_Timezone",
  });
  assert.equal(invalid.success, false);
});

test("workspace exports include generations and ledger entries beyond the recent-history limit", (t) => {
  const { store, user } = fixture(t);
  for (let i = 0; i < 35; i++) {
    const { task } = store.admitTask(
      user.id,
      { ...input, tool: "assistant" },
      "export-" + i,
      "demo",
    );
    store.finishTask(task.id, "completed", result, null);
  }
  assert.equal(store.taskHistory(user.id).length, 30);
  assert.equal(store.exportUser(user.id).generations.length, 35);
  assert.equal(store.exportUser(user.id).ledger.length, 70);
});

test("long-topic demo titles fit projects and copied title counts match the request", (t) => {
  const { user } = fixture(t);
  const draft = demoGeneration(
    {
      ...input,
      topic: "A long but valid topic ".repeat(100),
      tool: "titles",
      count: 3,
    },
    user,
  );
  assert.equal(draft.titles.length, 3);
  assert.equal(draft.content.split("\n\n").length, 3);
  assert.ok(draft.titles.every((title) => title.length <= 180));
  const ideas = demoGeneration(
    { ...input, topic: "Long topic ".repeat(100) },
    user,
  );
  assert.ok(ideas.ideas.every((idea) => idea.title.length <= 180));
  const short = demoGeneration(
    { ...input, tool: "script", format: "Short" },
    user,
  );
  assert.match(short.content, /0–3 seconds/);
});

test("production live inference is blocked until the missing safety gates are implemented", async (t) => {
  const { store } = fixture(t);
  const { GenerationService } = await import("../dist/generation.js");
  const mode = process.env.AI_ENABLE_LIVE,
    environment = process.env.NODE_ENV;
  try {
    process.env.AI_ENABLE_LIVE = "true";
    process.env.NODE_ENV = "production";
    assert.throws(
      () => new GenerationService(store),
      /Production live inference is blocked/,
    );
  } finally {
    if (mode === undefined) delete process.env.AI_ENABLE_LIVE;
    else process.env.AI_ENABLE_LIVE = mode;
    if (environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = environment;
  }
});
