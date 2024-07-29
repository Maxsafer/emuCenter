import sys
import configparser
from PyQt5.QtWidgets import QApplication
from ui_components import MainWindow
from xinput_handler import XInputHandler

def get_boolean_with_default(config, section, option, default=False):
    """
    Retrieves a boolean value from the configuration.
    Returns the default value if the option is missing or empty.
    """
    value = config.get(section, option, fallback=None)
    if value is None or value.strip() == '':
        return default
    return config.getboolean(section, option)

def main():
    # Read settings from configuration file
    config = configparser.ConfigParser()
    config.read('settings.ini')
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

    # Set up the XInput handler
    xinput_handler = XInputHandler(main_window.settings_label, main_window.buttons_label, main_window)
    main_window.init_xinput_handler()  # Ensure DPAD signals are connected

    sys.exit(app.exec_())

if __name__ == '__main__':
    main()