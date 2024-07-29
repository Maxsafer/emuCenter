import sys
import os

def update_fullscreen_in_vbam_ini(fullscreen):
    """
    Update the 'fullScreen' value to 'x' in the 'vbam.ini' file located in the VisualBoyAdvance-M directory
    within the local application data folder.
    """
    # Define the path to the ini file
    ini_file_path = os.path.join(os.getenv('LOCALAPPDATA'), 'visualboyadvance-m', 'vbam.ini')

    # Check if the ini file exists
    if not os.path.isfile(ini_file_path):
        print(f"File {ini_file_path} does not exist.")
        return

    # Read the file and modify the necessary line
    lines = []
    with open(ini_file_path, 'r') as file:
        lines = file.readlines()

    with open(ini_file_path, 'w') as file:
        in_geometry_section = False
        for line in lines:
            if line.strip() == '[geometry]':
                in_geometry_section = True
            elif in_geometry_section and line.startswith('fullScreen='):
                line = f'fullScreen={fullscreen}\n'
                in_geometry_section = False  # We found and replaced the line, no need to keep this flag on
            file.write(line)

    print(f"Updated 'fullScreen' to {fullscreen} in {ini_file_path}")

if __name__ == "__main__":
    if len(sys.argv) == 1:
        update_fullscreen_in_vbam_ini(fullscreen=0)
    else:
        update_fullscreen_in_vbam_ini(fullscreen=sys.argv[1])