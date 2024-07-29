import sys
import os

def update_fullscreen_in_cfg(fullscreen, path):
    """
    Update the 'fullScreen' value to 'x' in the 'Project64.cfg' file located in the Config directory
    within the local application data folder.
    """
    ini_file_path = os.path.join(path, 'Config' ,'Project64.cfg')

    # Check if the ini file exists
    if not os.path.isfile(ini_file_path):
        print(f"File {ini_file_path} does not exist.")
        return

    # Read the file and modify the necessary line
    lines = []
    with open(ini_file_path, 'r') as file:
        lines = file.readlines()

    with open(ini_file_path, 'w') as file:
        for x,line in enumerate(lines):
            if line.strip() == '[Settings]':
                if 'Screen' not in lines[x+1]:
                    line = f'[Settings]\nAuto Full Screen={fullscreen}\n'
            file.write(line)

    print(f"Updated 'Auto Full Screen' to {fullscreen} in {ini_file_path}")

if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("No path selected.")
    else:
        update_fullscreen_in_cfg(fullscreen=sys.argv[1], path=sys.argv[2])