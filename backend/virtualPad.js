/**
 * Virtual controller aggregator - Node port of the original EmuCenter's
 * virtual_pad_vg.py (VirtualX360).
 *
 * Creates one ViGEmBus virtual Xbox 360 pad and mirrors the "owning"
 * physical XInput pad onto it. Ownership follows whichever physical pad
 * is actually being used (500ms idle hold before switching), so emulators
 * configured once against the stable virtual pad work with any controller
 * the player happens to pick up. Rumble is passed back to the owner.
 *
 * Differences from the Python original:
 *  - The virtual pad's own XInput slot is excluded from owner scanning
 *    (the Python version scanned all 4 slots and could briefly adopt its
 *    own reflection as owner).
 *  - The slot is detected by diffing connected slots before/after creation;
 *    pad.userIndex reports the ViGEm serial, not the XInput slot.
 *
 * Windows-only. Requires the ViGEmBus driver (bundled installer in the
 * original repo's tools_installer/).
 */

const os = require('os');

// XINPUT_GAMEPAD wButtons masks -> vigemclient button names
const BUTTON_MAP = [
    [0x0010, 'START'],
    [0x0020, 'BACK'],
    [0x0040, 'LEFT_THUMB'],
    [0x0080, 'RIGHT_THUMB'],
    [0x0100, 'LEFT_SHOULDER'],
    [0x0200, 'RIGHT_SHOULDER'],
    [0x1000, 'A'],
    [0x2000, 'B'],
    [0x4000, 'X'],
    [0x8000, 'Y'],
];
const DPAD_UP = 0x0001;
const DPAD_DOWN = 0x0002;
const DPAD_LEFT = 0x0004;
const DPAD_RIGHT = 0x0008;

const NEUTRAL_GAMEPAD = Object.freeze({
    wButtons: 0, bLeftTrigger: 0, bRightTrigger: 0,
    sThumbLX: 0, sThumbLY: 0, sThumbRX: 0, sThumbRY: 0,
});

class VirtualPadAggregator {
    constructor({ pollHz = 250, idleHoldMs = 500, deadzone = 6000, triggerDeadzone = 5 } = {}) {
        this.pollMs = Math.max(2, Math.round(1000 / pollHz));
        this.idleHoldMs = idleHoldMs;
        this.deadzone = deadzone;
        this.trigDz = triggerDeadzone;

        this.running = false;
        this.slot = -1;        // the virtual pad's XInput slot
        this.owner = -1;       // physical slot currently mirrored
        this.lastActivity = 0;
        this.lastError = null;

        this._xinput = null;
        this._client = null;
        this._pad = null;
        this._timer = null;
        this._busy = false;
        this._lastSig = null;
    }

    getStatus() {
        return {
            supported: os.platform() === 'win32',
            enabled: this.running,
            slot: this.slot,
            owner: this.owner,
            error: this.lastError,
        };
    }

    async _connectedSlots() {
        const out = [];
        for (let i = 0; i < 4; i++) {
            try {
                await this._xinput.getState({ dwUserIndex: i, translate: false });
                out.push(i);
            } catch { /* not connected */ }
        }
        return out;
    }

    async start() {
        if (this.running) return this.getStatus();
        this.lastError = null;

        if (os.platform() !== 'win32') {
            this.lastError = 'Virtual controller is only supported on Windows';
            return this.getStatus();
        }

        try {
            this._xinput = await import('xinput-ffi');
            const ViGEmClient = require('vigemclient');

            const before = await this._connectedSlots();

            this._client = new ViGEmClient();
            let err = this._client.connect();
            if (err) throw new Error(`ViGEmBus not reachable (${err.message}). Is the ViGEmBus driver installed?`);

            this._pad = this._client.createX360Controller();
            this._pad.updateMode = 'manual';
            err = this._pad.connect();
            if (err) throw new Error(`Virtual pad connect failed: ${err.message}`);

            // Detect the virtual pad's XInput slot by diffing (retry while
            // Windows enumerates the new device).
            this.slot = -1;
            for (let attempt = 0; attempt < 20 && this.slot === -1; attempt++) {
                await new Promise(r => setTimeout(r, 150));
                const after = await this._connectedSlots();
                const fresh = after.find(s => !before.includes(s));
                if (fresh !== undefined) this.slot = fresh;
            }
            if (this.slot === -1) {
                throw new Error('Could not detect the virtual pad\'s XInput slot');
            }

            // Rumble passthrough to the owning physical pad (0..255 -> percent)
            this._pad.on('vibration', ({ large, small }) => {
                if (this.owner >= 0 && this._xinput) {
                    this._xinput.setState(
                        Math.round(large * 100 / 255),
                        Math.round(small * 100 / 255),
                        { dwUserIndex: this.owner, usePercent: true }
                    ).catch(() => { /* owner may have disconnected */ });
                }
            });

            this.owner = -1;
            this.lastActivity = 0;
            this._lastSig = null;
            this.running = true;
            this._timer = setInterval(() => { this._tick(); }, this.pollMs);
            console.log(`[VirtualPad] Aggregator running. Virtual pad on XInput slot ${this.slot}`);
        } catch (e) {
            this.lastError = e.message;
            console.error('[VirtualPad] start failed:', e.message);
            await this.stop();
        }
        return this.getStatus();
    }

    async stop() {
        this.running = false;
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        if (this._pad) {
            try {
                this._pad.resetInputs();
                this._pad.update();
                this._pad.disconnect();
            } catch { /* already gone */ }
            this._pad = null;
        }
        this._client = null;
        this.slot = -1;
        this.owner = -1;
        this._lastSig = null;
        return this.getStatus();
    }

    async _tick() {
        if (this._busy || !this.running) return;
        this._busy = true;
        try {
            const { owner, gamepad } = await this._pickOwner();
            this.owner = owner;

            const g = gamepad ?? NEUTRAL_GAMEPAD;
            const sig = `${g.wButtons}|${g.bLeftTrigger}|${g.bRightTrigger}|${g.sThumbLX}|${g.sThumbLY}|${g.sThumbRX}|${g.sThumbRY}`;
            if (sig !== this._lastSig && this._pad) {
                this._applyToPad(g);
                this._pad.update();
                this._lastSig = sig;
            }
        } catch { /* transient read error - skip tick */
        } finally {
            this._busy = false;
        }
    }

    /**
     * Port of the original _pick_owner: keep the current owner while it is
     * active or within the idle hold; otherwise the first active pad wins,
     * falling back to the first connected pad. The virtual pad's own slot
     * is never a candidate.
     */
    async _pickOwner() {
        const now = Date.now();

        if (this.owner >= 0 && this.owner !== this.slot) {
            const st = await this._getState(this.owner);
            if (st) {
                if (this._hasActivity(st)) {
                    this.lastActivity = now;
                    return { owner: this.owner, gamepad: st };
                }
                if (now - this.lastActivity < this.idleHoldMs) {
                    return { owner: this.owner, gamepad: st };
                }
            }
        }

        let firstConn = null;
        for (let i = 0; i < 4; i++) {
            if (i === this.slot) continue;
            const st = await this._getState(i);
            if (!st) continue;
            if (firstConn === null) firstConn = { owner: i, gamepad: st };
            if (this._hasActivity(st)) {
                this.lastActivity = now;
                return { owner: i, gamepad: st };
            }
        }

        return firstConn ?? { owner: -1, gamepad: null };
    }

    async _getState(index) {
        try {
            const state = await this._xinput.getState({ dwUserIndex: index, translate: false });
            return state.gamepad;
        } catch {
            return null;
        }
    }

    _hasActivity(g) {
        if (g.wButtons) return true;
        if (g.bLeftTrigger > this.trigDz || g.bRightTrigger > this.trigDz) return true;
        if (Math.abs(g.sThumbLX) > this.deadzone || Math.abs(g.sThumbLY) > this.deadzone) return true;
        if (Math.abs(g.sThumbRX) > this.deadzone || Math.abs(g.sThumbRY) > this.deadzone) return true;
        return false;
    }

    _applyToPad(g) {
        const pad = this._pad;
        pad.resetInputs();

        for (const [mask, name] of BUTTON_MAP) {
            if (g.wButtons & mask) pad.button[name].setValue(true);
        }

        // D-pad is modeled as two axes by vigemclient
        pad.axis.dpadHorz.setValue((g.wButtons & DPAD_RIGHT) ? 1 : (g.wButtons & DPAD_LEFT) ? -1 : 0);
        pad.axis.dpadVert.setValue((g.wButtons & DPAD_UP) ? 1 : (g.wButtons & DPAD_DOWN) ? -1 : 0);

        // Triggers 0..255 raw -> 0..1, with the original's deadzone clamp
        pad.axis.leftTrigger.setValue(g.bLeftTrigger <= this.trigDz ? 0 : g.bLeftTrigger / 255);
        pad.axis.rightTrigger.setValue(g.bRightTrigger <= this.trigDz ? 0 : g.bRightTrigger / 255);

        // Sticks -32768..32767 raw -> -1..1, zeroed inside the deadzone
        const dz = (v) => (v > -this.deadzone && v < this.deadzone) ? 0 : Math.max(-1, Math.min(1, v / 32767));
        pad.axis.leftX.setValue(dz(g.sThumbLX));
        pad.axis.leftY.setValue(dz(g.sThumbLY));
        pad.axis.rightX.setValue(dz(g.sThumbRX));
        pad.axis.rightY.setValue(dz(g.sThumbRY));
    }
}

module.exports = { VirtualPadAggregator };
