from PyQt5.QtWidgets import QApplication
from ui_components import MainWindow
import configparser
import sys
import shutil
import os

def get_boolean_with_default(config, section, option, default=False):
    """
    Retrieves a boolean value from the configuration.
    Returns the default value if the option is missing or empty.
    """
    value = config.get(section, option, fallback=None)
    if value is None or value.strip() == '':
        return default
    return config.getboolean(section, option)

def load_settings_safely(filename='settings.ini'):
    config = configparser.ConfigParser()
    backup_filename = filename + '.bak'
    
    try:
        config.read(filename)
        
        # Check if we have valid sections. 
        # If file is missing, config.read returns [], sections is [].
        # If file is empty, config.read returns [filename], sections is [].
        # If file is valid, sections is not empty.
        if config.sections():
            shutil.copy2(filename, backup_filename)
            print(f"Settings loaded successfully. Backup created at {backup_filename}")
        elif os.path.exists(backup_filename):
             # File missing OR empty/invalid, but backup exists
             print("Settings file missing or invalid. Restoring from backup...")
             shutil.copy2(backup_filename, filename)
             config.read(filename)
             
    except configparser.Error as e:
        print(f"Error reading settings: {e}")
        if os.path.exists(backup_filename):
            print("Restoring settings from backup...")
            try:
                shutil.copy2(backup_filename, filename)
                config.read(filename)
                print("Restored successfully.")
            except Exception as restore_error:
                print(f"Failed to restore backup: {restore_error}")
        else:
            print("No backup found.")
            
    return config

def main():
    # Read settings from configuration file
    config = load_settings_safely('settings.ini')
    options = {
        'fullscreen': False,
        'navbar': True,
    }

    settings = {option: get_boolean_with_default(config, 'MainWindow', option, default) for option, default in options.items()}

    fullscreen = settings.get('fullscreen', False)
    navbar = settings.get('navbar', True)
    sort_by = 'alphabetical' if config.get('MainWindow', 'sort_by', fallback='alphabetical') == '' else config.get('MainWindow', 'sort_by', fallback='alphabetical')

    app = QApplication(sys.argv)
    main_window = MainWindow(fullscreen, navbar, sort_by)
    main_window.show()

    sys.exit(app.exec_())

if __name__ == '__main__':
    main()