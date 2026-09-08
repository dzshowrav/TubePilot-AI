import { YoutubeConnection } from "../components/youtube-connection";
import { Youtube } from "../components/visuals";
import React, { useEffect, useState } from "react";
import { View, Switch } from "react-native";
import {
  Save,
  Sparkles,
  CreditCard,
  Shield,
  Download,
  Trash2,
  ExternalLink,
  Sun,
  Moon,
  LogOut,
  Check,
  User,
  Settings as SettingsIcon,
} from "lucide-react-native";
import type { Bootstrap, Profile, ProfileInput } from "@tubepilot/contracts";
import { useApp, profileFields } from "../state";
import { api } from "../api";
import { clearToken, downloadText, saveToken } from "../credentials";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Field,
  Heading,
  ModalShell,
  PageHeading,
  Progress,
  Row,
  Select,
  Txt,
} from "../components/ui";
export function Settings() {
  const {
    data,
    theme,
    setModal,
    refresh,
    notify,
    toggleTheme,
    client,
    navigate,
  } = useApp();
  const [tab, setTab] = useState("Workspace"),
    [form, setForm] = useState<ProfileInput | null>(
      data ? profileFields(data.profile) : null,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState(false),
    [confirm, setConfirm] = useState("");
  useEffect(() => {
    if (data) setForm(profileFields(data.profile));
  }, [data?.profile.id]);
  useEffect(() => {
    if (data) setForm((f) => (f ? { ...f, theme: data.profile.theme } : f));
  }, [data?.profile.theme]);
  if (!data || !form) return null;
  const update = <K extends keyof ProfileInput>(
    key: K,
    value: ProfileInput[K],
  ) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/me", "PATCH", form);
      await refresh();
      notify("Your workspace feels a little more like you.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const freshDemo = async () => {
    await clearToken();
    const session = await api<{ token?: string }>("/auth/demo", "POST", {});
    await saveToken(session.token);
    const boot = await api<Bootstrap>("/bootstrap");
    client.removeQueries({ predicate: (q) => q.queryKey[0] !== "bootstrap" });
    client.setQueryData(["bootstrap"], boot);
    navigate("overview");
  };
  const signOut = async () => {
    try {
      await api("/auth/logout", "POST", {});
      await freshDemo();
      setModal("auth");
      notify("Signed out. You can sign back in to your saved workspace.");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api("/me", "DELETE");
      setDeleting(false);
      setConfirm("");
      await freshDemo();
      notify("Workspace deleted. You’re now in a new demo workspace.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ maxWidth: 980, width: "100%" }}>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="A workspace that feels like you."
        description="The small details that make creating a little easier."
      />
      <Row gap={8} style={{ flexWrap: "wrap", marginBottom: 25 }}>
        {["Workspace", "Connections", "Usage & plans", "Privacy"].map((t) => (
          <Chip
            key={t}
            active={tab === t}
            onPress={() => {
              setTab(t);
              setError("");
            }}
          >
            {t}
          </Chip>
        ))}
      </Row>
      {!!error && (
        <Txt color={theme.danger} size={12} style={{ marginBottom: 15 }}>
          {error}
        </Txt>
      )}
      {tab === "Workspace" ? (
        <View style={{ gap: 20 }}>
          <Card style={{ gap: 22 }}>
            <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <Row gap={14}>
                <Avatar name={form.name} size={48} />
                <View>
                  <Heading size={20}>{data.profile.name}</Heading>
                  <Txt size={11} muted>
                    {data.profile.email ??
                      "Demo workspace · save your work with an account"}
                  </Txt>
                </View>
              </Row>
              {data.profile.guest ? (
                <Button
                  small
                  variant="secondary"
                  onPress={() => setModal("auth")}
                >
                  Create an account
                </Button>
              ) : (
                <Badge>FREE WORKSPACE</Badge>
              )}
            </Row>
            <Row style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
              <Field
                label="Your name"
                value={form.name}
                onChangeText={(v) => update("name", v)}
                style={{ flex: 1, minWidth: 220 }}
              />
              <Field
                label="Channel / workspace name"
                value={form.channelName}
                onChangeText={(v) => update("channelName", v)}
                style={{ flex: 1, minWidth: 220 }}
              />
            </Row>
            <Row style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 220 }}>
                <Select
                  label="Your niche"
                  value={form.niche}
                  options={[
                    "AI & Technology",
                    "Creator economy",
                    "Productivity",
                    "Design",
                    "Education",
                    "Gaming",
                    "Lifestyle",
                    "Other",
                  ]}
                  onChange={(v) => update("niche", v)}
                />
              </View>
              <View style={{ flex: 1, minWidth: 220 }}>
                <Select
                  label="Draft language"
                  value={form.language}
                  options={[
                    { label: "English", value: "en" },
                    { label: "বাংলা — Bengali", value: "bn" },
                  ]}
                  onChange={(v) =>
                    update("language", v as ProfileInput["language"])
                  }
                />
              </View>
            </Row>
            <Row style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 220 }}>
                <Select
                  label="Brand voice"
                  value={form.voice}
                  options={[
                    "Friendly",
                    "Educational",
                    "Professional",
                    "Funny",
                    "Cinematic",
                  ]}
                  onChange={(v) => update("voice", v as ProfileInput["voice"])}
                />
              </View>
              <View style={{ flex: 1, minWidth: 220 }}>
                <Select
                  label="Your focus right now"
                  value={form.goal}
                  options={[
                    { label: "Create more consistently", value: "consistency" },
                    { label: "Find the right audience", value: "audience" },
                    { label: "Make more engaging videos", value: "engagement" },
                  ]}
                  onChange={(v) => update("goal", v as ProfileInput["goal"])}
                />
              </View>
            </Row>
            <Select
              label="Timezone"
              value={form.timezone}
              options={[
                "Asia/Dhaka",
                "Asia/Kolkata",
                "Asia/Dubai",
                "Europe/London",
                "America/New_York",
                "America/Los_Angeles",
                "UTC",
              ]}
              onChange={(v) => update("timezone", v)}
            />
            <Row style={{ justifyContent: "flex-end" }}>
              <Button icon={Save} loading={busy} onPress={() => void save()}>
                Save preferences
              </Button>
            </Row>
          </Card>
          <Card style={{ gap: 22 }}>
            <Heading size={19}>A comfortable place to create</Heading>
            <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <View style={{ flex: 1, gap: 5 }}>
                <Txt size={13} weight="500">
                  Appearance
                </Txt>
                <Txt size={11} muted>
                  A little light or a little dark. Your choice.
                </Txt>
              </View>
              <Button
                variant="secondary"
                icon={theme.bg === "#111217" ? Sun : Moon}
                onPress={() => void toggleTheme()}
              >
                {theme.bg === "#111217" ? "Switch to light" : "Switch to dark"}
              </Button>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1, gap: 5 }}>
                <Txt size={13} weight="500">
                  In-app notifications
                </Txt>
                <Txt size={11} muted>
                  Keep a little inspiration within reach.
                </Txt>
              </View>
              <Switch
                accessibilityLabel="In-app notifications"
                value={form.notifications}
                onValueChange={(v) => {
                  update("notifications", v);
                  void api("/me", "PATCH", {
                    ...profileFields(data.profile),
                    notifications: v,
                  })
                    .then(() => refresh())
                    .then(() =>
                      notify(
                        v ? "Notifications enabled." : "Notifications paused.",
                      ),
                    )
                    .catch((e) => {
                      update("notifications", !v);
                      notify(e.message);
                    });
                }}
                trackColor={{ false: theme.border, true: theme.purple }}
                thumbColor={theme.white}
              />
            </Row>
          </Card>
        </View>
      ) : tab === "Connections" ? (
        <View style={{ gap: 19 }}>
          <Card>
            <YoutubeConnection />
          </Card>
          {[
            {
              name: "AI gateway",
              icon: Sparkles,
              color: theme.purple,
              status:
                data.integrations.ai === "demo"
                  ? "Demo templates"
                  : "Provider configured",
              description:
                "OpenAI-compatible backend gateway. Provider credentials are never stored in your browser or mobile app.",
              action: "How generation works",
              modal: "gateway",
            },
            {
              name: "Billing",
              icon: CreditCard,
              color: theme.accent,
              status: "Not configured",
              description:
                "Your free workspace includes demo credits. No payment information is collected and no paid subscription is active.",
              action: "Explore planned tiers",
              modal: "upgrade",
            },
          ].map((item) => (
            <Card key={item.name} style={{ gap: 16 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Row>
                  <item.icon color={item.color} size={24} />
                  <Heading size={19}>{item.name}</Heading>
                </Row>
                <Badge color={item.color}>{item.status}</Badge>
              </Row>
              <Txt size={12} muted style={{ lineHeight: 21 }}>
                {item.description}
              </Txt>
              <View style={{ alignItems: "flex-start" }}>
                <Button
                  variant="secondary"
                  icon={ExternalLink}
                  onPress={() => setModal(item.modal)}
                >
                  {item.action}
                </Button>
              </View>
            </Card>
          ))}
        </View>
      ) : tab === "Usage & plans" ? (
        <View style={{ gap: 20 }}>
          <Card style={{ gap: 23 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <View>
                <Heading size={21}>A little fuel for your creativity.</Heading>
                <Txt size={11} muted style={{ marginTop: 6 }}>
                  Free workspace · 100 starting credits
                </Txt>
              </View>
              <Badge color={theme.accent}>FREE</Badge>
            </Row>
            <Row style={{ alignItems: "flex-end" }}>
              <Heading size={44}>{data.profile.credits}</Heading>
              <Txt size={12} muted style={{ marginBottom: 9 }}>
                credits available
              </Txt>
            </Row>
            <Progress
              value={data.profile.credits}
              color={theme.accent}
              height={9}
            />
            <Row style={{ justifyContent: "space-between" }}>
              <Txt size={10} muted>
                {100 - data.profile.credits - data.profile.reserved} used
              </Txt>
              <Txt size={10} muted>
                {data.profile.reserved} reserved for active tasks
              </Txt>
            </Row>
            <Txt size={11} muted style={{ lineHeight: 20 }}>
              Ideas use 3 credits, scripts 5, and titles 2. Cancelled demo
              requests return reserved credits. Live provider requests may still
              incur usage after cancellation. Credits are not money and cannot
              be purchased in this version.
            </Txt>
            <Button
              variant="secondary"
              icon={CreditCard}
              onPress={() => setModal("upgrade")}
            >
              See what’s planned
            </Button>
          </Card>
          <Card style={{ gap: 12 }}>
            <Heading size={19}>Built with a little more care</Heading>
            {[
              "Credits are reserved before a task starts.",
              "Duplicate request keys do not create duplicate charges.",
              "Your drafts remain available when credits run out.",
            ].map((text) => (
              <Row key={text}>
                <Check size={14} color={theme.accent} />
                <Txt size={12} muted>
                  {text}
                </Txt>
              </Row>
            ))}
          </Card>
        </View>
      ) : (
        <View style={{ gap: 20 }}>
          <Card style={{ gap: 17 }}>
            <Row>
              <Shield size={23} color={theme.purple} />
              <Heading size={21}>Your workspace. Your control.</Heading>
            </Row>
            <Txt size={12} muted style={{ lineHeight: 21 }}>
              Projects, preferences, and generation history are stored in your
              isolated workspace. Provider keys stay on the server. If you link
              YouTube, only authorized read-only data is fetched. No audience
              profiles or automatic AI ingestion are enabled.
            </Txt>
            <Button
              variant="secondary"
              icon={Download}
              onPress={() =>
                void api("/me/export")
                  .then((json) => {
                    downloadText(
                      "tubepilot-workspace.json",
                      JSON.stringify(json, null, 2),
                      "application/json",
                    );
                    notify("Workspace export prepared.");
                  })
                  .catch((e) => notify(e.message))
              }
            >
              Export my workspace
            </Button>
          </Card>
          <Card style={{ gap: 14 }}>
            <Heading size={19}>Session & account</Heading>
            <Txt muted size={12}>
              {data.profile.guest
                ? "This is an anonymous demo workspace. Create an account to come back on another device."
                : "Sign out securely. Your saved work stays in your account."}
            </Txt>
            <Row>
              <Button
                variant="secondary"
                icon={LogOut}
                onPress={() => void signOut()}
              >
                Sign out
              </Button>
              {data.profile.guest && (
                <Button variant="ghost" onPress={() => setModal("auth")}>
                  Create an account
                </Button>
              )}
            </Row>
          </Card>
          <Card style={{ gap: 16, borderColor: theme.danger + "45" }}>
            <Heading size={19}>Delete this workspace</Heading>
            <Txt muted size={12}>
              Permanently remove your projects, profile, session, and generation
              history. This cannot be undone.
            </Txt>
            <View style={{ alignItems: "flex-start" }}>
              <Button
                variant="danger"
                icon={Trash2}
                onPress={() => setDeleting(true)}
              >
                Delete workspace
              </Button>
            </View>
          </Card>
        </View>
      )}
      <ModalShell
        visible={deleting}
        title="A permanent goodbye?"
        subtitle="This deletes all projects, generation history, and account information in this workspace."
        onClose={() => setDeleting(false)}
        width={480}
      >
        <Field
          label="Type DELETE to confirm"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="DELETE"
        />
        <Button
          variant="danger"
          icon={Trash2}
          disabled={confirm !== "DELETE"}
          loading={busy}
          onPress={() => void remove()}
        >
          Delete my workspace permanently
        </Button>
      </ModalShell>
    </View>
  );
}
