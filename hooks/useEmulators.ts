import { Emulator } from '@/types';
import BackendStorage from '@/utils/backendStorage';
import { useCallback, useEffect, useState } from 'react';

const EMULATORS_KEY = 'emulators';

export function useEmulators() {
    const [emulators, setEmulators] = useState<Emulator[]>([]);
    const [loading, setLoading] = useState(true);

    // Load emulators on mount
    useEffect(() => {
        (async () => {
            try {
                const emulatorsJson = await BackendStorage.getItem(EMULATORS_KEY);
                if (emulatorsJson) {
                    setEmulators(JSON.parse(emulatorsJson));
                }
            } catch (e) {
                console.error('Failed to load emulators', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Save emulators whenever they change
    useEffect(() => {
        if (loading) return;

        const saveEmulators = async () => {
            try {
                await BackendStorage.setItem(EMULATORS_KEY, JSON.stringify(emulators));
            } catch (e) {
                console.error('Failed to save emulators', e);
            }
        };

        saveEmulators();
    }, [emulators, loading]);

    const addEmulator = useCallback((
        name: string,
        displayName: string,
        exePath: string,
        gamesPaths: string[],
        template: string,
        excludedExtensions: string[] = ['.bin', '.sav', '.txt', '.srm', '.DS_Store'],
        icon?: string
    ) => {
        let resultEmulator: Emulator;

        setEmulators(prev => {
            const existingIndex = prev.findIndex(e => e.name === name);
            if (existingIndex >= 0) {
                // Update existing
                const updated = [...prev];
                const existing = updated[existingIndex];
                const updatedEmulator = {
                    ...existing,
                    displayName,
                    exePath,
                    gamesPaths,
                    gamesPath: gamesPaths[0], // Maintain legacy compat
                    template,
                    excludedExtensions,
                    icon: icon || existing.icon,
                };
                updated[existingIndex] = updatedEmulator;
                resultEmulator = updatedEmulator;
                return updated;
            } else {
                // Add new
                const newEmulator: Emulator = {
                    id: Date.now().toString(),
                    name,
                    displayName,
                    exePath,
                    gamesPaths,
                    gamesPath: gamesPaths[0], // Maintain legacy compat
                    template,
                    excludedExtensions,
                    icon,
                    createdAt: Date.now(),
                };
                resultEmulator = newEmulator;
                return [...prev, newEmulator];
            }
        });

        // Note: resultEmulator will be assigned synchronously inside the setEmulators updater 
        // ONLY if React processes it immediately (which it does not always). 
        // THIS IS UNSAFE IN REACT. 
        // BETTER APPROACH: Return the object derived from inputs, assuming it will be applied.

        // Re-deriving for safe return:
        // We can't easily know if it was an update or create without reading 'emulators' state, 
        // but 'emulators' in useCallback dependency might be stale if we don't include it.
        // However, we want strict returning. 
        // Let's rely on the fact that we are inside the hook.

        // Actually, for the purpose of 'onAdd' which usually just needs the ID or to trigger a scan,
        // we can construct the object.

        // Let's change the pattern specific to this hook to make it cleaner:
        // We will read the current 'emulators' ref if possible, but here we can just do:

        // Wait, I can't look up 'emulators' inside the setEmulators callback and return it out.
        // I have to do the check OUTSIDE setEmulators.

        // But 'emulators' is a dependency.
        return new Promise<Emulator>((resolve) => {
            setEmulators(prev => {
                const existingIndex = prev.findIndex(e => e.name === name);
                let currentEmulator: Emulator;

                if (existingIndex >= 0) {
                    const existing = prev[existingIndex];
                    currentEmulator = {
                        ...existing,
                        displayName,
                        exePath,
                        gamesPaths,
                        gamesPath: gamesPaths[0],
                        template,
                        excludedExtensions,
                        icon: icon || existing.icon,
                    };
                    const updated = [...prev];
                    updated[existingIndex] = currentEmulator;
                    resolve(currentEmulator);
                    return updated;
                } else {
                    currentEmulator = {
                        id: Date.now().toString(),
                        name,
                        displayName,
                        exePath,
                        gamesPaths,
                        gamesPath: gamesPaths[0],
                        template,
                        excludedExtensions,
                        icon,
                        createdAt: Date.now(),
                    };
                    resolve(currentEmulator);
                    return [...prev, currentEmulator];
                }
            });
        });
    }, []);

    const updateEmulator = useCallback((id: string, updates: Partial<Omit<Emulator, 'id' | 'createdAt'>>) => {
        setEmulators(prev => prev.map(emu =>
            emu.id === id ? { ...emu, ...updates } : emu
        ));
    }, []);

    const removeEmulator = useCallback((id: string) => {
        setEmulators(prev => prev.filter(emu => emu.id !== id));
    }, []);

    const getEmulator = useCallback((id: string) => {
        return emulators.find(emu => emu.id === id);
    }, [emulators]);

    const getEmulatorByName = useCallback((name: string) => {
        return emulators.find(emu => emu.name === name);
    }, [emulators]);

    return {
        emulators,
        loading,
        addEmulator,
        updateEmulator,
        removeEmulator,
        getEmulator,
        getEmulatorByName,
    };
}
