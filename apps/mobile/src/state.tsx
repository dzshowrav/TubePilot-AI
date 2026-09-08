import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Bootstrap,
  Profile,
  ProfileInput,
  Project,
  Screen,
  Tool,
} from "@tubepilot/contracts";
import { api, ApiError } from "./api";
import { saveToken } from "./credentials";
import { themes } from "./theme";
const screens: Screen[] = [
  "overview",
  "trends",
  "studio",
  "projects",
  "calendar",
  "analytics",
  "assistant",
  "settings",
];
const initialScreen = (): Screen =>
  Platform.OS === "web" &&
  screens.includes(window.location.hash.slice(1) as Screen)
    ? (window.location.hash.slice(1) as Screen)
    : "overview";
export function profileFields(profile: Profile): ProfileInput {
  const { id, email, guest, credits, reserved, createdAt, ...data } = profile;
  return data;
}
function useAppState() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["bootstrap"],
    queryFn: async () => {
      const session = await api<{ authenticated: boolean }>("/auth/session");
      if (!session.authenticated) {
        const auth = await api<{ token?: string }>("/auth/demo", "POST", {});
        await saveToken(auth.token);
      }
      return api<Bootstrap>("/bootstrap");
    },
    retry: 1,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchInterval: (query) =>
      ["queued", "running"].includes(
        query.state.data?.youtube?.sync?.status ?? "",
      )
        ? 1200
        : false,
  });
  const [screen, setScreen] = useState<Screen>(initialScreen),
    [modal, setModal] = useState<string | null>(null),
    [project, setProject] = useState<Project | null>(null),
    [draft, setDraft] = useState<{
      topic: string;
      tool: Tool;
      projectId?: string;
    }>({ topic: "", tool: "ideas" }),
    [toast, setToast] = useState("");
  const [themeOverride, setThemeOverride] = useState<"dark" | "light" | null>(
    null,
  );
  useEffect(() => setThemeOverride(null), [query.data?.profile.id]);
  const theme = themes[themeOverride ?? query.data?.profile.theme ?? "dark"];
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const change = () => setScreen(initialScreen());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const navigate = useCallback((next: Screen) => {
    setScreen(next);
    if (Platform.OS === "web") window.location.hash = next;
  }, []);
  const refresh = useCallback(async () => {
    await client.invalidateQueries({ queryKey: ["bootstrap"] });
    await client.invalidateQueries({ queryKey: ["history"] });
  }, [client]);
  const startStudio = (
    topic = "",
    tool: Tool = "ideas",
    projectId?: string,
  ) => {
    setDraft({ topic, tool, projectId });
    navigate(tool === "assistant" ? "assistant" : "studio");
    setModal(null);
  };
  const openProject = (value: Project) => {
    setProject(value);
    setModal("project");
  };
  const toggleTheme = async () => {
    const next =
      (themeOverride ?? query.data?.profile.theme ?? "dark") === "dark"
        ? "light"
        : "dark";
    setThemeOverride(next);
    if (query.data) {
      try {
        await api("/me", "PATCH", {
          ...profileFields(query.data.profile),
          theme: next,
        });
        await refresh();
      } catch (error) {
        notify((error as Error).message);
      }
    }
  };
  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    retry: query.refetch,
    screen,
    navigate,
    modal,
    setModal,
    project,
    setProject,
    openProject,
    draft,
    startStudio,
    theme,
    toggleTheme,
    notify,
    toast,
    refresh,
    client,
  };
}
const Context = createContext<ReturnType<typeof useAppState> | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const value = useAppState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useApp() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("AppProvider is missing");
  return ctx;
}
