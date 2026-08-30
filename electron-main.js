const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');

// Settings are written by the backend into userData/config/settings.json;
// the shell reads them directly for window-creation options.
function readUserSetting(name, fallback) {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'config', 'settings.json');
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        return settings && settings[name] !== undefined ? settings[name] : fallback;
    } catch {
        return fallback;
    }
}

const serveLib = require('electron-serve');
const serve = serveLib.default || serveLib;

// Gamepad input is not a DOM user gesture, so without this Chrome's
// autoplay policy would silently block the navigation sound.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const loadURL = serve({ directory: 'web-build' });

let mainWindow;
let backendProcess;

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        fullscreen: readUserSetting('fullscreenOnStart', false),
        autoHideMenuBar: true, // launcher look; Alt shows the menu
        icon: path.join(__dirname, 'backend', 'images', 'logo.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false, // Security best practice
            contextIsolation: true,
        }
    });

    // Keep the renderer's fullscreen button in sync with native state
    mainWindow.on('enter-full-screen', () => mainWindow.webContents.send('fullscreen:changed', true));
    mainWindow.on('leave-full-screen', () => mainWindow.webContents.send('fullscreen:changed', false));

    // Load the built frontend via electron-serve
    await loadURL(mainWindow);

    // Open DevTools for debugging
}

// Desktop bridge (see preload.js) - the renderer toggles NATIVE fullscreen,
// which the HTML5 fullscreen API cannot exit when set at window creation.
ipcMain.handle('fullscreen:toggle', () => {
    if (!mainWindow) return false;
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    return mainWindow.isFullScreen();
});
ipcMain.handle('fullscreen:get', () => (mainWindow ? mainWindow.isFullScreen() : false));
ipcMain.handle('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.handle('window:quit', () => { app.quit(); }); // will-quit kills the backend

// Rolling diagnostic log for the launch choreography (userData/launcher.log)
function llog(line) {
    try {
        const logFile = path.join(app.getPath('userData'), 'launcher.log');
        try { if (fs.statSync(logFile).size > 262144) fs.unlinkSync(logFile); } catch { /* absent */ }
        fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
    } catch { /* logging must never break the launcher */ }
}

/**
 * Bring the launcher itself back to the foreground. Used after the last
 * game exits when Windows' own hand-back did not land on us (some other
 * window was raised mid-game) - on a controller there is no practical
 * alt-tab. Same AttachThreadInput trick as bringGameForward; the
 * ShowWindow(9) also un-minimizes if the user had minimized us manually.
 */
function forceSelfForeground() {
    if (process.platform !== 'win32' || !mainWindow || mainWindow.isDestroyed()) return;
    const hwnd = mainWindow.getNativeWindowHandle().readUInt32LE(0);
    const cs = 'using System; using System.Runtime.InteropServices;' +
        'public class FF {' +
        '[DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();' +
        '[DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);' +
        '[DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();' +
        '[DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool att);' +
        '[DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);' +
        '[DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);' +
        '[DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);' +
        'public static void Force(IntPtr t) {' +
        'IntPtr fg = GetForegroundWindow(); uint d; uint fgT = GetWindowThreadProcessId(fg, out d);' +
        'uint myT = GetCurrentThreadId(); bool att = fg != IntPtr.Zero && fgT != myT;' +
        'if (att) AttachThreadInput(myT, fgT, true);' +
        'ShowWindow(t, 9); BringWindowToTop(t); SetForegroundWindow(t);' +
        'if (att) AttachThreadInput(myT, fgT, false); } }';
    const ps = `Add-Type -TypeDefinition '${cs}'; [FF]::Force([IntPtr]${hwnd})`;
    const enc = Buffer.from(ps, 'utf16le').toString('base64');
    const { spawn } = require('child_process');
    spawn('powershell.exe',
        ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', enc],
        { stdio: 'ignore', windowsHide: true }
    ).on('error', () => { /* no powershell - alt-tab it is */ });
}

/**
 * Bring the launched game's window to the front once it exists.
 *
 * The launcher deliberately does NOT minimize (an earlier design did,
 * and any lost exit event left it stranded in the taskbar). Instead it
 * stays fullscreen underneath, and this helper walks the launched
 * process tree until a real visible window appears, then forces it to
 * the foreground - allowed because the helper is spawned by the current
 * foreground process, with the AttachThreadInput trick as belt and
 * braces. When the game window later closes, Windows activates the next
 * window in z-order, which is the launcher: no restore logic, no
 * counters, nothing that can get stuck. Console windows are skipped so
 * a chatty emulator's log console is not promoted over its render
 * window. Gives up silently after ~20s (game failed to open a window).
 */
function bringGameForward(rootPid) {
    if (process.platform !== 'win32') return;
    const cs = 'using System; using System.Runtime.InteropServices; using System.Text;' +
        'public class FW {' +
        'delegate bool EnumProc(IntPtr h, IntPtr l);' +
        '[DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);' +
        '[DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);' +
        '[DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);' +
        '[DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);' +
        '[DllImport("user32.dll", CharSet=CharSet.Auto)] static extern int GetClassName(IntPtr h, StringBuilder sb, int max);' +
        '[DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();' +
        '[DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();' +
        '[DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool att);' +
        '[DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);' +
        '[DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);' +
        'public static IntPtr FindWindowOfPids(int[] pids) {' +
        'IntPtr found = IntPtr.Zero;' +
        'EnumWindows((h, l) => {' +
        'if (!IsWindowVisible(h) || GetWindowTextLength(h) == 0) return true;' +
        'uint p; GetWindowThreadProcessId(h, out p);' +
        'bool mine = false; foreach (int x in pids) if ((uint)x == p) mine = true;' +
        'if (!mine) return true;' +
        'var sb = new StringBuilder(64); GetClassName(h, sb, 64);' +
        'if (sb.ToString() == "ConsoleWindowClass") return true;' +
        'found = h; return false; }, IntPtr.Zero);' +
        'return found; }' +
        'public static void Force(IntPtr t) {' +
        'IntPtr fg = GetForegroundWindow(); uint d; uint fgT = GetWindowThreadProcessId(fg, out d);' +
        'uint myT = GetCurrentThreadId(); bool att = fg != IntPtr.Zero && fgT != myT;' +
        'if (att) AttachThreadInput(myT, fgT, true);' +
        'BringWindowToTop(t); SetForegroundWindow(t);' +
        'if (att) AttachThreadInput(myT, fgT, false); } }';
    const ps =
        `$root = ${Number(rootPid)}; ` +
        `Add-Type -TypeDefinition '${cs}'; ` +
        'for ($i = 0; $i -lt 40; $i++) { ' +
        '$set = @([int]$root); ' +
        '$all = Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId; ' +
        'do { $n = @($all | Where-Object { $set -contains [int]$_.ParentProcessId -and $set -notcontains [int]$_.ProcessId } | ForEach-Object { [int]$_.ProcessId }); $set += $n } while ($n.Count -gt 0); ' +
        '$h = [FW]::FindWindowOfPids([int[]]$set); ' +
        'if ($h -ne [IntPtr]::Zero) { [FW]::Force($h); exit 0 }; ' +
        'Start-Sleep -Milliseconds 500 }';
    const enc = Buffer.from(ps, 'utf16le').toString('base64');
    const { spawn } = require('child_process');
    spawn('powershell.exe',
        ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', enc],
        { stdio: 'ignore', windowsHide: true }
    ).on('error', () => { /* no powershell - game opens behind, alt-tab */ });
}

function startBackend() {
    // Spawn the existing server.js as a child process
    const backendPath = path.join(__dirname, 'backend/server.js');
    backendProcess = fork(backendPath, [], {
        env: {
            ...process.env,
            PORT: 3001,
            IS_ELECTRON: true,
            USER_DATA_PATH: app.getPath('userData')
        }
    });

    // A launched game should own the screen. The backend has no foreground
    // rights (it is a background process), so on Windows its children open
    // BEHIND the fullscreen launcher. The launcher stays where it is and
    // bringGameForward promotes the game's window once it exists; when
    // that window later closes, Windows activates the launcher again on
    // its own. Deliberately no minimize/restore choreography - see the
    // bringGameForward comment.
    backendProcess.on('message', (msg) => {
        if (!msg || !mainWindow || mainWindow.isDestroyed()) return;
        if (msg.type === 'game-started') {
            llog(`game-started pid=${msg.pid} running=${msg.remaining}`);
            if (msg.pid) bringGameForward(msg.pid);
        } else if (msg.type === 'game-exited') {
            llog(`game-exited running=${msg.remaining}`);
            // Windows normally hands the screen straight back (the
            // launcher sits right under the game). If another window won
            // the z-order instead, take the foreground back.
            if (msg.remaining === 0) {
                setTimeout(() => {
                    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
                        llog('not focused after last game exit - forcing foreground');
                        forceSelfForeground();
                    }
                }, 500);
            }
        }
    });
}

app.whenReady().then(() => {
    startBackend();
    createWindow();
});

// Cleanup when app closes
app.on('will-quit', () => {
    if (backendProcess) backendProcess.kill();
});