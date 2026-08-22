/**
 * Backend Storage - Persistent storage via backend API
 * Replaces AsyncStorage for cross-browser/device persistence
 */

import { DEFAULT_API_URL } from '@/types';

const API_URL = DEFAULT_API_URL;

export const BackendStorage = {
    /**
     * Get an item from backend storage
     */
    async getItem(key: string): Promise<string | null> {
        try {
            const response = await fetch(`${API_URL}/config/${encodeURIComponent(key)}`);
            const result = await response.json();

            if (result.success && result.data !== null) {
                // Return as string (like AsyncStorage)
                return JSON.stringify(result.data);
            }
            return null;
        } catch (error) {
            console.error(`[BackendStorage] getItem error for ${key}:`, error);
            return null;
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
