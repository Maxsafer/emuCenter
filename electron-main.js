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
}

app.whenReady().then(() => {
    startBackend();
    createWindow();
});

// Cleanup when app closes
app.on('will-quit', () => {
    if (backendProcess) backendProcess.kill();
});