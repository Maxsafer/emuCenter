import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Navigation sound effect, ported from the original EmuCenter (played on
 * selection change, volume 0-100 from settings.navSoundVolume). Web-only:
 * uses an HTMLAudioElement against the backend's /sounds route.
 *
 * Returns a stable play() callback; rapid re-triggers (hold-to-repeat
 * navigation) rewind the clip instead of overlapping it, matching the
 * original's behavior. Play failures (autoplay policy before the first
 * real user gesture) are swallowed - the Electron shell disables that
 * policy outright.
 */
export function useNavSound(apiUrl: string, volume: number) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const volumeRef = useRef(volume);
    volumeRef.current = volume;

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.Audio === 'undefined') {
            return;
        }
        const audio = new window.Audio(`${apiUrl}/sounds/navigation-sfx.wav`);
        audio.preload = 'auto';
        audioRef.current = audio;
        return () => {
            audio.pause();
            audioRef.current = null;
        };
    }, [apiUrl]);

    return useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const vol = Math.max(0, Math.min(100, volumeRef.current)) / 100;
        if (vol <= 0) return; // muted

        audio.volume = vol;
        try {
            audio.currentTime = 0;
        } catch { /* not seekable yet - play from wherever it is */ }
        audio.play().catch(() => { /* autoplay policy - ignore */ });
    }, []);
}
