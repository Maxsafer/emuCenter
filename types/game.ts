// Game and emulator types for the launcher

export interface Game {
    id: string;
    name: string; // Original filename
    cleanName: string; // Without region codes, extensions, etc.
    emulator: string; // Emulator ID
    command: string; // Full command to launch
    coverImage?: string; // Local file URI or URL
    createdAt: number;
    lastPlayed?: number;
    playCount: number;
    isFavorite: boolean;
}

export interface Emulator {
    id: string;
    name: string; // e.g., 'dolphin', 'ppsspp'
    displayName: string; // e.g., 'Dolphin (GameCube/Wii)'
    exePath: string; // Path to emulator executable
    gamesPaths: string[]; // Paths to game directories
    /** @deprecated Use gamesPaths instead */
    gamesPath?: string; // Path to games directory (legacy)
    template: string; // Command template, e.g., 'exepath game'
    icon?: string; // Icon URL or local path
    excludedExtensions: string[]; // Extensions to ignore
    createdAt: number;
}

export interface Settings {
    sortBy: 'alphabetical' | 'emulator';
    navSoundVolume: number; // 0-100
    simplifiedUI: boolean; // Disable cover images for performance
    theme: 'dark' | 'light';
    apiUrl: string; // Backend server URL
    // Gamepad index substituted for 'vcontroller' in launch templates; -1 = none
    preferredController: number;
    // Virtual controller aggregator (ViGEm): any physical pad drives one
    // stable virtual pad. When on, its slot overrides preferredController.
    virtualPadEnabled: boolean;
}

export interface RecentGame {
    gameId: string;
    timestamp: number;
}

export type GameSortMode = 'alphabetical' | 'emulator';
export type GameFilterMode = 'all' | 'favorites' | 'recents';
