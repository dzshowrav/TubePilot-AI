import { test, expect } from "@playwright/test";
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

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("page-content")).toBeVisible();
});

test("dashboard, period filter, search and light/dark preferences work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page.getByText("Good to see you, Alex")).toBeVisible();
  await expect(page.getByText("DEMO WORKSPACE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Last 28 days", exact: true }).click();
  await page.getByRole("button", { name: "Last 7 days", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Last 7 days", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.getByTestId("page-content")).toBeVisible();
  await page.keyboard.press("Control+k");
  await page
    .getByRole("textbox", { name: "Search your workspace", exact: true })
    .fill("My Projects");
  await page
    .getByRole("button", { name: /My Projects Your saved drafts/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Good ideas deserve a home." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Good ideas deserve a home." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("trend filters, bookmarking and saved collection persist", async ({
  page,
}) => {
  await page.getByTestId("nav-trends").click();
  await page.getByRole("textbox", { name: "Search trends" }).fill("AI agents");
  await expect(page.getByText("1 opportunities to explore")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Save The AI agents everyone will be using",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Unsave The AI agents everyone will be using",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Saved · 1", exact: true }).click();
  await expect(
    page.getByText("1 saved opportunities to explore"),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Trend details The AI agents everyone will be using",
    })
    .click();
  await expect(
    page.getByText(/Source: TubePilot’s fictional demo collection/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Make it an idea", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "What’s on your mind?" }),
  ).toHaveValue("The AI agents everyone will be using");
});

test("idea → script → title → saved project → calendar → export survives reload", async ({
  page,
}) => {
  await page.getByTestId("nav-studio").click();
  await page
    .getByRole("textbox", { name: "What’s on your mind?" })
    .fill("A calmer creative workflow");
  await page
    .getByRole("button", { name: "Create video ideas", exact: true })
    .click();
  await expect(
    page.getByText("A few directions to call your own."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Write the script", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Create my draft", exact: true })
    .click();
  await expect(
    page.getByText("Your story, starting to take shape."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Find the right title", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create title options", exact: true })
    .click();
  await expect(
    page.getByText("Give your story a great first line."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use this title", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  await page.getByRole("button", { name: "Script", exact: true }).click();
  expect(
    await page.getByRole("textbox", { name: "Script draft" }).inputValue(),
  ).toContain("# Hook");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const title = await page
    .getByRole("textbox", { name: "Project title", exact: true })
    .inputValue();
  await page
    .getByRole("textbox", { name: "Planned date (optional)" })
    .fill("2026-10-15");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.getByText("Project saved. One step closer.")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe("tubepilot-draft.md");
  const text = await readFile((await exported.path())!, "utf8");
  expect(text).toContain("# Hook");
  expect(text).toContain("2026-10-15");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByTestId("nav-projects").click();
  await page.reload();
  await page
    .getByRole("button", { name: `Open project ${title}`, exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Planned date (optional)" }),
  ).toHaveValue("2026-10-15");
  await page.getByRole("button", { name: "Script", exact: true }).click();
  expect(
    await page.getByRole("textbox", { name: "Script draft" }).inputValue(),
  ).toContain("# Hook");
});

test("projects can be created, edited, searched and permanently removed", async ({
  page,
}) => {
  await page.getByTestId("nav-projects").click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Project title", exact: true })
    .fill("My original test video");
  await page
    .getByRole("textbox", { name: "What’s the story?" })
    .fill("A story worth making.");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.getByText("Project saved. One step closer.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search projects" })
    .fill("original test");
  await page
    .getByRole("button", {
      name: "Open project My original test video",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.getByText("Nothing by that name yet")).toBeVisible();
});

test("onboarding and account registration preserve a personalized guest workspace", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Switch workspace", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Personalize this workspace", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Your name", exact: true })
    .fill("Nadia");
  await page
    .getByRole("textbox", {
      name: "Your channel / workspace name",
      exact: true,
    })
    .fill("Nadia Creates");
  await page.getByRole("button", { name: "Keep going", exact: true }).click();
  await page.getByRole("button", { name: "Keep going", exact: true }).click();
  await page
    .getByRole("button", { name: "Make myself at home", exact: true })
    .click();
  await expect(page.getByText("Good to see you, Nadia")).toBeVisible();
  await page
    .getByRole("button", { name: "Switch workspace", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create a free account", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill(`creator-${Date.now()}@example.com`);
  await page
    .getByRole("textbox", {
      name: "Password (at least 10 characters)",
      exact: true,
    })
    .fill("unique-test-password");
  await page
    .getByRole("button", { name: "Create my workspace", exact: true })
    .click();
  await expect(
    page.getByText("Welcome to your own creative workspace.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch workspace", exact: true }),
  ).toContainText("Nadia Creates");
  const boot = await (await page.request.get("/api/v1/bootstrap")).json();
  expect(boot.profile.guest).toBe(false);
  await page.reload();
  await expect(page.getByText("Good to see you, Nadia")).toBeVisible();
});

test("calendar planning does not erase an existing script", async ({
  page,
}) => {
  await page.getByTestId("nav-calendar").click();
  await page.getByRole("button", { name: "Plan a video", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Planned date", exact: true })
    .fill("2026-10-16");
  await page
    .getByRole("button", { name: "Save to calendar", exact: true })
    .click();
  await expect(page.getByText("Friday, October 16")).toBeVisible();
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Planned date (optional)" }),
  ).toHaveValue("2026-10-16");
});

test("assistant responses and sample analytics filters work without provider calls", async ({
  page,
}) => {
  await page.getByTestId("nav-assistant").click();
  await page
    .getByRole("textbox", { name: "Ask TubePilot" })
    .fill("Help me plan my next useful tutorial");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("DEMO RESPONSE", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/This workspace currently uses sample channel data/),
  ).toBeVisible();
  await page.getByTestId("nav-analytics").click();
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await expect(
    page.getByText("Stories your sample audience spent time with"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Audience", exact: true }).click();
  await expect(
    page.getByText("DEMO CHANNEL DNA", { exact: true }),
  ).toBeVisible();
});

test("mobile layout fits the viewport and navigates to a working studio", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Navigate to Home", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page
    .getByRole("button", { name: "Navigate to Create", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "What’s on your mind?" })
    .fill("A simple creative habit");
  await page
    .getByRole("button", { name: "Create video ideas", exact: true })
    .click();
  await expect(
    page.getByText("A few directions to call your own."),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("button", { name: /My Projects Your saved drafts/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Good ideas deserve a home." }),
  ).toBeVisible();
});

test("recent drafts reopen after reload without another credit charge", async ({
  page,
}) => {
  await page.getByTestId("nav-studio").click();
  await page.getByRole("button", { name: "Title lab", exact: true }).click();
  await page
    .getByRole("textbox", { name: "What’s on your mind?" })
    .fill("A deliberate creative habit");
  await page
    .getByRole("button", { name: "Create title options", exact: true })
    .click();
  await expect(
    page.getByText("Give your story a great first line."),
  ).toBeVisible();
  const before = await (await page.request.get("/api/v1/bootstrap")).json();
  await page.reload();
  await page
    .getByRole("button", { name: "Recent drafts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reopen draft", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Give your story a great first line."),
  ).toBeVisible();
  const after = await (await page.request.get("/api/v1/bootstrap")).json();
  expect(after.profile.credits).toBe(before.profile.credits);
});

test("an embedded HTTPS preview keeps a partitioned workspace session across reloads", async ({
  page,
}) => {
  const { request: nodeRequest } = await import("node:http");
  await page.route("https://preview-parent.example/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><body style="margin:0"><iframe title="TubePilot preview" style="width:100vw;height:100vh;border:0" src="https://3000-preview.e2b.app"></iframe></body></html>',
    }),
  );
  await page.route("https://3000-preview.e2b.app/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      headers = await request.allHeaders();
    delete headers["content-length"];
    delete headers["accept-encoding"];
    const response = await new Promise<{
      status: number;
      headers: Record<string, string>;
      body: Buffer;
    }>((resolve, reject) => {
      const proxied = nodeRequest(
        {
          hostname: "127.0.0.1",
          port: 3000,
          path: url.pathname + url.search,
          method: request.method(),
          headers: {
            ...headers,
            host: "3000-preview.e2b.app",
            "accept-encoding": "identity",
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          res.on("end", () => {
            const responseHeaders: Record<string, string> = {};
            for (const [key, value] of Object.entries(res.headers))
              if (
                value !== undefined &&
                !["transfer-encoding", "connection", "content-length"].includes(
                  key,
                )
              )
                responseHeaders[key] = Array.isArray(value)
                  ? value.join("\n")
                  : value;
            resolve({
              status: res.statusCode ?? 500,
              headers: responseHeaders,
              body: Buffer.concat(chunks),
            });
          });
        },
      );
      proxied.on("error", reject);
      proxied.end(request.postDataBuffer() ?? undefined);
    });
    await route.fulfill(response);
  });
  await page.goto("https://preview-parent.example");
  const frame = page.frameLocator("iframe");
  await expect(frame.getByTestId("page-content")).toBeVisible();
  await frame.getByTestId("nav-projects").click();
  await frame.getByRole("button", { name: "New project", exact: true }).click();
  await frame
    .getByRole("textbox", { name: "Project title", exact: true })
    .fill("An embedded preview project");
  await frame
    .getByRole("button", { name: "Save project", exact: true })
    .click();
  await expect(
    frame.getByText("Project saved. One step closer."),
  ).toBeVisible();
  await page.reload();
  await expect(frame.getByTestId("page-content")).toBeVisible();
  await frame.getByTestId("nav-projects").click();
  await expect(
    frame.getByRole("button", {
      name: "Open project An embedded preview project",
      exact: true,
    }),
  ).toBeVisible();
});
