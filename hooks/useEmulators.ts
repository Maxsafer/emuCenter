import { Emulator } from '@/types';
import BackendStorage from '@/utils/backendStorage';
import { useCallback, useEffect, useRef, useState } from 'react';

const EMULATORS_KEY = 'emulators';

export function useEmulators() {
    const [emulators, setEmulators] = useState<Emulator[]>([]);
    const [loading, setLoading] = useState(true);
    // If the initial load never reached the backend, the on-disk config may
    // hold data this session cannot see - saving would overwrite it.
    const loadFailed = useRef(false);

    // Load emulators on mount
    useEffect(() => {
        (async () => {
            try {
                const emulatorsJson = await BackendStorage.getItem(EMULATORS_KEY);
                if (emulatorsJson) {
                    setEmulators(JSON.parse(emulatorsJson));
                }
            } catch (e) {
                loadFailed.current = true;
                console.error('Failed to load emulators; saving disabled to protect on-disk config', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Save emulators whenever they change
    useEffect(() => {
        if (loading || loadFailed.current) return;

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
    ): Promise<Emulator> => {
        // Generated outside the updater so StrictMode's double invocation
        // produces identical objects for both the resolved value and the state.
        const newId = Date.now().toString();

        return new Promise<Emulator>((resolve) => {
            setEmulators(prev => {
                const existingIndex = prev.findIndex(e => e.name === name);

                if (existingIndex >= 0) {
                    // Update existing
                    const existing = prev[existingIndex];
                    const updatedEmulator: Emulator = {
                        ...existing,
                        displayName,
                        exePath,
                        gamesPaths,
                        template,
                        excludedExtensions,
                        icon: icon || existing.icon,
                    };
                    const updated = [...prev];
                    updated[existingIndex] = updatedEmulator;
                    resolve(updatedEmulator);
                    return updated;
                } else {
                    // Add new
                    const newEmulator: Emulator = {
                        id: newId,
                        name,
                        displayName,
                        exePath,
                        gamesPaths,
                        template,
                        excludedExtensions,
                        icon,
                        createdAt: Date.now(),
                    };
                    resolve(newEmulator);
                    return [...prev, newEmulator];
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
