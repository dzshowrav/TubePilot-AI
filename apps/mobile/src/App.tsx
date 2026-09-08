import React, { useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Compass,
  Clapperboard,
  FolderOpen,
  CalendarDays,
  BarChart3,
  Sparkles,
  Settings as SettingsIcon,
  ChevronDown,
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  ArrowUpRight,
  HelpCircle,
  Check,
} from "lucide-react-native";
import type { Screen } from "@tubepilot/contracts";
import { AppProvider, useApp } from "./state";
import {
  Avatar,
  Badge,
  Button,
  Heading,
  Progress,
  Row,
  Txt,
} from "./components/ui";
import { Logo } from "./components/visuals";
import { AppDialogs } from "./components/dialogs";
import { Overview } from "./screens/Overview";
import { Trends } from "./screens/Trends";
import { Studio } from "./screens/Studio";
import { Projects, ProjectEditor } from "./screens/Projects";
import { Calendar } from "./screens/Calendar";
import { Analytics } from "./screens/Analytics";
import { Assistant } from "./screens/Assistant";
import { Settings } from "./screens/Settings";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
const nav: { screen: Screen; label: string; icon: React.ComponentType<any> }[] =
  [
    { screen: "overview", label: "Overview", icon: LayoutDashboard },
    { screen: "trends", label: "Trend Radar", icon: Compass },
    { screen: "studio", label: "Content Studio", icon: Clapperboard },
    { screen: "projects", label: "My Projects", icon: FolderOpen },
    { screen: "calendar", label: "Content Calendar", icon: CalendarDays },
    { screen: "analytics", label: "Analytics", icon: BarChart3 },
  ];
const pages: Record<Screen, React.ComponentType> = {
  overview: Overview,
  trends: Trends,
  studio: Studio,
  projects: Projects,
  calendar: Calendar,
  analytics: Analytics,
  assistant: Assistant,
  settings: Settings,
};
function NavigationItem({ item }: { item: (typeof nav)[number] }) {
  const { screen, navigate, theme, data } = useApp();
  const active = screen === item.screen;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Navigate to ${item.label}`}
      testID={`nav-${item.screen}`}
      onPress={() => navigate(item.screen)}
      style={({ pressed, hovered }: any) => ({
        height: 44,
        paddingHorizontal: 13,
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: active
          ? theme.accent + "12"
          : hovered
            ? theme.cardAlt
            : "transparent",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <item.icon
        size={17}
        color={active ? theme.accent : theme.muted}
        strokeWidth={1.7}
      />
      <Txt
        size={12}
        color={active ? theme.accent : theme.muted}
        weight={active ? "500" : "400"}
      >
        {item.label}
      </Txt>
      <View style={{ flex: 1 }} />
      {item.screen === "projects" && (
        <Txt size={10} muted>
          {data?.projects.length}
        </Txt>
      )}
      {item.screen === "studio" && (
        <View
          style={{
            paddingHorizontal: 5,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor: theme.purpleBg,
          }}
        >
          <Txt size={7} color={theme.purple} weight="600">
            AI
          </Txt>
        </View>
      )}
    </Pressable>
  );
}
function Sidebar() {
  const { data, theme, setModal, navigate, screen } = useApp();
  return (
    <View
      style={{
        width: 223,
        backgroundColor: theme.sidebar,
        borderRightWidth: 1,
        borderRightColor: theme.border,
        paddingHorizontal: 15,
        paddingTop: 27,
        paddingBottom: 17,
      }}
    >
      <View style={{ paddingLeft: 10, marginBottom: 29 }}>
        <Logo />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Switch workspace"
        onPress={() => setModal("workspace")}
        style={{
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 10,
          padding: 11,
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          marginBottom: 28,
        }}
      >
        <Avatar name={data?.profile.channelName ?? "Creator"} size={30} />
        <View style={{ flex: 1, gap: 4 }}>
          <Txt size={10} weight="500" numberOfLines={1}>
            {data?.profile.channelName}
          </Txt>
          <Txt size={8} muted>
            {data?.profile.guest ? "Demo workspace" : "Personal workspace"}
          </Txt>
        </View>
        <ChevronDown size={12} color={theme.muted} />
      </Pressable>
      <Txt
        size={8}
        muted
        weight="600"
        style={{ letterSpacing: 1.5, marginLeft: 13, marginBottom: 10 }}
      >
        YOUR WORKSPACE
      </Txt>
      <View style={{ gap: 4 }}>
        {nav.map((item) => (
          <NavigationItem key={item.screen} item={item} />
        ))}
      </View>
      <View
        style={{
          height: 1,
          backgroundColor: theme.border,
          marginHorizontal: 12,
          marginVertical: 18,
        }}
      />
      <NavigationItem
        item={{ screen: "assistant", label: "AI Assistant", icon: Sparkles }}
      />
      <View style={{ flex: 1, minHeight: 30 }} />
      <View
        style={{
          backgroundColor: theme.purpleBg,
          borderWidth: 1,
          borderColor: theme.purple + "20",
          borderRadius: 12,
          padding: 15,
          gap: 11,
          marginBottom: 17,
        }}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <Row gap={6}>
            <Sparkles size={13} color={theme.purple} />
            <Txt size={10} color={theme.purple} weight="600">
              A little creative fuel
            </Txt>
          </Row>
        </Row>
        <Txt size={9} muted style={{ lineHeight: 16 }}>
          More room for your next good idea.
        </Txt>
        <Progress
          value={data?.profile.credits ?? 100}
          height={4}
          color={theme.purple}
        />
        <Row style={{ justifyContent: "space-between" }}>
          <Txt size={8} muted>
            {data?.profile.credits ?? 100} credits left
          </Txt>
          <Txt size={8} color={theme.purple}>
            Free plan
          </Txt>
        </Row>
        <Button
          small
          variant="secondary"
          icon={ArrowUpRight}
          onPress={() => setModal("upgrade")}
          style={{
            backgroundColor: theme.purple + "18",
            borderColor: theme.purple + "30",
          }}
        >
          Explore what’s next
        </Button>
      </View>
      <NavigationItem
        item={{ screen: "settings", label: "Settings", icon: SettingsIcon }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Help and getting started"
        onPress={() => setModal("help")}
        style={{
          height: 39,
          paddingHorizontal: 13,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <HelpCircle size={16} color={theme.muted} />
        <Txt size={11} muted>
          A little help
        </Txt>
      </Pressable>
      <View
        style={{ height: 1, backgroundColor: theme.border, marginVertical: 14 }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Your account"
        onPress={() => setModal("workspace")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 8,
        }}
      >
        <Avatar name={data?.profile.name ?? "Alex"} size={32} />
        <View style={{ flex: 1, gap: 3 }}>
          <Txt size={11} weight="500">
            {data?.profile.name}
          </Txt>
          <Txt size={8} muted>
            {data?.profile.guest
              ? "Just getting started ✦"
              : "Your creative workspace"}
          </Txt>
        </View>
        <ChevronDown size={12} color={theme.muted} />
      </Pressable>
    </View>
  );
}
function Shell() {
  const {
    data,
    loading,
    error,
    retry,
    theme,
    screen,
    setModal,
    toggleTheme,
    toast,
    navigate,
  } = useApp();
  const { width } = useWindowDimensions();
  const desktop = width >= 940;
  const Page = pages[screen];
  useEffect(() => {
    if (Platform.OS !== "web") return;
    document.title = `${screen === "assistant" ? "AI Assistant" : screen === "settings" ? "Settings" : (nav.find((n) => n.screen === screen)?.label ?? "Workspace")} · TubePilot AI`;
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setModal("search");
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [screen, setModal]);
  if (loading || !data) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: "center",
          justifyContent: "center",
          gap: 23,
          padding: 35,
        }}
      >
        <Logo />
        <Heading size={23}>
          {error
            ? "A small pause in the process."
            : "A little room for your next great idea."}
        </Heading>
        {error ? (
          <>
            <Txt muted style={{ textAlign: "center", maxWidth: 480 }}>
              {error.message}
            </Txt>
            <Button onPress={() => void retry()}>Try again</Button>
          </>
        ) : (
          <ActivityIndicator color={theme.purple} />
        )}
      </View>
    );
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        paddingTop: Platform.OS === "web" ? 0 : 36,
      }}
    >
      <View style={{ flex: 1, flexDirection: "row", minHeight: 0 }}>
        {desktop && <Sidebar />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Row
            style={{
              height: 72,
              paddingHorizontal: desktop ? 30 : 17,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Row gap={12}>
              {!desktop && (
                <Button
                  icon={Menu}
                  label="Open navigation"
                  variant="ghost"
                  onPress={() => setModal("navigation")}
                />
              )}
              <Txt size={11} muted>
                {desktop ? "Workspace   /   " : ""}
                <Txt size={11} weight="500">
                  {screen === "assistant"
                    ? "AI Assistant"
                    : screen === "settings"
                      ? "Settings"
                      : nav.find((n) => n.screen === screen)?.label}
                </Txt>
              </Txt>
            </Row>
            <View style={{ flex: 1 }} />
            {width > 1150 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open workspace search"
                onPress={() => setModal("search")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  paddingVertical: 9,
                  paddingHorizontal: 11,
                  borderRadius: 7,
                  borderWidth: 1,
                  borderColor: theme.border,
                  minWidth: 245,
                }}
              >
                <Search size={13} color={theme.faint} />
                <Txt size={10} muted>
                  Search your workspace…
                </Txt>
                <View style={{ flex: 1 }} />
                <View
                  style={{
                    paddingHorizontal: 5,
                    paddingVertical: 2,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 4,
                  }}
                >
                  <Txt size={8} muted>
                    ⌘ K
                  </Txt>
                </View>
              </Pressable>
            )}
            <Row gap={width < 600 ? 1 : 7}>
              {width > 700 && (
                <Badge color={theme.purple}>
                  {data.youtube?.state === "needs_reconnect"
                    ? "RECONNECT NEEDED"
                    : data.youtube?.connectionId
                      ? "CHANNEL LINKED"
                      : "DEMO WORKSPACE"}
                </Badge>
              )}
              {width <= 1150 && (
                <Button
                  icon={Search}
                  label="Open workspace search"
                  variant="ghost"
                  onPress={() => setModal("search")}
                />
              )}
              <Button
                icon={theme.bg === "#111217" ? Sun : Moon}
                label="Toggle color theme"
                variant="ghost"
                onPress={() => void toggleTheme()}
              />
              <View>
                <Button
                  icon={Bell}
                  label="Notifications"
                  variant="ghost"
                  onPress={() => setModal("notifications")}
                />
                {data.profile.notifications &&
                  data.notifications.some((n) => !n.read) && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        right: 10,
                        top: 10,
                        width: 4,
                        height: 4,
                        borderRadius: 3,
                        backgroundColor: theme.accent,
                      }}
                    />
                  )}
              </View>
              {width > 600 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Profile menu"
                  onPress={() => setModal("workspace")}
                  style={{ marginLeft: 5 }}
                >
                  <Avatar name={data.profile.name} size={30} />
                </Pressable>
              )}
            </Row>
          </Row>
          <ScrollView
            key={`${data.profile.id}-${screen}`}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: desktop ? 28 : 18,
              paddingBottom: 40,
            }}
          >
            <View
              testID="page-content"
              style={{ maxWidth: 1450, width: "100%", alignSelf: "center" }}
            >
              <Page key={data.profile.id} />
              <Row
                style={{
                  justifyContent: "space-between",
                  marginTop: 35,
                  paddingTop: 18,
                  borderTopWidth: 1,
                  borderTopColor: theme.border,
                  flexWrap: "wrap",
                }}
              >
                <Txt size={9} muted>
                  Made for your next chapter.
                </Txt>
                <Txt size={9} muted>
                  TubePilot AI · Development preview ·{" "}
                  {data.youtube?.connectionId
                    ? "Read-only YouTube"
                    : "Sample analytics"}
                </Txt>
              </Row>
            </View>
          </ScrollView>
        </View>
      </View>
      {!desktop && (
        <Row
          gap={0}
          style={{
            backgroundColor: theme.sidebar,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            paddingBottom: Platform.OS === "web" ? 3 : 19,
          }}
        >
          {[
            { screen: "overview", label: "Home", icon: LayoutDashboard },
            { screen: "trends", label: "Trends", icon: Compass },
            { screen: "studio", label: "Create", icon: Clapperboard },
            { screen: "analytics", label: "Analytics", icon: BarChart3 },
            { screen: "assistant", label: "AI", icon: Sparkles },
          ].map((item) => (
            <Pressable
              key={item.screen}
              accessibilityRole="button"
              accessibilityLabel={`Navigate to ${item.label}`}
              onPress={() => navigate(item.screen as Screen)}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                height: 61,
                gap: 5,
              }}
            >
              <item.icon
                size={20}
                color={screen === item.screen ? theme.accent : theme.muted}
              />
              <Txt
                size={8}
                color={screen === item.screen ? theme.accent : theme.muted}
              >
                {item.label}
              </Txt>
            </Pressable>
          ))}
        </Row>
      )}
      {!!toast && (
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: "absolute",
            bottom: desktop ? 23 : 85,
            right: 22,
            left: desktop ? undefined : 22,
            maxWidth: 470,
            paddingVertical: 14,
            paddingHorizontal: 18,
            borderRadius: 12,
            backgroundColor: theme.cardAlt,
            borderColor: theme.purple + "55",
            borderWidth: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 8px 35px #00000033",
          }}
        >
          <Check size={17} color={theme.accent} />
          <Txt size={12} style={{ flexShrink: 1 }}>
            {toast}
          </Txt>
        </View>
      )}
      <AppDialogs />
      <ProjectEditor />
    </View>
  );
}
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <Shell />
      </AppProvider>
    </QueryClientProvider>
  );
}
