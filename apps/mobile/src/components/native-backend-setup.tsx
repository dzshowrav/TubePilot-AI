import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { ArrowRight, Server, ShieldCheck } from "lucide-react-native";
import { normalizeApiOrigin } from "@tubepilot/contracts";
import { configureApiOrigin, getApiOrigin } from "../credentials";
import { useApp } from "../state";
import { Badge, Button, Card, Field, Heading, Row, Txt } from "./ui";
import { Logo } from "./visuals";

/** Native-only startup recovery. The APK contains the client, not the NestJS backend. */
export function NativeBackendSetup({
  reason,
  onConfigured,
}: {
  reason: string;
  onConfigured: () => void;
}) {
  const { theme, client } = useApp();
  const [origin, setOrigin] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void getApiOrigin()
      .then(setOrigin)
      .catch(() => {});
  }, []);
  const connect = async () => {
    setBusy(true);
    setError("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const normalized = normalizeApiOrigin(origin);
      // Probe with no existing app credentials. A new server never receives an old server's session.
      const response = await fetch(normalized + "/api/v1/health", {
        headers: { Accept: "application/json" },
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok || body?.ok !== true || body?.service !== "TubePilot AI")
        throw new Error(
          "This address did not return a TubePilot backend. Check its deployment and HTTPS URL.",
        );
      if (response.url && new URL(response.url).origin !== normalized)
        throw new Error(
          "The server redirected to another origin. Enter the final trusted backend origin directly.",
        );
      await configureApiOrigin(normalized);
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "bootstrap",
      });
      onConfigured();
    } catch (e) {
      setError(
        controller.signal.aborted
          ? "The server took too long to respond. Check the URL and your internet connection."
          : e instanceof Error
            ? e.message
            : "Could not connect to this backend.",
      );
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 26,
          paddingTop: 58,
          paddingBottom: 42,
        }}
      >
        <View
          style={{ maxWidth: 470, width: "100%", alignSelf: "center", gap: 24 }}
        >
          <Logo />
          <View style={{ gap: 12 }}>
            <Badge>ANDROID / NATIVE SETUP</Badge>
            <Heading size={29}>Your studio needs a home.</Heading>
            <Txt size={13} muted>
              This APK contains the TubePilot app. Connect it to your running
              TubePilot backend to use projects, accounts and generation.
            </Txt>
          </View>
          <Card style={{ padding: 20, gap: 17 }}>
            <Row>
              <Server size={20} color={theme.purple} />
              <Heading size={19}>Connect your workspace server</Heading>
            </Row>
            <Field
              label="TubePilot backend URL"
              value={origin}
              onChangeText={setOrigin}
              placeholder="https://studio.example.com"
              disabled={busy}
            />
            <Txt size={11} muted>
              Use the HTTPS origin only—no /api/v1 suffix. Enter only a server
              you trust. Your backend administrator can provide this address.
            </Txt>
            {!!error && (
              <Txt
                color={theme.danger}
                size={12}
                accessibilityLiveRegion="polite"
              >
                {error}
              </Txt>
            )}
            <Button
              icon={ArrowRight}
              loading={busy}
              disabled={!origin.trim()}
              onPress={() => void connect()}
            >
              Open my workspace
            </Button>
          </Card>
          <Row style={{ alignItems: "flex-start" }}>
            <ShieldCheck size={18} color={theme.positive} />
            <Txt size={11} muted style={{ flex: 1, lineHeight: 19 }}>
              The server URL is not an API key. Never enter Google passwords or
              provider secrets here. Switching the server clears the local
              session; credentials are bound to the backend that issued them.
            </Txt>
          </Row>
          <Txt size={10} muted>
            {reason}
          </Txt>
          <Txt size={10} muted>
            A GitHub APK build does not deploy the backend. Server setup is
            documented in the repository README.
          </Txt>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
