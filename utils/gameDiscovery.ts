import { Emulator } from '@/types';

/**
 * Scan an emulator's games directory and return discovered game files
 * Uses backend API for scanning since FileSystem doesn't work on web
 */
export async function discoverGames(
    emulator: Emulator,
    apiUrl: string = 'http://localhost:3001'
): Promise<{
    games: Array<{ name: string; path: string }>;
    errors: string[];
}> {
    const errors: string[] = [];
    const games: Array<{ name: string; path: string }> = [];

    // Support multiple paths (backwards compatible with legacy single path)
    const pathsToScan = emulator.gamesPaths?.length
        ? emulator.gamesPaths
        : (emulator.gamesPath ? [emulator.gamesPath] : []);

    // Filter out empty paths
    const validPaths = pathsToScan.filter(p => p && p.trim().length > 0);

    console.log(`[Game Discovery] Starting scan for emulator: ${emulator.displayName}`);
    console.log(`[Game Discovery] Found ${validPaths.length} path(s) to scan`);
    console.log(`[Game Discovery] API URL: ${apiUrl}`);

    for (const gamesPath of validPaths) {
        try {
            console.log(`[Game Discovery] Scanning path: ${gamesPath}`);

            // Use backend API to scan directory
            const response = await fetch(`${apiUrl}/scan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    gamesPath: gamesPath,
                    excludedExtensions: emulator.excludedExtensions,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                const error = data.error || `Unknown error scanning ${gamesPath}`;
                console.error(`[Game Discovery] Backend error for path ${gamesPath}: ${error}`);
                errors.push(error);
                continue;
            }

            console.log(`[Game Discovery] Backend scan successful for ${gamesPath}`);
            console.log(`[Game Discovery] Found ${data.games.length} games in this path`);

            data.games.forEach((game: { name: string; path: string }) => {
                // Avoid duplicates if same game exists (by path) - though unlikely if paths are distinct
                if (!games.some(g => g.path === game.path)) {
                    console.log(`[Game Discovery] Discovered: ${game.name}`);
                    games.push(game);
                }
            });

        } catch (error) {
            const errorMsg = `Error connecting to backend for path ${gamesPath}: ${error instanceof Error ? error.message : String(error)}`;
            console.error(`[Game Discovery] ${errorMsg}`);
            errors.push(errorMsg);
        }
    }

    if (errors.length > 0 && games.length === 0) {
        console.error(`[Game Discovery] All scans failed or no games found with errors.`);
    }

    return { games, errors };
}

/**
 * Build the launch command for a game
 * Handles cross-platform command building for Windows, macOS, and Linux
 */
export function buildGameCommand(emulator: Emulator, gamePath: string): string {
    // Determine if emulator is a macOS .app bundle
    const isMacApp = emulator.exePath.endsWith('.app');

    // If it's a Mac app BUT the user has customized the template (i.e. it's not just "exepath game"),
    // we assume they know what they are doing (e.g. using "open -a exepath --args ..." or pointing to a binary)
    // and we respect their template.
    // We only enforce the "open -a" auto-magic if the template is the default one.
    const isDefaultTemplate = emulator.template.trim() === 'exepath game';

    let command: string;

    if (isMacApp && isDefaultTemplate) {
        // For macOS .app bundles with default template: open -a "App.app" "game"
        command = `open -a "${emulator.exePath}" "${gamePath}"`;
    } else {
        // If it's a .app but we are using a custom template/flags, we likely need to execute the binary directly
        // rather than the bundle directory.
        let actualExe = emulator.exePath;
        if (isMacApp) {
            // Attempt to derive the binary path: App.app/Contents/MacOS/AppWithoutExtension
            // This is the standard structure for macOS apps.
            // We strip the last path segment (Dolphin.app) and remove .app to get "Dolphin"
            const pathParts = emulator.exePath.split('/');
            const appNameWithExt = pathParts[pathParts.length - 1];
            const appName = appNameWithExt.replace(/\.app$/i, '');

            // Construct path to inner binary
            actualExe = `${emulator.exePath}/Contents/MacOS/${appName}`;
        }

        // Use the provided template
        // Template: "exepath game" becomes: "exepath" "game"
        command = emulator.template;
        command = command.replace(/exepath/gi, `"${actualExe}"`);
        command = command.replace(/game/gi, `"${gamePath}"`);
    }

    console.log(`[Game Command] Built command: ${command}`);

    return command;
}
