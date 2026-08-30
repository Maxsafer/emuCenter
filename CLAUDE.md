# EmuCenter v3

Cross-platform emulator/game launcher. Expo (React Native Web) frontend +
Express backend + Electron shell. Successor to the Python/Qt
[EmuCenter](https://github.com/Maxsafer/emuCenter); built for handhelds
(Ayaneo Slide), fully controller-navigable. License: GPL-3.0.

## Architecture

- `app/index.tsx` — the entire UI (single screen: grid, tabs, header, modals)
- `components/` — GameCard, SectionHeader, TabIndicator, the modals
- `hooks/` — useGames/useEmulators/useSettings (state + backend persistence),
  useInputSystem (gamepad+keyboard), useGridSelection (controller nav model),
  useVirtualPad, useNavSound
- `backend/server.js` — Express on port 3001: config store, game scanning,
  launching (template tokens `exepath`/`game`/`emupath`/`vcontroller`, plus
  `?pre:`/`post:`/runner script hooks), cover matching with IGDB fallback,
  native file pickers (PowerShell/osascript/zenity), image upload
- `backend/virtualPad.js` — ViGEm virtual X360 aggregator (**Windows-only**;
  `vigemclient`/`xinput-ffi` are optionalDependencies for this reason)
- `electron-main.js` + `preload.js` — shell; IPC bridge for native
  fullscreen/minimize/quit; forks the backend with `USER_DATA_PATH`

Data: dev mode uses `backend/config` + `backend/images`; packaged builds use
the OS user-data dir (e.g. `%APPDATA%/EmuCenter`). `backend/config/` holds
real IGDB credentials and personal library state — it is gitignored and must
never be committed or shipped.

## Commands

```bash
cd backend && npm start     # backend (port 3001)
npm run web                 # dev frontend on http://localhost:8081
npx tsc --noEmit            # type check (strict)
npx expo lint               # lint
npm run dist                # installer for the HOST OS -> release/
```

`npm run dist` builds NSIS `.exe` on Windows, `.dmg` on macOS, AppImage on
Linux. Node 20+. Always run a fresh `npm install` (root AND `backend/`) per
platform — never reuse `node_modules` across OSes.

## Gotchas (learned the hard way)

- electron-builder `files` patterns: `!node_modules/**` matches at ANY depth.
  `backend/node_modules/**` and `web-build/assets/node_modules/**` (exported
  icon fonts!) are explicitly re-included — do not remove those lines.
- `asar` is intentionally OFF: the backend is forked as a real file and hands
  `.ps1` paths to PowerShell; neither works from inside an asar archive.
- Windows: `vigemclient` must be compiled with upstream node-gyp AND
  against Electron's headers:
  `npx node-gyp@11 rebuild --target=<electron version> --arch=x64 --disturl=https://electronjs.org/headers`
  (the Electron node-gyp fork wants a ClangCL toolset that is usually not
  installed, and a system-Node-header build has hard-crashed the packaged
  backend at module load; the Electron-header build loads under plain Node
  too, so dev mode keeps working). Also: it is an optionalDependency —
  npm ci SILENTLY drops it on build failure; scripts/build-installer.ps1
  guards against that. Icon embedding works without Developer Mode only
  because the winCodeSign cache was pre-extracted (darwin symlinks
  skipped).
- The ViGEm binding's `pad.userIndex` lies (returns the ViGEm serial, not
  the XInput slot) — the slot is detected by before/after diffing.
- The aggregator's virtual pad echoes physical input one frame later; the UI
  excludes its gamepad index (status polled every 3s) and debounces 'back'
  by 150ms. Keep both if touching input code.
- Keep dependency versions pinned; do not run `expo upgrade` casually —
  the export/electron-serve/electron-builder chain is tuned and verified.

## Releasing

Manual per-OS builds (`npm run dist` on each machine), artifacts collected
in `installers/` (gitignored, NAS-synced). `handoff/` (also NAS-only) carries
build instructions per machine when present. A tag-push (`v*`) GitHub Actions
workflow exists as an alternative but is not the primary flow.
