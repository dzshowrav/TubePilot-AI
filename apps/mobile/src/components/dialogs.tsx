import { YoutubeConnection } from "./youtube-connection";
import { Youtube } from "./visuals";
import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCheck,
  Sparkles,
  Search,
  FolderOpen,
  Compass,
  LayoutDashboard,
  Clapperboard,
  BarChart3,
  CalendarDays,
  Shield,
  BookOpen,
  User,
  LogIn,
  Lightbulb,
  Settings as SettingsIcon,
} from "lucide-react-native";
import type { Bootstrap, ProfileInput, Screen } from "@tubepilot/contracts";
import { useApp, profileFields } from "../state";
import { api } from "../api";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Heading,
  ModalShell,
  Progress,
  Row,
  Select,
  Txt,
} from "./ui";

export function AppDialogs() {
  const app = useApp(),
    {
      data,
      theme,
      modal,
      setModal,
      navigate,
      startStudio,
      notify,
      refresh,
      client,
    } = app;
  const [search, setSearch] = useState(""),
    [authMode, setAuthMode] = useState("register"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [step, setStep] = useState(0),
    [profile, setProfile] = useState<ProfileInput | null>(null);
  useEffect(() => {
    setError("");
    setBusy(false);
    if (modal === "onboarding" && data) {
      setStep(0);
      setProfile(profileFields(data.profile));
    }
    if (modal === "auth") {
      setName(data?.profile.name ?? "");
      setPassword("");
    }
    if (modal === "search") setSearch("");
  }, [modal]);
  const close = () => setModal(null);
  const authenticate = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ token?: string }>(
        `/auth/${authMode}`,
        "POST",
        { email, password, ...(authMode === "register" ? { name } : {}) },
      );
      const bootstrap = await api<Bootstrap>("/bootstrap");
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== "bootstrap" });
      client.setQueryData(["bootstrap"], bootstrap);
      setPassword("");
      close();
      navigate("overview");
      notify(
        authMode === "register"
          ? "Welcome to your own creative workspace."
          : "Welcome back. Your ideas are right where you left them.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const finishOnboarding = async () => {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      await api("/me", "PATCH", { ...profile, onboardingComplete: true });
      await refresh();
      close();
      notify("Your workspace is ready. Let’s make something great.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const destinations: {
    label: string;
    subtitle: string;
    screen: Screen;
    icon: React.ComponentType<any>;
  }[] = [
    {
      label: "Overview",
      subtitle: "Your creative dashboard",
      screen: "overview",
      icon: LayoutDashboard,
    },
    {
      label: "Trend Radar",
      subtitle: "Explore fresh directions",
      screen: "trends",
      icon: Compass,
    },
    {
      label: "Content Studio",
      subtitle: "Ideas, scripts, titles, and more",
      screen: "studio",
      icon: Clapperboard,
    },
    {
      label: "My Projects",
      subtitle: "Your saved drafts and ideas",
      screen: "projects",
      icon: FolderOpen,
    },
    {
      label: "Content Calendar",
      subtitle: "Make a little room to create",
      screen: "calendar",
      icon: CalendarDays,
    },
    {
      label: "Analytics",
      subtitle: "Sample channel insights",
      screen: "analytics",
      icon: BarChart3,
    },
    {
      label: "AI Assistant",
      subtitle: "A fresh creative perspective",
      screen: "assistant",
      icon: Sparkles,
    },
    {
      label: "Settings",
      subtitle: "Make your workspace feel like you",
      screen: "settings",
      icon: SettingsIcon,
    },
  ];
  const results = [
    ...destinations.map((d) => ({
      label: d.label,
      subtitle: d.subtitle,
      icon: d.icon,
      action: () => {
        navigate(d.screen);
        close();
      },
    })),
    ...(data?.projects ?? []).map((p) => ({
      label: p.title,
      subtitle: "Saved project",
      icon: FolderOpen,
      action: () => app.openProject(p),
    })),
    ...(data?.trends ?? []).map((t) => ({
      label: t.title,
      subtitle: "Sample trend · " + t.category,
      icon: Compass,
      action: () => {
        navigate("trends");
        close();
      },
    })),
  ]
    .filter((r) =>
      `${r.label} ${r.subtitle}`.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 10);
  return (
    <>
      <ModalShell
        visible={modal === "auth"}
        title={
          authMode === "register"
            ? "A home for your next chapter."
            : "Good to have you back."
        }
        subtitle={
          authMode === "register"
            ? "Create a free account to return to your workspace on any device."
            : "Your ideas, drafts, and plans are waiting for you."
        }
        onClose={close}
        width={470}
      >
        <View style={{ alignItems: "center", gap: 13, marginBottom: 7 }}>
          <Avatar name={name || "Creator"} size={55} />
          <Badge>YOUR OWN CREATIVE SPACE</Badge>
        </View>
        {authMode === "register" && (
          <Field
            label="Your name"
            value={name}
            onChangeText={setName}
            placeholder="What should we call you?"
          />
        )}
        <Field
          label="Email address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
        />
        <Field
          label="Password (at least 10 characters)"
          value={password}
          onChangeText={setPassword}
          secure
          placeholder="Make it something secure"
        />
        {!!error && (
          <Txt size={12} color={theme.danger}>
            {error}
          </Txt>
        )}
        <Button
          icon={authMode === "register" ? ArrowRight : LogIn}
          loading={busy}
          disabled={
            !email ||
            password.length < 10 ||
            (authMode === "register" && !name.trim())
          }
          onPress={() => void authenticate()}
        >
          {authMode === "register"
            ? "Create my workspace"
            : "Sign in to my workspace"}
        </Button>
        <Row style={{ justifyContent: "center", flexWrap: "wrap" }}>
          <Txt size={11} muted>
            {authMode === "register"
              ? "Already have a workspace?"
              : "New around here?"}
          </Txt>
          <Button
            small
            variant="ghost"
            onPress={() => {
              setAuthMode(authMode === "register" ? "login" : "register");
              setError("");
            }}
          >
            {authMode === "register" ? "Sign in" : "Create an account"}
          </Button>
        </Row>
        <Txt size={10} muted style={{ textAlign: "center", lineHeight: 18 }}>
          Development preview. Email verification, recovery, Google sign-in, and
          production account safeguards are not enabled yet. Don’t reuse an
          important password.
        </Txt>
      </ModalShell>
      <ModalShell
        visible={modal === "onboarding"}
        title={
          [
            "Make this space your own.",
            "What are you curious about?",
            "A little intention goes a long way.",
          ][step]
        }
        subtitle={`A quick introduction · Step ${step + 1} of 3`}
        onClose={close}
        width={530}
      >
        <Progress value={((step + 1) / 3) * 100} />
        {profile && (
          <>
            {step === 0 ? (
              <>
                <Field
                  label="Your name"
                  value={profile.name}
                  onChangeText={(v) => setProfile({ ...profile, name: v })}
                />
                <Field
                  label="Your channel / workspace name"
                  value={profile.channelName}
                  onChangeText={(v) =>
                    setProfile({ ...profile, channelName: v })
                  }
                />
                <Txt size={11} muted>
                  This is your workspace name, not a YouTube connection. You can
                  change it anytime.
                </Txt>
              </>
            ) : step === 1 ? (
              <>
                <Select
                  label="Your creative niche"
                  value={profile.niche}
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
                  onChange={(v) => setProfile({ ...profile, niche: v })}
                />
                <Select
                  label="Draft language"
                  value={profile.language}
                  options={[
                    { label: "English", value: "en" },
                    { label: "বাংলা — Bengali", value: "bn" },
                  ]}
                  onChange={(v) =>
                    setProfile({
                      ...profile,
                      language: v as ProfileInput["language"],
                    })
                  }
                />
                <Select
                  label="A voice that sounds like you"
                  value={profile.voice}
                  options={[
                    "Friendly",
                    "Educational",
                    "Professional",
                    "Funny",
                    "Cinematic",
                  ]}
                  onChange={(v) =>
                    setProfile({
                      ...profile,
                      voice: v as ProfileInput["voice"],
                    })
                  }
                />
              </>
            ) : (
              <>
                {[
                  {
                    id: "consistency",
                    title: "Find my creative rhythm",
                    description: "Make good work, a little more consistently.",
                  },
                  {
                    id: "audience",
                    title: "Find the right people",
                    description:
                      "Create for an audience I actually understand.",
                  },
                  {
                    id: "engagement",
                    title: "Make something more engaging",
                    description:
                      "Tell a clearer story and give viewers something useful.",
                  },
                ].map((goal) => (
                  <Pressable
                    key={goal.id}
                    accessibilityRole="button"
                    onPress={() =>
                      setProfile({
                        ...profile,
                        goal: goal.id as ProfileInput["goal"],
                      })
                    }
                    style={{
                      padding: 17,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor:
                        profile.goal === goal.id ? theme.purple : theme.border,
                      backgroundColor:
                        profile.goal === goal.id ? theme.purpleBg : theme.input,
                      flexDirection: "row",
                      gap: 13,
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1, gap: 5 }}>
                      <Txt size={13} weight="500">
                        {goal.title}
                      </Txt>
                      <Txt size={11} muted>
                        {goal.description}
                      </Txt>
                    </View>
                    {profile.goal === goal.id && (
                      <Check color={theme.purple} size={18} />
                    )}
                  </Pressable>
                ))}
              </>
            )}
            {!!error && (
              <Txt color={theme.danger} size={12}>
                {error}
              </Txt>
            )}
            <Row style={{ justifyContent: "space-between", marginTop: 10 }}>
              <Button
                variant="ghost"
                icon={ArrowLeft}
                onPress={() => (step ? setStep(step - 1) : close())}
              >
                {step ? "Back" : "Not right now"}
              </Button>
              <Button
                icon={step === 2 ? Sparkles : ArrowRight}
                loading={busy}
                disabled={!profile.name.trim() || !profile.channelName.trim()}
                onPress={() =>
                  step === 2 ? void finishOnboarding() : setStep(step + 1)
                }
              >
                {step === 2 ? "Make myself at home" : "Keep going"}
              </Button>
            </Row>
          </>
        )}
      </ModalShell>
      <ModalShell
        visible={modal === "search" || modal === "navigation"}
        title={
          modal === "search"
            ? "A little easier to find."
            : "Where would you like to go?"
        }
        subtitle="Your projects, tools, and next good idea."
        onClose={close}
        width={610}
      >
        {modal === "search" && (
          <Field
            label="Search your workspace"
            autoFocus
            value={search}
            onChangeText={setSearch}
            placeholder="A project, a topic, a tool…"
          />
        )}
        {(modal === "navigation"
          ? destinations.map((d) => ({
              label: d.label,
              subtitle: d.subtitle,
              icon: d.icon,
              action: () => {
                navigate(d.screen);
                close();
              },
            }))
          : results
        ).map((r, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            onPress={r.action}
            style={({ pressed }) => ({
              padding: 12,
              borderRadius: 8,
              backgroundColor: pressed ? theme.cardAlt : undefined,
              flexDirection: "row",
              gap: 13,
              alignItems: "center",
            })}
          >
            <View
              style={{
                padding: 10,
                borderRadius: 9,
                backgroundColor: theme.cardAlt,
              }}
            >
              <r.icon size={17} color={theme.purple} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Txt size={13} weight="500">
                {r.label}
              </Txt>
              <Txt size={10} muted>
                {r.subtitle}
              </Txt>
            </View>
            <ArrowRight size={14} color={theme.faint} />
          </Pressable>
        ))}
        {modal === "search" && !results.length && (
          <Empty
            icon={Search}
            title="Not here just yet."
            description="Try a different word, or start something new."
            action="Create an idea"
            onAction={() => startStudio()}
          />
        )}
      </ModalShell>
      <ModalShell
        visible={modal === "notifications"}
        title="A little good to know."
        subtitle="Updates and inspiration for your creative workspace."
        onClose={close}
        width={510}
      >
        {data?.profile.notifications === false && (
          <Txt muted size={11}>
            Notifications are paused in your preferences. Existing messages
            remain available.
          </Txt>
        )}
        {data?.notifications.map((n) => (
          <Card
            key={n.id}
            style={{
              padding: 17,
              gap: 9,
              backgroundColor: n.read ? theme.card : theme.purpleBg,
            }}
          >
            <Row>
              <View
                style={{
                  height: 6,
                  width: 6,
                  borderRadius: 3,
                  backgroundColor: n.read ? theme.faint : theme.purple,
                }}
              />
              <Txt size={13} weight="600">
                {n.title}
              </Txt>
            </Row>
            <Txt size={12} muted style={{ lineHeight: 20 }}>
              {n.body}
            </Txt>
          </Card>
        ))}
        <Button
          variant="secondary"
          icon={CheckCheck}
          onPress={() =>
            void api("/notifications/read", "POST", {})
              .then(() => refresh())
              .then(() => notify("You’re all caught up."))
              .catch((e) => notify(e.message))
          }
        >
          Mark all as read
        </Button>
      </ModalShell>
      <ModalShell
        visible={modal === "connect"}
        title="Bring your own channel."
        subtitle="Read-only Google authorization · nothing is published"
        onClose={close}
        width={720}
      >
        <YoutubeConnection />
      </ModalShell>
      <ModalShell
        visible={modal === "gateway"}
        title="A thoughtful foundation for AI."
        subtitle="Server-side credentials. Clear boundaries. Your work stays yours."
        onClose={close}
        width={550}
      >
        <Badge>
          {data?.integrations.ai === "demo"
            ? "DEMO TEMPLATES ACTIVE"
            : "SERVER PROVIDER CONFIGURED"}
        </Badge>
        <Txt size={13} muted style={{ lineHeight: 23 }}>
          The app uses the TubePilot OpenAI-compatible gateway. In this preview,
          template-powered generation lets you try the workflow without API keys
          or paid inference.
        </Txt>
        {[
          "Independent task cancellation and timeouts",
          "Persistent generation history and replayable events",
          "Atomic credit reservations and duplicate-request protection",
          "Provider keys never exposed to the client",
        ].map((t) => (
          <Row key={t}>
            <Check size={15} color={theme.accent} />
            <Txt size={12}>{t}</Txt>
          </Row>
        ))}
        <Txt size={11} muted>
          Live inference is an operator-configured development option.
          Production moderation, provider-policy review, and further security
          hardening remain release gates.
        </Txt>
        <Button
          onPress={() => {
            close();
            navigate("studio");
          }}
          icon={Sparkles}
        >
          Explore Content Studio
        </Button>
      </ModalShell>
      <ModalShell
        visible={modal === "upgrade"}
        title="Room for what comes next."
        subtitle="Plan preview · payments and upgrades are not active"
        onClose={close}
        width={700}
      >
        <Row gap={14} style={{ flexWrap: "wrap" }}>
          {[
            {
              name: "Free",
              tag: "YOUR CURRENT PLAN",
              features: [
                "100 starting workspace credits",
                "Ideas, scripts, titles, and drafts",
                "Projects, calendar, and sample analytics",
              ],
            },
            {
              name: "Creator",
              tag: "PLANNED",
              features: [
                "Higher generation limits",
                "Connected-channel workflows",
                "Advanced discovery and planning",
              ],
            },
            {
              name: "Pro",
              tag: "PLANNED",
              features: [
                "Deeper strategy tools",
                "Advanced analytics and reports",
                "Extended AI capabilities",
              ],
            },
          ].map((plan) => (
            <Card
              key={plan.name}
              style={{
                flex: 1,
                minWidth: 175,
                padding: 18,
                gap: 16,
                backgroundColor: theme.input,
              }}
            >
              <Badge color={plan.name === "Free" ? theme.accent : theme.purple}>
                {plan.tag}
              </Badge>
              <Heading size={23}>{plan.name}</Heading>
              {plan.features.map((feature) => (
                <Row key={feature} style={{ alignItems: "flex-start" }}>
                  <Check size={13} color={theme.muted} />
                  <Txt size={11} muted style={{ flex: 1 }}>
                    {feature}
                  </Txt>
                </Row>
              ))}
            </Card>
          ))}
        </Row>
        <Txt size={11} muted style={{ lineHeight: 19 }}>
          Pricing, payment processing, and paid-plan activation are not
          available in this development version. No purchase is made here. Your
          current saved work remains yours.
        </Txt>
        <Button onPress={close}>Keep creating with Free</Button>
      </ModalShell>
      <ModalShell
        visible={modal === "workspace"}
        title="Your creative corner."
        subtitle="One place for your next good idea."
        onClose={close}
        width={440}
      >
        <Row gap={14}>
          <Avatar name={data?.profile.channelName ?? "Creator"} size={50} />
          <View style={{ flex: 1, gap: 5 }}>
            <Heading size={19}>{data?.profile.channelName}</Heading>
            <Txt muted size={11}>
              {data?.profile.guest ? "Demo workspace" : "Personal workspace"} ·{" "}
              {data?.profile.niche}
            </Txt>
          </View>
        </Row>
        <Button
          variant="secondary"
          icon={User}
          onPress={() => setModal("onboarding")}
        >
          Personalize this workspace
        </Button>
        <Button
          variant="secondary"
          icon={SettingsIcon}
          onPress={() => {
            navigate("settings");
            close();
          }}
        >
          Workspace settings
        </Button>
        <Button
          icon={LogIn}
          onPress={() => {
            setAuthMode(data?.profile.guest ? "register" : "login");
            setModal("auth");
          }}
        >
          {data?.profile.guest
            ? "Create a free account"
            : "Sign in to another account"}
        </Button>
      </ModalShell>
      <ModalShell
        visible={modal === "help"}
        title="A little help getting started."
        subtitle="A small guide to your creator workspace."
        onClose={close}
        width={530}
      >
        {[
          {
            title: "Find your angle",
            text: "Explore the demo trend collection, or bring a topic of your own to Content Studio.",
          },
          {
            title: "Make something of it",
            text: "Generate ideas, turn one into a script, find a title, and save everything to a project.",
          },
          {
            title: "Give it a little structure",
            text: "Edit your drafts, set a planning date, and export your work when you’re ready.",
          },
        ].map((item, i) => (
          <Row key={item.title} style={{ alignItems: "flex-start" }}>
            <Badge>0{i + 1}</Badge>
            <View style={{ flex: 1, gap: 5 }}>
              <Txt size={14} weight="600">
                {item.title}
              </Txt>
              <Txt muted size={12} style={{ lineHeight: 20 }}>
                {item.text}
              </Txt>
            </View>
          </Row>
        ))}
        <Txt size={11} muted>
          Development version 0.3. Read-only YouTube linking is available when
          configured. Paid billing, agency mode, and production release
          safeguards are not complete. The current demo never publishes videos.
        </Txt>
        <Button icon={Sparkles} onPress={() => startStudio()}>
          Start with an idea
        </Button>
      </ModalShell>
    </>
  );
}
