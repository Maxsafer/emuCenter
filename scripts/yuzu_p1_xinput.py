import os
import re
import sys

QT_CONFIG = os.path.join(os.getenv('APPDATA'), 'yuzu', 'config', 'qt-config.ini')

PORT_RE = re.compile(r'(port\s*:\s*)(\d+)')

def set_yuzu_p1_port(index=0, ini_path=QT_CONFIG):
    if not os.path.isfile(ini_path):
        print(f"[Yuzu] qt-config.ini not found: {ini_path}")
        return 1

    with open(ini_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    out = []
    in_controls = False
    seen_controls = False
    changed_any = False
    ensured_connected = False

    # Track where the last Controls line ended up in `out`
    last_controls_line_idx = -1

    for raw in lines:
        line = raw
        stripped = line.strip()

        # Section header?
        if stripped.startswith('[') and stripped.endswith(']'):
            # leaving Controls? (we've already appended last content line before)
            in_controls = (stripped.lower() == '[controls]')
            if in_controls:
                seen_controls = True
            out.append(line)
            continue

        if in_controls:
            last_controls_line_idx = len(out)  # this index will be the last line inside Controls
            if '=' in stripped:
                key, val = [x.strip() for x in stripped.split('=', 1)]
                key_l = key.lower()

                if key_l.startswith('player_0_'):
                    new_val, nsubs = PORT_RE.subn(rf'\g<1>{index}', val)
                    if nsubs > 0:
                        line = f"{key}={new_val}\n"
                        changed_any = True

                    if key_l == 'player_0_connected':
                        if val.lower() != 'true':
                            line = f"{key}=true\n"
                            changed_any = True
                        ensured_connected = True

        out.append(line)

    # If Controls existed but we never saw player_0_connected, add it inside the section
    if seen_controls and not ensured_connected:
        insert_at = last_controls_line_idx + 1 if last_controls_line_idx >= 0 else len(out)
        out.insert(insert_at, "player_0_connected=true\n")
        changed_any = True

    if not seen_controls:
        print("[Yuzu] No [Controls] section found. Open Yuzu once, set any P1 mapping, close Yuzu, then rerun.")
        return 2

    if not changed_any:
        print("[Yuzu] Nothing changed (P1 was already on that port or no P1 mappings found).")
        return 0

    with open(ini_path, 'w', encoding='utf-8') as f:
        f.writelines(out)

    print(f"[Yuzu] Player 1 port set to {index} (SDL) in {ini_path}")
    return 0

if __name__ == '__main__':
    idx = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].lstrip('-').isdigit() else 0
    path = sys.argv[2] if len(sys.argv) > 2 else QT_CONFIG

    if idx != -1:
        set_yuzu_p1_port(index=idx, ini_path=path)