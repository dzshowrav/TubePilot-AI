import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  Generation,
  Profile,
  ProfileInput,
  Project,
  ProjectInput,
  Task,
  TaskInput,
  Notice,
} from "@tubepilot/contracts";
import { toolCosts } from "@tubepilot/contracts";
import { seedProjects, trends } from "./fixtures.js";

export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const now = () => new Date().toISOString();
const defaultProfile: ProfileInput = {
  name: "Alex Morgan",
  channelName: "The Curious Creator",
  niche: "AI & Technology",
  language: "en",
  goal: "consistency",
  timezone: "Asia/Dhaka",
  voice: "Friendly",
  theme: "dark",
  onboardingComplete: false,
  notifications: true,
};
type UserRow = {
  id: string;
  email: string | null;
  password_hash: string | null;
  profile: string;
  guest: number;
  balance: number;
  reserved: number;
  created_at: string;
};
type ProjectRow = {
  id: string;
  user_id: string;
  data: string;
  revision: number;
  created_at: string;
  updated_at: string;
};
type TaskRow = {
  id: string;
  user_id: string;
  input: string;
  status: Task["status"];
  progress: number;
  result: string | null;
  error: string | null;
  cost: number;
  mode: string;
  budget: number;
  created_at: string;
  budget_day: string;
};

export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,password_hash TEXT,profile TEXT NOT NULL,guest INTEGER NOT NULL DEFAULT 1,balance INTEGER NOT NULL DEFAULT 100,reserved INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS project_owner ON projects(user_id,updated_at);
      CREATE TABLE IF NOT EXISTS saved_trends(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,trend_id TEXT NOT NULL,PRIMARY KEY(user_id,trend_id));
      CREATE TABLE IF NOT EXISTS notices(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,body TEXT NOT NULL,type TEXT NOT NULL,is_read INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,idempotency_key TEXT NOT NULL,request_hash TEXT NOT NULL,input TEXT NOT NULL,status TEXT NOT NULL,progress INTEGER NOT NULL DEFAULT 0,result TEXT,error TEXT,cost INTEGER NOT NULL,mode TEXT NOT NULL,budget INTEGER NOT NULL DEFAULT 0,budget_day TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,idempotency_key));
      CREATE TABLE IF NOT EXISTS task_events(task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,sequence INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(task_id,sequence));
      CREATE TABLE IF NOT EXISTS credit_ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,kind TEXT NOT NULL,amount INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(task_id,kind));
      CREATE TABLE IF NOT EXISTS provider_budget(day TEXT PRIMARY KEY,reserved INTEGER NOT NULL DEFAULT 0,spent INTEGER NOT NULL DEFAULT 0,calls INTEGER NOT NULL DEFAULT 0);
      PRAGMA user_version=1;`);
    // Never replay an accepted request after a process restart. Unknown provider work is charged conservatively.
    for (const row of this.all<TaskRow>(
      "SELECT * FROM tasks WHERE status IN ('queued','running')",
    ))
      this.finishTask(
        row.id,
        "cancelled",
        null,
        "The server restarted. Start a new generation when ready.",
      );
    this.db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now());
  }
  one<T>(sql: string, ...values: SQLInputValue[]): T | undefined {
    return this.db.prepare(sql).get(...values) as T | undefined;
  }
  all<T>(sql: string, ...values: SQLInputValue[]): T[] {
    return this.db.prepare(sql).all(...values) as unknown as T[];
  }
  transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = work();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  userByEmail(email: string) {
    return this.one<UserRow>("SELECT * FROM users WHERE email=?", email);
  }
  createUser(
    email: string | null = null,
    passwordHash: string | null = null,
    name?: string,
  ): Profile {
    return this.transaction(() => {
      const id = randomUUID(),
        created = now();
      try {
        this.db
          .prepare(
            "INSERT INTO users(id,email,password_hash,profile,guest,created_at) VALUES(?,?,?,?,?,?)",
          )
          .run(
            id,
            email,
            passwordHash,
            JSON.stringify({
              ...defaultProfile,
              ...(name ? { name } : {}),
              onboardingComplete: !!email,
            }),
            email ? 0 : 1,
            created,
          );
      } catch {
        throw new ConflictException(
          "An account with that email already exists.",
        );
      }
      for (const input of seedProjects()) this.createProject(id, input);
      this.db
        .prepare(
          "INSERT INTO notices(id,user_id,title,body,type,created_at) VALUES(?,?,?,?,?,?)",
        )
        .run(
          randomUUID(),
          id,
          "A fresh perspective for your next video",
          "Explore the sample AI-agent opportunity in Trend Radar. These are demo insights, not live YouTube data.",
          "trend",
          created,
        );
      this.db
        .prepare(
          "INSERT INTO notices(id,user_id,title,body,type,created_at) VALUES(?,?,?,?,?,?)",
        )
        .run(
          randomUUID(),
          id,
          "Your creative workspace is ready",
          "Start with a video idea, make it your own, and save it to a project. Everything you save stays in this workspace.",
          "welcome",
          created,
        );
      return this.profile(id);
    });
  }
  registerAccount(
    email: string,
    passwordHash: string,
    name: string,
    guestId?: string,
  ): Profile {
    if (!guestId || !this.profile(guestId).guest)
      return this.createUser(email, passwordHash, name);
    return this.transaction(() => {
      const row = this.one<UserRow>("SELECT * FROM users WHERE id=?", guestId)!;
      try {
        this.db
          .prepare(
            "UPDATE users SET email=?,password_hash=?,guest=0,profile=? WHERE id=?",
          )
          .run(
            email,
            passwordHash,
            JSON.stringify({
              ...JSON.parse(row.profile),
              name,
              onboardingComplete: true,
            }),
            guestId,
          );
      } catch {
        throw new ConflictException(
          "An account with that email already exists.",
        );
      }
      this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(guestId);
      return this.profile(guestId);
    });
  }
  session(userId: string): string {
    const token = randomBytes(32).toString("base64url");
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(
        hash(token),
        userId,
        new Date(Date.now() + 7 * 86400000).toISOString(),
      );
    return token;
  }
  authenticate(token?: string): string {
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new UnauthorizedException("Sign in to your workspace.");
    const row = this.one<{ user_id: string }>(
      "SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?",
      hash(token),
      now(),
    );
    if (!row)
      throw new UnauthorizedException(
        "Your session expired. Please sign in again.",
      );
    return row.user_id;
  }
  signOut(token?: string) {
    if (typeof token === "string")
      this.db
        .prepare("DELETE FROM sessions WHERE token_hash=?")
        .run(hash(token));
  }
  profile(id: string): Profile {
    const row = this.one<UserRow>("SELECT * FROM users WHERE id=?", id);
    if (!row) throw new UnauthorizedException();
    return {
      ...JSON.parse(row.profile),
      id: row.id,
      email: row.email,
      guest: !!row.guest,
      credits: row.balance - row.reserved,
      reserved: row.reserved,
      createdAt: row.created_at,
    };
  }
  updateProfile(id: string, data: ProfileInput) {
    this.db
      .prepare("UPDATE users SET profile=? WHERE id=?")
      .run(JSON.stringify(data), id);
    return this.profile(id);
  }
  deleteAccount(id: string) {
    this.db.prepare("DELETE FROM users WHERE id=?").run(id);
  }
  projects(userId: string) {
    return this.all<ProjectRow>(
      "SELECT * FROM projects WHERE user_id=? ORDER BY updated_at DESC,id",
      userId,
    ).map(this.mapProject);
  }
  mapProject(row: ProjectRow): Project {
    return {
      ...JSON.parse(row.data),
      id: row.id,
      userId: row.user_id,
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  project(userId: string, id: string): Project {
    const row = this.one<ProjectRow>(
      "SELECT * FROM projects WHERE id=? AND user_id=?",
      id,
      userId,
    );
    if (!row) throw new NotFoundException("Project not found.");
    return this.mapProject(row);
  }
  createProject(userId: string, data: ProjectInput): Project {
    const id = randomUUID(),
      time = now();
    this.db
      .prepare(
        "INSERT INTO projects(id,user_id,data,created_at,updated_at) VALUES(?,?,?,?,?)",
      )
      .run(id, userId, JSON.stringify(data), time, time);
    return this.project(userId, id);
  }
  updateProject(
    userId: string,
    id: string,
    patch: Partial<ProjectInput> & { revision: number },
  ): Project {
    const project = this.project(userId, id);
    if (project.revision !== patch.revision)
      throw new ConflictException(
        "This project changed in another tab. Reload it before saving.",
      );
    const {
      id: _,
      userId: __,
      revision: ___,
      createdAt: ____,
      updatedAt: _____,
      ...data
    } = project;
    const { revision, ...changes } = patch;
    const updated = this.db
      .prepare(
        "UPDATE projects SET data=?,updated_at=?,revision=revision+1 WHERE id=? AND user_id=? AND revision=?",
      )
      .run(
        JSON.stringify({ ...data, ...changes }),
        now(),
        id,
        userId,
        revision,
      );
    if (!updated.changes)
      throw new ConflictException("This project changed. Please reload it.");
    return this.project(userId, id);
  }
  deleteProject(userId: string, id: string) {
    this.project(userId, id);
    this.db
      .prepare("DELETE FROM projects WHERE id=? AND user_id=?")
      .run(id, userId);
    return { ok: true };
  }
  trends(userId: string) {
    const saved = new Set(
      this.all<{ trend_id: string }>(
        "SELECT trend_id FROM saved_trends WHERE user_id=?",
        userId,
      ).map((row) => row.trend_id),
    );
    return trends.map((trend) => ({ ...trend, saved: saved.has(trend.id) }));
  }
  saveTrend(userId: string, id: string, saved: boolean) {
    if (!trends.some((t) => t.id === id))
      throw new NotFoundException("Trend not found.");
    if (saved)
      this.db
        .prepare("INSERT OR IGNORE INTO saved_trends VALUES(?,?)")
        .run(userId, id);
    else
      this.db
        .prepare("DELETE FROM saved_trends WHERE user_id=? AND trend_id=?")
        .run(userId, id);
    return { saved };
  }
  notices(userId: string): Notice[] {
    return this.all<{
      id: string;
      title: string;
      body: string;
      type: string;
      is_read: number;
      created_at: string;
    }>(
      "SELECT * FROM notices WHERE user_id=? ORDER BY created_at DESC",
      userId,
    ).map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      type: row.type,
      read: !!row.is_read,
      createdAt: row.created_at,
    }));
  }
  readNotices(userId: string) {
    this.db.prepare("UPDATE notices SET is_read=1 WHERE user_id=?").run(userId);
    return { ok: true };
  }
  admitTask(
    userId: string,
    input: TaskInput,
    key: string,
    mode: "demo" | "provider",
    budget = 0,
    budgetLimit = 0,
  ): { task: Task; fresh: boolean } {
    return this.transaction(() => {
      const requestHash = hash(JSON.stringify(input));
      const existing = this.one<TaskRow & { request_hash: string }>(
        "SELECT * FROM tasks WHERE user_id=? AND idempotency_key=?",
        userId,
        key,
      );
      if (existing) {
        if (existing.request_hash !== requestHash)
          throw new ConflictException(
            "That request key was already used for different input.",
          );
        return { task: this.mapTask(existing), fresh: false };
      }
      if (input.projectId) this.project(userId, input.projectId);
      const profile = this.profile(userId);
      if (mode === "provider" && profile.guest)
        throw new ForbiddenException(
          "Create a workspace account before using a live AI provider. Demo generation is available now.",
        );
      if (profile.credits < toolCosts[input.tool])
        throw new HttpException(
          "You have used your workspace credits. Your saved work is still available.",
          402,
        );
      const active = this.one<{ count: number }>(
        "SELECT COUNT(*) AS count FROM tasks WHERE user_id=? AND status IN ('queued','running')",
        userId,
      )!.count;
      if (active >= 2)
        throw new HttpException(
          "Two generations are already running. Wait for one to finish.",
          429,
        );
      const day = now().slice(0, 10),
        id = randomUUID(),
        time = now(),
        cost = toolCosts[input.tool];
      if (mode === "provider") {
        this.db
          .prepare("INSERT OR IGNORE INTO provider_budget(day) VALUES(?)")
          .run(day);
        const capacity = this.one<{
          reserved: number;
          spent: number;
          calls: number;
        }>("SELECT * FROM provider_budget WHERE day=?", day)!;
        if (
          capacity.reserved + capacity.spent + budget > budgetLimit ||
          capacity.calls >= 25
        )
          throw new HttpException(
            "The server’s daily AI budget has been reached. Try again tomorrow.",
            429,
          );
        this.db
          .prepare(
            "UPDATE provider_budget SET reserved=reserved+?,calls=calls+1 WHERE day=?",
          )
          .run(budget, day);
      }
      this.db
        .prepare("UPDATE users SET reserved=reserved+? WHERE id=?")
        .run(cost, userId);
      this.db
        .prepare(
          "INSERT INTO tasks(id,user_id,idempotency_key,request_hash,input,status,cost,mode,budget,budget_day,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          userId,
          key,
          requestHash,
          JSON.stringify(input),
          "queued",
          cost,
          mode,
          budget,
          day,
          time,
        );
      this.db
        .prepare("INSERT INTO credit_ledger VALUES(?,?,?,?,?,?)")
        .run(randomUUID(), userId, id, "reserve", cost, time);
      this.event(id, { type: "queued", progress: 0 });
      return { task: this.task(userId, id), fresh: true };
    });
  }
  mapTask(row: TaskRow): Task {
    const input = JSON.parse(row.input) as TaskInput;
    return {
      id: row.id,
      tool: input.tool,
      topic: input.topic,
      format: input.format,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      status: row.status,
      progress: row.progress,
      result: row.result ? JSON.parse(row.result) : null,
      error: row.error,
      credits: row.cost,
      createdAt: row.created_at,
    };
  }
  task(userId: string, id: string): Task {
    const row = this.one<TaskRow>(
      "SELECT * FROM tasks WHERE id=? AND user_id=?",
      id,
      userId,
    );
    if (!row) throw new NotFoundException("Generation not found.");
    return this.mapTask(row);
  }
  taskRow(id: string) {
    return this.one<TaskRow>("SELECT * FROM tasks WHERE id=?", id);
  }
  activeTasks(userId: string): Task[] {
    return this.all<TaskRow>(
      "SELECT * FROM tasks WHERE user_id=? AND status IN ('queued','running')",
      userId,
    ).map((row) => this.mapTask(row));
  }
  taskHistory(userId: string): Task[] {
    return this.all<TaskRow>(
      "SELECT * FROM tasks WHERE user_id=? ORDER BY created_at DESC LIMIT 30",
      userId,
    ).map((row) => this.mapTask(row));
  }
  startTask(id: string): boolean {
    const changed = this.db
      .prepare(
        "UPDATE tasks SET status='running',progress=12 WHERE id=? AND status='queued'",
      )
      .run(id).changes;
    if (changed) this.event(id, { type: "running", progress: 12 });
    return !!changed;
  }
  progress(id: string, value: number) {
    const changed = this.db
      .prepare("UPDATE tasks SET progress=? WHERE id=? AND status='running'")
      .run(value, id).changes;
    if (changed) this.event(id, { type: "progress", progress: value });
  }
  finishTask(
    id: string,
    status: "completed" | "cancelled" | "failed",
    result: Generation | null,
    error: string | null,
  ): boolean {
    return this.transaction(() => {
      const row = this.taskRow(id);
      if (!row || !["queued", "running"].includes(row.status)) return false;
      const charge =
        status === "completed" ||
        (row.mode === "provider" && row.status === "running");
      this.db
        .prepare(
          "UPDATE users SET reserved=reserved-?,balance=balance-? WHERE id=?",
        )
        .run(row.cost, charge ? row.cost : 0, row.user_id);
      this.db
        .prepare("INSERT INTO credit_ledger VALUES(?,?,?,?,?,?)")
        .run(
          randomUUID(),
          row.user_id,
          id,
          charge ? "settle" : "release",
          row.cost,
          now(),
        );
      if (row.mode === "provider")
        this.db
          .prepare(
            "UPDATE provider_budget SET reserved=reserved-?,spent=spent+? WHERE day=?",
          )
          .run(row.budget, charge ? row.budget : 0, row.budget_day);
      this.db
        .prepare(
          "UPDATE tasks SET status=?,progress=?,result=?,error=? WHERE id=?",
        )
        .run(
          status,
          status === "completed" ? 100 : row.progress,
          result ? JSON.stringify(result) : null,
          error,
          id,
        );
      this.event(id, {
        type: status,
        progress: status === "completed" ? 100 : row.progress,
        result,
        error,
      });
      return true;
    });
  }
  event(id: string, payload: unknown) {
    const sequence = this.one<{ n: number }>(
      "SELECT COALESCE(MAX(sequence),0)+1 AS n FROM task_events WHERE task_id=?",
      id,
    )!.n;
    this.db
      .prepare("INSERT INTO task_events VALUES(?,?,?)")
      .run(id, sequence, JSON.stringify(payload));
  }
  events(userId: string, id: string, after: number) {
    this.task(userId, id);
    return this.all<{ sequence: number; payload: string }>(
      "SELECT sequence,payload FROM task_events WHERE task_id=? AND sequence>? ORDER BY sequence LIMIT 100",
      id,
      after,
    );
  }
  ledger(userId: string, limit = 50) {
    return this.all(
      "SELECT l.kind,l.amount,l.created_at AS createdAt,t.input FROM credit_ledger l JOIN tasks t ON t.id=l.task_id WHERE l.user_id=? ORDER BY l.created_at DESC LIMIT ?",
      userId,
      limit,
    );
  }
  exportUser(userId: string) {
    return {
      profile: this.profile(userId),
      projects: this.projects(userId),
      savedTrends: this.trends(userId).filter((t) => t.saved),
      generations: this.all<TaskRow>(
        "SELECT * FROM tasks WHERE user_id=? ORDER BY created_at DESC",
        userId,
      ).map((row) => this.mapTask(row)),
      ledger: this.ledger(userId, -1),
      exportedAt: now(),
    };
  }
  close() {
    this.db.close();
  }
}
