#!/usr/bin/env bash
# Signing runs AFTER the native/JavaScript build. Release key material is never available to Metro.
set -euo pipefail

: "${ANDROID_HOME:?Android SDK is required}"
: "${ANDROID_BUILD_TOOLS:?Build tools version is required}"
: "${RUNNER_TEMP:?Runner temp directory is required}"
: "${SIGNING_MODE:?Signing mode is required}"
: "${APK_ARTIFACT_NAME:?Artifact name is required}"

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tools="$ANDROID_HOME/build-tools/$ANDROID_BUILD_TOOLS"
unsigned="$root/apps/mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk"
output="$RUNNER_TEMP/tubepilot-apk"
private="$RUNNER_TEMP/tubepilot-signing"
mkdir -p "$output" "$private"
chmod 700 "$private"
trap 'rm -rf -- "$private"' EXIT

test -s "$unsigned" || { echo '::error::Expected an unsigned release APK. Check Expo prebuild and Gradle output.'; exit 1; }
entries="$(unzip -Z1 "$unsigned")"
grep -q '^classes.dex$' <<< "$entries" || { echo '::error::APK has no Android application bytecode.'; exit 1; }
grep -q '^assets/index.android.bundle$' <<< "$entries" || { echo '::error::APK has no bundled JavaScript. Do not publish a Metro-dependent debug APK.'; exit 1; }
for abi in ${REACT_NATIVE_ARCHITECTURES//,/ }; do
  grep -q "^lib/$abi/" <<< "$entries" || { echo "::error::APK is missing the requested ABI: $abi"; exit 1; }
done
badging="$("$tools/aapt" dump badging "$unsigned")"
if grep -q '^application-debuggable' <<< "$badging"; then echo '::error::Expected a non-debuggable release build with bundled JS.'; exit 1; fi
expected_id="$(node -p "JSON.parse(require('fs').readFileSync('$output/build-info.json')).applicationId")"
grep -Fq "name='$expected_id'" <<< "$badging" || { echo '::error::APK application ID does not match configuration.'; exit 1; }
grep -Fq "versionCode='$ANDROID_VERSION_CODE'" <<< "$badging" || { echo '::error::APK version code does not match configuration.'; exit 1; }

# Align uncompressed native libraries for 16 KiB Android pages before signing.
"$tools/zipalign" -P 16 -f 4 "$unsigned" "$private/aligned.apk"
apk="$output/$APK_ARTIFACT_NAME.apk"
if [[ "$SIGNING_MODE" == preview ]]; then
  test -s "$root/apps/mobile/android/app/debug.keystore"
  "$tools/apksigner" sign --ks "$root/apps/mobile/android/app/debug.keystore" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$apk" "$private/aligned.apk"
  echo '::warning::Preview APK uses the Expo template test key. Do not use this signing identity for production or sensitive real-user access.'
elif [[ "$SIGNING_MODE" == release ]]; then
  : "${ANDROID_KEYSTORE_BASE64:?Set the android-release environment keystore secret}"
  : "${ANDROID_KEYSTORE_PASSWORD:?Set the keystore password secret}"
  : "${ANDROID_KEY_ALIAS:?Set the signing alias secret}"
  : "${ANDROID_KEY_PASSWORD:?Set the key password secret}"
  printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$private/release.keystore"
  chmod 600 "$private/release.keystore"
  "$tools/apksigner" sign --ks "$private/release.keystore" --ks-key-alias "$ANDROID_KEY_ALIAS" --ks-pass env:ANDROID_KEYSTORE_PASSWORD --key-pass env:ANDROID_KEY_PASSWORD --out "$apk" "$private/aligned.apk"
else
  echo '::error::Unsupported signing mode.'; exit 1
fi
"$tools/apksigner" verify --verbose --print-certs "$apk" > "$output/signature.txt"
"$tools/zipalign" -c -P 16 4 "$apk"
printf '%s\n' "$badging" > "$output/android-package.txt"
(cd "$output" && sha256sum "$APK_ARTIFACT_NAME.apk" > SHA256SUMS.txt)

echo "APK verified: $APK_ARTIFACT_NAME.apk"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo '## TubePilot Android APK'
    echo "- File: \`$APK_ARTIFACT_NAME.apk\`"
    echo "- Signing: \`$SIGNING_MODE\`"
    echo "- Architectures: \`$REACT_NATIVE_ARCHITECTURES\`"
    echo "- Android version code: \`$ANDROID_VERSION_CODE\`"
    echo '- JavaScript is bundled; Expo Go and a Metro development server are not required.'
    if [[ -n "${EXPO_PUBLIC_API_URL:-}" ]]; then
      echo "- Backend: \`$EXPO_PUBLIC_API_URL\` (public configuration, not a secret)."
    else
      echo '- Backend: configure a trusted HTTPS TubePilot API on first launch.'
    fi
    echo '- Download the artifact below, unzip it, then install the APK on a compatible Android device.'
    echo '- This does not deploy the backend, publish to Play, or replace device/security review.'
  } >> "$GITHUB_STEP_SUMMARY"
fi
