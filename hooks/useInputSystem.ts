import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Semantic navigation actions emitted by the input layer.
 * Gamepad and keyboard both feed the same stream, so consumers never
 * care which device produced an action.
 */
export type NavAction =
    | { type: 'direction'; dir: 'up' | 'down' | 'left' | 'right' }
    | { type: 'accept' }    // A / Enter      -> launch selected game
    | { type: 'back' }      // B / Escape     -> clear selection
    | { type: 'favorite' }  // BACK-Select / F
    | { type: 'sort' }      // Y / R          -> toggle sort mode
    | { type: 'info' }      // START / I      -> expand/collapse all sections
    | { type: 'tabLeft' }   // LB / Q
    | { type: 'tabRight' }; // RB / E

export interface ConnectedGamepad {
    index: number;
    id: string;
}

export type InputMode = 'pointer' | 'controller';

// Standard gamepad mapping (https://w3c.github.io/gamepad/#remapping).
// XInput pads (Ayaneo Slide included) expose mapping === 'standard' in Chromium.
const BTN_A = 0;
const BTN_B = 1;
const BTN_Y = 3;
const BTN_LB = 4;
const BTN_RB = 5;
const BTN_BACK = 8;
const BTN_START = 9;
const BTN_DPAD_UP = 12;
const BTN_DPAD_DOWN = 13;
const BTN_DPAD_LEFT = 14;
const BTN_DPAD_RIGHT = 15;

const ACTION_BUTTONS: ReadonlyArray<[number, NavAction]> = [
    [BTN_A, { type: 'accept' }],
    [BTN_B, { type: 'back' }],
    [BTN_Y, { type: 'sort' }],
    [BTN_LB, { type: 'tabLeft' }],
    [BTN_RB, { type: 'tabRight' }],
    [BTN_BACK, { type: 'favorite' }],
    [BTN_START, { type: 'info' }],
];

const STICK_DEADZONE = 0.5;
// Directions repeat while held, like the original's level-triggered D-pad poll.
const REPEAT_INITIAL_DELAY = 350;
const REPEAT_INTERVAL = 110;

type Direction = 'up' | 'down' | 'left' | 'right';
const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

const KEY_ACTIONS: Record<string, NavAction> = {
    ArrowUp: { type: 'direction', dir: 'up' },
    ArrowDown: { type: 'direction', dir: 'down' },
    ArrowLeft: { type: 'direction', dir: 'left' },
    ArrowRight: { type: 'direction', dir: 'right' },
    Enter: { type: 'accept' },
    Escape: { type: 'back' },
    f: { type: 'favorite' },
    r: { type: 'sort' },
    i: { type: 'info' },
    q: { type: 'tabLeft' },
    e: { type: 'tabRight' },
};

interface DirectionRepeatState {
    heldSince: number;
    lastFire: number;
}

/**
 * Polls the Gamepad API (rAF loop, rising-edge buttons, hold-to-repeat
 * directions) and listens for the keyboard fallback. Emits NavActions
 * through onAction. Web/Electron only - a no-op on native platforms.
 *
 * The pads list keeps updating while `enabled` is false (the Settings
 * picker needs it with its modal open); only action emission is gated.
 */
export function useInputSystem(opts: {
    enabled: boolean;
    onAction: (action: NavAction) => void;
}): { gamepads: ConnectedGamepad[]; inputMode: InputMode } {
    const [gamepads, setGamepads] = useState<ConnectedGamepad[]>([]);
    const [inputMode, setInputMode] = useState<InputMode>('pointer');

    // Refs so the poll loop and listeners subscribe once and never go stale.
    const onActionRef = useRef(opts.onAction);
    onActionRef.current = opts.onAction;
    const enabledRef = useRef(opts.enabled);
    enabledRef.current = opts.enabled;

    const inputModeRef = useRef<InputMode>('pointer');
    const setMode = (mode: InputMode) => {
        if (inputModeRef.current !== mode) {
            inputModeRef.current = mode;
            setInputMode(mode);
        }
    };

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.getGamepads) {
            return;
        }

        let rafId = 0;
        // Rising-edge tracking per pad index, per button.
        const prevPressed = new Map<number, boolean[]>();
        const repeatState = new Map<Direction, DirectionRepeatState>();
        let lastPadsKey = '';

        const emit = (action: NavAction) => {
            setMode('controller');
            if (enabledRef.current) {
                onActionRef.current(action);
            }
        };

        const poll = () => {
            const now = performance.now();
            const pads = navigator.getGamepads();

            const connected: ConnectedGamepad[] = [];
            // Any pad holding a direction counts, merged across D-pad and stick.
            const held: Record<Direction, boolean> = { up: false, down: false, left: false, right: false };

            for (const pad of pads) {
                if (!pad || !pad.connected) continue;
                connected.push({ index: pad.index, id: pad.id });

                const prev = prevPressed.get(pad.index) ?? [];
                const curr = pad.buttons.map(b => b.pressed);

                for (const [button, action] of ACTION_BUTTONS) {
                    if (curr[button] && !prev[button]) {
                        emit(action);
                    }
                }

                const axisX = pad.axes[0] ?? 0;
                const axisY = pad.axes[1] ?? 0;
                held.up = held.up || curr[BTN_DPAD_UP] || axisY < -STICK_DEADZONE;
                held.down = held.down || curr[BTN_DPAD_DOWN] || axisY > STICK_DEADZONE;
                held.left = held.left || curr[BTN_DPAD_LEFT] || axisX < -STICK_DEADZONE;
                held.right = held.right || curr[BTN_DPAD_RIGHT] || axisX > STICK_DEADZONE;

                prevPressed.set(pad.index, curr);
            }

            for (const dir of DIRECTIONS) {
                if (held[dir]) {
                    const state = repeatState.get(dir);
                    if (!state) {
                        repeatState.set(dir, { heldSince: now, lastFire: now });
                        emit({ type: 'direction', dir });
                    } else if (now - state.heldSince >= REPEAT_INITIAL_DELAY && now - state.lastFire >= REPEAT_INTERVAL) {
                        state.lastFire = now;
                        emit({ type: 'direction', dir });
                    }
                } else {
                    repeatState.delete(dir);
                }
            }

            const padsKey = connected.map(p => `${p.index}:${p.id}`).join('|');
            if (padsKey !== lastPadsKey) {
                lastPadsKey = padsKey;
                setGamepads(connected);
            }

            rafId = requestAnimationFrame(poll);
        };
        rafId = requestAnimationFrame(poll);

        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const tag = target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
            const action = KEY_ACTIONS[key];
            if (!action) return;

            // Arrow repeats come free from the OS; block page scroll either way.
            if (action.type === 'direction') {
                event.preventDefault();
            } else if (event.repeat) {
                return;
            }

            setMode('controller');
            if (enabledRef.current) {
                onActionRef.current(action);
            }
        };

        const onPointerDown = () => setMode('pointer');

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('pointerdown', onPointerDown);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('pointerdown', onPointerDown);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { gamepads, inputMode };
}
