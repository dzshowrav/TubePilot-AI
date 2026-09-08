import { test, expect, type Page } from "@playwright/test";
import type { YoutubeStatus } from "@tubepilot/contracts";
import { readFile } from "node:fs/promises";

const nativeRenderErrors = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  nativeRenderErrors.set(page, errors);
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("text node"))
      errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(nativeRenderErrors.get(page) ?? []).toEqual([]);
});
const channel = {
  id: "UC" + "a".repeat(22),
  title: "North Studio — authorized channel",
  description: "Authorized channel fixture",
  uploadsPlaylist: "UU" + "a".repeat(22),
  views: 12345,
  subscribers: null,
  subscribersHidden: true,
  videos: 2,
};
const empty: YoutubeStatus = {
  configured: true,
  state: "not_connected",
  connectionId: null,
  channel: null,
  snapshot: null,
  connectedAt: null,
  lastSyncedAt: null,
  message: null,
  analyticsGranted: false,
  sync: null,
  revocationPending: false,
  dataExpiresAt: null,
};
function connected(): YoutubeStatus {
  const now = new Date().toISOString(),
    expires = new Date(Date.now() + 6 * 86400000).toISOString();
  return {
    ...empty,
    state: "connected",
    connectionId: "connected-fixture",
    channel,
    connectedAt: now,
    lastSyncedAt: now,
    analyticsGranted: true,
    dataExpiresAt: expires,
    snapshot: {
      source: "youtube",
      fetchedAt: now,
      expiresAt: expires,
      channel,
      videos: {
        state: "ready",
        message: null,
        items: [
          {
            id: "abcDEF12345",
            title: "A returned upload, not a sample prediction",
            publishedAt: "2026-09-01T12:00:00Z",
            views: 700,
            likes: 25,
            comments: null,
            duration: "PT4M12S",
          },
        ],
      },
      analytics: {
        state: "ready",
        message: null,
        source: "youtube_analytics",
        reportingTimezone: "America/Los_Angeles",
        requestedEndDate: "2026-09-07",
        availableThrough: "2026-09-05",
        periods: [7, 28].map((days) => ({
          days: days as 7 | 28,
          startDate: days === 7 ? "2026-09-01" : "2026-08-11",
          endDate: "2026-09-05",
          totals: {
            views: 10,
            estimatedMinutesWatched: 20,
            subscribersGained: 3,
            subscribersLost: null,
          },
        })),
        series: [
          {
            date: "2026-09-02",
            views: 10,
            estimatedMinutesWatched: 20,
            subscribersGained: 3,
            subscribersLost: null,
          },
          {
            date: "2026-09-05",
            views: 0,
            estimatedMinutesWatched: 0,
            subscribersGained: 0,
            subscribersLost: null,
          },
        ],
      },
    },
  };
}
async function statusRoute(page: Page, get: () => YoutubeStatus) {
  await page.route("**/api/v1/bootstrap", async (route) => {
    const response = await route.fetch(),
      data = await response.json(),
      youtube = get();
    await route.fulfill({
      response,
      json: {
        ...data,
        profile: { ...data.profile, guest: false, email: "owner@example.com" },
        youtube,
        integrations: {
          ...data.integrations,
          youtube:
            youtube.state === "connected"
              ? "connected"
              : youtube.state === "needs_reconnect"
                ? "needs-reconnect"
                : "not-connected",
        },
      },
    });
  });
}

test("unconfigured YouTube shows useful setup instructions without pretending to connect", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("nav-settings").click();
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await expect(
    page.getByText("The connector is built. This server needs setup."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show setup instructions", exact: true })
    .click();
  await expect(page.getByText(/Register the exact APP_ORIGIN/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect with Google", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/no authorization or API call will be made/),
  ).toBeVisible();
});

test("connected dashboards keep actual observations separate from samples and export missing values as blanks", async ({
  page,
}) => {
  await statusRoute(page, connected);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: channel.title, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("12345", { exact: true })).toHaveCount(0);
  await expect(page.getByText("12,345", { exact: true })).toBeVisible();
  await expect(page.getByText("248.6K", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/subscriber count is hidden/)).toBeVisible();
  await page.getByTestId("nav-analytics").click();
  await expect(
    page.getByText("Watch time (minutes)", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("6.8%", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reporting period", exact: true })
    .click();
  await page.getByRole("button", { name: "Last 7 days", exact: true }).click();
  await page.getByRole("button", { name: "Chart metric", exact: true }).click();
  await page
    .getByRole("button", { name: "Subscribers lost", exact: true })
    .click();
  await expect(
    page.getByText("No returned values for this metric and period."),
  ).toBeVisible();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export reported data", exact: true })
    .click();
  const download = await pending;
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain("2026-09-02,10,20,3,,youtube_analytics");
  expect(csv).not.toContain("demo");
  await page
    .getByRole("button", { name: "Data & permissions", exact: true })
    .click();
  await expect(
    page.getByText("Not requested in this milestone", { exact: true }),
  ).toBeVisible();
});

test("a revoked connection never silently shows the demo metrics instead", async ({
  page,
}) => {
  const unavailable = {
    ...connected(),
    state: "needs_reconnect" as const,
    channel: null,
    snapshot: null,
    message: "Google authorization was revoked. Reconnect your channel.",
  };
  await statusRoute(page, () => unavailable);
  await page.goto("/");
  await expect(
    page.getByText("RECONNECT NEEDED", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Google authorization was revoked/),
  ).toBeVisible();
  await expect(page.getByText("248.6K", { exact: true })).toHaveCount(0);
  await expect(page.getByText("—", { exact: true })).toHaveCount(3);
  await page.getByTestId("nav-analytics").click();
  await expect(
    page.getByText("No historical report is available yet."),
  ).toBeVisible();
  await expect(page.getByText("DEMO CHANNEL DNA", { exact: true })).toHaveCount(
    0,
  );
});

test("Google popup return is origin/window bound, followed by review, confirmation and explicit disconnect", async ({
  page,
  context,
}) => {
  let current: YoutubeStatus = { ...empty };
  const reviewed: string[] = [],
    starts: unknown[] = [],
    disconnects: unknown[] = [];
  const flowId = "cbf8ce5c-1159-4630-9519-5a75a5ee8c44",
    receipt = "r".repeat(43),
    wrong = "x".repeat(43);
  await statusRoute(page, () => current);
  await page.route("**/api/v1/youtube/flows", async (route) => {
    starts.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        id: flowId,
        authorizationUrl:
          "https://accounts.google.com/o/oauth2/v2/auth?state=" +
          "s".repeat(43),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      },
    });
  });
  await page.route("**/api/v1/youtube/flows/*/review", async (route) => {
    reviewed.push(route.request().postDataJSON().receipt);
    await route.fulfill({
      json: {
        id: flowId,
        channels: [channel],
        analyticsGranted: true,
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        replacingConnection: false,
      },
    });
  });
  await page.route("**/api/v1/youtube/flows/*/confirm", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      receipt,
      channelId: channel.id,
    });
    current = connected();
    await route.fulfill({ json: current });
  });
  await page.route("**/api/v1/youtube", async (route) => {
    if (route.request().method() === "DELETE") {
      disconnects.push(route.request().postDataJSON());
      current = { ...empty };
      await route.fulfill({
        json: {
          ok: true,
          revocationPending: false,
          manualRevocationRequired: false,
        },
      });
    } else await route.fulfill({ json: current });
  });
  await context.route("https://accounts.google.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<h1>Mock Google authorization</h1><button onclick="location.href='http://localhost:3000/test-youtube-return'">Approve test consent</button><script>window.opener.postMessage(${JSON.stringify({ type: "tubepilot.youtube.authorization", flowId, receipt: wrong })},'http://localhost:3000')</script>`,
    }),
  );
  await context.route("http://localhost:3000/test-youtube-return", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<h1>Authorized return</h1><script>window.opener.postMessage(${JSON.stringify({ type: "tubepilot.youtube.authorization", flowId, receipt })},'http://localhost:3000');window.close()</script>`,
    }),
  );
  await page.goto("/");
  await page.getByTestId("nav-settings").click();
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await page
    .getByRole("switch", { name: "Include YouTube Analytics", exact: true })
    .click();
  const opened = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Connect with Google", exact: true })
    .click();
  const popup = await opened;
  await popup
    .getByRole("heading", { name: "Mock Google authorization" })
    .waitFor();
  // A same-origin message from the wrong window is also rejected, not just an untrusted origin.
  await page.evaluate(
    ({ flowId, wrong }) =>
      new Promise<void>((resolve) => {
        window.postMessage(
          { type: "tubepilot.youtube.authorization", flowId, receipt: wrong },
          window.location.origin,
        );
        requestAnimationFrame(() => resolve());
      }),
    { flowId, wrong },
  );
  expect(reviewed).toEqual([]);
  await popup
    .getByRole("button", { name: "Approve test consent", exact: true })
    .click();
  await expect(
    page.getByText("Is this the channel you meant?", { exact: true }),
  ).toBeVisible();
  expect(reviewed).toEqual([receipt]);
  expect(starts).toEqual([{ client: "web", analytics: true }]);
  await page
    .getByRole("button", { name: "Confirm read-only connection", exact: true })
    .click();
  await expect(page.getByText("LINKED", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Disconnect channel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Disconnect and revoke", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Connect with Google", exact: true }),
  ).toBeVisible();
  expect(disconnects).toEqual([{ revoke: true }]);
});
