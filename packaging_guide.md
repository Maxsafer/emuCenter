# Electron Packaging Runbook

This guide documents the specific steps and configurations required to successfully package the Expo/Next.js application with Electron, highlighting critical fixes for common issues encountered during the process.

## 1. Core Configuration

### Dependencies
Ensure the following are installed:
```bash
npm install --save-dev electron electron-builder electron-packager
npm install electron-serve
```

### `package.json` Structure
**Crucial**: The `main` field in `package.json` MUST point to the Expo entry point (`expo-router/entry`) for the React Native/Web build to work correctly. We use `electron-builder`'s `extraMetadata` to override this for the Electron build.

```json
{
  "main": "expo-router/entry",
  "scripts": {
    "dist": "expo export --platform web && electron-builder"
  },
  "build": {
    "extraMetadata": {
      "main": "electron-main.js"
    },
    "files": [
      "dist/**/*",
      "backend/**/*",
      "electron-main.js"
    ],
    "appId": "com.emucenter.app",
    "mac": { "category": "public.app-category.games" },
    "win": { "target": "nsis" },
    "linux": { "target": "AppImage" }
  }
}
```

## 2. Handling Web Assets (`electron-serve`)

### The Issue: Frozen App / Missing Styles
Standard Expo web builds use absolute paths (e.g., `<script src="/_expo/...">`). When running an Electron app from the file system (`file://`), these paths resolve to the root of the drive, failing to load assets.

### The Fix: Custom Protocol
We use `electron-serve` to serve the `dist` folder via a custom `app://` protocol.

**`electron-main.js` Setup:**
```javascript
const { app, BrowserWindow } = require('electron');
const serveLib = require('electron-serve');
// Handle default export compatibility
const serve = serveLib.default || serveLib;

// Serve the 'dist' directory via app:// protocol
const loadURL = serve({ directory: 'dist' });

async function createWindow() {
    mainWindow = new BrowserWindow({
         width: 1200,
         height: 800,
         webPreferences: {
             nodeIntegration: false,
             contextIsolation: true,
         }
    });

    // Load the app
    await loadURL(mainWindow);
}
```

## 3. Bundling Collision (`__dirname` errors)

### The Issue: `ReferenceError: __dirname is not defined`
If `package.json > main` is set to `electron-main.js`, Expo's web bundler attempts to bundle the Electron main process code into the web application. Since `__dirname` is a Node.js global not present in the browser, this causes a crash.

### The Fix
1.  **Revert** `package.json > main` to `expo-router/entry`.
2.  **Override** it in `electron-builder` config using `extraMetadata` (as shown in Section 1).

## 4. Backend Integration (Node.js)

### Path Handling
In a packaged Electron app, the filesystem is read-only (inside an ASAR archive). The backend must be aware of this.
*   **Code/Assets**: Read from `path.join(__dirname, ...)`
*   **User Data (Config/Saves)**: Must be written to `app.getPath('userData')`.

**`electron-main.js`**:
Pass the `userData` path to the forked backend process:
```javascript
backendProcess = fork(backendPath, [], {
    env: {
        ...process.env,
        IS_ELECTRON: true,
        USER_DATA_PATH: app.getPath('userData')
    }
});
```

**`backend/server.js`**:
Consume the environment variable:
```javascript
const CONFIG_DIR = (process.env.IS_ELECTRON && process.env.USER_DATA_PATH)
    ? path.join(process.env.USER_DATA_PATH, 'config')
    : path.join(__dirname, 'config');
```

## 5. Windows Packaging

### Prerequisites
*   A Windows machine is recommended for building Windows artifacts (NSIS installers), though it can be done on macOS/Linux using Wine (often complex to set up).
*   If building on macOS, you can usually build a portable generic executable, but for proper `.exe` installers, CI/CD (GitHub Actions) or a Windows VM is best.

### Configuration
The current `package.json` is already configured for Windows:
```json
"win": {
  "target": "nsis"
}
```

### Building for Windows (Recommended)
Due to common permission and path length issues with `electron-builder` on Windows, we recommend using `electron-packager` for a reliable build.

1.  **Prepare the Web Build**:
    ```bash
    npx expo export --platform web --output-dir web-build
    ```

2.  **Point entry to Electron**:
    Temporarily change the `main` field in `package.json` to `electron-main.js`:
    ```json
    "main": "electron-main.js"
    ```

We found that `electron-builder` can be unstable in some Windows environments due to file locking and cache permission issues. The most reliable method for Windows is using `electron-packager`.

**Step 1: Install electron-packager**
```bash
npm install --save-dev electron-packager
```

**Step 2: Build the Web App**
First, export the Expo app for web:
```bash
npx expo export --platform web
```

**Step 3: Prepare `package.json`**
For the packaged app to launch `electron-main.js` correctly, you must temporarily update the `main` field in `package.json`.
*   Change `"main": "expo-router/entry"` to `"main": "electron-main.js"`

**Step 4: Run Packager**
Run the following command to package the app (replace exclusions as needed):
```bash
npx electron-packager . "EmuCenter" --platform=win32 --arch=x64 --out=release-build --overwrite --ignore="^\.git" --ignore="^\.vscode" --ignore="^src" --ignore="^assets" --ignore="^node_modules/(?!electron-serve|express|cors|multer)"
```
*   **Output**: `release-build/EmuCenter-win32-x64/EmuCenter.exe`

**Step 5: Restore `package.json`**
After packaging is complete, revert the `main` field in `package.json`:
*   Change `"main": "electron-main.js"` back to `"main": "expo-router/entry"`

### Windows Specific Considerations
1.  **Paths**: Windows uses backslashes (`\`). Ensure all path joining in the backend uses `path.join()` which handles this automatically.
2.  **Shell Commands**: The backend checks `os.platform()`.
    *   Ensure `powershell` or `cmd.exe` commands are correctly formatted.
    *   The `open-file-dialog` implementation in `server.js` includes specific PowerShell logic for Windows.

## 6. Debugging

To view logs (both backend `stdout` and Electron `stderr`) of a packaged application:

**macOS**:
```bash
/Applications/test-app.app/Contents/MacOS/test-app
```

**Windows**:
Launch the executable from Command Prompt or PowerShell:
```powershell
.\dist\win-unpacked\test-app.exe
```
