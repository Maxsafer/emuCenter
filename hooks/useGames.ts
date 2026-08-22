import { Game, LaunchResponse, RecentGame } from '@/types';
import BackendStorage from '@/utils/backendStorage';
import { cleanGameName } from '@/utils/gameNameCleaner';
import { findBackgroundImage, getImagesDirectory } from '@/utils/imageMatching';
import { useCallback, useEffect, useState } from 'react';

const GAMES_KEY = 'games';
const RECENTS_KEY = 'recent_games';
const MAX_RECENTS = 9;

export function useGames(apiUrl: string) {
    const [games, setGames] = useState<Game[]>([]);
    const [recents, setRecents] = useState<RecentGame[]>([]);
    const [loading, setLoading] = useState(true);

    // Load games and recents on mount
    useEffect(() => {
        (async () => {
            try {
                const [gamesJson, recentsJson] = await Promise.all([
                    BackendStorage.getItem(GAMES_KEY),
                    BackendStorage.getItem(RECENTS_KEY),
                ]);

                if (gamesJson) {
                    setGames(JSON.parse(gamesJson));
                }
                if (recentsJson) {
                    setRecents(JSON.parse(recentsJson));
                }
            } catch (e) {
                console.error('Failed to load games', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Save games whenever they change
    useEffect(() => {
        if (loading) return;

        const saveGames = async () => {
            try {
                await BackendStorage.setItem(GAMES_KEY, JSON.stringify(games));
            } catch (e) {
                console.error('Failed to save games', e);
            }
        };

        saveGames();
    }, [games, loading]);

    // Save recents whenever they change
    useEffect(() => {
        if (loading) return;

        const saveRecents = async () => {
            try {
                await BackendStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
            } catch (e) {
                console.error('Failed to save recents', e);
            }
        };

        saveRecents();
    }, [recents, loading]);

    const addGame = useCallback(async (
        name: string,
        emulator: string,
        command: string
    ) => {
        const cleanedName = cleanGameName(name);
        const coverImage = await findBackgroundImage(name, getImagesDirectory(), apiUrl);

        // Generate unique ID: timestamp + random number to prevent collisions during bulk operations
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newGame: Game = {
            id: uniqueId,
            name,
            cleanName: cleanedName,
            emulator,
            command,
            coverImage: coverImage || undefined,
            createdAt: Date.now(),
            playCount: 0,
            isFavorite: false,
        };

        setGames(prev => [...prev, newGame]);
        return newGame;
    }, [apiUrl]);

    const removeGame = useCallback((id: string) => {
        setGames(prev => prev.filter(game => game.id !== id));
        // Also remove from recents
        setRecents(prev => prev.filter(r => r.gameId !== id));
    }, []);

    const updateGame = useCallback((id: string, updates: Partial<Omit<Game, 'id' | 'createdAt'>>) => {
        setGames(prev => prev.map(game =>
            game.id === id ? { ...game, ...updates } : game
        ));
    }, []);

    const toggleFavorite = useCallback((id: string) => {
        setGames(prev => prev.map(game =>
            game.id === id ? { ...game, isFavorite: !game.isFavorite } : game
        ));
    }, []);

    const updateRecents = useCallback((gameId: string) => {
        setRecents(prev => {
            // Remove if already exists
            const filtered = prev.filter(r => r.gameId !== gameId);

            // Add to top
            const updated = [
                { gameId, timestamp: Date.now() },
                ...filtered
            ];

            // Keep only last MAX_RECENTS
            return updated.slice(0, MAX_RECENTS);
        });
    }, []);

    const launchGame = useCallback(async (game: Game): Promise<LaunchResponse> => {
        try {
            const response = await fetch(`${apiUrl}/launch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ command: game.command }),
            });

            const data = await response.json();

            if (data.success) {
                // Update play count and last played
                updateGame(game.id, {
                    playCount: game.playCount + 1,
                    lastPlayed: Date.now(),
                });

                // Add to recents
                updateRecents(game.id);
            }

            return data;
        } catch (error) {
            console.error('Failed to launch game', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }, [apiUrl, updateGame, updateRecents]);

    const getRecentGames = useCallback(() => {
        return recents
            .map(r => games.find(g => g.id === r.gameId))
            .filter((g): g is Game => g !== undefined);
    }, [recents, games]);

    const getFavoriteGames = useCallback(() => {
        return games.filter(g => g.isFavorite);
    }, [games]);

    const getGamesByEmulator = useCallback((emulatorId: string) => {
        return games.filter(g => g.emulator === emulatorId);
    }, [games]);

    const refreshGameImages = useCallback(async () => {
        const imagesDir = getImagesDirectory();

        for (const game of games) {
            const coverImage = await findBackgroundImage(game.name, imagesDir);
            if (coverImage && coverImage !== game.coverImage) {
                updateGame(game.id, { coverImage });
            }
        }
    }, [games, updateGame]);

    const scanGamesFromEmulator = useCallback(async (emulator: import('@/types').Emulator) => {
        console.log(`[useGames] Starting game scan for emulator: ${emulator.displayName}`);

        const { discoverGames } = await import('@/utils/gameDiscovery');
        const { buildGameCommand } = await import('@/utils/gameDiscovery');

        const { games: discoveredGames, errors } = await discoverGames(emulator, apiUrl);

        if (errors.length > 0) {
            console.error('[useGames] Errors during scan:', errors);
            return { success: false, errors, count: 0 };
        }

        console.log(`[useGames] Discovered ${discoveredGames.length} games on disk`);

        setGames(prevGames => {
            const existingGamesForEmulator = prevGames.filter(g => g.emulator === emulator.name);
            const discoveredNames = new Set(discoveredGames.map(g => g.name));

            // 1. Identify games to remove (orphans within this emulator)
            const gamesToRemove = existingGamesForEmulator.filter(g => !discoveredNames.has(g.name));
            let newGamesList = prevGames.filter(game =>
                !(game.emulator === emulator.name && !discoveredNames.has(game.name))
            );

            // 2. Add or Update games
            const addedGames: Game[] = [];
            let addedCount = 0;
            let updatedCount = 0;

            for (const discoveredGame of discoveredGames) {
                const command = buildGameCommand(emulator, discoveredGame.path);
                const existingGame = prevGames.find(g =>
                    g.name === discoveredGame.name && g.emulator === emulator.name
                );

                if (existingGame) {
                    if (existingGame.command !== command) {
                        // Update existing game in the new list
                        newGamesList = newGamesList.map(g =>
                            g.id === existingGame.id ? { ...g, command } : g
                        );
                        updatedCount++;
                    }
                } else {
                    // Create new game
                    const cleanedName = cleanGameName(discoveredGame.name);
                    // Note: We can't await findBackgroundImage here synchronously inside setState
                    // So we'll add it with undefined coverImage first, and maybe trigger an update later
                    // Or we could run calculate new games BEFORE setGames.
                    // Let's refactor to calculate BEFORE setGames.
                    // But we need 'prevGames' to know what expects.
                    // Actually, we can just use 'games' from closure if we assume 'games' is reasonably fresh?
                    // NO, 'games' is stale in the loop.
                    // The safer way is to trust 'prevGames'.
                }
            }
            return prevGames; // Placeholder for now - see below
        });

        // Correct approach: Calculate additions/updates based on PREVIOUS state to avoid races.
        // However, 'findBackgroundImage' is async. We can't do async inside setGames.
        // So we must prepare the game data outside.

        // Let's modify the strategy:
        // 1. Prepare ALL potential new game objects (with images) assuming they are new.
        // 2. Perform a functional state update that merges them, checking against 'prev'.

        const potentialNewGames = await Promise.all(discoveredGames.map(async (d) => {
            const coverImage = await findBackgroundImage(d.name, getImagesDirectory(), apiUrl);
            return {
                ...d,
                cleanName: cleanGameName(d.name),
                coverImage,
                command: buildGameCommand(emulator, d.path)
            };
        }));

        let resultAdded = 0;
        let resultUpdated = 0;
        let resultRemoved = 0;

        setGames(prev => {
            const existingGamesMap = new Map();
            prev.filter(g => g.emulator === emulator.name).forEach(g => existingGamesMap.set(g.name, g));

            const discoveredNames = new Set(discoveredGames.map(g => g.name));

            // Filter out removed games for this emulator
            let nextGames = prev.filter(g =>
                g.emulator !== emulator.name || discoveredNames.has(g.name)
            );

            resultRemoved = prev.length - nextGames.length; // Approximate, but mainly track removed count

            // Add or update
            potentialNewGames.forEach(pg => {
                const existing = existingGamesMap.get(pg.name);
                if (existing) {
                    // Update command if changed
                    if (existing.command !== pg.command) {
                        nextGames = nextGames.map(g => g.id === existing.id ? { ...g, command: pg.command } : g);
                        resultUpdated++;
                    }
                } else {
                    // Add new
                    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    nextGames.push({
                        id: uniqueId,
                        name: pg.name,
                        cleanName: pg.cleanName,
                        emulator: emulator.name,
                        command: pg.command,
                        coverImage: pg.coverImage || undefined,
                        createdAt: Date.now(),
                        playCount: 0,
                        isFavorite: false,
                    });
                    resultAdded++;
                }
            });

            return nextGames;
        });

        return { success: true, count: resultAdded, updated: resultUpdated, removed: resultRemoved };

    }, [apiUrl]);

    const removeGamesByEmulator = useCallback((emulatorId: string) => {
        setGames(prev => prev.filter(game => game.emulator !== emulatorId));
        setRecents(prev => prev.filter(r => {
            // We can't access 'games' here reliably if we want strictly consistent atomic update
            // But recents stores ID. We need to cross-ref.
            // Best effort:
            return true; // We rely on a separate cleanup or just accept loose recents for a moment
        }));
        // Actually, we should clean recents properly.
        // Let's do it in a useEffect or similar?
        // Or just let 'cleanupOrphanedGames' handle it.
        // For now, let's leave recents cleanup as best-effort based on current 'games' which might be stale?
        // No, we can just filter recents by ID if we knew which IDs were removed.
        // But we don't know IDs inside the functional update easily.
        // Let's just update games. Recents will point to non-existent games, which 'getRecentGames' filters out anyway!
        // "getRecentGames" -> games.find(g => g.id === r.gameId). If undefined, it filters it out.
        // So we don't strictly NEED to remove from recents state immediately to prevent crashes.
    }, []);

    const cleanupOrphanedGames = useCallback((currentEmulators: Array<{ name: string }>) => {
        // If currentEmulators is empty, it means ALL emulators were removed.
        // We should remove ALL games that have an emulator field that is not in the list.
        // Check if list is empty?
        const emulatorNames = new Set(currentEmulators.map(e => e.name));

        setGames(prev => {
            const keptGames = prev.filter(game => emulatorNames.has(game.emulator));
            if (keptGames.length !== prev.length) {
                console.log(`[cleanupOrphanedGames] Removing ${prev.length - keptGames.length} orphaned games`);
            }
            return keptGames;
        });

    }, []);

    return {
        games,
        loading,
        addGame,
        removeGame,
        updateGame,
        toggleFavorite,
        launchGame,
        getRecentGames,
        getFavoriteGames,
        getGamesByEmulator,
        refreshGameImages,
        scanGamesFromEmulator,
        removeGamesByEmulator,
        cleanupOrphanedGames,
    };
}
