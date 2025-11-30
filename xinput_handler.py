from PyQt5.QtCore import QTimer, pyqtSignal, QObject
from ctypes import wintypes
import ctypes

import sys

# Load XInput library
if sys.platform == 'win32':
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
else:
    xinput = None
    
    # Dummy structures for non-Windows
    class XInputGamepad:
        pass
        
    class XInputState:
        pass

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
    button_back_signal = pyqtSignal()
    button_lb_signal = pyqtSignal()
    button_rb_signal = pyqtSignal()

    def __init__(self, settings_label, buttons_label, window, ignore_indices=None):
        super().__init__()
        self.settings_label = settings_label
        self.buttons_label = buttons_label
        self.window = window
        self.ignore_indices = set(ignore_indices or [])

        self.timer = QTimer()
        self.timer.timeout.connect(self.check_xinput_events)
        self.timer.start(100)

        self.prev_gamepad_buttons = [0] * 4

    def set_ignore_indices(self, indices):
        s = set(indices or [])
        self.ignore_indices = set() if len(s) >= 4 else s

    def _virtual_status_text(self):
        if not self.ignore_indices:
            return "Virtual controller: disabled\n"
        # could be more than one in theory, so show all
        slots_txt = ", ".join(str(i) for i in sorted(self.ignore_indices))
        return f"Virtual controller: enabled (slot {slots_txt})\n"

    def check_xinput_events(self):
        if not self.window.isActiveWindow():
            return  # inputs blocked when window isn't focused

        if xinput is None:
            self.settings_label.setText("XInput not supported on this platform")
            self.buttons_label.setText("")
            return

        any_controller_connected = False
        all_pressed_buttons = []

        for controller_id in range(4):
            state = XInputState()
            result = xinput.XInputGetState(controller_id, ctypes.byref(state))
            if result == ERROR_SUCCESS:
                any_controller_connected = True

                # Build the per-line label, mark the virtual (ignored) slot
                pressed_buttons_text = self.get_pressed_buttons(state.Gamepad.wButtons)
                if controller_id in self.ignore_indices:
                    line = f"Aggregator ({controller_id}): {pressed_buttons_text}"
                else:
                    line = f"Controller ({controller_id}): {pressed_buttons_text}"
                all_pressed_buttons.append(line)

                # Only drive UI actions from NON-ignored slots
                if controller_id not in self.ignore_indices:
                    current_buttons = state.Gamepad.wButtons
                    prev_buttons = self.prev_gamepad_buttons[controller_id]
                    
                    # Calculate buttons that were just pressed (rising edge)
                    # (current & ~prev) gives bits that are 1 now but were 0 before
                    just_pressed = current_buttons & ~prev_buttons
                    
                    dpad_state = self.get_dpad_state(current_buttons)
                    if dpad_state:
                        self.dpad_signal.emit(dpad_state)
                        
                    # Use just_pressed for action buttons to prevent spamming
                    if just_pressed & 0x1000:
                        self.button_a_signal.emit()
                    if just_pressed & 0x2000:
                        self.button_b_signal.emit()
                    if just_pressed & 0x4000:
                        self.button_x_signal.emit()
                    if just_pressed & 0x8000:
                        self.button_y_signal.emit()
                    if just_pressed & 0x0010:
                        self.button_start_signal.emit()
                    if just_pressed & 0x0020:
                        self.button_back_signal.emit()
                    if just_pressed & 0x0100:
                        self.button_lb_signal.emit()
                    if just_pressed & 0x0200:
                        self.button_rb_signal.emit()
                        
                    # Update previous state
                    self.prev_gamepad_buttons[controller_id] = current_buttons
            else:
                # Reset previous state if controller disconnected
                self.prev_gamepad_buttons[controller_id] = 0

        # Prefix the status label with virtual status (enabled + slot list) 
        virtual_status = self._virtual_status_text()

        if any_controller_connected:
            header_text = "CONTROLLER(S) CONNECTED\n" + virtual_status
            body_text = "\n".join(all_pressed_buttons) if all_pressed_buttons else "No buttons pressed"
        else:
            header_text = "NO CONTROLLER(S) CONNECTED\n" + virtual_status
            body_text = ""

        # buttons_label is the top label, settings_label is the bottom label
        self.buttons_label.setText(header_text)
        self.settings_label.setText(body_text)
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