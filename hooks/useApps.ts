import { App, DEFAULT_API_URL, LaunchResponse } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = '@apps_v1';
const API_URL_KEY = '@api_url';

export function useApps() {
    const [apps, setApps] = useState<App[]>([]);
    const [loading, setLoading] = useState(true);
    const [apiUrl, setApiUrlState] = useState(DEFAULT_API_URL);

    // Load apps and API URL on mount
    useEffect(() => {
        (async () => {
            try {
                const [appsJson, storedApiUrl] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEY),
                    AsyncStorage.getItem(API_URL_KEY),
                ]);

                if (appsJson) {
                    setApps(JSON.parse(appsJson));
                }
                if (storedApiUrl) {
                    setApiUrlState(storedApiUrl);
                }
            } catch (e) {
                console.error('Failed to load apps', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Save apps whenever they change
    useEffect(() => {
        if (loading) return;
        const saveApps = async () => {
            try {
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
            } catch (e) {
                console.error('Failed to save apps', e);
            }
        };
        saveApps();
    }, [apps, loading]);

    const addApp = useCallback((name: string, icon: string, command: string) => {
        const newApp: App = {
            id: Date.now().toString(),
            name,
            icon,
            command,
            createdAt: Date.now(),
        };
        setApps((prev) => [...prev, newApp]);
    }, []);

    const removeApp = useCallback((id: string) => {
        setApps((prev) => prev.filter((app) => app.id !== id));
    }, []);

    const setApiUrl = useCallback(async (url: string) => {
        setApiUrlState(url);
        await AsyncStorage.setItem(API_URL_KEY, url);
    }, []);

    const launchApp = useCallback(async (app: App): Promise<LaunchResponse> => {
        try {
            const response = await fetch(`${apiUrl}/launch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ command: app.command }),
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Failed to launch app', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }, [apiUrl]);

    return {
        apps,
        loading,
        addApp,
        removeApp,
        launchApp,
        apiUrl,
        setApiUrl,
    };
}
