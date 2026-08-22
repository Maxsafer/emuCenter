const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

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
        webPreferences: {
            nodeIntegration: false, // Security best practice
            contextIsolation: true,
        }
    });

    // Load the built frontend via electron-serve
    await loadURL(mainWindow);

    // Open DevTools for debugging
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
}

app.whenReady().then(() => {
    startBackend();
    createWindow();
});

// Cleanup when app closes
app.on('will-quit', () => {
    if (backendProcess) backendProcess.kill();
});