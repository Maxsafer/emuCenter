from PyQt5.QtCore import QTimer, pyqtSignal, QObject
from ctypes import wintypes
import ctypes

# Load XInput library
xinput = ctypes.windll.xinput1_4

# Define XInput structures and constants
class XInputGamepad(ctypes.Structure):
    _fields_ = [
        ('wButtons', wintypes.WORD),
        ('bLeftTrigger', wintypes.BYTE),
        ('bRightTrigger', wintypes.BYTE),
        ('sThumbLX', wintypes.SHORT),
        ('sThumbLY', wintypes.SHORT),
        ('sThumbRX', wintypes.SHORT),
        ('sThumbRY', wintypes.SHORT)
    ]

class XInputState(ctypes.Structure):
    _fields_ = [
        ('dwPacketNumber', wintypes.DWORD),
        ('Gamepad', XInputGamepad)
    ]

ERROR_SUCCESS = 0
BUTTONS = {
    0x0001: "DPAD_UP",
    0x0002: "DPAD_DOWN",
    0x0004: "DPAD_LEFT",
    0x0008: "DPAD_RIGHT",
    0x0010: "START",
    0x0020: "BACK",
    0x0040: "LEFT_THUMB",
    0x0080: "RIGHT_THUMB",
    0x0100: "LEFT_SHOULDER",
    0x0200: "RIGHT_SHOULDER",
    0x1000: "A",
    0x2000: "B",
    0x4000: "X",
    0x8000: "Y"
}

class XInputHandler(QObject):
    dpad_signal = pyqtSignal(dict)
    button_a_signal = pyqtSignal()
    button_b_signal = pyqtSignal()
    button_y_signal = pyqtSignal()
    button_x_signal = pyqtSignal()
    button_start_signal = pyqtSignal()

    def __init__(self, settings_label, buttons_label, window, ignore_indices=None):
        super().__init__()
        self.settings_label = settings_label
        self.buttons_label = buttons_label
        self.window = window
        self.ignore_indices = set(ignore_indices or [])

        self.timer = QTimer()
        self.timer.timeout.connect(self.check_xinput_events)
        self.timer.start(100)

    def set_ignore_indices(self, indices):
        s = set(indices or [])
        self.ignore_indices = set() if len(s) >= 4 else s

    def _virtual_status_text(self):
        if not self.ignore_indices:
            return "Virtual controller: disabled"
        # could be more than one in theory, so show all
        slots_txt = ", ".join(str(i) for i in sorted(self.ignore_indices))
        return f"Virtual controller: enabled (slot {slots_txt})"

    def check_xinput_events(self):
        if not self.window.isActiveWindow():
            return  # remove this line if you want inputs even when window isn't focused

        any_controller_connected = False
        all_pressed_buttons = []

        for controller_id in range(4):
            state = XInputState()
            result = xinput.XInputGetState(controller_id, ctypes.byref(state))
            if result == ERROR_SUCCESS:
                any_controller_connected = True

                # Build the per-line label, mark the virtual (ignored) slot
                pressed_buttons = self.get_pressed_buttons(state.Gamepad.wButtons)
                if controller_id in self.ignore_indices:
                    line = f"Aggregator ({controller_id}): {pressed_buttons}"
                else:
                    line = f"Controller ({controller_id}): {pressed_buttons}"
                all_pressed_buttons.append(line)

                # Only drive UI actions from NON-ignored slots
                if controller_id not in self.ignore_indices:
                    dpad_state = self.get_dpad_state(state.Gamepad.wButtons)
                    if dpad_state:
                        self.dpad_signal.emit(dpad_state)
                    if state.Gamepad.wButtons & 0x1000:
                        self.button_a_signal.emit()
                    if state.Gamepad.wButtons & 0x2000:
                        self.button_b_signal.emit()
                    if state.Gamepad.wButtons & 0x4000:
                        self.button_x_signal.emit()
                    if state.Gamepad.wButtons & 0x8000:
                        self.button_y_signal.emit()
                    if state.Gamepad.wButtons & 0x0010:
                        self.button_start_signal.emit()

        # Prefix the status label with virtual status (enabled + slot list) 
        prefix = self._virtual_status_text()

        if any_controller_connected:
            self.settings_label.setText(prefix + "\nController(s) connected")
            self.buttons_label.setText("\n".join(all_pressed_buttons) if all_pressed_buttons else "No buttons pressed")
        else:
            self.settings_label.setText(prefix + "\nNo controllers connected")
            self.buttons_label.setText("")
    def get_pressed_buttons(self, wButtons):
        pressed_buttons = [name for bitmask, name in BUTTONS.items() if wButtons & bitmask]
        return ", ".join(pressed_buttons) if pressed_buttons else "No buttons pressed"

    def get_dpad_state(self, wButtons):
        return {
            'up': bool(wButtons & 0x0001),
            'down': bool(wButtons & 0x0002),
            'left': bool(wButtons & 0x0004),
            'right': bool(wButtons & 0x0008)
        }