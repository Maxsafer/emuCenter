/**
 * Known-emulator catalog: detection regexes plus battle-tested launch
 * templates (taken from the author's working setups, legacy and current).
 * Used to prepopulate the Add Emulator form and to pick the right icon
 * (the backend mirrors the same canonical matching for /emulator-icon).
 */

export interface EmulatorProfile {
    /** Canonical key - also the bundled icon's base name */
    key: string;
    displayName: string;
    /** Matched against the typed name, display name, and exe path */
    match: RegExp;
    template: string;
}

export const EMULATOR_CATALOG: EmulatorProfile[] = [
    // Specific names first so broad patterns can't shadow them
    {
        key: 'visualboyadvance-m',
        displayName: 'VisualBoyAdvance-M (GB/GBC/GBA)',
        match: /vba|visual\s*boy|visualboyadvance/i,
        template: 'exepath game',
    },
    {
        key: 'project64',
        displayName: 'Project64 (N64)',
        match: /project\s*64|pj64/i,
        template: 'exepath game',
    },
    {
        key: 'duckstation',
        displayName: 'DuckStation (PS1)',
        match: /duckstation/i,
        template: 'exepath -fullscreen -nogui game',
    },
    {
        key: 'pcsx2',
        displayName: 'PCSX2 (PS2)',
        match: /pcsx2/i,
        template: 'exepath -fullscreen -nogui -batch -- game',
    },
    {
        key: 'rpcs3',
        displayName: 'RPCS3 (PS3)',
        match: /rpcs3/i,
        template: 'exepath --no-gui --fullscreen game\\PS3_GAME\\USRDIR\\EBOOT.BIN',
    },
    {
        key: 'ppsspp',
        displayName: 'PPSSPP (PSP)',
        match: /ppsspp/i,
        template: 'exepath game',
    },
    {
        key: 'dolphin',
        displayName: 'Dolphin (GameCube/Wii)',
        match: /dolphin/i,
        template: 'exepath --config=Dolphin.Interface.ConfirmStop=False --config=Dolphin.Display.Fullscreen=True -b -e game',
    },
    {
        key: 'desmume',
        displayName: 'DeSmuME (DS)',
        match: /desmume/i,
        template: 'exepath --windowed-fullscreen game',
    },
    {
        key: 'citra',
        displayName: 'Citra (3DS)',
        match: /citra/i,
        template: 'exepath game',
    },
    {
        key: 'yuzu',
        displayName: 'yuzu (Switch)',
        match: /yuzu/i,
        template: 'exepath -f -g game',
    },
    {
        key: 'eden',
        displayName: 'Eden (Switch)',
        match: /\beden\b/i,
        template: 'exepath -f -g game',
    },
    {
        key: 'xemu',
        displayName: 'xemu (Xbox)',
        match: /xemu/i,
        template: 'exepath -full-screen -dvd_path game',
    },
    {
        key: 'xenia',
        displayName: 'Xenia (Xbox 360)',
        match: /xenia/i,
        template: 'exepath --fullscreen game',
    },
];

/**
 * Detect a known emulator from free-form text (name and/or exe path).
 * Returns the first matching profile or null.
 */
export function detectEmulator(text: string): EmulatorProfile | null {
    if (!text.trim()) return null;
    return EMULATOR_CATALOG.find(profile => profile.match.test(text)) ?? null;
}
