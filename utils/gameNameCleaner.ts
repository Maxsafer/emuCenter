/**
 * Utilities for cleaning and processing game names
 */

/**
 * Known game-file extensions (kept in sync with the backend's list).
 * Stripping is limited to these so version-like segments ("Game v1.2")
 * and extensionless folder names survive intact.
 */
const GAME_EXTENSION_RE = /\.(iso|zip|7z|rar|gb|gba|gbc|nds|3ds|cia|wbfs|wad|rvz|gcm|gcz|ciso|cso|chd|bin|cue|img|mdf|ecm|nsp|xci|xex|zar|elf|pbp|z64|n64|v64|nes|sfc|smc|srl)$/i;

/**
 * Clean a game name by removing:
 * - Known file extensions (iteratively, so "track01.bin.ecm" fully unwraps)
 * - Region codes like (USA), (EUR), (Japan)
 * - Release info like [!], [a], [b]
 * - Extra whitespace
 */
export function cleanGameName(rawName: string): string {
    // Strip known extensions until none remain
    let withoutExt = rawName;
    let prev;
    do {
        prev = withoutExt;
        withoutExt = withoutExt.replace(GAME_EXTENSION_RE, '');
    } while (withoutExt !== prev);

    // Remove content in parentheses and brackets
    const withoutCodes = withoutExt.replace(/\([^)]*\)|\[[^\]]*\]/g, '');

    // Remove extra whitespace and trim
    const cleaned = withoutCodes.replace(/\s+/g, ' ').trim();

    return cleaned;
}

/**
 * Generate a safe cache key from a game name
 * Converts to lowercase and replaces spaces/special chars with underscores
 */
export function getGameCacheKey(gameName: string): string {
    return gameName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * Generate a short hash tag for emulator identification
 * Used to disambiguate games with same names from different emulators
 */
export function generateEmuTag(emulatorName: string, length: number = 3): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < emulatorName.length; i++) {
        const char = emulatorName.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to base36 and take first N characters
    return Math.abs(hash).toString(36).substring(0, length);
}

/**
 * Normalize a name for matching (remove hyphens, extra spaces, lowercase)
 */
export function normalizeForMatching(name: string): string {
    return name
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}
