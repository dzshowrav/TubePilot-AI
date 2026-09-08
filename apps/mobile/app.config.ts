import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const raw = process.env.ANDROID_VERSION_CODE;
  const versionCode =
    raw === undefined ? (config.android?.versionCode ?? 1) : Number(raw);
  if (
    !Number.isSafeInteger(versionCode) ||
    versionCode < 1 ||
    versionCode > 2147483647 ||
    (raw !== undefined && !/^[1-9]\d*$/.test(raw))
  )
    throw new Error("ANDROID_VERSION_CODE must be a positive 32-bit integer.");
  return {
    ...config,
    name: config.name ?? "TubePilot AI",
    slug: config.slug ?? "tubepilot-ai",
    android: { ...config.android, versionCode },
    plugins: [
      ...(config.plugins ?? []),
      ...(process.env.TUBEPILOT_APK_BUILD === "true"
        ? ["./plugins/with-unsigned-apk.cjs"]
        : []),
    ],
  };
};
