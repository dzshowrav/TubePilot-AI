import { z } from "zod";

export const youtubeStartInput = z
  .object({
    client: z.enum(["web", "native"]),
    analytics: z.boolean().default(false),
  })
  .strict();
export const youtubeReceiptInput = z
  .object({ receipt: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
  .strict();
export const youtubeConfirmInput = youtubeReceiptInput
  .extend({ channelId: z.string().regex(/^UC[A-Za-z0-9_-]{22}$/) })
  .strict();
export const youtubeDisconnectInput = z
  .object({ revoke: z.boolean() })
  .strict();
export interface YoutubeChannel {
  id: string;
  title: string;
  description: string;
  uploadsPlaylist: string | null;
  views: number | null;
  subscribers: number | null;
  subscribersHidden: boolean;
  videos: number | null;
}
export interface YoutubeVideo {
  id: string;
  title: string;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  duration: string | null;
}
export interface YoutubeMetrics {
  views: number | null;
  estimatedMinutesWatched: number | null;
  subscribersGained: number | null;
  subscribersLost: number | null;
}
export interface YoutubePeriod {
  days: 7 | 28;
  startDate: string;
  endDate: string;
  totals: YoutubeMetrics;
}
export interface YoutubeReport {
  state: "ready" | "empty" | "missing_scope" | "unavailable";
  message: string | null;
  source: "youtube_analytics";
  reportingTimezone: "America/Los_Angeles";
  requestedEndDate: string;
  availableThrough: string | null;
  periods: YoutubePeriod[];
  series: ({ date: string } & YoutubeMetrics)[];
}
export interface YoutubeSnapshot {
  source: "youtube";
  fetchedAt: string;
  expiresAt: string;
  channel: YoutubeChannel;
  videos: {
    state: "ready" | "empty" | "unavailable";
    items: YoutubeVideo[];
    message: string | null;
  };
  analytics: YoutubeReport;
}
export interface YoutubeSync {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}
export interface YoutubeStatus {
  configured: boolean;
  state: "not_connected" | "connected" | "needs_reconnect";
  connectionId: string | null;
  channel: YoutubeChannel | null;
  snapshot: YoutubeSnapshot | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  message: string | null;
  analyticsGranted: boolean;
  sync: YoutubeSync | null;
  revocationPending: boolean;
  dataExpiresAt: string | null;
}
export interface YoutubeFlow {
  id: string;
  authorizationUrl: string;
  expiresAt: string;
}
export interface YoutubeReview {
  id: string;
  channels: YoutubeChannel[];
  analyticsGranted: boolean;
  expiresAt: string;
  replacingConnection: boolean;
}
