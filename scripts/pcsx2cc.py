import sys
import os

def update_fullscreen_in_qt_ini(confirmclose):

    # Define the path to the ini file
    ini_file_path = os.path.join(os.getenv('USERPROFILE'), 'Documents/PCSX2/inis', 'PCSX2.ini')

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
            elif in_ui_section and line.startswith('ConfirmShutdown'):
                line = f'ConfirmShutdown = {confirmclose}\n'
                in_ui_section = False
            file.write(line)

    print(f"Updated 'ConfirmShutdown' to {confirmclose} in {ini_file_path}")

if __name__ == "__main__":
    if len(sys.argv) == 1:
        update_fullscreen_in_qt_ini(confirmclose='true')
    else:
        update_fullscreen_in_qt_ini(confirmclose=sys.argv[1])