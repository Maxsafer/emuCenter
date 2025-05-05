import sys
import os

def update_fullscreen_in_qt_ini(confirmclose, default):

    # Define the path to the ini file
    ini_file_path = os.path.join(os.getenv('APPDATA'), 'yuzu/config', 'qt-config.ini')

    # Check if the ini file exists
    if not os.path.isfile(ini_file_path):
        print(f"File {ini_file_path} does not exist.")
        return

    # Read the file and modify the necessary line
    lines = []
    with open(ini_file_path, 'r') as file:
        lines = file.readlines()

    with open(ini_file_path, 'w') as file:
        in_ui_section = False
        for line in lines:
            if line.strip() == '[UI]':
                in_ui_section = True
            elif in_ui_section and line.startswith('confirmStop='):
                line = f'confirmStop={confirmclose}\n'
            elif in_ui_section and line.startswith('confirmStop\default='):
                line = f'confirmStop\default={default}\n'
                in_ui_section = False
            file.write(line)

    print(f"Updated 'confirmStop' to {confirmclose} in {ini_file_path}")
    print(f"Updated 'confirmStop\default' to {default} in {ini_file_path}")

if __name__ == "__main__":
    if len(sys.argv) == 1:
        update_fullscreen_in_qt_ini(confirmclose='2', default='false')
    else:
        update_fullscreen_in_qt_ini(confirmclose=sys.argv[1], default=sys.argv[2])