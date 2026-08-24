/**
 * Backend Storage - Persistent storage via backend API
 * Replaces AsyncStorage for cross-browser/device persistence
 */

import { DEFAULT_API_URL } from '@/types';

const API_URL = DEFAULT_API_URL;

// The Electron shell forks the backend and loads the window at the same
// time, so the first getItem calls can race a backend that is not listening
// yet. Returning null on that failure is indistinguishable from "no saved
// data": the hooks would come up empty and their save-on-change effects
// would then overwrite the real config on disk. Retry while the backend
// boots, and if it never answers, THROW so callers can tell "unreachable"
// apart from "empty" and disable saving for the session.
const GET_RETRIES = 30;
const GET_RETRY_DELAY_MS = 500;

export const BackendStorage = {
    /**
     * Get an item from backend storage
     */
    async getItem(key: string): Promise<string | null> {
        for (let attempt = 0; ; attempt++) {
            try {
                const response = await fetch(`${API_URL}/config/${encodeURIComponent(key)}`);
                const result = await response.json();

                if (result.success && result.data !== null) {
                    // Return as string (like AsyncStorage)
                    return JSON.stringify(result.data);
                }
                // The backend answered: there really is no saved data.
                return null;
            } catch (error) {
                if (attempt >= GET_RETRIES) {
                    console.error(`[BackendStorage] backend unreachable, giving up on ${key}:`, error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, GET_RETRY_DELAY_MS));
            }
        }
    },

    /**
     * Set an item in backend storage
     */
    async setItem(key: string, value: string): Promise<void> {
        try {
            const response = await fetch(`${API_URL}/config/${encodeURIComponent(key)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: JSON.parse(value) })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to save');
            }
        } catch (error) {
            console.error(`[BackendStorage] setItem error for ${key}:`, error);
            throw error;
        }
    },

    /**
     * Remove an item from backend storage
     */
    async removeItem(key: string): Promise<void> {
        try {
            const response = await fetch(`${API_URL}/config/${encodeURIComponent(key)}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to delete');
            }
        } catch (error) {
            console.error(`[BackendStorage] removeItem error for ${key}:`, error);
            throw error;
        }
    }
};

export default BackendStorage;
