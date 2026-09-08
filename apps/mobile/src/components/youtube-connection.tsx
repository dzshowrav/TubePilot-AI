import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Switch,
  Platform,
  Linking,
  ActivityIndicator,
} from "react-native";
import {
  Check,
  ChevronRight,
  ExternalLink,
  Info,
  Link2,
  RefreshCw,
  ShieldCheck,
  Unplug,
  X,
} from "lucide-react-native";
import type {
  YoutubeFlow,
  YoutubeReview,
  YoutubeStatus,
} from "@tubepilot/contracts";
import { useApp } from "../state";
import { api } from "../api";
import { authorizeYoutube } from "../youtube-auth";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Heading,
  ModalShell,
  Row,
  Txt,
} from "./ui";
import { Youtube } from "./visuals";

export function YoutubeConnection() {
  const { data, theme, refresh, notify, setModal } = useApp();
  const [analytics, setAnalytics] = useState(
      data?.youtube?.analyticsGranted ?? false,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [flow, setFlow] = useState<YoutubeFlow | null>(null),
    [review, setReview] = useState<YoutubeReview | null>(null),
    [receipt, setReceipt] = useState(""),
    [selected, setSelected] = useState(""),
    [instructions, setInstructions] = useState(false),
    [disconnecting, setDisconnecting] = useState(false),
    [revoke, setRevoke] = useState(true);
  const activeFlow = useRef<string | null>(null),
    controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      if (activeFlow.current)
        void api(`/youtube/flows/${activeFlow.current}`, "DELETE").catch(
          () => {},
        );
    },
    [],
  );
  const state = data?.youtube;
  if (!state)
    return (
      <Card>
        <Txt muted>Loading channel connection…</Txt>
      </Card>
    );
  const syncing =
    state.sync?.status === "queued" || state.sync?.status === "running";
  const getReview = async (id: string, proof: string) => {
    const value = await api<YoutubeReview>(
      `/youtube/flows/${id}/review`,
      "POST",
      { receipt: proof },
    );
    setReceipt(proof);
    setReview(value);
    setSelected(value.channels[0]?.id ?? "");
    setError("");
  };
  const begin = async () => {
    setBusy(true);
    setError("");
    setReview(null);
    setReceipt("");
    controller.current?.abort();
    if (activeFlow.current)
      void api(`/youtube/flows/${activeFlow.current}`, "DELETE").catch(
        () => {},
      );
    const abort = new AbortController();
    controller.current = abort;
    try {
      const result = await authorizeYoutube(async () => {
        const value = await api<YoutubeFlow>("/youtube/flows", "POST", {
          client: Platform.OS === "web" ? "web" : "native",
          analytics,
        });
        activeFlow.current = value.id;
        setFlow(value);
        return value;
      }, abort.signal);
      await getReview(result.flowId, result.receipt);
    } catch (e) {
      if (!abort.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (!review) return;
    setBusy(true);
    setError("");
    try {
      await api(`/youtube/flows/${review.id}/confirm`, "POST", {
        receipt,
        channelId: selected,
      });
      activeFlow.current = null;
      setFlow(null);
      setReview(null);
      setReceipt("");
      await refresh();
      notify("Channel linked. A read-only refresh has been requested.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const sync = async () => {
    setError("");
    setBusy(true);
    try {
      await api<YoutubeStatus>("/youtube/sync", "POST", {});
      await refresh();
      notify("Reading your channel. Nothing is being published.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        revocationPending: boolean;
        manualRevocationRequired: boolean;
      }>("/youtube", "DELETE", { revoke });
      setDisconnecting(false);
      setReview(null);
      setFlow(null);
      activeFlow.current = null;
      await refresh();
      notify(
        result.manualRevocationRequired
          ? "Disconnected locally. Remove TubePilot access in your Google account to finish revocation."
          : result.revocationPending
            ? "YouTube data deleted locally. Google permission revocation is queued."
            : "YouTube disconnected. Your projects are still saved.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 18 }}>
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <Row>
          <View
            style={{
              padding: 11,
              borderRadius: 12,
              backgroundColor: "#ed949914",
            }}
          >
            <Youtube size={27} />
          </View>
          <View>
            <Heading size={21}>Your channel. With your permission.</Heading>
            <Txt size={11} muted>
              Google authorization · read-only access
            </Txt>
          </View>
        </Row>
        <Badge
          color={state.state === "connected" ? theme.positive : theme.purple}
        >
          {state.state === "connected"
            ? "LINKED"
            : state.state === "needs_reconnect"
              ? "RECONNECT NEEDED"
              : state.configured
                ? "READY TO CONNECT"
                : "SETUP REQUIRED"}
        </Badge>
      </Row>
      <Txt size={12} muted style={{ lineHeight: 21 }}>
        Bring your own channel into the workspace. We only request read
        access—never permission to upload, edit, or delete videos.
      </Txt>
      {state.channel && (
        <Card style={{ backgroundColor: theme.input, padding: 18, gap: 13 }}>
          <Row gap={12}>
            <Avatar name={state.channel.title} size={43} />
            <View style={{ flex: 1, gap: 4 }}>
              <Heading size={19}>{state.channel.title}</Heading>
              <Txt size={10} muted selectable>
                {state.channel.id}
              </Txt>
            </View>
            <Button
              small
              variant="ghost"
              icon={ExternalLink}
              label="Open connected YouTube channel"
              onPress={() =>
                void Linking.openURL(
                  `https://www.youtube.com/channel/${state.channel!.id}`,
                )
              }
            />
          </Row>
          <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <Txt size={10} muted>
              {state.lastSyncedAt
                ? "Last read: " + new Date(state.lastSyncedAt).toLocaleString()
                : "Waiting for the first channel refresh"}
            </Txt>
            <Badge>
              {state.analyticsGranted
                ? "ANALYTICS GRANTED"
                : "CHANNEL STATISTICS ONLY"}
            </Badge>
          </Row>
        </Card>
      )}
      {!!state.message && (
        <Row
          style={{
            padding: 13,
            borderRadius: 9,
            backgroundColor: theme.purpleBg,
            alignItems: "flex-start",
          }}
        >
          <Info size={16} color={theme.purple} />
          <Txt size={11} color={theme.purple} style={{ flex: 1 }}>
            {state.message}
          </Txt>
        </Row>
      )}
      {!!error && (
        <Txt size={12} color={theme.danger} accessibilityLiveRegion="polite">
          {error}
        </Txt>
      )}
      {syncing && (
        <Row>
          <ActivityIndicator color={theme.purple} />
          <Txt muted size={12}>
            Reading your channel and available reports…
          </Txt>
        </Row>
      )}
      {review ? (
        <Card style={{ gap: 17, backgroundColor: theme.input }}>
          <Badge>REVIEW BEFORE LINKING</Badge>
          <Heading size={19}>Is this the channel you meant?</Heading>
          <Txt size={11} muted>
            This links the selected channel to{" "}
            {data?.profile.email ?? "your current TubePilot account"}. Google
            sign-in does not automatically change your TubePilot account.
          </Txt>
          {review.channels.map((channel) => (
            <Button
              key={channel.id}
              icon={selected === channel.id ? Check : Youtube}
              variant={selected === channel.id ? "primary" : "secondary"}
              onPress={() => setSelected(channel.id)}
            >
              {channel.title}
            </Button>
          ))}
          {!review.channels.length && (
            <Txt size={12} muted>
              Google did not expose a YouTube channel for this account. Try a
              different Google or Brand Account.
            </Txt>
          )}
          <Txt size={11} muted>
            {review.analyticsGranted
              ? "Historical analytics permission was granted."
              : "Historical analytics is not enabled for this connection. Only channel statistics will be read."}{" "}
            {review.replacingConnection
              ? "Confirming replaces the existing channel and removes its cached data."
              : ""}
          </Txt>
          <Button
            icon={Link2}
            disabled={!selected}
            loading={busy}
            onPress={() => void confirm()}
          >
            Confirm read-only connection
          </Button>
          <Button
            variant="ghost"
            onPress={() => {
              if (activeFlow.current)
                void api(
                  `/youtube/flows/${activeFlow.current}`,
                  "DELETE",
                ).catch(() => {});
              activeFlow.current = null;
              setReview(null);
              setFlow(null);
              setReceipt("");
            }}
          >
            Discard this authorization
          </Button>
        </Card>
      ) : (
        <>
          {state.configured ? (
            <View style={{ gap: 16 }}>
              <Row
                style={{
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <View style={{ flex: 1, gap: 5 }}>
                  <Txt size={12} weight="500">
                    Include historical analytics (optional)
                  </Txt>
                  <Txt size={11} muted>
                    Views, watch minutes, and subscribers gained/lost. No
                    revenue, audience profiles, predictions, or AI scoring.
                  </Txt>
                </View>
                <Switch
                  accessibilityLabel="Include YouTube Analytics"
                  value={analytics}
                  onValueChange={setAnalytics}
                  disabled={busy}
                  trackColor={{ false: theme.border, true: theme.purple }}
                  thumbColor={theme.white}
                />
              </Row>
              {data?.profile.guest ? (
                <Button icon={Link2} onPress={() => setModal("auth")}>
                  Create an account to connect
                </Button>
              ) : (
                <Button
                  icon={Youtube}
                  loading={busy}
                  onPress={() => void begin()}
                >
                  {state.connectionId
                    ? "Reauthorize with Google"
                    : "Connect with Google"}
                </Button>
              )}
              {busy && (
                <Button
                  variant="ghost"
                  icon={X}
                  onPress={() => {
                    controller.current?.abort();
                    if (activeFlow.current)
                      void api(
                        `/youtube/flows/${activeFlow.current}`,
                        "DELETE",
                      ).catch(() => {});
                    activeFlow.current = null;
                    setBusy(false);
                    setFlow(null);
                  }}
                >
                  Cancel authorization
                </Button>
              )}
            </View>
          ) : (
            <Card style={{ backgroundColor: theme.input, gap: 14 }}>
              <Heading size={18}>
                The connector is built. This server needs setup.
              </Heading>
              <Txt size={12} muted>
                No Google credentials are configured, so no authorization or API
                call will be made. Your demo workspace remains fully usable.
              </Txt>
              <Button
                small
                variant="secondary"
                icon={ChevronRight}
                onPress={() => setInstructions(!instructions)}
              >
                {instructions
                  ? "Hide setup instructions"
                  : "Show setup instructions"}
              </Button>
              {instructions && (
                <View style={{ gap: 10 }}>
                  {[
                    "Enable the YouTube Data API v3 and, optionally, YouTube Analytics API in Google Cloud.",
                    "Create a Web application OAuth client and configure its consent screen / test users.",
                    "Set YOUTUBE_ENABLED, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_ORIGIN, GOOGLE_REDIRECT_URI and YOUTUBE_ENCRYPTION_KEY on the server.",
                    "Register the exact APP_ORIGIN/api/v1/youtube/oauth/callback URL. Keep the encryption key stable and private.",
                  ].map((line, i) => (
                    <Row key={line} style={{ alignItems: "flex-start" }}>
                      <Txt size={11} color={theme.purple}>
                        0{i + 1}
                      </Txt>
                      <Txt size={11} muted style={{ flex: 1 }}>
                        {line}
                      </Txt>
                    </Row>
                  ))}
                  <Txt size={10} muted>
                    Operator guide: docs/YOUTUBE_INTEGRATION.md. Never enter
                    Google passwords, client secrets, or encryption keys into
                    chat or browser storage.
                  </Txt>
                </View>
              )}
            </Card>
          )}
          {flow && !busy && (
            <Card style={{ gap: 12, backgroundColor: theme.input }}>
              <Txt size={12} weight="500">
                Automatic return blocked?
              </Txt>
              <Txt size={11} muted>
                Only paste the one-time TubePilot confirmation code from the
                Google return page for the request you started here. Never share
                it with someone else.
              </Txt>
              <Field
                label="YouTube confirmation code"
                value={receipt}
                onChangeText={setReceipt}
                placeholder="One-time confirmation code"
              />
              <Button
                small
                variant="secondary"
                disabled={!/^[A-Za-z0-9_-]{43}$/.test(receipt.trim())}
                onPress={() => {
                  setBusy(true);
                  void getReview(flow.id, receipt.trim())
                    .catch((e) => setError(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                Review authorized channel
              </Button>
            </Card>
          )}
        </>
      )}
      {state.connectionId && (
        <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <Button
            icon={RefreshCw}
            variant="secondary"
            disabled={
              busy ||
              syncing ||
              state.state !== "connected" ||
              !state.configured
            }
            onPress={() => void sync()}
          >
            Refresh channel
          </Button>
          <Button
            icon={Unplug}
            variant="ghost"
            onPress={() => setDisconnecting(true)}
          >
            Disconnect channel
          </Button>
        </Row>
      )}
      {state.revocationPending && (
        <Txt size={11} muted>
          Google revocation is pending. Local channel data is already removed.
          You can also remove access directly in your Google account.
        </Txt>
      )}
      <Row
        style={{
          alignItems: "flex-start",
          paddingTop: 15,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        }}
      >
        <ShieldCheck size={16} color={theme.positive} />
        <Txt size={10} muted style={{ flex: 1, lineHeight: 18 }}>
          Tokens stay encrypted on the server. Cached YouTube data expires after
          6 days without a refresh. This milestone does not feed YouTube data to
          AI or generate channel scores. Reports can lag; unavailable values are
          never replaced with demo numbers.
        </Txt>
      </Row>
      <Button
        small
        variant="ghost"
        icon={ExternalLink}
        onPress={() =>
          void Linking.openURL("https://myaccount.google.com/permissions")
        }
      >
        Manage access in Google
      </Button>
      <ModalShell
        visible={disconnecting}
        title="Disconnect this channel?"
        subtitle="Cached YouTube data will be deleted. Your own projects and drafts stay in your workspace."
        onClose={() => setDisconnecting(false)}
        width={490}
      >
        <Row style={{ alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: 7 }}>
            <Txt weight="500">Also revoke Google permission</Txt>
            <Txt size={11} muted>
              Google revocation can invalidate other TubePilot connections that
              share this Google account and OAuth project. If Google is
              unavailable, an encrypted revocation request is retried for up to
              48 hours.
            </Txt>
          </View>
          <Switch
            accessibilityLabel="Revoke Google permission"
            value={revoke}
            onValueChange={setRevoke}
            trackColor={{ false: theme.border, true: theme.purple }}
            thumbColor={theme.white}
          />
        </Row>
        <Button
          icon={Unplug}
          variant="danger"
          loading={busy}
          onPress={() => void disconnect()}
        >
          {revoke ? "Disconnect and revoke" : "Disconnect this workspace only"}
        </Button>
      </ModalShell>
    </View>
  );
}
