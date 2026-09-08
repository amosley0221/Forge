# Forge — AI 3D game asset studio

Type a prompt, drop a photo, or hand it a folder of sprite sheets, and Forge builds a
**rigged, animated, game-ready 3D asset** — creatures, characters, props, vehicles,
environment kits, weapons. Edit by prompt or by hand across Model / Sculpt / Paint /
Rig / Animate / LOD, approve the motion clips, and export to Unity, Unreal, Godot,
Roblox, VRM or raw GLB.

One cloud project is shared by the desktop app (Windows + macOS) and the Android
companion — capture on the phone, finish on the desktop, review animations on
whichever is in your hand.

## Download

Everything ships from the [releases page][releases].

- **Android** — `forge-<version>.apk`. It installs **over** your existing build, so
  you never uninstall and never lose your project. Already have it? Open Forge and
  tap **Update** on the Library tab.
- **macOS** — `.dmg`
- **Windows** — `.msi` or `-setup.exe`

How that works, and how to swap in your own signing key, is in
[docs/ANDROID_RELEASE.md](docs/ANDROID_RELEASE.md).

## Repository layout

```
packages/core      types, design tokens, copy, the asset store and its sync transports
packages/ui        React pieces both apps share — the three.js viewport, useForge, primitives
apps/desktop       Vite + React UI in a Tauri 2 shell  → .dmg / .msi / -setup.exe
apps/mobile        Vite + React UI in a Capacitor shell → .apk (plus the update plugin)
server             Postgres schema and the agent contract the clients expect
docs               release process and architecture notes
```

`packages/core` is the single source of truth for the data model, so a change to
`Asset` lands on both clients at once.

## Getting started

```bash
npm ci
npm run build           # core → ui → desktop → mobile

npm run dev:desktop     # http://localhost:1420 in a browser
npm run dev:mobile      # http://localhost:5173, resize to a phone viewport
```

For the native shells:

```bash
# desktop — needs the Rust toolchain
cd apps/desktop && npx tauri dev

# android — needs JDK 17 and the Android SDK
npm run android:sync
cd apps/mobile && npx cap open android
```

Both apps run fully offline against the local store (localStorage +
`BroadcastChannel`), which is also what keeps two browser tabs in sync so you can see
the desktop and phone UIs talking to each other. Point them at a server by passing a
`RemoteConfig` to `useForge` — see `packages/core/src/store.ts`.

## What is real and what is scaffolding

Honest inventory, so nothing here surprises you later:

**Real**

- The complete desktop and Android UIs — every screen, mode, modal and piece of copy
  from the design handoff.
- The shared data model, version history (append-only, with undo), clip review
  states, and the cross-client sync layer with its offline queue.
- The three.js viewport: orbit, zoom, part picking, wireframe overlay, turntable, and
  the seven motion clips.
- The Android build, signing, release and in-app update pipeline, end to end.

**Scaffolding, with the seams marked in code**

- Generated geometry. `packages/ui/src/viewer/engine.ts` builds procedural stand-in
  meshes; swap `build()` for a `GLTFLoader` once assets carry a real `fileUrl`.
- The generation jobs themselves. `useForge`'s `runJob` drives the five-stage progress
  overlay on a timer; `packages/core/src/agent.ts` already defines the client and the
  stage events the server is expected to emit.
- Sprite-sheet reading and photo subject detection return the scripted results from
  the design prototype.
- The backend. `server/schema.sql` has the tables and RLS the clients assume; there is
  no deployed API yet, so `useForge` runs on the local transport by default.

## Design

Accent `#F59E3B` is reserved for AI actions, selection and primary CTAs; success green
only for approvals and ready states. No other hues. Type is IBM Plex Sans / Mono.
Tokens live in `packages/core/src/constants.ts` (`COLORS`) and
`packages/ui/src/tokens.css` — change them in one place.

## Releasing

```bash
npm version 0.4.1 --no-git-tag-version --workspaces --include-workspace-root
git commit -am "Forge 0.4.1" && git tag v0.4.1 && git push origin main --tags
```

The tag triggers the release workflow: signed APK, `latest.json` for the in-app
updater, desktop bundles, all attached to the GitHub release. Details and the
signing-key story in [docs/ANDROID_RELEASE.md](docs/ANDROID_RELEASE.md).

[releases]: https://github.com/amosley0221/Forge/releases
