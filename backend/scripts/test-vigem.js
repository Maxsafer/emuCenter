/**
 * Standalone proof-of-concept for the virtual controller aggregator stack.
 * Run: node scripts/test-vigem.js
 *
 * Verifies, end to end:
 *   1. ViGEmBus is reachable and a virtual X360 pad can be created
 *   2. The virtual pad's XInput slot is reported (userIndex)
 *   3. Input fed via vigemclient is readable back through the XInput API
 *   4. Rumble sent to the virtual pad arrives at the vibration listener
 */
const ViGEmClient = require('vigemclient');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    const XInput = await import('xinput-ffi');

    const connectedSlots = async () => {
        const out = [];
        for (let i = 0; i < 4; i++) {
            try {
                await XInput.getState({ dwUserIndex: i, translate: false });
                out.push(i);
            } catch { /* not connected */ }
        }
        return out;
    };

    const before = await connectedSlots();
    console.log('[1] Physical slots before:', before);

    const client = new ViGEmClient();
    let err = client.connect();
    if (err) throw new Error('ViGEmClient connect failed: ' + err.message);
    console.log('[2] ViGEmBus connected');

    const pad = client.createX360Controller();
    err = pad.connect();
    if (err) throw new Error('Virtual pad connect failed: ' + err.message);
    await sleep(500); // let Windows enumerate the new device

    // pad.userIndex is unreliable (returns the ViGEm serial, not the XInput
    // slot) - detect the slot by diffing, like the original Python aggregator.
    const after = await connectedSlots();
    const slot = after.find(s => !before.includes(s));
    console.log('[3] Virtual pad created. userIndex claims', pad.userIndex,
        '| slot-diff says', slot, '| slots now:', after);
    if (slot === undefined) throw new Error('Could not detect virtual pad slot');

    // Feed input and read it back through XInput
    pad.button.A.setValue(true);
    pad.axis.leftX.setValue(1);
    await sleep(200);

    const state = await XInput.getState({ dwUserIndex: slot, translate: false });
    const aPressed = (state.gamepad.wButtons & 0x1000) !== 0;
    console.log('[4] Read-back: A pressed =', aPressed, '| sThumbLX =', state.gamepad.sThumbLX);

    // Rumble passthrough: send vibration TO the virtual pad, expect the event
    let gotVibration = null;
    pad.on('vibration', (v) => { gotVibration = v; });
    await XInput.setState(50, 50, { dwUserIndex: slot, usePercent: true });
    await sleep(300);
    console.log('[5] Vibration event received:', gotVibration);
    await XInput.setState(0, 0, { dwUserIndex: slot, usePercent: true });

    pad.button.A.setValue(false);
    pad.axis.leftX.setValue(0);
    await sleep(100);
    pad.disconnect();
    await sleep(1000); // give Windows time to remove the device
    console.log('[6] Disconnected. Slots after:', await connectedSlots());

    const ok = Number.isInteger(slot) && slot >= 0 && aPressed && gotVibration !== null;
    console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
    process.exit(ok ? 0 : 1);
}

main().catch(e => {
    console.error('RESULT: FAIL -', e.message);
    process.exit(1);
});
