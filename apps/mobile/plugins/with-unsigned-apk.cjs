const { withAppBuildGradle } = require("expo/config-plugins");
const MARKER =
  "// TubePilot GitHub APK: sign only after Gradle and Metro finish.";
function unsignedRelease(contents) {
  if (contents.includes(MARKER)) return contents;
  if (
    !/apply plugin:\s*["']com.android.application["']/.test(contents) ||
    !contents.includes("signingConfig signingConfigs.debug")
  )
    throw new Error(
      "Unexpected Expo Android template; review the APK signing override before building.",
    );
  return `${contents}\n${MARKER}\nandroid.buildTypes.release.signingConfig = null\n`;
}
module.exports = function withUnsignedApk(config) {
  return withAppBuildGradle(config, (result) => {
    if (result.modResults.language !== "groovy")
      throw new Error(
        "TubePilot APK signing currently expects a Groovy Android build file.",
      );
    result.modResults.contents = unsignedRelease(result.modResults.contents);
    return result;
  });
};
module.exports.unsignedRelease = unsignedRelease;
