import sys
import os

def update_fullscreen_in_qt_ini(fullscreend, fullscreen, confirmclose):
    """
    Update the 'fullScreen' value to 'x' in the 'qt-config.ini' file located in the citra/config directory
    within the local application data folder.
    """
    # Define the path to the ini file
    ini_file_path = os.path.join(os.getenv('APPDATA'), 'citra/config', 'qt-config.ini')

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
            elif in_ui_section and line.startswith('fullscreen\default='):
                line = f'fullscreen\default={fullscreend}\n'
            elif in_ui_section and line.startswith('fullscreen='):
                line = f'fullscreen={fullscreen}\n'
            elif in_ui_section and line.startswith('confirmClose\default='):
                line = f'confirmClose\default={confirmclose}\n'
            elif in_ui_section and line.startswith('confirmClose='):
                line = f'confirmClose={confirmclose}\n'
                in_ui_section = False
            file.write(line)

    print(f"Updated 'fullscreen\default' to {fullscreend} in {ini_file_path}")
    print(f"Updated 'fullscreen' to {fullscreen} in {ini_file_path}")
    print(f"Updated 'confirmClose\default' to {confirmclose} in {ini_file_path}")
    print(f"Updated 'confirmClose' to {confirmclose} in {ini_file_path}")

if __name__ == "__main__":
    if len(sys.argv) == 1:
        update_fullscreen_in_qt_ini(fullscreend='false', fullscreen='false', confirmclose='true')
    else:
        update_fullscreen_in_qt_ini(fullscreend=sys.argv[1], fullscreen=sys.argv[2], confirmclose=sys.argv[3])