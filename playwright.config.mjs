import { defineConfig } from "@playwright/test";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { mkdirSync, readFileSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";
import { execFileSync } from "node:child_process";

// The npm-distributed headless browser keeps Linux CI/sandbox testing independent of a browser CDN.
// macOS/Windows use Playwright's normal installed Chromium instead.
let launchOptions = {};
if (process.platform === "linux" && process.env.E2E_SYSTEM_BROWSER !== "true") {
  const { default: chromium } = await import("@sparticuz/chromium");
  const require = createRequire(import.meta.url);
  const packageDir = resolve(
    dirname(require.resolve("@sparticuz/chromium")),
    "..",
  );
  const libraries = resolve(".arena/browser-libs");
  mkdirSync(libraries, { recursive: true });
  execFileSync("tar", ["-xf", "-", "-C", libraries], {
    input: brotliDecompressSync(
      readFileSync(join(packageDir, "bin/al2023.tar.br")),
    ),
  });
  launchOptions = {
    executablePath: await chromium.executablePath(),
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    env: {
      ...process.env,
      LD_LIBRARY_PATH: `${join(libraries, "lib")}:${process.env.LD_LIBRARY_PATH ?? ""}`,
    },
  };
}
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  outputDir: ".arena/test-results",
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Dhaka",
    launchOptions,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/api/v1/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      AI_ENABLE_LIVE: "false",
      YOUTUBE_ENABLED: "false",
      ...(process.env.CI ? { DATABASE_PATH: ":memory:" } : {}),
    },
  },
});
