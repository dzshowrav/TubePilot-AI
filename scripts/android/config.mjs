import {
  readFileSync,
  appendFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizeApiOrigin } from "@tubepilot/contracts";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export function buildConfiguration(env, app) {
  const signing = env.INPUT_SIGNING || "preview",
    architecture = env.INPUT_ARCHITECTURE || "arm64-v8a";
  if (!["preview", "release"].includes(signing))
    throw new Error("Signing must be preview or release.");
  if (!["arm64-v8a", "universal"].includes(architecture))
    throw new Error("Architecture must be arm64-v8a or universal.");
  const versionCode = env.INPUT_VERSION_CODE || env.GITHUB_RUN_NUMBER || "1";
  if (
    !/^[1-9]\d*$/.test(versionCode) ||
    !Number.isSafeInteger(Number(versionCode)) ||
    Number(versionCode) > 2147483647
  )
    throw new Error("Version code must be a positive 32-bit integer.");
  const candidate = env.INPUT_API_URL || env.REPOSITORY_API_URL || "";
  const apiOrigin = candidate ? normalizeApiOrigin(candidate) : "";
  if (signing === "release") {
    if (
      env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      env.GITHUB_REF !== `refs/heads/${env.DEFAULT_BRANCH || "main"}`
    )
      throw new Error(
        "Private signing is allowed only by a manual run on the default branch.",
      );
    if (!apiOrigin)
      throw new Error(
        "A privately signed build requires an explicit HTTPS backend origin.",
      );
  }
  const versionName = app.version,
    applicationId = app.android?.package;
  if (
    typeof versionName !== "string" ||
    !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(versionName)
  )
    throw new Error("Set a valid Expo version before building.");
  if (
    typeof applicationId !== "string" ||
    !/^[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+$/.test(applicationId)
  )
    throw new Error("Set a valid Android package ID before building.");
  return {
    signing,
    architecture,
    architectures:
      architecture === "universal"
        ? "armeabi-v7a,arm64-v8a,x86,x86_64"
        : "arm64-v8a",
    apiOrigin,
    versionCode: Number(versionCode),
    versionName,
    applicationId,
    artifactName: `TubePilot-AI-${versionName}-${signing}-${architecture}-v${versionCode}`,
  };
}
export function androidToolchain(toml) {
  const version = (name) => {
    const match = toml.match(new RegExp(`^${name}\\s*=\\s*"([0-9.]+)"`, "m"));
    if (!match)
      throw new Error(`React Native SDK metadata is missing ${name}.`);
    return match[1];
  };
  return {
    compileSdk: version("compileSdk"),
    buildTools: version("buildTools"),
    ndk: version("ndkVersion"),
  };
}
export function configureWorkflow(env = process.env) {
  const app = JSON.parse(
    readFileSync(join(root, "apps/mobile/app.json"), "utf8"),
  ).expo;
  const config = buildConfiguration(env, app);
  const sdk = androidToolchain(
    readFileSync(
      join(root, "node_modules/react-native/gradle/libs.versions.toml"),
      "utf8",
    ),
  );
  if (!env.GITHUB_ENV || !env.GITHUB_OUTPUT || !env.RUNNER_TEMP)
    throw new Error("This command requires the GitHub Actions environment.");
  const entries = {
    SIGNING_MODE: config.signing,
    ANDROID_VERSION_CODE: String(config.versionCode),
    REACT_NATIVE_ARCHITECTURES: config.architectures,
    EXPO_PUBLIC_API_URL: config.apiOrigin,
    APK_ARTIFACT_NAME: config.artifactName,
    ANDROID_COMPILE_SDK: sdk.compileSdk,
    ANDROID_BUILD_TOOLS: sdk.buildTools,
    ANDROID_NDK_VERSION: sdk.ndk,
  };
  appendFileSync(
    env.GITHUB_ENV,
    Object.entries(entries)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(""),
  );
  appendFileSync(env.GITHUB_OUTPUT, `artifact_name=${config.artifactName}\n`);
  const output = join(env.RUNNER_TEMP, "tubepilot-apk");
  mkdirSync(output, { recursive: true });
  writeFileSync(
    join(output, "build-info.json"),
    JSON.stringify(
      {
        ...config,
        sdk,
        sourceCommit: env.GITHUB_SHA ?? null,
        workflowRun: env.GITHUB_RUN_ID ?? null,
        createdAt: new Date().toISOString(),
        backendSetupRequired: !config.apiOrigin,
        signingNotice:
          config.signing === "preview"
            ? "TEST KEY: internal testing only, not secure production distribution."
            : "Private signing does not certify product or store readiness.",
      },
      null,
      2,
    ) + "\n",
  );
  if (!config.apiOrigin)
    console.log(
      "::notice::No API origin was supplied. This APK will show backend setup on first launch. GitHub does not host the API.",
    );
  console.log(
    `Preparing ${config.artifactName}; Android API ${sdk.compileSdk}, build tools ${sdk.buildTools}, NDK ${sdk.ndk}.`,
  );
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    configureWorkflow();
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
