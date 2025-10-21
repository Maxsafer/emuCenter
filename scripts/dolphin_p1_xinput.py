import os
import sys

GCPAD_INI = os.path.join(os.getenv('APPDATA'), 'Dolphin Emulator\Config', 'GCPadNew.ini')

def set_device_line(lines, section_name, device_value):
    """
    Return new lines with Device=... set inside [section_name].
    Creates the section if missing. Preserves other lines.
    """
    out = []
    in_section = False
    seen_section = False
    replaced = False

    for i, line in enumerate(lines):
        stripped = line.strip()
        # Enter/exit sections
        if stripped.startswith("[") and stripped.endswith("]"):
            if in_section and not replaced:
                # we were in target section but never saw a Device line -> add it before leaving
                out.append(f"Device = {device_value}\n")
            in_section = (stripped.lower() == f"[{section_name.lower()}]")
            seen_section = seen_section or in_section
            out.append(line)
            continue

        if in_section:
            # Replace existing Device line
            if stripped.lower().startswith("device"):
                out.append(f"Device = {device_value}\n")
                replaced = True
            else:
                out.append(line)
        else:
            out.append(line)

    if not seen_section:
        # Create whole section at end
        out.append(f"\n[{section_name}]\n")
        out.append(f"Device = {device_value}\n")
    elif in_section and not replaced:
        # File ended while still in section
        out.append(f"Device = {device_value}\n")

    return out

def set_dolphin_p1_xinput(index=0, ini_path=GCPAD_INI):
    device = f"XInput/{index}/Gamepad"
    if not os.path.isfile(ini_path):
        print(f"[Dolphin] Configuration file not found: {ini_path}")
        return 1

    # --- GameCube Port 1 ---
    if not os.path.isfile(ini_path):
        # create minimal file if missing
        lines = []
    else:
        with open(ini_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    new_lines = set_device_line(lines, "GCPad1", device)
    with open(ini_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print(f"[Dolphin] Configuration file = {ini_path}")
    print(f"[Dolphin] GCPad1 -> Device = {device}")

if __name__ == "__main__":
    idx = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].lstrip('-').isdigit() else 0
    path = sys.argv[2] if len(sys.argv) > 2 else GCPAD_INI

    if idx != -1:
        set_dolphin_p1_xinput(idx, ini_path=path)