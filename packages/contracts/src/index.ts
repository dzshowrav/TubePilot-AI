import type { YoutubeStatus } from "./youtube.js";
import { z } from "zod";

export const stages = ["idea", "scripting", "ready", "published"] as const;
export const tools = [
  "ideas",
  "script",
  "titles",
  "description",
  "shorts",
  "thumbnail",
  "assistant",
] as const;
export type Tool = (typeof tools)[number];
export type Stage = (typeof stages)[number];
export type Screen =
  | "overview"
  | "trends"
  | "studio"
  | "projects"
  | "calendar"
  | "analytics"
  | "assistant"
  | "settings";
export const toolCosts: Record<Tool, number> = {
  ideas: 3,
  script: 5,
  titles: 2,
  description: 2,
  shorts: 3,
  thumbnail: 3,
  assistant: 2,
};
export const toolLabels: Record<Tool, string> = {
  ideas: "Video ideas",
  script: "Script writer",
  titles: "Title lab",
  description: "SEO description",
  shorts: "Shorts studio",
  thumbnail: "Thumbnail brief",
  assistant: "AI assistant",
};
export const stageLabels: Record<Stage, string> = {
  idea: "Idea",
  scripting: "Scripting",
  ready: "Ready to create",
  published: "Published",
};

export const profileInput = z
  .object({
    name: z.string().trim().min(1).max(60),
    channelName: z.string().trim().min(1).max(80),
    niche: z.string().trim().min(1).max(80),
    language: z.enum(["en", "bn", "hi", "ar", "es"]),
    goal: z.enum(["consistency", "audience", "engagement"]),
    timezone: z
      .string()
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return !!value;
        } catch {
          return false;
        }
      }, "Choose a valid timezone."),
    voice: z.enum([
      "Friendly",
      "Educational",
      "Professional",
      "Funny",
      "Cinematic",
    ]),
    theme: z.enum(["dark", "light"]),
    onboardingComplete: z.boolean(),
    notifications: z.boolean(),
  })
  .strict();
export type ProfileInput = z.infer<typeof profileInput>;
export interface Profile extends ProfileInput {
  id: string;
  email: string | null;
  guest: boolean;
  credits: number;
  reserved: number;
  createdAt: string;
}
export const authInput = z
  .object({
    email: z
      .email()
      .max(200)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(10).max(128),
    name: z.string().trim().min(1).max(60).optional(),
  })
  .strict();

export const projectInput = z
  .object({
    title: z.string().trim().min(1).max(180),
    topic: z.string().max(6000).default(""),
    format: z.enum(["Long-form", "Short", "Tutorial"]).default("Long-form"),
    stage: z.enum(stages).default("idea"),
    script: z.string().max(50000).default(""),
    description: z.string().max(10000).default(""),
    thumbnail: z.string().max(5000).default(""),
    titles: z.array(z.string().max(200)).max(50).default([]),
    scheduledFor: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(value + "T12:00:00Z");
        return (
          Number.isFinite(date.getTime()) &&
          date.toISOString().slice(0, 10) === value
        );
      }, "Choose a valid calendar date.")
      .nullable()
      .default(null),
    visual: z
      .enum(["tools", "workflow", "creator", "studio", "coding", "design"])
      .default("tools"),
  })
  .strict();
export type ProjectInput = z.infer<typeof projectInput>;
export interface Project extends ProjectInput {
  id: string;
  userId: string;
  updatedAt: string;
  createdAt: string;
  revision: number;
}
// PATCH must not reuse creation defaults: Zod applies defaults inside optional fields.
// An omitted field is preserved, not reset to an empty script/title/calendar date.
export const projectPatch = z
  .object({
    title: projectInput.shape.title.optional(),
    topic: projectInput.shape.topic.removeDefault().optional(),
    format: projectInput.shape.format.removeDefault().optional(),
    stage: projectInput.shape.stage.removeDefault().optional(),
    script: projectInput.shape.script.removeDefault().optional(),
    description: projectInput.shape.description.removeDefault().optional(),
    thumbnail: projectInput.shape.thumbnail.removeDefault().optional(),
    titles: projectInput.shape.titles.removeDefault().optional(),
    scheduledFor: projectInput.shape.scheduledFor.removeDefault().optional(),
    visual: projectInput.shape.visual.removeDefault().optional(),
    revision: z.number().int().min(1),
  })
  .strict();
export const taskInput = z
  .object({
    tool: z.enum(tools),
    topic: z.string().trim().min(3).max(4000),
    format: z.enum(["Long-form", "Short", "Tutorial"]).default("Long-form"),
    count: z.number().int().min(3).max(10).default(5),
    projectId: z.string().max(80).optional(),
  })
  .strict();
export type TaskInput = z.infer<typeof taskInput>;
export interface Idea {
  title: string;
  hook: string;
  angle: string;
  format: string;
}
export interface Generation {
  heading: string;
  content: string;
  ideas?: Idea[];
  titles?: string[];
  source: "demo" | "provider";
}
export interface Task {
  id: string;
  projectId?: string;
  format: ProjectInput["format"];
  tool: Tool;
  topic: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  result: Generation | null;
  error: string | null;
  credits: number;
  createdAt: string;
}
export interface Trend {
  id: string;
  title: string;
  summary: string;
  category: string;
  format: string;
  score: number;
  growth: number;
  state: "Emerging" | "Rising" | "Hot";
  visual: Project["visual"];
  tags: string[];
  why: string;
  saved?: boolean;
  source: "demo";
}
export interface Notice {
  id: string;
  title: string;
  body: string;
  read: boolean;
  type: string;
  createdAt: string;
}
export interface Analytics {
  views: number;
  watchHours: number;
  subscribers: number;
  ctr: number;
  series: {
    date: string;
    views: number;
    subscribers: number;
    watchHours: number;
  }[];
  sources: { name: string; value: number; color: string }[];
  videos: {
    title: string;
    views: number;
    ctr: number;
    retention: number;
    visual: Project["visual"];
  }[];
  source: "demo";
}
export interface Bootstrap {
  profile: Profile;
  trends: Trend[];
  projects: Project[];
  analytics: Analytics;
  notifications: Notice[];
  integrations: {
    youtube:
      | "not-configured"
      | "not-connected"
      | "connected"
      | "needs-reconnect";
    ai: "demo" | "provider";
    billing: "not-configured";
  };
  youtube: YoutubeStatus;
  serverTime: string;
}
export interface ApiError {
  message: string;
  code?: string;
}

export * from "./youtube.js";
