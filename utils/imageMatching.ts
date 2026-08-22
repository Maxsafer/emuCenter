/**
 * Get image URL for a game - uses backend smart matching
 * Returns the URL to request from backend
 */
export function getGameImageUrl(gameName: string, apiUrl: string = 'http://localhost:3001'): string {
    return `${apiUrl}/game-image/${encodeURIComponent(gameName)}`;
}

/**
 * Get the images directory path (backend/images) - for reference only
 */
export function getImagesDirectory(): string {
    return '/Users/maximilianosf/Documents/repos/test-app/backend/images';
}

/**
 * Find background image - now just returns the backend URL
 * The backend handles all the smart matching logic
 */
export async function findBackgroundImage(
    gameName: string,
    _imagesDirectory: string,
    apiUrl: string = 'http://localhost:3001'
): Promise<string | null> {
    // Simply return the game-image URL - backend does the matching
    return getGameImageUrl(gameName, apiUrl);
}
