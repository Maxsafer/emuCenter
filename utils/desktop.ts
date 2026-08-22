/**
 * Typed access to the Electron preload bridge (window.emuDesktop).
 * Null in the browser dev tab - callers fall back to web APIs.
 */
export interface DesktopBridge {
    toggleFullscreen: () => Promise<boolean>;
    isFullscreen: () => Promise<boolean>;
    minimize: () => Promise<void>;
    onFullscreenChange: (callback: (fullscreen: boolean) => void) => void;
}

export function getDesktopBridge(): DesktopBridge | null {
    if (typeof window === 'undefined') return null;
    return (window as { emuDesktop?: DesktopBridge }).emuDesktop ?? null;
}
