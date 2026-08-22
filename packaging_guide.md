# Electron Packaging Runbook

How to package EmuCenter (Expo web frontend + Express backend + Electron shell)
into a runnable Windows build, and why the configuration looks the way it does.

## TL;DR

```bash
npm run dist
```

That runs `expo export --platform web --output-dir web-build` and then
`electron-builder`. Output: **`release/win-unpacked/EmuCenter.exe`** — a
portable folder build. `release/` is gitignored.

## 1. Core configuration (`package.json`)

The `build` block is the single source of truth. The load-bearing choices:

| Setting | Value | Why |
|---|---|---|
| `main` (package root) | `expo-router/entry` | Expo's bundler must see its own entry. If `main` points at `electron-main.js`, Expo bundles the Electron main process into the web app and crashes on `__dirname` (see §3). |
| `build.extraMetadata.main` | `electron-main.js` | electron-builder rewrites `main` **inside the package only**. No manual field-swapping before/after builds — the old runbook's Step 3/Step 5 dance is obsolete. |
| `build.asar` | `false` | The backend runs as a **forked child process** (`backend/server.js`) and passes `.ps1` script paths to `powershell -File`. Neither works from inside an asar archive — the December build shipped a bare `app.asar` and the native file pickers were broken regardless of signing. Unarchived output reproduces the layout the proven electron-packager build used. |
| `build.files` | `web-build/**`, `backend/**`, `!backend/config/**`, `electron-main.js` | `backend/config/` holds real IGDB/Twitch credentials and the personal game library — it must never ship. Packaged installs start clean and write config to userData (§4). |
| `build.win.target` | `dir` | Portable folder. No installer toolchain involved. |
| `build.win.signAndEditExecutable` | `false` | Skips the winCodeSign toolchain entirely — the fix for the symlink failure (§5). Cosmetic cost only: the exe keeps the stock Electron icon/metadata. |
| `build.directories.output` | `release` | Gitignored. `release-packager/` and `release-v3/` are dead outputs from December. |

## 2. Web assets (`electron-serve`)

Expo web builds reference absolute paths (`/_expo/...`), which break under
`file://`. `electron-main.js` serves the **`web-build`** directory through
electron-serve's `app://` protocol:

```javascript
const loadURL = serve({ directory: 'web-build' });
```

The export dir is `web-build` in all three places that must agree: the `dist`
script, `electron-main.js`, and `build.files`. (An older revision of this
guide said `dist` — that was the drift that broke reproducibility.)

## 3. Bundling collision (`__dirname is not defined`)

If `package.json > main` is set to `electron-main.js`, Expo bundles the
Electron main process into the web app; `__dirname` doesn't exist in the
browser and the app crashes. Keep `main` at `expo-router/entry` and let
`extraMetadata` override it inside the package (§1).

## 4. Data locations

`electron-main.js` forks the backend with:

```javascript
env: { IS_ELECTRON: true, USER_DATA_PATH: app.getPath('userData') }
```

`backend/server.js` derives both stores from it:

| | Dev (`npm start` in backend/) | Packaged |
|---|---|---|
| Config (library, settings, IGDB creds) | `backend/config/` | `%APPDATA%/EmuCenter/config/` |
| Cover images (uploads + matcher) | `backend/images/` | `%APPDATA%/EmuCenter/images/` (seeded once from the bundled images) |

An empty library on the first packaged run is expected — add an emulator to
confirm the write path works.

## 5. The winCodeSign failure (December 2025) and its fix

Every `electron-builder` run failed while extracting its `winCodeSign-2.6.0`
cache: 7-Zip tried to create macOS symlinks and Windows refused
(`Cannot create symbolic link : El cliente no dispone de un privilegio requerido`).
Creating symlinks needs Developer Mode or an elevated shell.

**Fix used here:** don't need winCodeSign at all. `win.target: "dir"` +
`signAndEditExecutable: false` means electron-builder never downloads or
extracts that toolchain.

**If you later want a real NSIS installer:**
1. Enable Windows **Developer Mode** (Settings → System → For developers) —
   grants the symlink privilege; the cache then extracts fine. (One elevated
   build also works; the cache in `%LOCALAPPDATA%\electron-builder\Cache`
   persists for later non-elevated builds.)
2. Switch `win.target` to `"nsis"` (optionally add an `icon`).
3. `npm run dist` again.

## 6. Debugging a packaged build

Launch from a terminal to see backend stdout and Electron stderr:

```powershell
.\release\win-unpacked\EmuCenter.exe
```

Backend logs print the images directory and port on boot. The packaged
backend binds port 3001 — stop any dev backend first.

## Appendix: electron-packager fallback

The December 2025 build that worked (`release-packager/test-app-win32-x64/`)
used electron-packager. Only reach for this if electron-builder breaks again;
note electron-packager is EOL (superseded by `@electron/packager`) and needs
the manual `main`-field swap that electron-builder's `extraMetadata` avoids:

1. `npx expo export --platform web --output-dir web-build`
2. Temporarily set `"main": "electron-main.js"` in `package.json`.
3. ```bash
   npx electron-packager . "EmuCenter" --platform=win32 --arch=x64 \
     --out=release-packager --overwrite --ignore="^/\.git" \
     --ignore="^/release" --ignore="^/backend/config"
   ```
4. Revert `"main"` to `"expo-router/entry"`.
