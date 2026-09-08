import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import type {
  YoutubeChannel,
  YoutubeSnapshot,
  YoutubeSync,
} from "@tubepilot/contracts";
import { Store, hash } from "../store.js";
import { GoogleError, type QuotaBucket } from "./google-client.js";
import { DATA_TTL_MS, FLOW_TTL_MS, pacificDate } from "./config.js";

export interface FlowRow {
  id: string;
  user_id: string;
  session_hash: string;
  state_hash: string;
  verifier: string | null;
  credentials: string | null;
  receipt_hash: string | null;
  channels: string | null;
  client: "web" | "native";
  analytics: number;
  status: string;
  expected_connection: string | null;
  created_at: string;
  expires_at: string;
}
export interface ConnectionRow {
  id: string;
  user_id: string;
  channel_id: string | null;
  channel: string | null;
  credentials: string | null;
  scopes: string;
  state: "connected" | "needs_reconnect";
  connected_at: string;
  last_synced_at: string | null;
  expires_at: string;
  snapshot: string | null;
  message: string | null;
}
export interface SyncRow {
  id: string;
  user_id: string;
  connection_id: string;
  status: YoutubeSync["status"];
  error: string | null;
  created_at: string;
  finished_at: string | null;
}
export interface RevokeRow {
  id: string;
  user_id: string | null;
  credentials: string;
  attempts: number;
  next_at: string;
  expires_at: string;
}
const equalHash = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export class YoutubeRepository {
  constructor(
    readonly store: Store,
    readonly now: () => number = Date.now,
  ) {
    store.db.exec(`
   PRAGMA secure_delete=ON;
   CREATE TABLE IF NOT EXISTS youtube_flows(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,state_hash TEXT NOT NULL UNIQUE,verifier TEXT,credentials TEXT,receipt_hash TEXT,channels TEXT,client TEXT NOT NULL,analytics INTEGER NOT NULL,status TEXT NOT NULL,expected_connection TEXT,created_at TEXT NOT NULL,expires_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS youtube_connections(id TEXT NOT NULL UNIQUE,user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,channel_id TEXT,channel TEXT,credentials TEXT,scopes TEXT NOT NULL,state TEXT NOT NULL,connected_at TEXT NOT NULL,last_synced_at TEXT,expires_at TEXT NOT NULL,snapshot TEXT,message TEXT);
   CREATE TABLE IF NOT EXISTS youtube_syncs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,connection_id TEXT NOT NULL,status TEXT NOT NULL,error TEXT,created_at TEXT NOT NULL,finished_at TEXT);
   CREATE INDEX IF NOT EXISTS youtube_sync_owner ON youtube_syncs(user_id,created_at);
   CREATE TABLE IF NOT EXISTS youtube_quota(day TEXT NOT NULL,bucket TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,bucket));
   CREATE TABLE IF NOT EXISTS youtube_revocations(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,credentials TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_at TEXT NOT NULL,expires_at TEXT NOT NULL);
  `);
    // Startup is not proof an OAuth exchange / sync did not run. Never replay either.
    store.db
      .prepare(
        "UPDATE youtube_flows SET status='failed',verifier=NULL,credentials=NULL,receipt_hash=NULL,channels=NULL WHERE status='exchanging'",
      )
      .run();
    store.db
      .prepare(
        "UPDATE youtube_syncs SET status='cancelled',error='The server restarted. Refresh the channel again.',finished_at=? WHERE status IN ('queued','running')",
      )
      .run(this.time());
    this.prune();
  }
  time() {
    return new Date(this.now()).toISOString();
  }
  connection(userId: string) {
    return this.store.one<ConnectionRow>(
      "SELECT * FROM youtube_connections WHERE user_id=?",
      userId,
    );
  }
  sessionValid(userId: string, sessionHash: string) {
    return !!this.store.one(
      "SELECT token_hash FROM sessions WHERE token_hash=? AND user_id=? AND expires_at>?",
      sessionHash,
      userId,
      this.time(),
    );
  }
  createFlow(
    userId: string,
    sessionHash: string,
    id: string,
    state: string,
    verifier: string,
    client: "web" | "native",
    analytics: boolean,
  ) {
    return this.store.transaction(() => {
      if (!this.sessionValid(userId, sessionHash))
        throw new ForbiddenException(
          "Your app session expired. Sign in again.",
        );
      const own = this.store.one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM youtube_flows WHERE user_id=? AND created_at>?",
        userId,
        new Date(this.now() - FLOW_TTL_MS).toISOString(),
      )!.n;
      const all = this.store.one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM youtube_flows WHERE expires_at>?",
        this.time(),
      )!.n;
      if (own >= 5 || all >= 500)
        throw new HttpException(
          "Too many connection attempts. Please wait ten minutes.",
          429,
        );
      const expiry = new Date(this.now() + FLOW_TTL_MS).toISOString();
      this.store.db
        .prepare(
          "INSERT INTO youtube_flows(id,user_id,session_hash,state_hash,verifier,client,analytics,status,expected_connection,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          userId,
          sessionHash,
          hash(state),
          verifier,
          client,
          analytics ? 1 : 0,
          "pending",
          this.connection(userId)?.id ?? null,
          this.time(),
          expiry,
        );
      return expiry;
    });
  }
  claimState(state: string): FlowRow {
    return this.store.transaction(() => {
      if (!/^[A-Za-z0-9_-]{43}$/.test(state))
        throw new ForbiddenException(
          "The authorization link is invalid or expired. Start again.",
        );
      const row = this.store.one<FlowRow>(
        "SELECT * FROM youtube_flows WHERE state_hash=? AND status='pending' AND expires_at>?",
        hash(state),
        this.time(),
      );
      if (!row || !this.sessionValid(row.user_id, row.session_hash))
        throw new ForbiddenException(
          "The authorization link is invalid, already used, or expired. Start again.",
        );
      this.store.db
        .prepare("UPDATE youtube_flows SET status='exchanging' WHERE id=?")
        .run(row.id);
      return row;
    });
  }
  flow(id: string) {
    return this.store.one<FlowRow>(
      "SELECT * FROM youtube_flows WHERE id=?",
      id,
    );
  }
  finishExchange(row: FlowRow, credentials: string, receipt: string) {
    if (!this.sessionValid(row.user_id, row.session_hash)) return false;
    return !!this.store.db
      .prepare(
        "UPDATE youtube_flows SET status='awaiting_confirmation',credentials=?,receipt_hash=?,verifier=NULL WHERE id=? AND status='exchanging' AND expires_at>?",
      )
      .run(credentials, hash(receipt), row.id, this.time()).changes;
  }
  receipt(
    userId: string,
    sessionHash: string,
    id: string,
    receipt: string,
  ): FlowRow {
    const row = this.flow(id);
    if (!row || row.user_id !== userId)
      throw new NotFoundException("Authorization attempt not found.");
    if (
      row.session_hash !== sessionHash ||
      !this.sessionValid(userId, sessionHash) ||
      row.expires_at <= this.time() ||
      row.status !== "awaiting_confirmation" ||
      !row.receipt_hash ||
      !equalHash(row.receipt_hash, hash(receipt))
    )
      throw new ForbiddenException(
        "This authorization receipt is invalid or expired. Start again from this app session.",
      );
    return row;
  }
  saveChannels(id: string, channels: YoutubeChannel[]) {
    this.store.db
      .prepare(
        "UPDATE youtube_flows SET channels=? WHERE id=? AND status='awaiting_confirmation' AND expires_at>?",
      )
      .run(JSON.stringify(channels), id, this.time());
  }
  failFlow(id: string) {
    this.store.db
      .prepare(
        "UPDATE youtube_flows SET status='failed',verifier=NULL,credentials=NULL,receipt_hash=NULL,channels=NULL WHERE id=? AND status!='completed'",
      )
      .run(id);
  }
  cancelFlow(userId: string, id: string) {
    const row = this.flow(id);
    if (!row || row.user_id !== userId)
      throw new NotFoundException("Authorization attempt not found.");
    this.failFlow(id);
  }
  confirm(
    userId: string,
    sessionHash: string,
    flowId: string,
    receipt: string,
    channel: YoutubeChannel,
    connectionId: string,
    sealedTokens: string,
    scopes: string[],
    tokenExpiry?: number,
  ) {
    return this.store.transaction(() => {
      const flow = this.receipt(userId, sessionHash, flowId, receipt);
      if ((this.connection(userId)?.id ?? null) !== flow.expected_connection)
        throw new ConflictException(
          "Your channel connection changed while you were authorizing. Start again.",
        );
      if (
        !(JSON.parse(flow.channels ?? "[]") as YoutubeChannel[]).some(
          (item) => item.id === channel.id,
        )
      )
        throw new ForbiddenException(
          "Choose a channel returned by the authorized Google account.",
        );
      this.store.db
        .prepare("DELETE FROM youtube_connections WHERE user_id=?")
        .run(userId);
      const expiry = new Date(
        Math.min(this.now() + DATA_TTL_MS, tokenExpiry ?? Infinity),
      ).toISOString();
      this.store.db
        .prepare(
          "INSERT INTO youtube_connections(id,user_id,channel_id,channel,credentials,scopes,state,connected_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .run(
          connectionId,
          userId,
          channel.id,
          JSON.stringify(channel),
          sealedTokens,
          JSON.stringify(scopes),
          "connected",
          this.time(),
          expiry,
        );
      this.store.db
        .prepare(
          "UPDATE youtube_syncs SET status='cancelled',error='The channel connection changed.',finished_at=? WHERE user_id=? AND status IN ('queued','running')",
        )
        .run(this.time(), userId);
      this.store.db
        .prepare(
          "UPDATE youtube_flows SET status='completed',verifier=NULL,credentials=NULL,receipt_hash=NULL,channels=NULL WHERE id=?",
        )
        .run(flowId);
    });
  }
  replaceTokens(userId: string, id: string, sealed: string, scopes: string[]) {
    return !!this.store.db
      .prepare(
        "UPDATE youtube_connections SET credentials=?,scopes=? WHERE user_id=? AND id=? AND state='connected'",
      )
      .run(sealed, JSON.stringify(scopes), userId, id).changes;
  }
  assertConnection(userId: string, id: string) {
    const row = this.connection(userId);
    if (
      !row ||
      row.id !== id ||
      row.state !== "connected" ||
      row.expires_at <= this.time()
    )
      throw new ForbiddenException(
        "The channel connection changed or expired.",
      );
    return row;
  }
  latestSync(userId: string): YoutubeSync | null {
    const row = this.store.one<SyncRow>(
      "SELECT * FROM youtube_syncs WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1",
      userId,
    );
    return row
      ? {
          id: row.id,
          status: row.status,
          error: row.error,
          createdAt: row.created_at,
          finishedAt: row.finished_at,
        }
      : null;
  }
  admitSync(userId: string, connectionId: string, initial = false) {
    return this.store.transaction(() => {
      this.assertConnection(userId, connectionId);
      const active = this.store.one<SyncRow>(
        "SELECT * FROM youtube_syncs WHERE user_id=? AND connection_id=? AND status IN ('queued','running')",
        userId,
        connectionId,
      );
      if (active) return { id: active.id, fresh: false };
      if (
        !initial &&
        this.store.one(
          "SELECT id FROM youtube_syncs WHERE user_id=? AND created_at>?",
          userId,
          new Date(this.now() - 60_000).toISOString(),
        )
      )
        throw new HttpException(
          "Wait one minute between channel refreshes.",
          429,
        );
      const activeCount = this.store.one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM youtube_syncs WHERE status IN ('queued','running')",
      )!.n;
      if (activeCount >= 4)
        throw new HttpException(
          "Channel refresh is busy. Try again shortly.",
          429,
        );
      const id = randomUUID();
      this.store.db
        .prepare(
          "INSERT INTO youtube_syncs(id,user_id,connection_id,status,created_at) VALUES(?,?,?,?,?)",
        )
        .run(id, userId, connectionId, "queued", this.time());
      return { id, fresh: true };
    });
  }
  startSync(id: string) {
    return !!this.store.db
      .prepare(
        "UPDATE youtube_syncs SET status='running' WHERE id=? AND status='queued'",
      )
      .run(id).changes;
  }
  saveSnapshot(
    userId: string,
    connectionId: string,
    runId: string,
    snapshot: YoutubeSnapshot,
  ) {
    return this.store.transaction(() => {
      this.assertConnection(userId, connectionId);
      if (
        !this.store.one(
          "SELECT id FROM youtube_syncs WHERE id=? AND status='running'",
          runId,
        )
      )
        return false;
      this.store.db
        .prepare(
          "UPDATE youtube_connections SET channel=?,snapshot=?,last_synced_at=?,expires_at=?,message=NULL WHERE id=? AND user_id=?",
        )
        .run(
          JSON.stringify(snapshot.channel),
          JSON.stringify(snapshot),
          snapshot.fetchedAt,
          snapshot.expiresAt,
          connectionId,
          userId,
        );
      this.endSync(runId, "completed", null);
      return true;
    });
  }
  endSync(
    id: string,
    state: "completed" | "failed" | "cancelled",
    message: string | null,
  ) {
    this.store.db
      .prepare(
        "UPDATE youtube_syncs SET status=?,error=?,finished_at=? WHERE id=? AND status IN ('queued','running')",
      )
      .run(state, message, this.time(), id);
  }
  syncError(userId: string, id: string, message: string) {
    this.store.db
      .prepare(
        "UPDATE youtube_connections SET message=? WHERE id=? AND user_id=?",
      )
      .run(message, id, userId);
  }
  invalidate(userId: string, id: string, message: string) {
    this.store.db
      .prepare(
        "UPDATE youtube_connections SET state='needs_reconnect',channel_id=NULL,channel=NULL,credentials=NULL,scopes='[]',snapshot=NULL,message=? WHERE id=? AND user_id=?",
      )
      .run(message, id, userId);
  }
  remove(userId: string) {
    this.store.transaction(() => {
      this.store.db
        .prepare("DELETE FROM youtube_connections WHERE user_id=?")
        .run(userId);
      this.store.db
        .prepare("DELETE FROM youtube_flows WHERE user_id=?")
        .run(userId);
      this.store.db
        .prepare("DELETE FROM youtube_syncs WHERE user_id=?")
        .run(userId);
    });
  }
  reserve(bucket: QuotaBucket, limit: number) {
    this.store.transaction(() => {
      const day = pacificDate(this.now());
      this.store.db
        .prepare("INSERT OR IGNORE INTO youtube_quota(day,bucket) VALUES(?,?)")
        .run(day, bucket);
      if (
        !this.store.db
          .prepare(
            "UPDATE youtube_quota SET used=used+1 WHERE day=? AND bucket=? AND used<?",
          )
          .run(day, bucket, limit).changes
      )
        throw new GoogleError(
          "budget",
          "TubePilot’s daily YouTube request budget has been reached. Try again after midnight Pacific time.",
        );
    });
  }
  enqueueRevocation(id: string, userId: string, credentials: string) {
    this.store.db
      .prepare(
        "INSERT INTO youtube_revocations(id,user_id,credentials,next_at,expires_at) VALUES(?,?,?,?,?)",
      )
      .run(
        id,
        userId,
        credentials,
        this.time(),
        new Date(this.now() + 48 * 3600_000).toISOString(),
      );
  }
  revocations() {
    return this.store.all<RevokeRow>(
      "SELECT * FROM youtube_revocations WHERE next_at<=? AND expires_at>? ORDER BY next_at LIMIT 10",
      this.time(),
      this.time(),
    );
  }
  revoked(id: string) {
    this.store.db.prepare("DELETE FROM youtube_revocations WHERE id=?").run(id);
  }
  retryRevocation(row: RevokeRow) {
    this.store.db
      .prepare(
        "UPDATE youtube_revocations SET attempts=attempts+1,next_at=? WHERE id=?",
      )
      .run(
        new Date(
          this.now() +
            Math.min(6 * 3600_000, 30_000 * 2 ** Math.min(row.attempts, 10)),
        ).toISOString(),
        row.id,
      );
  }
  revocationPending(userId: string) {
    return !!this.store.one(
      "SELECT id FROM youtube_revocations WHERE user_id=? AND expires_at>?",
      userId,
      this.time(),
    );
  }
  prune() {
    this.store.db
      .prepare("DELETE FROM youtube_flows WHERE expires_at<=?")
      .run(this.time());
    this.store.db
      .prepare("DELETE FROM youtube_revocations WHERE expires_at<=?")
      .run(this.time());
    this.store.db
      .prepare(
        "UPDATE youtube_connections SET state='needs_reconnect',channel_id=NULL,channel=NULL,snapshot=NULL,credentials=NULL,scopes='[]',message='Stored YouTube data expired and was deleted. Reconnect to authorize a fresh read.' WHERE expires_at<=? AND (snapshot IS NOT NULL OR credentials IS NOT NULL OR channel IS NOT NULL)",
      )
      .run(this.time());
    this.store.db
      .prepare(
        "DELETE FROM youtube_syncs WHERE created_at<? AND status NOT IN ('queued','running')",
      )
      .run(new Date(this.now() - DATA_TTL_MS).toISOString());
  }
}
