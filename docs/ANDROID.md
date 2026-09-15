# Android packaging

`android/` is a generated Capacitor 8 project with the app ID `com.collabdeal.os`, symbol-only icon/splash, HTTPS-only networking, disabled backups, and no server secrets. It wraps the deployed responsive app so database, login, billing, and AI logic remain shared.

## Requirements

Node 22+, Java/JDK 21, Android SDK platform 36/build tools, and a working Android Studio installation or command-line SDK. A checksum-verified portable Microsoft JDK 21 is installed in ignored `.tools/jdk21/jdk-21.0.12.1+1`; use it without changing system Java. Gradle 8.14.3, SDK platform 36 (revision 2), and build tools 35 are now installed. Android Studio's bundled JDK 25 is incompatible with this Gradle version; Java 8 remains on the default system PATH. Both APK and AAB builds passed on 14 September 2026. Device testing remains outstanding.

## Build locally

Set `JAVA_HOME` and the Android SDK location for your installed tools. On Windows, set the deployed public origin and sync:

```powershell
$env:JAVA_HOME = "$((Get-Location).Path)\.tools\jdk21\jdk-21.0.12.1+1"
$env:GRADLE_USER_HOME = "$((Get-Location).Path)\.tools\gradle21"
$env:ANDROID_HOME = 'C:\Users\msi laptop\AppData\Local\Android\Sdk'
$env:CAPACITOR_SERVER_URL = 'https://your-app.example'
npm run android:prepare
npm run android:open
```

The tool paths above describe this workspace. Other machines should use their own installed JDK/SDK paths. Portable JDK source: [Microsoft OpenJDK downloads](https://learn.microsoft.com/en-us/java/openjdk/download).

The prepare command refuses HTTP, credentials, URL paths, query strings, or fragments. It copies only the local fallback shell and public origin, not environment files. For a command-line build from `android/`:

```powershell
.\gradlew.bat --no-daemon assembleDebug bundleRelease
```

Outputs are `android/app/build/outputs/apk/debug/app-debug.apk` and `android/app/build/outputs/bundle/release/app-release.aab`. Both files currently exist and were generated successfully. The debug APK is development-signed and its signature verifies. The release AAB is unsigned unless all release signing variables are configured:

- `ANDROID_KEYSTORE_PATH` (absolute path)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Manage the signing identity outside source control and back it up securely. Keystore files are gitignored. Never generate a replacement identity for an already published app.

### Local build verification and watcher issue

Initial attempts failed to move Gradle transform caches while the web preview was watching downloaded build-tool files. Excluded `.tools` and Android/generated output from Vite watching, stopped the preview, and reran with `--no-daemon --no-watch-fs --max-workers=1`. All 339 tasks completed successfully in 5 minutes 57 seconds. No antivirus exclusions, security-setting changes, or destructive cache cleanup were needed.

The generated artifacts contain the configuration-required fallback shell because no deployed origin is available. They validate the packaging toolchain, not the connected product. Run `android:prepare` with the trusted production origin and rebuild before distribution. The APK contained no `.env` files; the release AAB was independently confirmed unsigned.

- Debug APK: 4,224,663 bytes; SHA-256 `6F0D39371DB23DCB2DADAFBBF1441E60F581D3ED2CEA753C64711515A1C5415F`.
- Release AAB: 3,069,165 bytes; SHA-256 `A2BD7AE30410B4E5427A5FD6B8D8C100AF4434B01845E0883300C6BAD002BEF3`.

## CI

`.github/workflows/android.yml` supports a manual run with the public HTTPS origin. It installs Node/Java/SDK tooling, validates the project, syncs Capacitor, and produces a debug APK plus unsigned release AAB artifact. A configured GitHub repository and an actual successful run are still required. Signing must be supplied through the repository's approved secret/secure-file system before store submission.

## Runtime and authentication limitations

This wrapper is online-first; it is not a bundled offline copy of the server-rendered application. Capacitor documents `server.url` as a live-reload facility, so this remote-hosted architecture needs explicit production/device security validation before distribution. A fully bundled client calling shared APIs is a possible later architecture, not an implemented feature.

Google OAuth opens the system browser and returns a one-time authorization code through the HTTPS mobile callback and the `collabdeal://auth/callback` scheme. The app exchanges the code using its originating PKCE session. Confirm redirect allow-lists, cold/warm launch, back navigation, cancellation, and account switching on a device. Prefer verified Android App Links once the production domain and signing certificate are available. The custom scheme is not a verified App Link.

Test navigation, keyboard, safe areas, uploads, offline/reconnect, Razorpay checkout/UPI intents, Google login, deep-link replay, and logout/session expiry. Browser checkout integration exists; a native Razorpay Android SDK integration is not included and Android payment compatibility is unverified. Check current store billing/distribution policies with the product owner before shipping subscriptions through any store. No store listing, signed release, or store approval is claimed.
