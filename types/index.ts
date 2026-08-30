export interface LaunchResponse {
    success: boolean;
    // Set when the backend debounced this request as a duplicate press;
    // the launch "succeeded" but no new process was started.
    ignored?: boolean;
    error?: string;
}

// API configuration.
// Note: settings.apiUrl is itself stored on the backend this URL points to,
// so a changed value can only take effect if the backend is reachable at the
// default first. Fine for the localhost-only setup; revisit if that changes.
export const DEFAULT_API_URL = 'http://localhost:3001';

// Re-export game types
export * from './game';
