import { randomBytes, randomUUID, createHash } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type {
  YoutubeChannel,
  YoutubeFlow,
  YoutubeReview,
  YoutubeSnapshot,
  YoutubeStatus,
} from "@tubepilot/contracts";
import { Store, hash } from "../store.js";
import {
  ANALYTICS_SCOPE,
  DATA_TTL_MS,
  NATIVE_RETURN_URI,
  YOUTUBE_SCOPE,
  youtubeConfig,
  type YoutubeConfig,
} from "./config.js";
import { TokenVault } from "./vault.js";
import {
  GoogleClient,
  GoogleError,
  emptyReport,
  type GoogleTokens,
} from "./google-client.js";
import {
  YoutubeRepository,
  type ConnectionRow,
  type FlowRow,
} from "./repository.js";

export interface YoutubeOptions {
  config?: YoutubeConfig | null;
  fetcher?: typeof fetch;
  now?: () => number;
  maintenance?: boolean;
}
export interface OAuthResult {
  flowId: string;
  client: "web" | "native";
  origin: string;
  receipt?: string;
  error?: string;
}
export class YoutubeService {
  readonly repo: YoutubeRepository;
  readonly config: YoutubeConfig | null;
  private vault: TokenVault | null;
  private google: GoogleClient | null;
  private refreshes = new Map<string, Promise<GoogleTokens>>();
  private controllers = new Map<
    string,
    { userId: string; controller: AbortController }
  >();
  private running = new Set<Promise<void>>();
  private timer?: ReturnType<typeof setInterval>;
  private pumping = false;
  private closed = false;
  private now: () => number;
  constructor(
    private store: Store,
    options: YoutubeOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.config =
      options.config === undefined ? youtubeConfig() : options.config;
    this.repo = new YoutubeRepository(store, this.now);
    this.vault = this.config ? new TokenVault(this.config.encryptionKey) : null;
    this.google = this.config
      ? new GoogleClient(
          this.config,
          (bucket) =>
            this.repo.reserve(
              bucket,
              bucket === "data"
                ? this.config!.dataUnitsPerDay
                : this.config!.analyticsRequestsPerDay,
            ),
          options.fetcher,
          this.now,
        )
      : null;
    if (options.maintenance !== false) {
      this.timer = setInterval(() => {
        this.repo.prune();
        void this.processRevocations();
      }, 30_000);
      this.timer.unref();
    }
  }
  private configured() {
    if (!this.config || !this.vault || !this.google)
      throw new ServiceUnavailableException(
        "YouTube is not configured on this server. The demo workspace remains available.",
      );
    return { config: this.config, vault: this.vault, google: this.google };
  }
  private context(userId: string, id: string, purpose: string) {
    return `${userId}:${id}:${purpose}`;
  }
  start(
    userId: string,
    sessionToken: string,
    input: { client: "web" | "native"; analytics: boolean },
    requestOrigin?: string,
  ): YoutubeFlow {
    const { config, vault } = this.configured();
    if (this.repo.revocationPending(userId))
      throw new BadRequestException(
        "Google permission revocation is still pending. Wait for it to finish before reconnecting.",
      );
    if (this.store.profile(userId).guest)
      throw new ForbiddenException(
        "Create a TubePilot account before linking a channel.",
      );
    if (input.client === "web" && requestOrigin !== config.appOrigin)
      throw new ForbiddenException(
        "Start Google authorization from the configured TubePilot app origin.",
      );
    const id = randomUUID(),
      state = randomBytes(32).toString("base64url"),
      verifier = randomBytes(48).toString("base64url");
    const expiresAt = this.repo.createFlow(
      userId,
      hash(sessionToken),
      id,
      state,
      vault.seal({ verifier }, this.context(userId, id, "verifier")),
      input.client,
      input.analytics,
    );
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: [
        YOUTUBE_SCOPE,
        ...(input.analytics ? [ANALYTICS_SCOPE] : []),
      ].join(" "),
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "consent select_account",
      include_granted_scopes: "true",
      enable_granular_consent: "true",
    }).toString();
    return { id, authorizationUrl: url.href, expiresAt };
  }
  async callback(
    state: string,
    code?: string,
    providerError?: string,
  ): Promise<OAuthResult> {
    const { config, vault, google } = this.configured();
    const flow = this.repo.claimState(state);
    const result = {
      flowId: flow.id,
      client: flow.client,
      origin: config.appOrigin,
    };
    if (providerError) {
      this.repo.failFlow(flow.id);
      return {
        ...result,
        error:
          "Google authorization was not completed. Your existing connection has not changed.",
      };
    }
    if (!code || code.length > 4096) {
      this.repo.failFlow(flow.id);
      return {
        ...result,
        error: "Google did not return a valid authorization code. Start again.",
      };
    }
    const controller = new AbortController();
    this.controllers.set(flow.id, { userId: flow.user_id, controller });
    try {
      const { verifier } = vault.open<{ verifier: string }>(
        flow.verifier!,
        this.context(flow.user_id, flow.id, "verifier"),
      );
      const tokens = await google.exchange(code, verifier, controller.signal);
      // Previous Google consent may include extra scopes. Only enable what this connection requested.
      tokens.scopes = tokens.scopes.filter(
        (scope) =>
          scope === YOUTUBE_SCOPE ||
          (flow.analytics === 1 && scope === ANALYTICS_SCOPE),
      );
      const receipt = randomBytes(32).toString("base64url");
      if (
        this.closed ||
        controller.signal.aborted ||
        !this.repo.finishExchange(
          flow,
          vault.seal(tokens, this.context(flow.user_id, flow.id, "tokens")),
          receipt,
        )
      )
        throw new Error("expired");
      // No connection is made here. Only the initiating client receives this receipt.
      // State/status polling alone cannot link a channel (including a login-CSRF victim's channel).
      return { ...result, receipt };
    } catch (error) {
      if (!this.closed) this.repo.failFlow(flow.id);
      return {
        ...result,
        error:
          error instanceof GoogleError
            ? error.message
            : "The authorization expired or could not be completed. Start again.",
      };
    } finally {
      this.controllers.delete(flow.id);
    }
  }
  private flowTokens(flow: FlowRow) {
    return this.configured().vault.open<GoogleTokens>(
      flow.credentials!,
      this.context(flow.user_id, flow.id, "tokens"),
    );
  }
  async review(
    userId: string,
    sessionToken: string,
    id: string,
    receipt: string,
  ): Promise<YoutubeReview> {
    const { google } = this.configured();
    const flow = this.repo.receipt(userId, hash(sessionToken), id, receipt);
    let channels: YoutubeChannel[];
    const tokens = this.flowTokens(flow);
    if (flow.channels) channels = JSON.parse(flow.channels);
    else {
      const controller = new AbortController();
      const key = "review:" + id;
      this.controllers.set(key, { userId, controller });
      try {
        channels = await google.channels(tokens.accessToken, controller.signal);
        this.repo.receipt(userId, hash(sessionToken), id, receipt);
        this.repo.saveChannels(id, channels);
      } catch (error) {
        if (error instanceof GoogleError)
          throw new BadRequestException(error.message);
        throw error;
      } finally {
        this.controllers.delete(key);
      }
    }
    return {
      id,
      channels,
      analyticsGranted: tokens.scopes.includes(ANALYTICS_SCOPE),
      expiresAt: flow.expires_at,
      replacingConnection: !!flow.expected_connection,
    };
  }
  confirm(
    userId: string,
    sessionToken: string,
    id: string,
    receipt: string,
    channelId: string,
  ) {
    const { vault } = this.configured();
    const flow = this.repo.receipt(userId, hash(sessionToken), id, receipt);
    const channel = (
      JSON.parse(flow.channels ?? "[]") as YoutubeChannel[]
    ).find((item) => item.id === channelId);
    if (!channel)
      throw new ForbiddenException(
        "Review and choose a channel returned by the authorized account first.",
      );
    const tokens = this.flowTokens(flow),
      connectionId = randomUUID();
    this.repo.confirm(
      userId,
      hash(sessionToken),
      id,
      receipt,
      channel,
      connectionId,
      vault.seal(tokens, this.context(userId, connectionId, "tokens")),
      tokens.scopes,
      tokens.refreshExpiresAt,
    );
    this.abortUser(userId);
    try {
      this.sync(userId, true);
    } catch {
      /* The connection is durable even if the global refresh queue is currently full. */
    }
    return this.status(userId);
  }
  cancel(userId: string, id: string) {
    this.repo.cancelFlow(userId, id);
    this.controllers.get(id)?.controller.abort();
    this.controllers.get("review:" + id)?.controller.abort();
    return { ok: true };
  }
  status(userId: string): YoutubeStatus {
    this.repo.prune();
    const row = this.repo.connection(userId);
    return {
      configured: !!this.config,
      state: row?.state ?? "not_connected",
      connectionId: row?.id ?? null,
      channel: row?.channel ? JSON.parse(row.channel) : null,
      snapshot: row?.snapshot ? JSON.parse(row.snapshot) : null,
      connectedAt: row?.connected_at ?? null,
      lastSyncedAt: row?.last_synced_at ?? null,
      message: row?.message ?? null,
      analyticsGranted: row
        ? JSON.parse(row.scopes).includes(ANALYTICS_SCOPE)
        : false,
      sync: row ? this.repo.latestSync(userId) : null,
      revocationPending: this.repo.revocationPending(userId),
      dataExpiresAt: row?.expires_at ?? null,
    };
  }
  private async tokens(row: ConnectionRow, signal: AbortSignal) {
    const { vault, google } = this.configured();
    this.repo.assertConnection(row.user_id, row.id);
    const existing = vault.open<GoogleTokens>(
      row.credentials!,
      this.context(row.user_id, row.id, "tokens"),
    );
    if (
      existing.refreshExpiresAt !== undefined &&
      existing.refreshExpiresAt <= this.now()
    )
      throw new GoogleError(
        "revoked",
        "Time-limited Google authorization expired. Reconnect your channel.",
      );
    if (existing.expiresAt > this.now() + 60_000) return existing;
    let promise = this.refreshes.get(row.id);
    if (!promise) {
      promise = (async () => {
        const current = await google.refresh(existing, signal);
        this.repo.assertConnection(row.user_id, row.id);
        if (
          signal.aborted ||
          this.closed ||
          !this.repo.replaceTokens(
            row.user_id,
            row.id,
            vault.seal(current, this.context(row.user_id, row.id, "tokens")),
            current.scopes,
          )
        )
          throw new Error("Connection changed.");
        return current;
      })();
      this.refreshes.set(row.id, promise);
    }
    try {
      return await promise;
    } finally {
      if (this.refreshes.get(row.id) === promise) this.refreshes.delete(row.id);
    }
  }
  sync(userId: string, initial = false) {
    this.configured();
    const connection = this.repo.connection(userId);
    if (!connection || connection.state !== "connected")
      throw new BadRequestException(
        "Connect or reauthorize a channel before refreshing.",
      );
    const run = this.repo.admitSync(userId, connection.id, initial);
    if (run.fresh)
      setImmediate(() => {
        if (this.closed) return;
        const work = this.runSync(userId, connection.id, run.id);
        this.running.add(work);
        void work.finally(() => this.running.delete(work));
      });
    return this.status(userId);
  }
  private async runSync(userId: string, connectionId: string, runId: string) {
    if (!this.repo.startSync(runId)) return;
    const controller = new AbortController();
    this.controllers.set(runId, { userId, controller });
    try {
      const row = this.repo.assertConnection(userId, connectionId),
        google = this.configured().google;
      const tokens = await this.tokens(row, controller.signal);
      const channel = (
        await google.channels(tokens.accessToken, controller.signal)
      ).find((item) => item.id === row.channel_id);
      if (!channel)
        throw new GoogleError(
          "revoked",
          "The authorized account no longer exposes the selected channel. Reconnect to choose a channel.",
        );
      let videos: YoutubeSnapshot["videos"];
      try {
        const items = await google.videos(
          channel,
          tokens.accessToken,
          controller.signal,
        );
        videos = {
          state: items.length ? "ready" : "empty",
          items,
          message: null,
        };
      } catch (error) {
        if (error instanceof GoogleError && error.code === "revoked")
          throw error;
        videos = {
          state: "unavailable",
          items: [],
          message:
            error instanceof GoogleError
              ? error.message
              : "Recent uploads are unavailable.",
        };
      }
      if (controller.signal.aborted) throw new Error("Refresh cancelled.");
      let analytics: YoutubeSnapshot["analytics"];
      try {
        analytics = await google.analytics(
          channel.id,
          tokens,
          controller.signal,
        );
      } catch (error) {
        if (error instanceof GoogleError && error.code === "revoked")
          throw error;
        analytics = emptyReport(
          error instanceof GoogleError
            ? error.message
            : "Historical analytics are unavailable.",
        );
      }
      if (this.closed || controller.signal.aborted) return;
      const fetchedAt = new Date(this.now()).toISOString(),
        expiresAt = new Date(
          Math.min(
            this.now() + DATA_TTL_MS,
            tokens.refreshExpiresAt ?? Infinity,
          ),
        ).toISOString();
      this.repo.saveSnapshot(userId, connectionId, runId, {
        source: "youtube",
        fetchedAt,
        expiresAt,
        channel,
        videos,
        analytics,
      });
    } catch (error) {
      if (!this.closed) {
        const message =
          error instanceof GoogleError
            ? error.message
            : "The refresh stopped. Your connection may have changed; try again.";
        if (
          error instanceof GoogleError &&
          (error.code === "revoked" || error.code === "permission")
        )
          this.repo.invalidate(userId, connectionId, message);
        else this.repo.syncError(userId, connectionId, message);
        this.repo.endSync(
          runId,
          controller.signal.aborted ? "cancelled" : "failed",
          message,
        );
      }
    } finally {
      this.controllers.delete(runId);
    }
  }
  private abortUser(userId: string) {
    for (const [key, operation] of this.controllers)
      if (operation.userId === userId && !key.startsWith("revoke:"))
        operation.controller.abort();
  }
  disconnect(userId: string, revoke: boolean) {
    const row = this.repo.connection(userId);
    this.abortUser(userId);
    let manualRevocationRequired = false;
    // Queue the minimal encrypted revocation token before deleting local API data. No Google data
    // is retained for the UI; account deletion may remove the user association but not this short TTL.
    if (row?.credentials && revoke) {
      try {
        const { vault } = this.configured();
        const tokens = vault.open<GoogleTokens>(
            row.credentials,
            this.context(userId, row.id, "tokens"),
          ),
          id = randomUUID();
        this.repo.enqueueRevocation(
          id,
          userId,
          vault.seal({ token: tokens.refreshToken }, "revocation:" + id),
        );
      } catch {
        manualRevocationRequired = true;
      }
    }
    this.repo.remove(userId);
    void this.processRevocations();
    return {
      ok: true,
      revocationPending: this.repo.revocationPending(userId),
      manualRevocationRequired,
    };
  }
  async processRevocations() {
    if (this.pumping || this.closed || !this.google || !this.vault) return;
    this.pumping = true;
    try {
      for (const row of this.repo.revocations()) {
        if (this.closed) break;
        const controller = new AbortController();
        this.controllers.set("revoke:" + row.id, {
          userId: row.user_id ?? "",
          controller,
        });
        try {
          const { token } = this.vault.open<{ token: string }>(
            row.credentials,
            "revocation:" + row.id,
          );
          await this.google.revoke(token, controller.signal);
          if (!this.closed) this.repo.revoked(row.id);
        } catch {
          if (!this.closed) this.repo.retryRevocation(row);
        } finally {
          this.controllers.delete("revoke:" + row.id);
        }
      }
    } finally {
      this.pumping = false;
    }
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    if (this.timer) clearInterval(this.timer);
    for (const operation of this.controllers.values())
      operation.controller.abort();
    await Promise.allSettled([...this.running]);
  }
  onModuleDestroy() {
    return this.close();
  }
}

export function callbackDocument(result: OAuthResult) {
  const nonce = randomBytes(16).toString("base64");
  const message = JSON.stringify({
    type: "tubepilot.youtube.authorization",
    flowId: result.flowId,
    ...(result.receipt ? { receipt: result.receipt } : { error: result.error }),
  }).replace(/</g, "\\u003c");
  const origin = JSON.stringify(result.origin).replace(/</g, "\\u003c");
  const success = !!result.receipt;
  const native = new URL(NATIVE_RETURN_URI);
  native.searchParams.set("flow", result.flowId);
  native.hash = new URLSearchParams(
    result.receipt
      ? { receipt: result.receipt }
      : { error: result.error ?? "Authorization could not be completed." },
  ).toString();
  return {
    nonce,
    nativeUrl: native.href,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TubePilot · Google authorization</title><style nonce="${nonce}">body{background:#111217;color:#f3f3f6;font:16px system-ui;display:grid;place-items:center;min-height:90vh;margin:0}main{max-width:430px;padding:35px}small{color:#d2f580;letter-spacing:2px}p{color:#a1a3b4;line-height:1.7}code{overflow-wrap:anywhere;color:#d2f580}</style></head><body><main><small>TUBEPILOT AI</small><h1>${success ? "Permission received." : "Authorization not completed."}</h1><p>Return to the original TubePilot window to ${success ? "review and confirm your channel" : "try again"}. This window can be closed. If your browser blocked the return, start again from the app.</p><p>No video has been published and no channel is linked until you confirm it in TubePilot.</p>${success ? `<p>If the automatic return is blocked, copy this one-time confirmation code, close this window, and paste it into the original TubePilot connection dialog. Only use it if <strong>you</strong> started this request. Never share it.</p><code>${result.receipt}</code>` : ""}</main><script nonce="${nonce}">if(window.opener){window.opener.postMessage(${message},${origin});window.close();}</script></body></html>`,
  };
}
