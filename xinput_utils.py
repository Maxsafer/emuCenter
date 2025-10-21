import ctypes
from ctypes import wintypes

# try multiple DLLs for compatibility
for _dll in ("xinput1_4.dll", "xinput1_3.dll", "xinput9_1_0.dll"):
    try:
        _xinput = ctypes.WinDLL(_dll)
        break
    except OSError:
        _xinput = None
if _xinput is None:
    raise OSError("XInput DLL not found")

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

XInputGetState = _xinput.XInputGetState
XInputGetState.argtypes = [wintypes.DWORD, ctypes.POINTER(XINPUT_STATE)]
XInputGetState.restype  = wintypes.DWORD
ERROR_SUCCESS = 0

def xinput_connected_indices():
    s = set()
    for i in range(4):
        st = XINPUT_STATE()
        if XInputGetState(i, ctypes.byref(st)) == ERROR_SUCCESS:
            s.add(i)
    return s