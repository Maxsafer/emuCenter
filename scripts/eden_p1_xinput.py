import os
import re
import sys

QT_CONFIG = os.path.join(os.getenv('APPDATA'), 'eden', 'config', 'qt-config.ini')

PORT_RE = re.compile(r'(?i)(port\s*:\s*)\d+')

def set_eden_p1_port(index=0, ini_path=QT_CONFIG):
    # Only touch the port for player_0_* inside [Controls], and force connected=true.
    if not os.path.isfile(ini_path):
        print(f"[Eden] qt-config.ini not found: {ini_path}")
        return 1

    with open(ini_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    out = []
    in_controls = False
    seen_controls = False
    changed_any = False
    ensured_connected = False
    last_controls_line_idx = -1  # last line index inside [Controls] in `out`

    for raw in lines:
        line = raw
        stripped = line.strip()

        # Section header?
        if stripped.startswith('[') and stripped.endswith(']'):
            in_controls = (stripped.lower() == '[controls]')
            if in_controls:
                seen_controls = True
            out.append(line)
            continue

        if in_controls:
            last_controls_line_idx = len(out)

            if '=' in stripped:
                key, val = [x.strip() for x in stripped.split('=', 1)]
                key_l = key.lower()

                if key_l.startswith('player_0_'):
                    # Always enforce connected
                    if key_l == 'player_0_connected':
                        if val.lower() != 'true':
                            line = f"{key}=true\n"
                            changed_any = True
                        ensured_connected = True
                    else:
                        # Replace only existing "port:<num>" occurrences in the value
                        new_val, nsubs = PORT_RE.subn(rf'\g<1>{index}', val)
                        if nsubs > 0:
                            line = f"{key}={new_val}\n"
                            changed_any = True

        out.append(line)

    # If Controls existed but we never saw player_0_connected, add it inside the section
    if seen_controls and not ensured_connected:
        insert_at = last_controls_line_idx + 1 if last_controls_line_idx >= 0 else len(out)
        out.insert(insert_at, "player_0_connected=true\n")
        changed_any = True

    if not seen_controls:
        print("[Eden] No [Controls] section found. Open Eden once, set any P1 mapping, close Eden, then rerun.")
        return 2

    if not changed_any:
        print("[Eden] Nothing changed (no P1 ports found to update or already set).")
        return 0

    with open(ini_path, 'w', encoding='utf-8') as f:
        f.writelines(out)

    print(f"[Eden] Player 1 port set to {index} in {ini_path}")
    return 0

if __name__ == '__main__':
    idx = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].lstrip('-').isdigit() else 0
    emupath = sys.argv[2] if len(sys.argv) > 2 else ''
    path = sys.argv[3] if len(sys.argv) > 3 else QT_CONFIG

    if idx != -1:
        set_eden_p1_port(index=idx, ini_path=path)