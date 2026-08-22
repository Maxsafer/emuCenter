// Todo types (kept for reference/future use)
export interface Todo {
    id: string;
    text: string;
    completed: boolean;
    createdAt: number;
}

// App Launcher types
export interface App {
    id: string;
    name: string;
    icon: string; // URL or local asset path
    command: string; // Path or command to launch the app
    createdAt: number;
}

export interface LaunchResponse {
    success: boolean;
    error?: string;
}

// API configuration.
// Note: settings.apiUrl is itself stored on the backend this URL points to,
// so a changed value can only take effect if the backend is reachable at the
// default first. Fine for the localhost-only setup; revisit if that changes.
export const DEFAULT_API_URL = 'http://localhost:3001';

// Re-export game types
export * from './game';
