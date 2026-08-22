import { DEFAULT_API_URL } from '@/types';

/**
 * Get image URL for a game - uses backend smart matching
 * Returns the URL to request from backend
 */
export function getGameImageUrl(gameName: string, apiUrl: string = DEFAULT_API_URL): string {
    return `${apiUrl}/game-image/${encodeURIComponent(gameName)}`;
}

/**
 * Find background image - now just returns the backend URL
 * The backend handles all the smart matching logic
 */
export async function findBackgroundImage(
    gameName: string,
    apiUrl: string = DEFAULT_API_URL
): Promise<string | null> {
    // Simply return the game-image URL - backend does the matching
    return getGameImageUrl(gameName, apiUrl);
}
