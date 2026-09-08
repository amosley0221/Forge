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
                types · tokens · copy · store · provider clients
                                 │
                     ┌───────────┴────────────┐
                     │  SyncTransport         │
                     │  local  |  remote      │
                     └───────────┬────────────┘
                                 │
       Meshy / Tripo (your key)   ·   server (schema only, not deployed)
```

Both apps import the same model and the same mutations. What differs is which
surfaces exist: the desktop has the editor and the export drawer; the phone has
camera capture and review.

## State and sync

`useForge` (packages/ui) owns the asset list and every mutation that can change it:
`generate`, `importModel`, `rig`, `addClip`, `undoLast`, `setClipStatus`,
`selectVersion`, `removeAsset`. It writes through a `SyncTransport`:

- **local** — `localStorage` + `BroadcastChannel`. Works offline, and makes two
  browser tabs behave like two devices.
- **remote** — same writes, mirrored locally first, pushed to the API, with remote
  changes arriving over SSE. Failed writes queue in `forge.queue.v1` and replay in
  order on reconnect. No backend is deployed, so the apps run on the local transport
  and never claim to be synced to a cloud.

Rules that hold everywhere:

- **Versions are append-only.** `Undo` drops the last version only when more than one
  exists.
- **Conflicts never overwrite.** Two devices editing the same asset produce sibling
  versions.
- A remote change from the *other* device raises a toast naming what happened.
- Model files live outside the synced state: IndexedDB on desktop, real files in the
  app data directory on Android, addressed by `fileId`.

## Viewport

`packages/ui/src/viewer/engine.ts` is a plain three.js scene wrapped by
`<ForgeViewer>`. It reloads only when the model URL changes, so switching clips or
scrubbing speed never restarts the scene. Clicking a mesh emits its name, which
scopes the next prompt.

The engine loads real GLBs with `GLTFLoader` and plays the file's own animation
tracks through an `AnimationMixer`. Loading and failure are surfaced to the UI rather
than swallowed, so a file that will not open says why.

## Generation

`useForge().generate()` is the only path that creates an asset from a prompt, and
`importModel()` the only path that creates one from a file. Both end the same way:
the GLB is written to the app's `BlobStore`, read back, and measured with
`readMeshStats()` — triangles, materials, bounding box, animation track names and
byte size. Those measurements are what the UI shows; nothing is estimated.

`runGeneration()` (packages/core) submits to the provider and polls its task status
until it succeeds or fails. The percentage in the overlay is the provider's own
progress value, weighted across submit → generate → download → import. There is no
timer. Cancelling aborts the poll and the download.

Rigging and motion live in `providers/meshy-rig.ts`: `rigModel()` turns a completed
Meshy task into a skeleton, `animateModel()` bakes one named action onto it. Each
result lands as a new version, and a freshly baked clip is marked `review` so it has
to be watched before it counts as approved.

## Providers

`GenerationProvider` (packages/core/src/providers/types.ts) is the whole contract:
`validateKey`, `textTo3D`, `imageTo3D`, `status`. Meshy and Tripo implement it. Keys
are supplied by the user and held by each app's `SecretStore` — the OS keychain via
Tauri on desktop, app-private preferences on Android.

Provider calls go out from the WebView, so CORS matters: Android routes them through
the CapacitorHttp plugin's native networking, and the packaged desktop app through
the Tauri shell. In a plain browser they are blocked, and `requestJson` says exactly
that instead of reporting a generic failure.

## Packaging

| Target | Shell | Output |
| --- | --- | --- |
| Windows / macOS | Tauri 2 | `.msi`, `-setup.exe`, `.dmg` |
| Android | Capacitor 6 | `.apk` |

The Android build carries one native plugin of our own,
`ForgeUpdaterPlugin.java`, which installs a newer release APK over the running app.
That, and the signing rules it depends on, are in
[ANDROID_RELEASE.md](ANDROID_RELEASE.md).
