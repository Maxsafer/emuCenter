from PyQt5.QtWidgets import QLabel, QWidget, QFrame, QVBoxLayout, QHBoxLayout, QPushButton, QStackedWidget, QMainWindow, QAction, QDesktopWidget, QApplication, QCheckBox, QFileDialog, QScrollArea, QGridLayout, QScroller, QDialog, QShortcut, QMenu, QTextEdit
from PyQt5.QtGui import QFont, QColor, QPalette, QIcon, QPixmap, QKeySequence
from PyQt5.QtCore import Qt, QThread, pyqtSignal, QTimer
from xinput_handler import XInputHandler
import configparser
import subprocess
import time
import sys
import os

# CustomMessageBox class definition
class CustomMessageBox(QDialog):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Warning!")
        self.setFixedSize(400, 200)
        
        # Set up the layout and label
        layout = QVBoxLayout()
        self.label = QLabel("Game starting, please be patient.")
        self.label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.label)
        self.setLayout(layout)

        # Set up a timer to close the popup automatically
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.close)
        self.timer.setSingleShot(True)
        self.timer.start(2000)  # ttl in milliseconds
        
        self.exec_()

class AlwaysOnTopDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowFlags(Qt.WindowStaysOnTopHint | Qt.FramelessWindowHint)
        self.setFixedSize(200, 100)  # Set the size of the dialog
        self.setWindowTitle("Running Command")
        self.setStyleSheet("background-color: #303030; color: white;")
        
        # Set up the layout and label
        layout = QVBoxLayout()
        self.label = QLabel("Command is running...")
        self.label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.label)
        self.setLayout(layout)


class Worker(QThread):
    output_signal = pyqtSignal(str)
    finished_signal = pyqtSignal()

    def __init__(self, command):
        super().__init__()
        self.command = command
        self.process = None

    def run(self):
        self.process = subprocess.Popen(self.command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        for line in self.process.stdout:
            self.output_signal.emit(line.strip())
        self.process.stdout.close()
        self.process.wait()
        self.finished_signal.emit()

class QHLine(QFrame):
    def __init__(self):
        super(QHLine, self).__init__()
        self.setFrameShape(QFrame.HLine)
        self.setFrameShadow(QFrame.Sunken)

class TouchScrollArea(QScrollArea):
    screenTouched = pyqtSignal()  # Signal to indicate that the screen was touched

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAttribute(Qt.WA_AcceptTouchEvents)

    def mousePressEvent(self, event):
        self.screenTouched.emit()  # Emit the signal when the screen is touched
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        self.screenTouched.emit()  # Emit the signal when the screen is touched
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        self.screenTouched.emit()  # Emit the signal when the screen is touched
        super().mouseReleaseEvent(event)

class MainWindow(QMainWindow):
    def __init__(self, fullscreen=False, navbar=True, sort_by='alphabetical'):
        super().__init__()
        self.fullscreen = fullscreen
        self.navbar_visible = navbar
        self.sort_by = sort_by
        self.config = configparser.ConfigParser()
        file_path = 'settings.ini'
        self.selected_row = 0  # Track the selected row in the grid
        self.selected_col = 0  # Track the selected column in the grid
        self.games_in_grid = []  # Track the games in the grid layout
        self.screen_touched = False  # Flag to track if the screen was touched

        # Set the window icon
        self.setWindowIcon(QIcon('images/logo.png'))

        # Check if the file exists
        if not os.path.exists(file_path):
            # If the file does not exist, create it
            self.config['MainWindow'] = {'fullscreen': 'no', 'navbar': 'no', 'sort_by': 'alphabetical'}
            self.config['Templates'] = {}
            self.config['Settings'] = {}
            self.config['Emulators'] = {}

            # Write the config file
            with open(file_path, 'w') as configfile:
                self.config.write(configfile)

        self.config.read(file_path)
        self.worker = None
        self.active_workers = []  # Track active workers
        self.game_names = []  # List to store game names
        self.game_executables = []
        self.emulators = []
        self.init_ui()
        self.setup_shortcuts()
        self.highlight_selected_game()
        self.init_xinput_handler()

    def init_ui(self):
        self.setWindowTitle('EmuCenter v1.0')
        self.setFixedSize(1500, 1000)
        centerPoint = QDesktopWidget().availableGeometry().center()
        qtRectangle = self.frameGeometry()
        qtRectangle.moveCenter(centerPoint)
        self.move(qtRectangle.topLeft())

        # Create the main widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        self.setStyleSheet("background-color: #303030;")  # Set background color for main window

        main_layout = QVBoxLayout()  # Changed to QVBoxLayout

        # Hamburger menu button
        self.hamburger_button = QPushButton()
        self.hamburger_button.setFixedSize(100, 35)
        self.hamburger_button.setText("☰")
        self.hamburger_button.setStyleSheet("background-color: #2a2a2a; border: none;")
        self.hamburger_button.clicked.connect(self.toggle_navbar)
        self.style_button(self.hamburger_button)

        # Navigation bar
        self.nav_layout = QHBoxLayout()  # Changed to QHBoxLayout
        nav_button1 = QPushButton("Games")
        nav_button2 = QPushButton("Settings")
        nav_button4 = QPushButton("Exit")

        nav_button1.setFixedSize(200, 120)
        nav_button2.setFixedSize(200, 120)
        nav_button4.setFixedSize(200, 120)

        self.style_button(nav_button1)
        self.style_button(nav_button2)
        self.style_button(nav_button4)

        nav_button1.setFont(QFont("Arial", self.centralWidget().width() // 50, QFont.Bold))
        nav_button2.setFont(QFont("Arial", self.centralWidget().width() // 50, QFont.Bold))
        nav_button4.setFont(QFont("Arial", self.centralWidget().width() // 50, QFont.Bold))

        # Create the dropdown menu
        dropdown_button = QPushButton()
        self.style_button(dropdown_button)

        dropdown_button.setText("Order by")
        dropdown_button.setFixedSize(200, 120)
        dropdown_button.setFont(QFont("Arial", self.centralWidget().width() // 50, QFont.Bold))
        # dropdown_button.setPopupMode(QToolButton.MenuButtonPopup)

        dropdown_menu = QMenu(dropdown_button)
        option1 = QAction("Alphabetical", self)
        option2 = QAction("Emulator", self)
        # Connect the actions to the update_sort_by_setting method
        option1.triggered.connect(lambda: self.update_sort_by_setting("alphabetical"))
        option2.triggered.connect(lambda: self.update_sort_by_setting("emulator"))
        dropdown_menu.addAction(option1)
        dropdown_menu.addAction(option2)
        dropdown_menu.setStyleSheet("""
        QMenu {
            background-color: #2a2a2a;  /* Background color */
            color: white;  /* Text color */
            font-size: 100px;
            border: 20px solid #3a3a3a;  /* Border color */
        }
        QMenu::item {
            background-color: #2a2a2a;  /* Item background color */
            color: white;  /* Item text color */
        }
        QMenu::item:selected {
            background-color: #3a3a3a;  /* Selected item background color */
            color: white;  /* Selected item text color */
        }
    """)
        dropdown_button.setMenu(dropdown_menu)

        self.nav_layout.addWidget(nav_button1)
        self.nav_layout.addWidget(dropdown_button)
        self.nav_layout.addWidget(nav_button2)
        self.nav_layout.addWidget(nav_button4)
        self.nav_layout.addStretch(1)

        self.nav_widget = QWidget()
        self.nav_widget.setLayout(self.nav_layout)
        nav_palette = self.nav_widget.palette()
        nav_palette.setColor(QPalette.Window, QColor(45, 45, 45))
        self.nav_widget.setPalette(nav_palette)
        self.nav_widget.setAutoFillBackground(True)

        if not self.navbar_visible:
            self.nav_widget.hide()

        # Stacked widget
        self.stacked_widget = QStackedWidget()

        # Home screen with grid
        home_widget = QWidget()
        home_layout = QVBoxLayout()

        self.grid_scroll_area = TouchScrollArea()  # Use the custom TouchScrollArea
        self.grid_scroll_area.setWidgetResizable(True)
        self.grid_scroll_area.setStyleSheet("background-color: #303030;")  # Set background color for scroll area
        grid_widget = QWidget()
        grid_widget.setStyleSheet("background-color: #303030;")  # Set background color for grid widget
        self.grid_layout = QGridLayout(grid_widget)
        self.grid_scroll_area.setWidget(grid_widget)

        self.grid_scroll_area.screenTouched.connect(self.on_screen_touched)  # Connect the signal to the handler

        # Enable touch scrolling
        QScroller.grabGesture(self.grid_scroll_area.viewport(), QScroller.LeftMouseButtonGesture)

        home_layout.addWidget(self.grid_scroll_area)
        home_widget.setLayout(home_layout)
        home_widget.setAutoFillBackground(True)
        home_palette = home_widget.palette()
        home_palette.setColor(QPalette.Window, QColor(30, 30, 30))
        home_widget.setPalette(home_palette)

        # Settings screen with scroll area
        settings_scroll_area = QScrollArea()
        settings_scroll_area.setWidgetResizable(True)
        settings_scroll_area.setStyleSheet("background-color: #303030;")  # Set background color for scroll area
        settings_widget = QWidget()
        settings_widget.setStyleSheet("background-color: #303030;")  # Set background color for settings widget
        settings_scroll_area.setWidget(settings_widget)
        settings_layout = QVBoxLayout()

        # Enable touch scrolling for settings tab
        QScroller.grabGesture(settings_scroll_area.viewport(), QScroller.LeftMouseButtonGesture)

        self.startup_label = QLabel("Startup")
        self.startup_label.setFont(QFont("Arial", 25, 100))
        self.startup_label.setStyleSheet("color: white;")

        self.fullscreen_checkbox = QCheckBox("Fullscreen on start")
        self.fullscreen_checkbox.setFont(QFont("Arial", 18))
        self.fullscreen_checkbox.setStyleSheet("color: white;")
        self.fullscreen_checkbox.setChecked(self.fullscreen)
        self.fullscreen_checkbox.stateChanged.connect(self.update_fullscreen_setting)

        self.navbar_checkbox = QCheckBox("Show navigation bar on start")
        self.navbar_checkbox.setFont(QFont("Arial", 18))
        self.navbar_checkbox.setStyleSheet("color: white;")
        self.navbar_checkbox.setChecked(self.navbar_visible)
        self.navbar_checkbox.stateChanged.connect(self.update_navbar_setting)

        self.emulator_label = QLabel("\nEmulators")
        self.emulator_label.setFont(QFont("Arial", 25, 100))
        self.emulator_label.setStyleSheet("color: white;")

        self.settings_label = QLabel("Waiting for XInput events...")
        self.settings_label.setFont(QFont("Arial", 18))
        self.settings_label.setAlignment(Qt.AlignCenter)
        self.settings_label.setStyleSheet("color: white;")

        self.buttons_label = QLabel("")
        self.buttons_label.setFont(QFont("Arial", 18))
        self.buttons_label.setAlignment(Qt.AlignCenter)
        self.buttons_label.setStyleSheet("color: white;")

        settings_layout.addWidget(self.startup_label)
        settings_layout.addWidget(self.fullscreen_checkbox)
        settings_layout.addWidget(self.navbar_checkbox)
        settings_layout.addWidget(self.emulator_label)

        emulators_desc = self.get_emulators()

        for emulator in self.emulators:
            self.add_emulator_section(settings_layout, f"{emulator.upper()} ({emulators_desc.get(emulator)})", f'{emulator.lower()}Path', f'{emulator.lower()}GamesPath', f"{emulator}")

        settings_layout.addWidget(self.settings_label)
        settings_layout.addWidget(self.buttons_label)
        settings_layout.addStretch(1)  # Add stretch to push items to the top
        settings_widget.setLayout(settings_layout)
        settings_widget.setAutoFillBackground(True)
        settings_palette = settings_widget.palette()
        settings_palette.setColor(QPalette.Window, QColor(30, 30, 30))
        settings_widget.setPalette(settings_palette)

        # About screen
        about_widget = QWidget()
        about_layout = QVBoxLayout()

        # About label
        about_label = QLabel("EmuCenter version 1.0")
        about_label.setFont(QFont("Arial", 24, QFont.Bold))
        about_label.setAlignment(Qt.AlignLeft)
        about_label.setStyleSheet("color: white;")
        about_layout.addWidget(about_label)

        # Text box for additional information
        info_text_edit = QTextEdit()
        info_text_edit.setFont(QFont("Arial", 16))
        info_text_edit.setStyleSheet("color: white; background-color: #303030;")
        info_text_edit.setReadOnly(True)  # Make the text box read-only
        info_text_edit.setText(
            "EmuCenter is a powerful emulator front-end designed to provide a seamless experience for managing and launching your favorite games.\n\n"
            "Features:\n"
            "- Customizable templates for emulators\n"
            "- User scalable\n"
            "- XInput controller support\n"
            "- Touch support\n"
            "- Sorting by alphabetical order or emulator\n"
            "- Fullscreen mode\n"
            "- Customizable game grid\n\n"
        
            "For more information/documentation, visit https://github.com/Maxsafer/emuCenter\n"
            "Developed with love by Maxsafer aka classman."
        )
        about_layout.addWidget(info_text_edit)

        about_widget.setLayout(about_layout)
        about_widget.setAutoFillBackground(True)
        about_palette = about_widget.palette()
        about_palette.setColor(QPalette.Window, QColor(30, 30, 30))
        about_widget.setPalette(about_palette)

        self.stacked_widget.addWidget(home_widget)
        self.stacked_widget.addWidget(settings_scroll_area)  # Add the scroll area
        self.stacked_widget.addWidget(about_widget)

        nav_button1.clicked.connect(lambda: self.stacked_widget.setCurrentWidget(home_widget))
        nav_button2.clicked.connect(lambda: self.stacked_widget.setCurrentWidget(self.stacked_widget.widget(1)))
        nav_button4.clicked.connect(QApplication.quit)

        # Add hamburger button and nav_widget to the main layout
        nav_layout = QHBoxLayout()  # Changed to QHBoxLayout
        nav_layout.addWidget(self.hamburger_button)
        nav_layout.addWidget(self.nav_widget)
        nav_layout.addStretch(1)

        main_layout.addLayout(nav_layout)
        main_layout.addWidget(self.stacked_widget)

        central_widget.setLayout(main_layout)

        # Create menu bar
        self.create_menu_bar()

        # Apply fullscreen setting
        if self.fullscreen:
            self.showFullScreen()

        games = self.get_games_names()

        for game in games.get('list_games'):
            self.add_game_to_grid(game)
        self.recalculate_grid_layout()
    
    def on_screen_touched(self):
        self.screen_touched = True  # Set the flag when the screen is touched

    def update_sort_by_setting(self, sort_by_value):
        self.update_settings('MainWindow', 'sort_by', sort_by_value)
        self.sort_by = sort_by_value
        self.recalculate_grid_layout()

    def get_emulators(self):
        temp_descs = {}
        for key, value in self.config.items('Settings'):
            self.emulators.append(key)
            temp_descs[key] = value
        return temp_descs

    def set_emulator(self, path):
        for emulator in self.emulators:
            if emulator in path:
                return emulator
        else:
            return ''

    def get_games_names(self):
        excluded_extensions = []
        games_names = []
        games_paths = []
        emulators_games = {}
        templates = {}

        for key, value in self.config.items('MainWindow'):
            if "exclude" in key:
                excluded_extensions = value.replace(" ","").split(",")
            else:
                excluded_extensions = [".bin",".sav",".txt","shortcuts",".sgm",".srm"]


        for key, value in self.config.items('Emulators'):
            if "exe" in value:
                emulators_games[os.path.dirname(value)] = [value]
            else:
                games_paths.append(value)

        for key, value in self.config.items('Templates'):
            templates[key] = value

        for game_path in games_paths:
            if os.path.exists(game_path):
                files = os.listdir(game_path)
                files = [file for file in files if not any(file.endswith(ext) for ext in excluded_extensions)]
                emulators_games[os.path.dirname(game_path)] += files

                set_emu = self.set_emulator(emulators_games[os.path.dirname(game_path)][0].lower())
                    
                self.game_executables += [templates[set_emu].replace("exepath", emulators_games[os.path.dirname(game_path)][0]).replace("game", f'"{os.path.join(game_path, file)}"') for file in emulators_games[os.path.dirname(game_path)] if "exe" not in file]
                games_names += files
            
            else:
                print("Path does not exist: ", game_path)

        return {'total_games':len(games_names), 'list_games':games_names}
    
    def show_popup(self):
        # Show the custom popup message
        msg_box = CustomMessageBox()

    def create_menu_bar(self):
        menu_bar = self.menuBar()

        # Add "System" menu
        file_menu = menu_bar.addMenu('System')

        # Add "Games" action
        games_action = QAction('Games', self)
        games_action.triggered.connect(lambda: self.stacked_widget.setCurrentWidget(self.stacked_widget.widget(0)))
        file_menu.addAction(games_action)

        # Add "Reload" action
        reload_action = QAction('Reload', self)
        reload_action.triggered.connect(lambda: self.restart())
        file_menu.addAction(reload_action)

        # Add "Settings" action
        settings_action = QAction('Settings', self)
        settings_action.triggered.connect(lambda: self.stacked_widget.setCurrentWidget(self.stacked_widget.widget(1)))
        file_menu.addAction(settings_action)

        # Add "Exit" action
        exit_action = QAction('Exit', self)
        exit_action.triggered.connect(QApplication.quit)
        file_menu.addAction(exit_action)

        # Add "View" menu
        view_menu = menu_bar.addMenu('View')

        # Add "Fullscreen" action
        fullscreen_action = QAction('Fullscreen', self)
        fullscreen_action.setCheckable(True)
        fullscreen_action.setChecked(self.fullscreen)
        fullscreen_action.triggered.connect(self.toggle_fullscreen_menu)
        view_menu.addAction(fullscreen_action)

        # Add "About" menu
        about_menu = menu_bar.addMenu('Help')

        about_action = QAction('About', self)
        about_action.triggered.connect(lambda: self.stacked_widget.setCurrentWidget(self.stacked_widget.widget(2)))
        about_menu.addAction(about_action)

    def toggle_fullscreen_menu(self, checked):
        if checked:
            self.showFullScreen()
        else:
            self.showNormal()
        self.recalculate_grid_layout()

    def update_fullscreen_setting(self, state):
        checked = state == Qt.Checked
        self.update_settings('MainWindow', 'fullscreen', 'yes' if checked else 'no')

    def update_navbar_setting(self, state):
        checked = state == Qt.Checked
        self.update_settings('MainWindow', 'navbar', 'yes' if checked else 'no')

    def add_emulator_section(self, layout, label_text, exe_key, games_key, button_label):
        label = QLabel(f"\n{label_text}")
        label.setFont(QFont("Arial", 18))
        label.setStyleSheet("color: white;")
        exe_path_label = QLabel(f"Emulator path: {self.get_emulator_path(exe_key)}")
        exe_path_label.setFont(QFont("Arial", 10))
        exe_path_label.setStyleSheet("color: white;")
        games_path_label = QLabel(f"Games path: {self.get_emulator_path(games_key)}")
        games_path_label.setFont(QFont("Arial", 10))
        games_path_label.setStyleSheet("color: white;")

        button_layout = QHBoxLayout()
        exe_button = QPushButton(f"Select {button_label}")
        games_button = QPushButton("Games")
        self.style_button(exe_button)
        self.style_button(games_button)
        exe_button.clicked.connect(lambda: self.select_exe(exe_key, f"Select {button_label}", exe_path_label))
        games_button.clicked.connect(lambda: self.select_folder(games_key, "Select Games Folder", games_path_label))

        button_layout.addWidget(exe_button)
        button_layout.addWidget(games_button)

        layout.addWidget(label)
        layout.addWidget(exe_path_label)
        layout.addWidget(games_path_label)
        layout.addLayout(button_layout)

    def select_exe(self, config_key, dialog_title, path_label):
        options = QFileDialog.Options()
        file_path, _ = QFileDialog.getOpenFileName(self, dialog_title, "", "Executable Files (*.exe);;All Files (*)", options=options)
        if file_path:
            self.update_settings('Emulators', config_key, file_path)
            path_label.setText(f"Emulator path: {file_path}")

    def select_folder(self, config_key, dialog_title, path_label):
        options = QFileDialog.Options()
        folder_path = QFileDialog.getExistingDirectory(self, dialog_title, options=options)
        if folder_path:
            self.update_settings('Emulators', config_key, folder_path)
            path_label.setText(f"Games path: {folder_path}")

    def get_emulator_path(self, config_key):
        return self.config.get('Emulators', config_key, fallback="No path selected")

    def update_settings(self, section, key, value):
        if not self.config.has_section(section):
            self.config.add_section(section)
        self.config.set(section, key, value)
        with open('settings.ini', 'w') as configfile:
            self.config.write(configfile)

    def style_button(self, button):
        button.setStyleSheet("""
            QPushButton {
                background-color: #2a2a2a;
                color: white;
                border: none;
                padding: 10px;
                font-family: Arial;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #3a3a3a;
            }
            QPushButton:pressed {
                background-color: #1a1a1a;
            }
        """)
        button.setCursor(Qt.PointingHandCursor)

    def command_cleaner(self, command):
        # splitted = command.split("/")
        # to_replace = ''
        # for x,piece in enumerate(splitted):
        #     if ":" in piece and x != 0:
        #         to_replace += splitted[x].split(" ")[0]
        #         break
        #     to_replace += piece+"/"
        
        # if " " in to_replace: 
        #     to_replace_split = to_replace.split("/")
        #     new = ''
        #     for x,piece in enumerate(to_replace_split):
        #         if " " in piece:
        #             new += f'"{piece}"'+"/"
        #         elif x != len(to_replace_split) - 1:
        #             new += piece+"/"
        #         else:
        #             new += piece
        #     command = command.replace(to_replace, new)

        if "?" in command:
            commandsplt = command.split("?")
            command = commandsplt[0]
            scripts = commandsplt[1]

            if "," in scripts:
                scripts = scripts.split(",")
            else:
                scripts = [scripts]
            
            for script in scripts:
                script = script.split("=")
                self.run_command(f"{' '.join(script[0].split(':'))} {script[1].replace('emupath', os.path.dirname(command.split('"')[0]))}", popup=False)
                time.sleep(.5)
        return command.replace("/","\\")

    def run_command(self, command, popup:bool):
        print("Running command: ", command)
        worker = Worker(command)
        worker.output_signal.connect(self.display_output)
        worker.finished_signal.connect(lambda: self.worker_finished(worker))
        worker.start()
        self.active_workers.append(worker)  # Track active worker
        if popup:
            self.show_popup()

    def setup_shortcuts(self):
        quit_shortcut = QShortcut(QKeySequence("Ctrl+Q"), self)
        quit_shortcut.activated.connect(self.close)
        
        quit_shortcut2 = QShortcut(QKeySequence("Ctrl+C"), self)
        quit_shortcut2.activated.connect(self.close)
        
        quit_shortcut3 = QShortcut(QKeySequence("Esc"), self)
        quit_shortcut3.activated.connect(self.close)

    def worker_finished(self, worker):
        self.active_workers.remove(worker)
        worker.deleteLater()

    def closeEvent(self, event):
        for worker in self.active_workers:
            worker.wait()  # Wait for each worker to finish
        event.accept()

    def display_output(self, output):
        print(output)

    def add_game_to_grid(self, game_name):
        self.game_names.append(game_name)  # Store game name

    def sort_games(self):
        sorted_games = {}
        match self.sort_by:
            case 'alphabetical':
                for game in self.game_names:
                    sorted_games[game[0].upper()] = sorted_games.get(game[0].upper(),[]) + [game]
                sorted_games = {key: sorted_games[key] for key in sorted(sorted_games)}
                return sorted_games

            case 'emulator':
                for game in self.game_names:
                    emu = self.set_emulator(self.find_exec(game).lower())
                    sorted_games[emu] = sorted_games.get(emu,[]) + [game]
                sorted_games = {key: sorted_games[key] for key in sorted(sorted_games)}
                return sorted_games
            
            case _:
                for game in self.game_names:
                    sorted_games[game[0].upper()] = sorted_games.get(game[0].upper(),[]) + [game]
                sorted_games = {key: sorted_games[key] for key in sorted(sorted_games)}
                return sorted_games

    def recalculate_grid_layout(self):
        self.games_in_grid = []
        for i in reversed(range(self.grid_layout.count())):
            self.grid_layout.itemAt(i).widget().setParent(None)

        sorted_games = self.sort_games()
        current_letter = ""
        row = -1  # Start with -1 so the first increment sets it to 0
        col = 0
        button_margin = 25  # Margin around each button
        window_width = self.centralWidget().width()
        button_size = (window_width // 5) - button_margin * 2
        buttons_per_row = window_width // (button_size + button_margin * 2)

        for first_letter, game_names in sorted_games.items():
            for game_name in game_names:
                if first_letter != current_letter:
                    col = 0
                    row += 1
                    self.grid_layout.addWidget(QHLine(), row, col, 1, 5)
                    current_letter = first_letter
                    label = QLabel(current_letter)
                    if self.sort_by == 'alphabetical':
                        label.setFont(QFont("Arial", 35, QFont.Bold))
                    else:
                        label.setFont(QFont("Arial", (window_width // 30) - button_margin * 2, QFont.Bold))
                    label.setStyleSheet("color: white;")
                    self.grid_layout.addWidget(label, row, col, Qt.AlignCenter)
                    col += 1
                    self.games_in_grid.append([])  # Add new row for letter/emulator

                if col >= buttons_per_row:
                    col = 0
                    row += 1
                    self.games_in_grid.append([])  # Add new row for new line of games

                button = self._add_game_button(game_name, row, col)
                self.games_in_grid[-1].append(button)  # Add button to the latest row in the grid
                col += 1

        self.highlight_selected_game()

    def find_exec(self, game_name):
        for item in self.game_executables:
            if game_name in item:
                return item
        return ''  # Return '' if no match is found

    def _add_game_button(self, game_name, row, col):
        button_margin = 25  # Margin around each button
        window_width = self.centralWidget().width()
        button_size = (window_width // 5) - button_margin * 2

        button = QPushButton()
        self.style_button(button)
        button.setFixedSize(button_size, button_size)  # Set fixed size for the button
        button.clicked.connect(lambda: self.run_command(self.command_cleaner(self.find_exec(game_name)), popup=True))

        # Create a QLabel for the background text
        emu = self.set_emulator(self.find_exec(game_name).lower())
        pixmap = QPixmap(f"./images/{emu}.png")
        scaled_pixmap = pixmap.scaled(round(button_size/3), round(button_size/3), Qt.KeepAspectRatio, Qt.SmoothTransformation)
        background_label = QLabel(emu, button)
        background_label.setPixmap(scaled_pixmap)
        background_label.setAlignment(Qt.AlignCenter)
        background_label.setStyleSheet(f"""
            QLabel {{
                color: rgba(255, 255, 255, 70);  /* White text with 50% opacity */
                font-size: {max(5, button_size // 15)}px;
                font-family: Arial;
            }}
        """)

        # Create a QLabel to handle text wrapping for the main button text
        label = QLabel(game_name, button)
        label.setWordWrap(True)
        label.setAlignment(Qt.AlignCenter)
        label.setStyleSheet(f"""
            QLabel {{
                font-size: {max(15, button_size // 10)}px;
                font-family: Arial;
                color: white;
            }}
        """)

        # Create a layout for the button and add both labels
        layout = QVBoxLayout(button)
        layout.addWidget(background_label)
        layout.addWidget(label)
        button.setLayout(layout)

        self.grid_layout.addWidget(button, row, col)
        return button

    def resizeEvent(self, event):
        self.recalculate_grid_layout()
        super().resizeEvent(event)

    def highlight_selected_game(self):
        """
        Highlight the currently selected game in the grid.
        """
        if not self.games_in_grid:
            return  # If there are no games in the grid, do nothing
        
        if self.screen_touched:
            return  # Do not snap to the selected game if the screen was touched
        
        for row in range(len(self.games_in_grid)):
            for col in range(len(self.games_in_grid[row])):
                button = self.games_in_grid[row][col]
                if (row, col) == (self.selected_row, self.selected_col):
                    button.setStyleSheet("""
                        QPushButton {
                            background-color: #5a5a5a;
                            color: yellow;
                            border: 2px solid yellow;
                            padding: 10px;
                            font-family: Arial;
                            border-radius: 5px;
                        }
                    """)
                else:
                    self.style_button(button)

        # Ensure the selected game button is visible within the scroll area
        selected_button = self.games_in_grid[self.selected_row][self.selected_col]
        self.grid_scroll_area.ensureWidgetVisible(selected_button)

    def handle_dpad_input(self, dpad_state):
        if not self.games_in_grid:
            return  # If there are no games in the grid, do nothing
        
        if self.stacked_widget.currentWidget() != self.stacked_widget.widget(0):
            return

        if not any(dpad_state.values()):
            return  # If no D-Pad button is actually pressed, do nothing

        # Reset the screen_touched flag since a controller input was detected
        self.screen_touched = False

        current_row_games = self.games_in_grid[self.selected_row]
        current_col_max = len(current_row_games) - 1

        if dpad_state['up']:
            if self.selected_row > 0:
                self.selected_row -= 1
                if self.selected_row == 0:
                    self.selected_col = max(0, self.selected_col - 1)  # Adjust for offset when moving to the first row
        elif dpad_state['down']:
            if self.selected_row < len(self.games_in_grid) - 1:
                self.selected_row += 1
                if self.selected_row == 1:
                    self.selected_col = min(current_col_max + 1, self.selected_col + 1)  # Adjust for offset when moving from the first row
        elif dpad_state['left']:
            self.selected_col = max(0, self.selected_col - 1)
        elif dpad_state['right']:
            self.selected_col = min(current_col_max, self.selected_col + 1)

        # Adjust column position if the new row has fewer columns
        new_row_games = self.games_in_grid[self.selected_row]
        new_col_max = len(new_row_games) - 1
        self.selected_col = min(self.selected_col, new_col_max)

        self.highlight_selected_game()

    def handle_button_a(self):
        if self.stacked_widget.currentWidget() != self.stacked_widget.widget(0):
            return

        selected_button = self.games_in_grid[self.selected_row][self.selected_col]
        if isinstance(selected_button, QPushButton):
            selected_button.click()

    def handle_button_b(self):
        if self.stacked_widget.currentWidget() != self.stacked_widget.widget(0):
            return

        if self.nav_widget.isVisible():
            self.toggle_navbar()
        else:
            self.toggle_navbar()

    def handle_button_x(self):
        if self.stacked_widget.currentWidget() != self.stacked_widget.widget(0):
            return

        self.close()

    def handle_button_y(self):
        if self.stacked_widget.currentWidget() != self.stacked_widget.widget(0):
            return

        if self.sort_by == 'alphabetical':
            self.update_sort_by_setting('emulator')
        else:
            self.update_sort_by_setting('alphabetical')

        # Reset selected game to the first one
        self.selected_row = 0
        self.selected_col = 0
        self.highlight_selected_game()

    def init_xinput_handler(self):
        self.xinput_handler = XInputHandler(self.settings_label, self.buttons_label, self)
        self.xinput_handler.dpad_signal.connect(self.handle_dpad_input)
        self.xinput_handler.button_a_signal.connect(self.handle_button_a)
        self.xinput_handler.button_b_signal.connect(self.handle_button_b)
        self.xinput_handler.button_x_signal.connect(self.handle_button_x)
        self.xinput_handler.button_y_signal.connect(self.handle_button_y)

    def update_sort_by_setting(self, sort_by_value):
        self.update_settings('MainWindow', 'sort_by', sort_by_value)
        self.sort_by = sort_by_value
        self.selected_row = 0  # Reset the selected row
        self.selected_col = 0  # Reset the selected column
        self.recalculate_grid_layout()
        self.highlight_selected_game()

    def toggle_navbar(self):
        if self.nav_widget.isVisible():
            self.nav_widget.hide()
            self.hamburger_button.setText("☰")  # Show hamburger icon
        else:
            self.nav_widget.show()
            self.hamburger_button.setText("X")  # Show close icon

    def restart(self):
        QApplication.quit()  # Close the current instance of the application
        os.execl(sys.executable, sys.executable, *sys.argv)  # Restart the application

if __name__ == '__main__':
    config = configparser.ConfigParser()
    config.read('settings.ini')
    fullscreen = config.getboolean('MainWindow', 'fullscreen', fallback=False)
    navbar = config.getboolean('MainWindow', 'navbar', fallback=False)

    app = QApplication(sys.argv)
    main_window = MainWindow(fullscreen, navbar)
    main_window.show()
    sys.exit(app.exec_())