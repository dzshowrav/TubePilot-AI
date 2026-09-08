import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { parse } from "yaml";
import { normalizeApiOrigin, readScopedSession } from "@tubepilot/contracts";
import {
  buildConfiguration,
  androidToolchain,
  configureWorkflow,
} from "../../scripts/android/config.mjs";
const require = createRequire(import.meta.url);
const {
  unsignedRelease,
} = require("../../apps/mobile/plugins/with-unsigned-apk.cjs");
const app = { version: "0.3.0", android: { package: "ai.tubepilot.studio" } };

test("native/backend build origins are HTTPS-only and canonical", () => {
  assert.equal(
    normalizeApiOrigin(" HTTPS://Studio.Example.com:443/ "),
    "https://studio.example.com",
  );
  assert.equal(
    normalizeApiOrigin("https://studio.example.com:8443"),
    "https://studio.example.com:8443",
  );
  for (const input of [
    "",
    "http://example.com",
    "https://user:secret@example.com",
    "https://example.com/api/v1",
    "https://example.com?secret=x",
    "https://example.com#token",
    "https://localhost",
    "https://localhost.",
    "https://127.0.0.1",
    "https://0.0.0.0",
    "https://[::1]",
    "https://host.invalid\nINJECTED=value",
  ])
    assert.throws(() => normalizeApiOrigin(input), undefined, input);
});

test("native session credentials never cross backend origins or accept invalid token values", () => {
  const token = "a".repeat(43),
    base = "https://one.example/api/v1";
  assert.equal(
    readScopedSession(JSON.stringify({ apiBase: base, token }), base),
    token,
  );
  assert.equal(
    readScopedSession(
      JSON.stringify({ apiBase: base, token }),
      "https://two.example/api/v1",
    ),
    null,
  );
  assert.equal(
    readScopedSession(
      JSON.stringify({ apiBase: base, token: token + "\r\nHeader:value" }),
      base,
    ),
    null,
  );
  assert.equal(
    readScopedSession(token, base),
    null,
    "legacy unbound sessions must not migrate to another server",
  );
  assert.equal(readScopedSession("null", base), null);
  assert.equal(readScopedSession(null, base), null);
});

test("a default preview is installable without a baked backend or private signing secrets", () => {
  const config = buildConfiguration(
    { GITHUB_EVENT_NAME: "push", GITHUB_RUN_NUMBER: "17" },
    app,
  );
  assert.equal(config.signing, "preview");
  assert.equal(config.apiOrigin, "");
  assert.equal(config.versionCode, 17);
  assert.equal(config.architectures, "arm64-v8a");
  assert.match(config.artifactName, /preview-arm64-v8a-v17$/);
});

test("manual build URL overrides a repository variable, with a universal ABI option", () => {
  const config = buildConfiguration(
    {
      INPUT_API_URL: "https://selected.example/",
      REPOSITORY_API_URL: "https://default.example",
      INPUT_ARCHITECTURE: "universal",
      INPUT_VERSION_CODE: "42",
    },
    app,
  );
  assert.equal(config.apiOrigin, "https://selected.example");
  assert.equal(config.versionCode, 42);
  assert.equal(config.architectures, "armeabi-v7a,arm64-v8a,x86,x86_64");
});

test("privately signed builds require a manual default-branch run and an explicit backend", () => {
  const input = {
    INPUT_SIGNING: "release",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: "refs/heads/main",
    DEFAULT_BRANCH: "main",
    INPUT_API_URL: "https://studio.example",
  };
  assert.equal(buildConfiguration(input, app).signing, "release");
  assert.throws(
    () => buildConfiguration({ ...input, GITHUB_EVENT_NAME: "push" }, app),
    /manual/,
  );
  assert.throws(
    () => buildConfiguration({ ...input, GITHUB_REF: "refs/heads/other" }, app),
    /default branch/,
  );
  assert.throws(
    () => buildConfiguration({ ...input, INPUT_API_URL: "" }, app),
    /HTTPS backend/,
  );
});

test("build settings reject shell injection, invalid modes and Android version overflows", () => {
  for (const env of [
    { INPUT_SIGNING: "debug;echo unsafe" },
    { INPUT_ARCHITECTURE: "arm64-v8a;exit 0" },
    { INPUT_VERSION_CODE: "0" },
    { INPUT_VERSION_CODE: "-1" },
    { INPUT_VERSION_CODE: "1.5" },
    { INPUT_VERSION_CODE: "2147483648" },
    { INPUT_VERSION_CODE: "1\nOTHER=value" },
    { INPUT_API_URL: "https://user:password@example.com" },
  ])
    assert.throws(() => buildConfiguration(env, app));
  assert.throws(() => buildConfiguration({}, { ...app, version: "../bad" }));
  assert.throws(() =>
    buildConfiguration({}, { ...app, android: { package: "bad/id" } }),
  );
});

test("Android tool versions are derived from the installed React Native catalog", () => {
  const info = androidToolchain(
    readFileSync("node_modules/react-native/gradle/libs.versions.toml", "utf8"),
  );
  assert.match(info.compileSdk, /^\d+$/);
  assert.match(info.buildTools, /^\d+\.\d+\.\d+$/);
  assert.match(info.ndk, /^\d+\.\d+\.\d+$/);
  assert.throws(() => androidToolchain('compileSdk = "36"'), /missing/);
});

test("Gradle release signing override is explicit, idempotent and fails on a changed template", () => {
  const template =
    'apply plugin: "com.android.application"\nandroid { buildTypes { release { signingConfig signingConfigs.debug } } }';
  const changed = unsignedRelease(template);
  assert.match(changed, /android.buildTypes.release.signingConfig = null/);
  assert.equal(unsignedRelease(changed), changed);
  assert.throws(
    () => unsignedRelease('plugins { id("com.android.application") }'),
    /Unexpected Expo Android template/,
  );
});

test("workflow metadata and environment files contain only validated public settings", () => {
  const directory = mkdtempSync(join(tmpdir(), "tubepilot-build-config-"));
  try {
    const env = {
      GITHUB_ENV: join(directory, "env"),
      GITHUB_OUTPUT: join(directory, "outputs"),
      RUNNER_TEMP: directory,
      GITHUB_RUN_NUMBER: "5",
      INPUT_API_URL: "https://api.example",
      ANDROID_KEYSTORE_PASSWORD: "must-not-export-this",
    };
    configureWorkflow(env);
    const output = readFileSync(env.GITHUB_ENV, "utf8");
    assert.match(output, /EXPO_PUBLIC_API_URL=https:\/\/api.example\n/);
    assert.equal(output.includes("must-not-export-this"), false);
    const info = JSON.parse(
      readFileSync(join(directory, "tubepilot-apk/build-info.json"), "utf8"),
    );
    assert.equal(info.backendSetupRequired, false);
    assert.equal(info.signing, "preview");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("GitHub APK workflow keeps private signing separate from compilation and excludes unsafe PR triggers", () => {
  const workflow = parse(
    readFileSync(".github/workflows/android-apk.yml", "utf8"),
  );
  assert.ok(workflow.on.workflow_dispatch);
  assert.ok(workflow.on.push);
  assert.equal(workflow.on.pull_request_target, undefined);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  const job = workflow.jobs.apk;
  assert.match(job.environment, /android-release/);
  const steps = job.steps,
    build = steps.findIndex(
      (step) => step.name === "Build standalone unsigned release APK",
    );
  assert.ok(build >= 0);
  const secrets = steps.filter((step) =>
    Object.values(step.env ?? {}).some(
      (value) => typeof value === "string" && value.includes("secrets."),
    ),
  );
  for (const step of secrets) {
    assert.equal(step.if, "env.SIGNING_MODE == 'release'");
    if (step.name.startsWith("Sign and"))
      assert.ok(steps.indexOf(step) > build);
  }
  assert.match(steps[build].run, /assembleRelease/);
  assert.match(steps[build].run, /--no-configuration-cache/);
  assert.equal(steps[build].env.NODE_ENV, "production");
  assert.ok(
    steps.some(
      (step) =>
        step.uses === "actions/upload-artifact@v7.0.1" &&
        step.with["if-no-files-found"] === "error",
    ),
  );
});

test("native API requests isolate cookie/session state and sign-in callers cannot rebind a returned token", () => {
  const native = readFileSync("apps/mobile/src/credentials.ts", "utf8"),
    api = readFileSync("apps/mobile/src/api.ts", "utf8"),
    web = readFileSync("apps/mobile/src/credentials.web.ts", "utf8");
  assert.match(native, /requestCredentials[^=]*=\s*["']omit["']/);
  assert.match(native, /readScopedSession/);
  assert.match(api, /saveToken\(json.token, baseUrl\)/);
  assert.match(api, /getApiBaseUrl\(\)/);
  assert.match(web, /return ["']\/api\/v1["']/);
});
