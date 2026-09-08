# Build an Android APK with GitHub Actions

**Added:** 2026-09-09 · **Workflow:** [Build Android APK](../.github/workflows/android-apk.yml)

This workflow builds an **installable, standalone APK on a GitHub-hosted Android runner**. It uses
Expo prebuild and Gradle, not EAS Build. No Expo account, EAS project or `EXPO_TOKEN` is required.
JavaScript/Hermes and native modules are packaged into the app; Expo Go and Metro are not needed
when opening the installed APK.

An APK is only the mobile client. **GitHub Actions does not deploy the NestJS API or database.**
The application and Google/AI integrations still have the development/production boundaries in
[Implementation Status](./IMPLEMENTATION_STATUS.md).

## Get your first APK

### Before the workflow is merged to `main`

This session uses `arena/01a07d26-tubepilot-ai`. A push that changes the mobile app, shared contracts,
Android build scripts or the APK workflow on `arena/**` automatically starts a **preview** APK build.
That makes the first build usable without changing another branch or requiring signing secrets.

Open the repository's **Actions → Build Android APK**, select the latest run for your branch, then
wait for the **Standalone Android APK** job to finish.

### Manual builds after merging to the default branch

GitHub requires a `workflow_dispatch` definition on the default branch for the normal **Run workflow**
UI. Once the workflow is merged to `main`:

1. Open **Actions → Build Android APK → Run workflow**.
2. Select the branch containing the app you want to build.
3. Choose `preview` for an internal testing APK.
4. Choose `arm64-v8a` for most modern Android phones, or `universal` for all supported phone/emulator ABIs.
5. Optionally enter your HTTPS backend origin, for example `https://studio.example.com`.
   **Do not add `/api/v1`**, credentials, query parameters or provider keys.
6. Optionally set an Android `version_code`; otherwise the workflow run number is used.
7. Run the workflow. Successful runs upload an artifact and put its download link in the run summary.

A reusable backend default can be saved as the **Actions variable** `EXPO_PUBLIC_API_URL`. The workflow
input takes precedence over that variable. It is public app configuration, not a secret. Access to
repository secrets/variables may require the repository owner; the coding connection cannot manage
those settings in this session.

## Download and install

In the completed run's **Artifacts** section, download:

```text
TubePilot-AI-<version>-<preview|release>-<architecture>-v<versionCode>
```

Unzip it. The artifact contains:

- The signed `.apk`.
- `SHA256SUMS.txt` to verify the download.
- `signature.txt` with APK-signature verification and public certificate information.
- `android-package.txt` with application ID, SDK and version metadata.
- `build-info.json` with build mode, architecture, source commit and public backend configuration.

Artifacts are retained for **14 days**. APKs, private keys, generated Android projects and build output
are not committed to Git, and the workflow does not automatically create a GitHub release or publish
to Google Play.

Transfer/open the APK on your Android device and allow **Install unknown apps** for the app opening
it, if Android asks. Install only APKs whose source/signature you trust. An `arm64-v8a` APK will not
install on a 32-bit-only phone or an x86 emulator; choose `universal` in that case.

### Backend setup on first launch

- If a backend origin was supplied to the build, the app uses it automatically.
- A preview without that input displays **Your studio needs a home** on first launch.
- Enter a **trusted HTTPS TubePilot backend origin**. The app checks `/api/v1/health` without sending
  existing credentials, then opens the workspace.
- The same setup/recovery screen is available if the native app cannot open its configured backend.
- Changing that address clears the local session. App bearer sessions are bound to the exact backend
  that issued them; they are not forwarded to another host. Unbound sessions from older development
  versions are not silently migrated.
- A health response is not identity verification: only enter a backend you or your administrator trust.

A phone's `localhost` is the phone—not the sandbox, your laptop or a GitHub runner. Use a deployed HTTPS
origin. An Arena preview origin can be used for temporary testing while that preview is running, but
it is not a permanent production backend. The APK never contains provider keys or YouTube refresh tokens.

## Signing modes

### `preview` — no signing secrets required

This creates a **release-mode, non-debuggable app** with bundled JS, then signs it with the Expo
Android template's standard **test/debug key**. Release mode here describes packaging, not product
readiness or a secure production signing identity.

The test key is publicly known. Use this APK only for controlled development/testing. **Do not use it
for production distribution or sensitive real-user access.** A malicious package signed with the same
public key could impersonate a preview update. Use your own private signing identity for distribution.

Preview builds generally share a certificate while the pinned Expo template stays the same. If the
certificate changes (for example after a template update), Android may require uninstalling the old
preview. Private-key builds use a different certificate and also cannot update a test-key installation
in place. Register/save your workspace before uninstalling; anonymous app-session access can be lost.

### `release` — privately signed APK

This is optional and allowed only for a **manual run on the repository's default branch**. It also
requires an explicit HTTPS backend origin. A private signature does not make the unfinished product
production-ready or satisfy Google Play/API policy reviews.

1. On your own trusted computer, generate or obtain a dedicated Android signing key. For example:

   ```sh
   keytool -genkeypair -v -storetype JKS \
     -keystore tubepilot-upload.jks -alias tubepilot \
     -keyalg RSA -keysize 4096 -validity 10000
   ```

   Enter strong passwords at the prompts. Back up the key and passwords securely. **Never commit,
   paste into chat or upload the keystore as an Actions artifact.**
2. In GitHub repository **Settings → Environments**, create `android-release`.
3. Protect that environment with required reviewers and a deployment-branch policy allowing **only
   the default branch**. If your plan cannot enforce the protections you need, do not add production
   secrets until you have an appropriate trusted-runner/release process.
4. Add these **environment secrets**, not repository-wide secrets available to preview branches:

   | Secret | Value |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | Base64-encoded keystore bytes |
   | `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
   | `ANDROID_KEY_ALIAS` | Signing alias, e.g. `tubepilot` |
   | `ANDROID_KEY_PASSWORD` | Private-key password; often the same as the store password |

   To encode a keystore locally, use `base64 -w 0 tubepilot-upload.jks` on Linux, or
   `base64 -i tubepilot-upload.jks | tr -d '\n'` on macOS. Treat that output as the private key.
5. Run **Build Android APK** on `main`, choose `release`, supply the backend origin, and approve the
   protected environment if required. Keep version codes monotonically increasing for future updates.

The `android-preview` environment needs no secrets. Never put production signing secrets there.

### How signing is isolated

Gradle and Metro build an **unsigned** release APK first. The private key is not available to those
steps. After compilation, a separate signing step decodes the key only into the runner's private temp
directory and passes passwords through environment references to `apksigner`, not command-line values.

The APK is checked for `classes.dex`, packaged JS, requested native ABIs, application ID, version code
and a non-debuggable release manifest. It is zip-aligned, signed, signature-verified and checksummed
before upload. Temporary signing material is deleted even on failure. Configuration caching is disabled;
no signing files are put in the Gradle cache or artifact directory.

Only reviewed, trusted code should receive release-environment approval. Environment protections are
necessary even though the workflow has its own default-branch guard; branch-controlled YAML alone is
not a security boundary against a malicious collaborator.

## What the workflow does

1. Check out source; set up Node 22, Java 17, Android SDK/licenses and Gradle cache.
2. Install from `package-lock.json`, build shared packages, typecheck and test Android build helpers.
3. Validate inputs and derive SDK/build-tools/NDK versions from the installed React Native catalog.
4. Run Expo prebuild for Android with a validated version code and an unsigned-release config plugin.
5. Run `:app:assembleRelease` for the selected ABIs, bundling the real app and native modules.
6. Sign, verify, checksum and upload the artifact.

The Expo-managed `android/` and `ios/` directories are deliberately ignored by Git. Do not hand-edit
them to configure CI: use `app.json`, `app.config.ts` and the config plugin under `apps/mobile/plugins`.
The prebuild step deletes/regenerates the Android directory.

## Troubleshooting

| Symptom | Check |
|---|---|
| No **Run workflow** button | Merge the workflow definition to the default branch first. A branch push can still trigger the preview build. |
| Run is waiting for approval | Review the `android-release` environment's required reviewers / branch policy. Do not bypass it by moving secrets to a preview environment. |
| Signing secrets missing | Add all four secrets to `android-release`, then run `release` manually on the default branch. |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | The installed app uses another certificate. Uninstall it or use the same original private signing key. |
| `INSTALL_FAILED_VERSION_DOWNGRADE` | Choose a version code at least as new as the installed APK; for store releases it must increase. |
| APK cannot be installed on this device | Check the ABI, minimum Android version and download checksum. Try `universal` for ABI compatibility. |
| App asks for a server URL | Supply a running HTTPS backend; the APK and GitHub runner do not host the API. |
| Server connection fails | Verify `/api/v1/health`, HTTPS certificate, correct origin, backend uptime and device connectivity. No `/api/v1` suffix in the input. |
| Native build fails after an Expo/RN update | Review the prebuild template, SDK catalog and unsigned signing override. Do not silently upload a Metro-dependent debug build. |
| Google connection fails | Configure the server-side Google project and callback as described in the YouTube guide; packaging the APK does not configure OAuth. |

## Verified GitHub build

The first preview run successfully compiled, aligned, signed, verified and uploaded an actual APK
in **8 minutes 32 seconds**:

- [Successful build run](https://github.com/dzshowrav/TubePilot-AI/actions/runs/34273826689)
- [APK artifact](https://github.com/dzshowrav/TubePilot-AI/actions/runs/34273826689/artifacts/10075195600)
- `TubePilot-AI-0.3.0-preview-arm64-v8a-v1` — approximately 31.3 MB artifact, test-key signed.
- No backend URL was embedded, so this build uses first-launch server setup.

Artifact links expire according to their retention period; rerun the workflow for a fresh build.
The regular repository checks also passed on GitHub. Private signing was not exercised because no
production signing secrets were provided. Installing/testing the APK on a physical device remains
separate from the successful CI build.

## Verification boundaries

Local checks validate configuration, origin/session isolation, workflow structure, template modification,
TypeScript and web/browser behavior. **An Expo Hermes export is not an APK build.** The actual APK must
come from a successful GitHub Gradle/sign/verify run. Physical installation, app-link returns, accessibility,
API conformance and Google Play review still require separate testing. This workflow builds APKs, not
Play Store AABs, and does not publish anything automatically.
