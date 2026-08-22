import { useCallback, useEffect, useState } from 'react';

export interface VirtualPadStatus {
    supported: boolean;
    enabled: boolean;
    /** XInput slot the virtual pad occupies (-1 when off) */
    slot: number;
    /** Physical slot currently driving the virtual pad (-1 = none yet) */
    owner: number;
    error: string | null;
}

/**
 * Client for the backend's virtual controller aggregator. The backend is
 * the source of truth (it also restores the aggregator on boot from the
 * saved setting); this hook mirrors its status and toggles it.
 */
export function useVirtualPad(apiUrl: string) {
    const [status, setStatus] = useState<VirtualPadStatus | null>(null);

    const refresh = useCallback(async () => {
        try {
            const res = await fetch(`${apiUrl}/virtual-pad`);
            const json = await res.json();
            if (json.status) setStatus(json.status);
        } catch {
            setStatus(null);
        }
    }, [apiUrl]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const setEnabled = useCallback(async (enabled: boolean): Promise<VirtualPadStatus | null> => {
        try {
            const res = await fetch(`${apiUrl}/virtual-pad`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled }),
            });
            const json = await res.json();
            if (json.status) {
                setStatus(json.status);
                return json.status;
            }
            return null;
        } catch {
            return null;
        }
    }, [apiUrl]);

    return { status, refresh, setEnabled };
}
