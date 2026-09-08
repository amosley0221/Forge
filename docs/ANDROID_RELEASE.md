# Android releases and in-place updates

The Android app is distributed as an APK on the [releases page][releases], not through
the Play Store. The whole point of the setup below is that **a new release installs
over the one already on the phone** — no uninstall, no lost project data.

## Why an APK sometimes refuses to install over the old one

Android identifies an app by its `applicationId` and refuses any update whose
**signing certificate differs** from the installed one. When that happens the phone
says something like *"App not installed"* and the only way through is to uninstall
first, which wipes the app's data.

Two things therefore have to hold for every single build:

| Requirement | Where it is enforced |
| --- | --- |
| Same `applicationId` — `games.dustline.forge` | `apps/mobile/capacitor.config.ts`, `apps/mobile/android/app/build.gradle` |
| Same signing certificate | `signingConfigs.release` in `apps/mobile/android/app/build.gradle`, fed by the release workflow |
| `versionCode` strictly increasing | Computed in `.github/workflows/release.yml` from the version |

The classic cause of the "uninstall first" dance is a CI job producing a
**debug-signed** APK: the Android debug keystore is generated per machine, so every
CI run signs with a different certificate. The release workflow fails the build if
the APK comes out debug-signed or unsigned (`apksigner verify --print-certs`).

## versionCode

`versionCode` is the only value Android compares when deciding whether an APK is an
update. It is derived from the release version so it always moves forward:

```
major * 1_000_000 + minor * 1_000 + patch
0.4.0 -> 4000    0.4.1 -> 4001    1.0.0 -> 1000000
```

`versionName` (`0.4.1`) is the human-facing label. Never publish two releases with the
same version.

## Cutting a release

```bash
# bump the workspace version first
npm version 0.4.1 --no-git-tag-version --workspaces --include-workspace-root
git commit -am "Forge 0.4.1"
git tag v0.4.1
git push origin main --tags
```

Pushing the tag runs `.github/workflows/release.yml`, which:

1. resolves `0.4.1` / `versionCode 4001` from the tag;
2. builds the web bundle and runs `cap sync android`;
3. builds `assembleRelease` with the release signing config;
4. **verifies the APK is signed with a non-debug certificate**;
5. writes `latest.json` (version, download URL, size, SHA-256, signing cert digest);
6. builds the macOS and Windows desktop bundles;
7. publishes everything to the release tagged `v0.4.1`.

You can also run it by hand from the Actions tab (**Release** → *Run workflow*) and
type a version — useful for a one-off or a pre-release.

Assets on each release:

```
forge-0.4.1.apk        the Android build
latest.json            manifest the in-app updater reads
Forge_0.4.1_x64.dmg    macOS (when that build succeeds)
Forge_0.4.1_x64_en-US.msi / Forge_0.4.1_x64-setup.exe   Windows
```

## Updating from inside the app

`apps/mobile/src/updater.ts` fetches

```
https://github.com/amosley0221/Forge/releases/latest/download/latest.json
```

That URL always redirects to the newest release, so it never has to change, and it
avoids the GitHub API's unauthenticated rate limit. If `latest.json`'s `versionCode`
is higher than the installed one, the Library tab shows an **Update** banner.
Tapping it downloads the APK into the app cache and hands it to the system installer
through a `FileProvider` (`ForgeUpdaterPlugin.java`).

The user has to grant *"Allow from this source"* once — that is Android's
`REQUEST_INSTALL_PACKAGES` gate, and it cannot be bypassed by any sideloaded app.
After that, updates are two taps.

## Signing keys

The repository contains a working key at
`apps/mobile/android/keystore/forge-release.jks` (alias `forge`, password
`forgeforge`) so a fresh clone can cut an installable release immediately.

> **This key is public.** Anyone who can read the repo can sign an APK that your
> phone will accept as a Forge update. That is fine for a private repo or a personal
> sideload; it is not fine for wider distribution.

To switch to a private key — do this **before** your first public release, because
changing keys later forces every user to uninstall:

```bash
keytool -genkeypair -v \
  -keystore forge-release.jks -alias forge \
  -keyalg RSA -keysize 4096 -validity 10950 \
  -storepass '<your-password>' -keypass '<your-password>' \
  -dname "CN=Forge, O=<you>, C=<XX>"

base64 -w0 forge-release.jks    # macOS: base64 -i forge-release.jks
```

Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | the base64 blob above |
| `ANDROID_KEYSTORE_PASSWORD` | store password |
| `ANDROID_KEY_ALIAS` | `forge` |
| `ANDROID_KEY_PASSWORD` | key password (often the same) |

The workflow prefers the secret and only falls back to the committed key, logging a
warning when it does. Then delete
`apps/mobile/android/keystore/forge-release.jks` and back up your new key somewhere
you will not lose it — losing it means no one can ever update in place again.

## Building an APK locally

Needs JDK 17 and the Android SDK (`ANDROID_HOME` set):

```bash
npm ci
npm run build:mobile
cd apps/mobile && npx cap sync android
cd android && ./gradlew assembleRelease \
  -PforgeVersionName=0.4.1 -PforgeVersionCode=4001
# apps/mobile/android/app/build/outputs/apk/release/forge-0.4.1.apk
```

To sign with your own key locally, drop a `keystore.properties` next to
`apps/mobile/android/build.gradle` (it is git-ignored):

```properties
storeFile=/absolute/path/forge-release.jks
storePassword=…
keyAlias=forge
keyPassword=…
```

## Checking a build before you ship it

```bash
apksigner verify --print-certs forge-0.4.1.apk   # certificate digest must not change between releases
aapt dump badging forge-0.4.1.apk | head -1      # package, versionCode, versionName
adb install -r forge-0.4.1.apk                   # -r = reinstall, keeping data
```

If `adb install -r` succeeds against the previous build, the releases page download
will too.

[releases]: https://github.com/amosley0221/Forge/releases
