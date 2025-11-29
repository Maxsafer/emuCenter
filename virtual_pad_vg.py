import os, sys, time, threading, ctypes
from ctypes import wintypes
import os, sys, time, threading, ctypes
from ctypes import wintypes

# Ensure vendored vgamepad is importable
_here = os.path.dirname(os.path.abspath(__file__))
if os.path.isdir(os.path.join(_here, "vgamepad")) and _here not in sys.path:
    sys.path.insert(0, _here)

if sys.platform == 'win32':
    try:
        import vgamepad as vg  # vendored
    except ImportError:
        vg = None

    # ---- XInput (physical devices) ----
    _xinput = None
    for dll in ("xinput1_4.dll", "xinput1_3.dll", "xinput9_1_0.dll"):
        try:
            _xinput = ctypes.WinDLL(dll)
            break
        except OSError:
            continue
    
    # If we are on Windows but can't load XInput, we might want to handle it gracefully
    # But the original code raised OSError. Let's keep it safe but maybe not crash import?
    # For now, if _xinput is None, we can't do physical reading.
    
    if _xinput:
        class XINPUT_GAMEPAD(ctypes.Structure):
            _fields_ = [
                ("wButtons",      wintypes.WORD),
                ("bLeftTrigger",  wintypes.BYTE),
                ("bRightTrigger", wintypes.BYTE),
                ("sThumbLX",      wintypes.SHORT),
                ("sThumbLY",      wintypes.SHORT),
                ("sThumbRX",      wintypes.SHORT),
                ("sThumbRY",      wintypes.SHORT),
            ]

        class XINPUT_STATE(ctypes.Structure):
            _fields_ = [("dwPacketNumber", wintypes.DWORD), ("Gamepad", XINPUT_GAMEPAD)]

        ERROR_SUCCESS = 0

        XInputGetState = _xinput.XInputGetState
        XInputGetState.argtypes = [wintypes.DWORD, ctypes.POINTER(XINPUT_STATE)]
        XInputGetState.restype  = wintypes.DWORD

        class XINPUT_VIBRATION(ctypes.Structure):
            _fields_ = [("wLeftMotorSpeed", wintypes.WORD), ("wRightMotorSpeed", wintypes.WORD)]
        XInputSetState = _xinput.XInputSetState
        XInputSetState.argtypes = [wintypes.DWORD, ctypes.POINTER(XINPUT_VIBRATION)]
        XInputSetState.restype  = wintypes.DWORD
    else:
        # Windows but no XInput DLL found
        XInputGetState = None
        XInputSetState = None

    # ---- Merger -> one virtual X360 ----
    class VirtualX360:
        def __init__(self, poll_hz=250, idle_hold_ms=500, deadzone=6000, trigger_deadzone=5):
            self.poll_dt = 1.0 / float(poll_hz)
            self.idle_hold = idle_hold_ms / 1000.0
            self.deadzone = int(deadzone)
            self.trig_dz = int(trigger_deadzone)
            self._thread = None
            self._stop = threading.Event()
            self._owner = -1
            self._last_activity = 0.0
            self.gamepad = None  # vgamepad.VX360Gamepad

        def start(self):
            if vg is None:
                print("vgamepad not loaded, cannot start VirtualX360")
                return

            # vgamepad constructs and auto-connects a virtual X360 via ViGEmBus
            try:
                self.gamepad = vg.VX360Gamepad()
            except Exception as e:
                print(f"Failed to create VX360Gamepad: {e}")
                return

            # optional: rumble passthrough to active physical pad
            def on_feedback(client, target, large, small, led, user_data):
                idx = self._owner
                if idx >= 0 and XInputSetState:
                    vib = XINPUT_VIBRATION(
                        wLeftMotorSpeed  = int(large) * 257,  # 0..255 -> 0..65535
                        wRightMotorSpeed = int(small) * 257,
                    )
                    XInputSetState(idx, ctypes.byref(vib))
            try:
                self.gamepad.register_notification(on_feedback)
            except Exception:
                # older vgamepad builds may differ; safe to ignore
                pass

            self._stop.clear()
            self._thread = threading.Thread(target=self._run, name="VirtualX360", daemon=True)
            self._thread.start()

        def stop(self):
            self._stop.set()
            if self._thread:
                self._thread.join(timeout=1.0)
                self._thread = None
            if self.gamepad:
                try:
                    self.gamepad.unregister_notification()
                except Exception:
                    pass
                # deleting object disconnects the virtual pad
                self.gamepad = None
                
        def send_neutral(self):
            if self.gamepad is not None:
                self.gamepad.reset()
                self.gamepad.update()

        def _run(self):
            last_tuple = None
            while not self._stop.is_set():
                owner, state = self._pick_owner()
                if owner >= 0 and self.gamepad:
                    tup = (
                        state.Gamepad.wButtons,
                        state.Gamepad.bLeftTrigger, state.Gamepad.bRightTrigger,
                        state.Gamepad.sThumbLX, state.Gamepad.sThumbLY,
                        state.Gamepad.sThumbRX, state.Gamepad.sThumbRY
                    )
                    if tup != last_tuple:
                        self._apply_to_vpad(state.Gamepad)
                        self.gamepad.update()
                        last_tuple = tup
                time.sleep(self.poll_dt)

        def _pick_owner(self):
            if not XInputGetState:
                return -1, None

            now = time.monotonic()
            # keep current owner if active or within hold
            if self._owner >= 0:
                st = XINPUT_STATE()
                if XInputGetState(self._owner, ctypes.byref(st)) == ERROR_SUCCESS:
                    if self._has_activity(st.Gamepad):
                        self._last_activity = now
                        return self._owner, st
                    if (now - self._last_activity) < self.idle_hold:
                        return self._owner, st

            first_conn = None
            for i in range(4):
                st = XINPUT_STATE()
                if XInputGetState(i, ctypes.byref(st)) == ERROR_SUCCESS:
                    if first_conn is None:
                        first_conn = (i, st)
                    if self._has_activity(st.Gamepad):
                        self._owner = i
                        self._last_activity = now
                        return i, st

            if first_conn:
                self._owner = first_conn[0]
                return first_conn
            self._owner = -1
            return -1, XINPUT_STATE()

        def _has_activity(self, g):
            if g.wButtons: return True
            if g.bLeftTrigger > self.trig_dz or g.bRightTrigger > self.trig_dz: return True
            if abs(g.sThumbLX) > self.deadzone or abs(g.sThumbLY) > self.deadzone: return True
            if abs(g.sThumbRX) > self.deadzone or abs(g.sThumbRY) > self.deadzone: return True
            return False

        def _apply_to_vpad(self, g):
            if vg is None: return
            # Buttons
            btn = vg.XUSB_BUTTON
            mapping = [
                (0x0001, btn.XUSB_GAMEPAD_DPAD_UP),
                (0x0002, btn.XUSB_GAMEPAD_DPAD_DOWN),
                (0x0004, btn.XUSB_GAMEPAD_DPAD_LEFT),
                (0x0008, btn.XUSB_GAMEPAD_DPAD_RIGHT),
                (0x0010, btn.XUSB_GAMEPAD_START),
                (0x0020, btn.XUSB_GAMEPAD_BACK),
                (0x0040, btn.XUSB_GAMEPAD_LEFT_THUMB),
                (0x0080, btn.XUSB_GAMEPAD_RIGHT_THUMB),
                (0x0100, btn.XUSB_GAMEPAD_LEFT_SHOULDER),
                (0x0200, btn.XUSB_GAMEPAD_RIGHT_SHOULDER),
                (0x1000, btn.XUSB_GAMEPAD_A),
                (0x2000, btn.XUSB_GAMEPAD_B),
                (0x4000, btn.XUSB_GAMEPAD_X),
                (0x8000, btn.XUSB_GAMEPAD_Y),
            ]

            # clear then set buttons
            self.gamepad.reset()  # clears buttons & axes

            for mask, vbtn in mapping:
                if g.wButtons & mask:
                    self.gamepad.press_button(button=vbtn)

            # triggers (0..255), deadzone clamp
            lt = 0 if g.bLeftTrigger  <= self.trig_dz else int(g.bLeftTrigger)
            rt = 0 if g.bRightTrigger <= self.trig_dz else int(g.bRightTrigger)
            self.gamepad.left_trigger(value=lt)
            self.gamepad.right_trigger(value=rt)

            # sticks (-32768..32767), apply deadzone
            def dz(v): return 0 if -self.deadzone < v < self.deadzone else int(v)
            self.gamepad.left_joystick(x_value=dz(g.sThumbLX),  y_value=dz(g.sThumbLY))
            self.gamepad.right_joystick(x_value=dz(g.sThumbRX), y_value=dz(g.sThumbRY))

else:
    # Non-Windows Dummy
    class VirtualX360:
        def __init__(self, poll_hz=250, idle_hold_ms=500, deadzone=6000, trigger_deadzone=5):
            pass
        def start(self):
            print("Virtual controller not supported on this platform")
        def stop(self):
            pass
        def send_neutral(self):
            pass