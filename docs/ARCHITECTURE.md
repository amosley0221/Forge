# Architecture

## Shape

```
             ┌───────────────┐        ┌───────────────┐
             │ apps/desktop  │        │ apps/mobile   │
             │ React + Tauri │        │ React + Cap.  │
             └───────┬───────┘        └───────┬───────┘
                     │      packages/ui       │
                     │  ForgeViewer, useForge │
                     └───────────┬────────────┘
                                 │ packages/core
                       types · tokens · copy · store · agent client
                                 │
                     ┌───────────┴────────────┐
                     │  SyncTransport         │
                     │  local  |  remote      │
                     └───────────┬────────────┘
                                 │
                        server (Postgres + jobs + agent)
```

Both apps import the same model and the same mutations. The only thing that differs
is which surfaces exist: the desktop has the six editor modes, the LOD chain and the
export drawer; the phone has capture, review and hand-off.

## State and sync

`useForge` (packages/ui) owns the asset list and every mutation that can change it:
`newAsset`, `addVersion`, `undoLast`, `setClipStatus`, `selectVersion`. It writes
through a `SyncTransport`:

- **local** — `localStorage` + `BroadcastChannel`. Works offline, and makes two
  browser tabs behave like two devices.
- **remote** — same writes, mirrored locally first, pushed to the API, with remote
  changes arriving over SSE. Failed writes queue in `forge.queue.v1` and replay in
  order on reconnect.

Rules that hold everywhere:

- **Versions are append-only.** `Undo` drops the last version only when more than one
  exists.
- **Conflicts never overwrite.** Two devices editing the same asset produce sibling
  versions.
- The sync pill shows *Syncing…* (accent) for at least 900 ms before *Synced* (green),
  so a fast round trip still reads as a state change.
- A remote change from the *other* device raises a toast naming what happened.

## Viewport

`packages/ui/src/viewer/engine.ts` is a plain three.js scene wrapped by
`<ForgeViewer>`. It rebuilds geometry only when something structural changes (kind,
version, variant, wireframe, selection), so switching clips or scrubbing speed never
restarts the scene. Clicking a mesh emits its `part` name, which scopes the next
prompt (`@tail` instead of `@whole model`).

Meshes are procedural stand-ins. The seam is `ViewerEngine.build()`: give it a
`GLTFLoader` and keep the part names, and picking, highlighting, wireframe and the
clip playback above it keep working unchanged.

## Prompt routing

One entry point handles every prompt (`submitPrompt` in each app's session):

1. A motion verb (`walk`, `run`, `drive`, `attack`, `hurt`, `spin`) → generate a clip,
   switch to Animate, mark it `review`.
2. A prompt while a clip is under review → re-run that clip with the note.
3. Anything else → a new version, scoped to the selected part when there is one.
4. On the start screen → a new asset in the selected category.

`matchAnimWord` (packages/core) is the shared matcher, so the phone and the desktop
route the same sentence the same way.

## Agent contract

Requests are `{ projectId, assetId?, selectedPart?, mode, prompt, attachments,
defaults }`. The server plans tool calls — `generate_mesh`, `edit_region`,
`detect_subjects`, `image_to_mesh`, `read_sprite_sheet`, `sheet_to_mesh`, `auto_rig`,
`generate_clip`, `retopologize`, `bake_textures`, `generate_lods`, `run_checks`,
`export` — and streams progress as `understanding → shape → retopo_uv → texturing →
checks`, 0–100.

It answers with a reply of at most two sentences that names the parts it touched and
offers a next step, plus either a new version, a new clip, or a `question` with
options — which the clients render as the "Which one should become the asset?" UI.

Types and the client are in `packages/core/src/agent.ts`; the tables the jobs write to
are in `server/schema.sql`. Provider keys stay server-side. Under bring-your-own-key
on desktop they live in the OS keychain via the Tauri commands in
`apps/desktop/src-tauri/src/main.rs` and are never synced.

## Packaging

| Target | Shell | Output |
| --- | --- | --- |
| Windows / macOS | Tauri 2 | `.msi`, `-setup.exe`, `.dmg` |
| Android | Capacitor 6 | `.apk` |

The Android build carries one native plugin of our own,
`ForgeUpdaterPlugin.java`, which installs a newer release APK over the running app.
That, and the signing rules it depends on, are in
[ANDROID_RELEASE.md](ANDROID_RELEASE.md).
