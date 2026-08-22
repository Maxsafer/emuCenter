import { DEFAULT_API_URL, Settings } from '@/types';
import BackendStorage from '@/utils/backendStorage';
import { useCallback, useEffect, useState } from 'react';

const SETTINGS_KEY = 'settings';

const DEFAULT_SETTINGS: Settings = {
    sortBy: 'alphabetical',
    navSoundVolume: 75,
    simplifiedUI: false,
    theme: 'dark',
    apiUrl: DEFAULT_API_URL,
    preferredController: -1,
    virtualPadEnabled: false,
    fullscreenOnStart: false,
    showInfoCards: true,
};

export function useSettings() {
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);

    // Load settings on mount
    useEffect(() => {
        (async () => {
            try {
                const settingsJson = await BackendStorage.getItem(SETTINGS_KEY);
                if (settingsJson) {
                    const loaded = JSON.parse(settingsJson);
                    setSettings({ ...DEFAULT_SETTINGS, ...loaded });
                }
            } catch (e) {
                console.error('Failed to load settings', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Save settings whenever they change
    useEffect(() => {
        if (loading) return;

        const saveSettings = async () => {
            try {
                await BackendStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
            } catch (e) {
                console.error('Failed to save settings', e);
            }
        };

        saveSettings();
    }, [settings, loading]);

    const updateSettings = useCallback((updates: Partial<Settings>) => {
        setSettings(prev => ({ ...prev, ...updates }));
    }, []);

    const setSortBy = useCallback((sortBy: Settings['sortBy']) => {
        updateSettings({ sortBy });
    }, [updateSettings]);

    const setNavSoundVolume = useCallback((volume: number) => {
        updateSettings({ navSoundVolume: Math.max(0, Math.min(100, volume)) });
    }, [updateSettings]);

    const setSimplifiedUI = useCallback((simplified: boolean) => {
        updateSettings({ simplifiedUI: simplified });
    }, [updateSettings]);

    const setTheme = useCallback((theme: Settings['theme']) => {
        updateSettings({ theme });
    }, [updateSettings]);

    const setApiUrl = useCallback((url: string) => {
        updateSettings({ apiUrl: url });
    }, [updateSettings]);

    const setPreferredController = useCallback((index: number) => {
        updateSettings({ preferredController: index });
    }, [updateSettings]);

    const setVirtualPadEnabled = useCallback((enabled: boolean) => {
        updateSettings({ virtualPadEnabled: enabled });
    }, [updateSettings]);

    const setFullscreenOnStart = useCallback((enabled: boolean) => {
        updateSettings({ fullscreenOnStart: enabled });
    }, [updateSettings]);

    const setShowInfoCards = useCallback((show: boolean) => {
        updateSettings({ showInfoCards: show });
    }, [updateSettings]);

    const resetSettings = useCallback(() => {
        setSettings(DEFAULT_SETTINGS);
    }, []);

    return {
        settings,
        loading,
        updateSettings,
        setSortBy,
        setNavSoundVolume,
        setSimplifiedUI,
        setTheme,
        setApiUrl,
        setPreferredController,
        setVirtualPadEnabled,
        setFullscreenOnStart,
        setShowInfoCards,
        resetSettings,
    };
}
