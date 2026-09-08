# Forge — AI 3D game asset studio

Describe an object or photograph one, and Forge turns it into a 3D model you can drop
into your game. Models are generated through **your own** 3D provider account, stored
on your device, viewed and inspected in a real viewport, and exported as GLB. The
desktop app (Windows + macOS) and the Android app share one codebase.

A fresh install starts **empty**. There is no sample content, no demo account, and no
progress bar that moves on a timer — every number in the UI is measured from a real
file, and every percentage comes from the provider actually doing the work.

## Download

Everything ships from the [releases page][releases].

- **Android** — `forge-<version>.apk`. It installs **over** your existing build, so you
  never uninstall and never lose your project. Already have it? Open Forge and tap
  **Update** on the Library tab.
- **macOS** — `.dmg` · **Windows** — `.msi` or `-setup.exe`. The desktop app checks for
  updates on launch and shows a banner; **Update and restart** installs the new build
  over the current one and relaunches. Nothing is uninstalled.

How both updaters work, and how to swap in your own signing keys, is in
[docs/ANDROID_RELEASE.md](docs/ANDROID_RELEASE.md).

## What you need

Generation runs through a **paid, credit-based 3D provider** that you connect with your
own API key on first run:

| Provider | Text → 3D | Image → 3D | Rigging | Motion clips |
| --- | --- | --- | --- | --- |
| [Meshy](https://www.meshy.ai/api) | ✅ | ✅ | ✅ | ✅ |
| [Tripo](https://platform.tripo3d.ai/api-keys) | ✅ | ✅ | — | — |

**Without a key the app still works**: import `.glb`/`.gltf` files you already have,
view and inspect them, play any animation tracks they contain, and export them. The
UI says exactly which actions need a provider rather than hiding them.

Your key is stored in the OS keychain on desktop and in app-private storage on
Android. It is never written into project data and never syncs anywhere.

## What each part actually does

Honest inventory, because the design this was built from describes more than a
provider API can deliver:

**Real**

- **Generate** — text→3D and image→3D through Meshy or Tripo, with progress polled
  from the provider's own task status.
- **Photo capture** — the phone camera, then *you* drag a box around the subject; that
  exact crop of your real photo is what gets sent. No fake object detection.
- **Rig and animate** — Meshy's rigging and animation endpoints. Clips arrive marked
  for review; you approve them or send them back.
- **Viewport** — the actual GLB, via `GLTFLoader`. Orbit, pinch/wheel zoom, click a
  mesh to select it, wireframe overlay, and playback of the file's own animation
  tracks through an `AnimationMixer`.
- **Numbers** — triangles, materials, real-world size, file size and clip names are
  measured from the loaded file, never invented.
- **Library and versions** — append-only version history with undo, stored on device
  (IndexedDB on desktop, real files on Android) and mirrored across tabs/devices.
- **Import and export** — import any `.glb`/`.gltf`; export hands over the real file
  (Share sheet on Android, download on desktop).
- **Android release and in-app updates** — signed APK, `latest.json`, install in place.
- **Desktop in-app updates** — Tauri's updater against a signed `updater.json`; the app
  replaces itself and restarts.
- **Shared library over GitHub** — point both devices at one repository and they show
  the same assets. Forge syncs on launch and whenever you return to it; models are plain
  `.glb` files under `models/`, browsable and downloadable from github.com. The token
  lives beside the provider key and never enters project data.
- **Paid-job recovery** — a provider charges the moment it accepts a job, so the task id
  is written down before anything else can fail. If the download or the mesh import dies,
  the job stays in a "didn't finish" list and can be completed without spending credits
  again.

**Not built**

- **Sculpt, Paint and LOD.** A provider returns a finished mesh; it is not a sculpting
  engine, a texture painter or an LOD baker. Rather than ship tool rails that do
  nothing, those modes are absent.
- **Format conversion.** Export writes the GLB as-is. The engine chips tell you what
  Unity/Unreal/Godot/Roblox expect so you know whether to convert.
- **Sprite-sheet batches.** `packages/core/src/spritesheet.ts` does real analysis
  (frame-grid detection from transparent gutters or even division, plus palette
  extraction) but no provider offers sheet→3D, so it is not wired to a screen.
- **A hosted backend.** Sync goes through a GitHub repository you own rather than a
  Forge server. `packages/core/src/store.ts` still carries a server-backed transport and
  `server/schema.sql` the schema, for anyone who would rather run one.

> The Meshy rigging and animation endpoints in `packages/core/src/providers/meshy-rig.ts`
> are written against Meshy's documented v1 API and parse responses defensively, but
> they have not been exercised against a live key from this repository. If a response
> shape has moved, the app surfaces the provider's own error rather than failing
> silently.

## Repository layout

```
packages/core      types, design tokens, copy, store + sync, provider clients, settings
packages/ui        React pieces both apps share — the GLB viewport and useForge
apps/desktop       Vite + React in a Tauri 2 shell  → .dmg / .msi / -setup.exe
apps/mobile        Vite + React in a Capacitor shell → .apk, plus the update plugin
server             Postgres schema for the (not yet deployed) sync backend
docs               release process and architecture notes
```

## Getting started

```bash
npm ci
npm run build           # core → ui → desktop → mobile

npm run dev:desktop     # http://localhost:1420
npm run dev:mobile      # http://localhost:5173, resize to a phone viewport
```

Provider calls are blocked by CORS in a plain browser — generation works in the
packaged desktop and Android builds, and the error message says so. Importing,
viewing and exporting work everywhere.

For the native shells:

```bash
cd apps/desktop && npx tauri dev        # needs the Rust toolchain
npm run android:sync && cd apps/mobile && npx cap open android   # needs JDK 17 + Android SDK
```

## Design

Accent `#F59E3B` is reserved for AI actions, selection and primary CTAs; success green
only for approvals and ready states. No other hues. IBM Plex Sans / Mono. Tokens live
in `packages/core/src/constants.ts` (`COLORS`) and `packages/ui/src/tokens.css`.

## Releasing

```bash
npm version 0.5.0 --no-git-tag-version --workspaces --include-workspace-root
git commit -am "Forge 0.5.0" && git tag v0.5.0 && git push origin main --tags
```

The tag triggers the release workflow: signed APK, `latest.json` for the in-app
updater, desktop bundles, all attached to the GitHub release. Details and the
signing-key story in [docs/ANDROID_RELEASE.md](docs/ANDROID_RELEASE.md).

[releases]: https://github.com/amosley0221/Forge/releases
