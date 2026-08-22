const { contextBridge, ipcRenderer } = require('electron');

// Minimal desktop bridge: the renderer drives NATIVE window fullscreen via
// IPC. The HTML5 fullscreen API cannot see or exit a window that was made
// fullscreen natively (e.g. by the fullscreenOnStart boot option).
contextBridge.exposeInMainWorld('emuDesktop', {
    toggleFullscreen: () => ipcRenderer.invoke('fullscreen:toggle'),
    isFullscreen: () => ipcRenderer.invoke('fullscreen:get'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    quit: () => ipcRenderer.invoke('window:quit'),
    onFullscreenChange: (callback) => {
        ipcRenderer.on('fullscreen:changed', (_event, value) => callback(value));
    },
});
