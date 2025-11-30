from PyQt5.QtWidgets import QLabel, QWidget, QFrame, QVBoxLayout, QHBoxLayout, QPushButton, QStackedWidget, QMainWindow, QAction, QDesktopWidget, QApplication, QCheckBox, QFileDialog, QScrollArea, QGridLayout, QScroller, QDialog, QShortcut, QMenu, QTextEdit, QComboBox, QListView, QGraphicsDropShadowEffect, QSlider
from PyQt5.QtGui import QFont, QColor, QPalette, QIcon, QPixmap, QKeySequence, QRegion, QPainterPath
from PyQt5.QtCore import Qt, QThread, pyqtSignal, QTimer, QUrl, QRunnable, QThreadPool, QObject, pyqtSlot
from functools import lru_cache
from PyQt5.QtMultimedia import QSoundEffect
from xinput_handler import XInputHandler
from xinput_utils import xinput_connected_indices
from virtual_pad_vg import VirtualX360
import hashlib, base64
import configparser
import subprocess
import platform
import time
import sys
import os
import re
import json

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

class ErrorDialog(QDialog):
    """Dialog to display initialization errors"""
    def __init__(self, errors):
        super().__init__()
        self.setWindowTitle("Configuration Errors")
        self.setFixedSize(600, 400)
        
        layout = QVBoxLayout()
        
        label = QLabel("The following errors were encountered during initialization:")
        label.setFont(QFont("Arial", 12, QFont.Bold))
        label.setStyleSheet("color: white;")
        label.setWordWrap(True)
        layout.addWidget(label)
        
        # Create a text area to display errors
        error_text = QTextEdit()
        error_text.setReadOnly(True)
        error_text.setFont(QFont("Arial", 10))
        error_text.setStyleSheet("color: white; background-color: #2a2a2a;")
        error_text.setText("\n".join(errors))
        layout.addWidget(error_text)
        
        # Add OK button
        ok_button = QPushButton("OK")
        ok_button.setStyleSheet("""
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
        ok_button.clicked.connect(self.accept)
        layout.addWidget(ok_button)
        
        self.setLayout(layout)
        self.setStyleSheet("background-color: #303030;")
        
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

class ImageCache:
    def __init__(self):
        self.cache = {}

    def get(self, key):
        return self.cache.get(key)

    def put(self, key, pixmap):
        self.cache[key] = pixmap

class WorkerSignals(QObject):
    finished = pyqtSignal()
    result = pyqtSignal(object)

class ImageLoader(QRunnable):
    def __init__(self, path, size, mode='inner'):
        super(ImageLoader, self).__init__()
        self.path = path
        self.size = size
        self.mode = mode # 'inner' or 'button'
        self.signals = WorkerSignals()

    @pyqtSlot()
    def run(self):
        try:
            if not os.path.exists(self.path):
                self.signals.result.emit(None)
                return

            pixmap = QPixmap(self.path)
            if pixmap.isNull():
                self.signals.result.emit(None)
                return

            if self.mode == 'inner':
                # Scale for inner button content (keep aspect ratio by expanding)
                scaled_pixmap = pixmap.scaled(self.size, self.size, Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation)
            else:
                # Scale for other uses if needed
                scaled_pixmap = pixmap.scaled(self.size, self.size, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            
            self.signals.result.emit(scaled_pixmap)
        except Exception as e:
            print(f"Error loading image {self.path}: {e}")
            self.signals.result.emit(None)
        finally:
            self.signals.finished.emit()


class QHLine(QFrame):
    def __init__(self):
        super(QHLine, self).__init__()
        self.setFrameShape(QFrame.HLine)
        self.setFrameShadow(QFrame.Sunken)

class TouchScrollArea(QScrollArea):
    screenTouched = pyqtSignal()  # Signal to indicate that the screen was touched

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def mousePressEvent(self, event):
        self.screenTouched.emit()  # Emit the signal when the screen is touched
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        self.screenTouched.emit()  # Emit the signal when the screen is touched
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        self.screenTouched.emit()  # Emit the signal when the screen is touched
        super().mouseReleaseEvent(event)



class TransparentComboBox(QComboBox):
    """QComboBox with transparent popup background for liquid glass effect"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._popup_configured = False
    
    def showPopup(self):
        # Apply styling BEFORE showing popup
        self._apply_popup_styling()
        super().showPopup()
        # Apply again after showing to catch any newly created widgets
        QTimer.singleShot(0, self._apply_popup_styling)
    
    def _apply_popup_styling(self):
        """Apply liquid glass styling to popup and all parent containers"""
        # Get the view and configure it
        view = self.view()
        if not view:
            return
        
        # Configure the popup window directly
        popup_window = view.window()
        if popup_window:
            try:
                popup_window.setWindowFlags(Qt.Popup | Qt.FramelessWindowHint | Qt.NoDropShadowWindowHint)
                popup_window.setAttribute(Qt.WA_TranslucentBackground)
            except:
                pass

class Blocker(QWidget):
    """
    A full‐window, transparent widget that
    (a) eats all mouse events, and
    (b) forces a BlankCursor.
    """
    def __init__(self, parent):
        super().__init__(parent)
        # cover the entire parent
        self.setGeometry(parent.rect())
        # make sure it’s on top
        self.setAttribute(Qt.WA_NoSystemBackground)
        self.setAttribute(Qt.WA_TransparentForMouseEvents, False)
        self.setWindowFlags(Qt.Widget | Qt.FramelessWindowHint)
        # transparent paint
        self.setStyleSheet("background: rgba(0,0,0,0%);")
        # always hide cursor when over this widget
        self.setCursor(Qt.BlankCursor)
        self.hide()

    def resizeEvent(self, event):
        # keep covering parent when it resizes
        self.setGeometry(self.parent().rect())
        super().resizeEvent(event)

    def mousePressEvent(self, event):
        # eat everything
        event.accept()
    def mouseReleaseEvent(self, event):
        event.accept()
    def mouseMoveEvent(self, event):
        event.accept()
    def wheelEvent(self, event):
        event.accept()

class MainWindow(QMainWindow):
    def __init__(self, fullscreen=False, navbar=True, sort_by='alphabetical'):
        super().__init__()
        self.fullscreen = fullscreen
        self.navbar_visible = navbar
        self.sort_by = sort_by
        self.CACHE_FILE = 'games_cache.json'
        self.config = configparser.ConfigParser()
        file_path = 'settings.ini'
        self.selected_row = -1  # Track the selected row in the grid
        self.selected_col = -1  # Track the selected column in the grid
        self.show_all_overlays = False # Flag to toggle game overlays
        self.games_in_grid = []  # Track the games in the grid layout
        self.screen_touched = True  # Flag to track if the screen was touched (default to True for touch-first experience)

        self.config.read(file_path)
        self.vpad_enabled = self.config.getboolean('MainWindow', 'virtual_controller', fallback=True)
        self.preferred_controller_idx = self.config.getint('MainWindow', 'preferred_controller', fallback=-1)
        self.simplified_ui = self.config.getboolean('MainWindow', 'simplified_ui', fallback=False)
        self.vpad = None
        self.ignored_xinput_indices = []

        if self.vpad_enabled:
            beforexinput = xinput_connected_indices()
            self.vpad = VirtualX360(poll_hz=250, idle_hold_ms=500)
            try:
                self.vpad.start()
                afterxinput = xinput_connected_indices()
                diff = afterxinput - beforexinput
                self.ignored_xinput_indices = list(diff) if diff else []
            except Exception as e:
                print(self, "Virtual Pad", f"Failed to start virtual pad:\n{e}")
                self.vpad = None

        # Set the window icon
        self.setWindowIcon(QIcon('images/logo.png'))

        # Check if the file exists
        if not os.path.exists(file_path):
            # If the file does not exist, create it
            self.config['MainWindow'] = {'fullscreen': 'no', 'navbar': 'no', 'sort_by': 'alphabetical', 'virtual_controller': 'no'}
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
        self.game_to_emulator = {} # Map game name to emulator
        self.available_game_images = None # Cache for available game images
        self.game_executables = []
        self.emulators = []
        self.games_loaded = False # Flag to track if games are loaded
        self.init_errors = []  # Track initialization errors
        
        # Initialize navigation sound
        self.nav_sound = QSoundEffect()
        self.nav_sound.setSource(QUrl.fromLocalFile("./sounds/navigation-sfx.wav"))
        self.nav_volume = self.config.getint('MainWindow', 'nav_sound_volume', fallback=75)
        self.nav_sound.setVolume(self.nav_volume / 100.0)
        
        # Favorites system
        self.favorite_games = set()  # Track favorited game names
        self.current_grid = 'main'  # Track which grid is displayed ('main' or 'favorites')
        self.load_favorites()  # Load favorites from settings.ini
        
        self.game_cache = {}  # Cache for sorted game lists
        
        # Image loading optimization
        self.thread_pool = QThreadPool()
        self.image_cache = ImageCache()

        self.init_ui()
        self._blocker = Blocker(self)
        self.setup_shortcuts()
        self.highlight_selected_game()
        self.init_xinput_handler()

    def init_ui(self):
        self.setWindowTitle('EmuCenter v1.1')
        # ... (existing code) ...
        
        self.setFixedSize(1500, 1000)
        centerPoint = QDesktopWidget().availableGeometry().center()
        qtRectangle = self.frameGeometry()
        qtRectangle.moveCenter(centerPoint)
        self.move(qtRectangle.topLeft())

        # Create the main widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        self.setStyleSheet("""
            QMainWindow {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #0f0c29, stop:0.5 #302b63, stop:1 #24243e);
            }
            QScrollBar:vertical {
                border: none;
                background: rgba(0, 0, 0, 0);
                width: 10px;
                margin: 0px 0px 0px 0px;
            }
            QScrollBar::handle:vertical {
                background: rgba(255, 255, 255, 30);
                min-height: 20px;
                border-radius: 5px;
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                border: none;
                background: none;
            }
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {
                background: none;
            }
            QScrollBar:horizontal {
                border: none;
                background: rgba(0, 0, 0, 0);
                height: 10px;
                margin: 0px 0px 0px 0px;
            }
            QScrollBar::handle:horizontal {
                background: rgba(255, 255, 255, 30);
                min-width: 20px;
                border-radius: 5px;
            }
            QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {
                border: none;
                background: none;
            }
            QScrollBar::add-page:horizontal, QScrollBar::sub-page:horizontal {
                background: none;
            }
        """)  # Set background color and scrollbar style

        main_layout = QVBoxLayout()  # Changed to QVBoxLayout

        # Hamburger menu button
        self.hamburger_button = QPushButton()
        self.hamburger_button.setFixedSize(100, 60)
        self.hamburger_button.setText("☰")
        self.hamburger_button.setStyleSheet("background-color: #2a2a2a; border: none;")
        self.hamburger_button.clicked.connect(self.toggle_navbar)
        self.style_button(self.hamburger_button)

        # Navigation bar
        self.nav_layout = QHBoxLayout()  # Changed to QHBoxLayout
        nav_button1 = QPushButton("Games")
        nav_button2 = QPushButton("Settings")
        nav_button4 = QPushButton("Exit")

        nav_button1.setFixedSize(200, 60)
        nav_button2.setFixedSize(200, 60)
        nav_button4.setFixedSize(200, 60)

        self.style_button(nav_button1)
        self.style_button(nav_button2)
        self.style_button(nav_button4)

        nav_button1.setFont(QFont("Arial", self.centralWidget().width() // 40, QFont.Bold))
        nav_button2.setFont(QFont("Arial", self.centralWidget().width() // 40, QFont.Bold))
        nav_button4.setFont(QFont("Arial", self.centralWidget().width() // 40, QFont.Bold))

        # Create the dropdown menu
        dropdown_button = QPushButton()
        self.style_button(dropdown_button)

        dropdown_button.setText("Order by")
        dropdown_button.setFixedSize(200, 60)
        dropdown_button.setFont(QFont("Arial", self.centralWidget().width() // 40, QFont.Bold))

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
                background-color: rgba(15, 12, 41, 230);
                color: white;
                font-size: 100px;
                border: 1px solid rgba(255, 255, 255, 30);
                border-radius: 10px;
            }
            QMenu::item {
                background-color: transparent;
                color: white;
            }
            QMenu::item:selected {
                background-color: rgba(255, 255, 255, 15);
                color: white;
            }
        """)
        dropdown_menu.setWindowFlags(dropdown_menu.windowFlags() | Qt.FramelessWindowHint | Qt.NoDropShadowWindowHint)
        dropdown_menu.setAttribute(Qt.WA_TranslucentBackground)
        dropdown_button.setMenu(dropdown_menu)

        # --- Primary Controller (nav) ---
        self.nav_controller_combo = TransparentComboBox()
        self.nav_controller_combo.setFixedSize(200, 60)
        self.nav_controller_combo.setFont(QFont("Arial", self.centralWidget().width() // 40, QFont.Bold))
        self.nav_controller_combo.setView(QListView())
        self.nav_controller_combo.view().setMinimumWidth(self.centralWidget().width())
        
        dynamic_font_size = self.centralWidget().width() // 30
        self.nav_controller_combo.setStyleSheet(f"""
            QComboBox {{
                background-color: rgba(255, 255, 255, 10);
                color: white;
                border: 1px solid rgba(255, 255, 255, 30);
                border-radius: 20px;
                padding: 10px 20px;
                font-size: {dynamic_font_size}px;
            }}
            QComboBox::drop-down {{
                border: none;
            }}
            QComboBox:down-arrow {{
                image: none;
            }}
            QComboBox QAbstractItemView {{
                background-color: rgba(15, 12, 41, 230);
                color: white;
                selection-background-color: rgba(255, 255, 255, 0);
                border: 1px solid rgba(255, 255, 255, 30);
                outline: 0;
                font-size: 100px;
                border-radius: 10px;
            }}
            QComboBox QAbstractItemView::item {{
                min-height: 100px;
                padding: 20px 40px;
            }}
            QComboBox QAbstractItemView::item:selected {{
                background-color: rgba(255, 255, 255, 15);
                color: white;
                border-radius: 5px;
            }}
        """)

        self.populate_any_controller_combo(self.nav_controller_combo)
        
        self.nav_controller_combo.activated.connect(
            lambda _: (self.on_controller_changed_from(self.nav_controller_combo), self.populate_any_controller_combo(self.nav_controller_combo))
        )

        self.nav_layout.addWidget(nav_button1)
        self.nav_layout.addWidget(dropdown_button)
        self.nav_layout.addWidget(self.nav_controller_combo)
        self.nav_layout.addWidget(nav_button2)
        self.nav_layout.addWidget(nav_button4)
        self.nav_layout.addStretch(1)

        self.nav_widget = QWidget()
        self.nav_widget.setLayout(self.nav_layout)
        self.nav_widget.setLayout(self.nav_layout)
        self.nav_widget.setStyleSheet("background-color: transparent;")

        if not self.navbar_visible:
            self.nav_widget.hide()

        # Stacked widget
        self.stacked_widget = QStackedWidget()

        # Home screen with grid
        home_widget = QWidget()
        home_layout = QVBoxLayout()

        self.grid_scroll_area = TouchScrollArea()  # Use the custom TouchScrollArea
        self.grid_scroll_area.setWidgetResizable(True)
        self.grid_scroll_area.setStyleSheet("background-color: transparent; border: none;")  # Set background color for scroll area
        grid_widget = QWidget()
        grid_widget.setStyleSheet("background-color: transparent;")  # Set background color for grid widget
        self.grid_layout = QGridLayout(grid_widget)
        self.grid_scroll_area.setWidget(grid_widget)

        self.grid_scroll_area.screenTouched.connect(self.on_screen_touched)  # Connect the signal to the handler

        # Enable touch scrolling
        QScroller.grabGesture(self.grid_scroll_area.viewport(), QScroller.LeftMouseButtonGesture)

        home_layout.addWidget(self.grid_scroll_area)
        home_widget.setLayout(home_layout)
        home_widget.setLayout(home_layout)
        home_widget.setStyleSheet("background-color: transparent;")

        # Settings screen with scroll area
        settings_scroll_area = QScrollArea()
        settings_scroll_area.setWidgetResizable(True)
        settings_scroll_area.setStyleSheet("background-color: transparent; border: none;")  # Set background color for scroll area
        settings_widget = QWidget()
        settings_widget.setStyleSheet("background-color: transparent;")  # Set background color for settings widget
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
        
        # Volume Control
        self.volume_label = QLabel(f"Navigation Volume: {self.nav_volume}%")
        self.volume_label.setFont(QFont("Arial", 18))
        self.volume_label.setStyleSheet("color: white;")
        
        self.volume_slider = QSlider(Qt.Horizontal)
        self.volume_slider.setMinimum(0)
        self.volume_slider.setMaximum(100)
        self.volume_slider.setValue(self.nav_volume)
        self.volume_slider.setTickPosition(QSlider.TicksBelow)
        self.volume_slider.setTickInterval(10)
        self.volume_slider.setStyleSheet("""
            QSlider {
                min-height: 75px;
            }
            QSlider::groove:horizontal {
                background: rgba(255, 255, 255, 10);
                border: 1px solid rgba(255, 255, 255, 30);
                height: 15px;
                margin: 2px 0;
                border-radius: 5px;
            }
            QSlider::handle:horizontal {
                background: rgba(255, 255, 255, 255);
                border: 1px solid rgba(255, 255, 255, 50);
                width: 70px;
                height: 70px;
                margin: -11px 0;
                border-radius: 15px;
            }
            QSlider::sub-page:horizontal {
                background: rgba(255, 255, 255, 30);
                border-radius: 5px;
            }
            QSlider::add-page:horizontal {
                background: rgba(255, 255, 255, 5);
                border-radius: 5px;
            }
        """)
        self.volume_slider.valueChanged.connect(self.update_volume_setting)

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
        
        self.simplified_ui_checkbox = QCheckBox("Simplified UI (disables game covers for better performance)")
        self.simplified_ui_checkbox.setFont(QFont("Arial", 18))
        self.simplified_ui_checkbox.setStyleSheet("color: white;")
        self.simplified_ui_checkbox.setChecked(self.simplified_ui)
        self.simplified_ui_checkbox.stateChanged.connect(self.update_simplified_ui_setting)
        settings_layout.addWidget(self.simplified_ui_checkbox)
        
        settings_layout.addWidget(self.volume_label)
        settings_layout.addWidget(self.volume_slider)

        self.input_label = QLabel("\nInput")
        self.input_label.setFont(QFont("Arial", 25, 100))
        self.input_label.setStyleSheet("color: white;")
        settings_layout.addWidget(self.input_label)

        self.vpad_checkbox = QCheckBox("Enable virtual controller (ViGEm)")
        self.vpad_checkbox.setFont(QFont("Arial", 18))
        self.vpad_checkbox.setStyleSheet("color: white;")
        self.vpad_checkbox.setChecked(self.vpad_enabled)
        self.vpad_checkbox.stateChanged.connect(self.on_vpad_checkbox_changed)

        self.controller_label = QLabel("Enable a primary controller?")
        self.controller_label.setFont(QFont("Arial", 18, QFont.Bold))
        self.controller_label.setStyleSheet("color: white;")

        self.controller_combo = TransparentComboBox()
        self.controller_combo.setView(QListView())
        self.controller_combo.setStyleSheet("""
            QComboBox {
                background-color: rgba(255, 255, 255, 10);
                color: white;
                border: 1px solid rgba(255, 255, 255, 30);
                border-radius: 20px;
                padding: 10px 20px;
            }
            QComboBox::drop-down {
                border: none;
            }
            QComboBox QAbstractItemView {
                background-color: rgba(15, 12, 41, 240);
                color: white;
                selection-background-color: rgba(255, 255, 255, 0);
                border: 1px solid rgba(255, 255, 255, 30);
                font-size: 50px;
                outline: 0;
                border-radius: 10px;
            }
            QComboBox QAbstractItemView::item:selected {
                background-color: rgba(255, 255, 255, 15);
                color: white;
                border-radius: 5px;
            }
        """)
        self.controller_combo.setFont(QFont("Arial", self.centralWidget().width() // 40))
        self.populate_controller_combo()
        self.controller_combo.activated.connect(self.on_controller_changed)

        settings_layout.addWidget(self.controller_label)
        settings_layout.addWidget(self.controller_combo)
        settings_layout.addWidget(self.vpad_checkbox)
        settings_layout.addWidget(self.buttons_label)
        settings_layout.addWidget(self.settings_label)

        settings_layout.addWidget(self.emulator_label)

        emulators_desc = self.get_emulators()

        for emulator in self.emulators:
            self.add_emulator_section(settings_layout, f"{emulator.upper()} ({emulators_desc.get(emulator)})", f'{emulator.lower()}Path', f'{emulator.lower()}GamesPath', f"{emulator}")

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
        about_label = QLabel("EmuCenter version 2.0.0")
        about_label.setFont(QFont("Arial", 24, QFont.Bold))
        about_label.setAlignment(Qt.AlignLeft)
        about_label.setStyleSheet("color: white;")
        about_layout.addWidget(about_label)

        # Text box for additional information
        info_text_edit = QTextEdit()
        info_text_edit.setFont(QFont("Arial", 16))
        info_text_edit.setStyleSheet("color: white; background-color: rgba(255, 255, 255, 5)")
        info_text_edit.setReadOnly(True)  # Make the text box read-only
        info_text_edit.setText(
            "EmuCenter version 2.0.0 is a powerful emulator front-end designed to provide a seamless experience for managing and launching your favorite games.\n\n"
            "For more information/documentation, visit    https://github.com/Maxsafer/emuCenter\n"

            "Developed with love by Maxsafer, aka classman."
        )
        about_layout.addWidget(info_text_edit)

        about_widget.setLayout(about_layout)
        about_widget.setAutoFillBackground(True)
        about_palette = about_widget.palette()
        about_palette.setColor(QPalette.Window, QColor(255, 255, 255, 5))
        about_widget.setPalette(about_palette)

        self.stacked_widget.addWidget(home_widget)
        self.stacked_widget.addWidget(settings_scroll_area)  # Add the scroll area
        self.stacked_widget.addWidget(about_widget)

        nav_button1.clicked.connect(lambda: (self.stacked_widget.setCurrentWidget(home_widget),
                                     self.populate_controller_combo(),
                                     self.populate_any_controller_combo(self.nav_controller_combo),
                                     self.reset_selection_mode()))
        
        nav_button2.clicked.connect(lambda: (self.populate_controller_combo(),
                                     self.populate_any_controller_combo(self.nav_controller_combo),
                                     self.stacked_widget.setCurrentWidget(self.stacked_widget.widget(1))))
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
        
        self.games_loaded = True
        self.load_game_cache()
        self.recalculate_grid_layout()
        
        # Show error popup if there were any initialization errors
        if self.init_errors:
            ErrorDialog(self.init_errors)
    
    def populate_any_controller_combo(self, combo: QComboBox):
        try:
            indices = sorted(list(xinput_connected_indices()))
        except Exception:
            indices = []
        combo.blockSignals(True)
        combo.clear()
        combo.addItem("None", -1)
        for idx in indices:
            combo.addItem(f"XInput {idx}", idx)
        pos = combo.findData(self.preferred_controller_idx)
        combo.setCurrentIndex(0 if pos < 0 else pos)
        combo.blockSignals(False)

    def populate_controller_combo(self):
        self.populate_any_controller_combo(self.controller_combo)

    def on_controller_changed_from(self, combo: QComboBox):
        data = combo.currentData()
        self.preferred_controller_idx = int(data) if data is not None else -1
        self.update_settings('MainWindow', 'preferred_controller', str(self.preferred_controller_idx))
        # sync the other combo(s)
        if hasattr(self, 'controller_combo') and combo is not self.controller_combo:
            self.populate_any_controller_combo(self.controller_combo)
        if hasattr(self, 'nav_controller_combo') and combo is not self.nav_controller_combo:
            self.populate_any_controller_combo(self.nav_controller_combo)

    def on_controller_changed(self, _):
        self.on_controller_changed_from(self.controller_combo)

    def on_vpad_checkbox_changed(self, state):
        enabled = (state == Qt.Checked)
        # persist setting
        self.update_settings('MainWindow', 'virtual_controller', 'yes' if enabled else 'no')
        self.vpad_enabled = enabled

        if enabled and self.vpad is None:
            # (re)start vpad and recompute ignore index
            beforexinput = xinput_connected_indices()
            self.vpad = VirtualX360(poll_hz=250, idle_hold_ms=500)
            try:
                self.vpad.start()
                afterxinput = xinput_connected_indices()
                diff = afterxinput - beforexinput
                self.ignored_xinput_indices = list(diff) if diff else []
            except Exception as e:
                print(self, "Virtual Pad", f"Failed to start virtual pad:\n{e}")
                self.vpad = None
                # roll back checkbox if start failed
                self.vpad_checkbox.blockSignals(True)
                self.vpad_checkbox.setChecked(False)
                self.vpad_checkbox.blockSignals(False)
                self.ignored_xinput_indices = []
        elif not enabled and self.vpad is not None:
            # stop vpad and clear ignore index
            try:
                self.vpad.stop()
            except Exception as e:
                print(f"Error stopping vpad: {e}")
            self.vpad = None
            self.ignored_xinput_indices = []

        # inform the handler about new ignore set, if it exists
        if hasattr(self, 'xinput_handler'):
            try:
                self.xinput_handler.set_ignore_indices(self.ignored_xinput_indices)
            except Exception:
                pass
            
        self.populate_controller_combo()
        if hasattr(self, 'nav_controller_combo'):
            self.populate_any_controller_combo(self.nav_controller_combo)

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
                break
            else:
                excluded_extensions = [".bin",".sav",".txt","shortcuts",".sgm",".srm","backups"]


        for key, value in self.config.items('Emulators'):
            # Check if this is an emulator executable path or a games directory path
            # Keys ending with "gamespath" are game directories, others are emulator executables
            if key.lower().endswith('gamespath'):
                games_paths.append(value)
            else:
                # This is an emulator executable path
                emulators_games[os.path.dirname(value)] = [value]

        for key, value in self.config.items('Templates'):
            templates[key] = value

        for game_path in games_paths:
            try:
                if not os.path.exists(game_path):
                    error_msg = f"Path does not exist: {game_path}"
                    print(error_msg)
                    self.init_errors.append(error_msg)
                    continue
                
                if not os.path.isdir(game_path):
                    error_msg = f"Path is not a directory: {game_path}"
                    print(error_msg)
                    self.init_errors.append(error_msg)
                    continue
                
                files = os.listdir(game_path)
                files2 = []
                for file in files:
                    if not any(file.endswith(ext) for ext in excluded_extensions):
                        if file in games_names:
                            old_path = os.path.join(game_path, file)
                            root, ext = os.path.splitext(file)
                            id = self.emu_tag(game_path, k=3)
                            new_name = f"{root}.{id}{ext}"
                            new_path = os.path.join(game_path, new_name)
                            # avoid collision if the target already exists
                            i = 2
                            while os.path.exists(new_path):
                                new_name = f"{root}.{id}-{i}{ext}"
                                new_path = os.path.join(game_path, new_name)
                                i += 1
                            os.rename(old_path, new_path)
                            files2.append(new_name)
                        else:
                            files2.append(file)
                emulators_games[os.path.dirname(game_path)] += files2

                set_emu = self.set_emulator(emulators_games[os.path.dirname(game_path)][0].lower())
                emulator_basename = os.path.basename(emulators_games[os.path.dirname(game_path)][0])
                    
                self.game_executables += [templates[set_emu].replace("exepath", emulators_games[os.path.dirname(game_path)][0]).replace("game", f'"{os.path.join(game_path, file)}"') for file in emulators_games[os.path.dirname(game_path)] if file != emulator_basename]
                games_names += files2
                
                # Populate game_to_emulator map
                for game in files2:
                    self.game_to_emulator[game] = set_emu
            except Exception as e:
                error_msg = f"Error processing path '{game_path}': {str(e)}"
                print(error_msg)
                self.init_errors.append(error_msg)

        return {'total_games':len(games_names), 'list_games':games_names}
    
    def emu_tag(self, emulator_name, k=3):
        h = hashlib.sha1(emulator_name.lower().encode()).digest()
        return base64.b32encode(h).decode().lower().replace('=', '')[:k]

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
    
    def update_simplified_ui_setting(self, state):
        checked = state == Qt.Checked
        self.update_settings('MainWindow', 'simplified_ui', 'yes' if checked else 'no')
        self.simplified_ui = checked

    def update_volume_setting(self, value):
        self.nav_volume = value
        self.nav_sound.setVolume(value / 100.0)
        self.volume_label.setText(f"Navigation Volume: {value}%")
        self.update_settings('MainWindow', 'nav_sound_volume', str(value))

    def add_emulator_section(self, layout, label_text, exe_key, games_key, button_label):
        label = QLabel(f"\n{label_text}")
        label.setFont(QFont("Arial", 18, QFont.Bold))
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
        
        # Set minimum size to ensure rounded corners are visible
        exe_button.setMinimumHeight(50)
        exe_button.setMinimumWidth(120)
        exe_button.setFont(QFont("Arial", 10))
        games_button.setMinimumHeight(50)
        games_button.setMinimumWidth(120)
        games_button.setFont(QFont("Arial", 10))
        
        exe_button.setCursor(Qt.PointingHandCursor)
        games_button.setCursor(Qt.PointingHandCursor)
        
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
        
        # Determine file filter based on operating system
        system = platform.system()
        if system == 'Windows':
            file_filter = "Executable Files (*.exe);;All Files (*)"
        elif system == 'Darwin':  # macOS
            file_filter = "Application Bundles (*.app);;Executable Files (*.exe);;All Files (*)"
        elif system in ('Linux', 'SunOS'):  # Linux and OmniOS (SunOS-based)
            file_filter = "All Files (*)"
        else:  # Fallback for other Unix-like systems
            file_filter = "All Files (*)"
        
        file_path, _ = QFileDialog.getOpenFileName(self, dialog_title, "", file_filter, options=options)
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
                background-color: rgba(255, 255, 255, 10);
                color: white;
                border: 1px solid rgba(255, 255, 255, 30);
                padding: 10px;
                font-family: Arial;
                border-radius: 20px;
            }
            QPushButton:hover {
                background-color: rgba(255, 255, 255, 20);
                border: 1px solid rgba(255, 255, 255, 50);
            }
            QPushButton:pressed {
                background-color: rgba(255, 255, 255, 5);
            }
        """)
        button.setCursor(Qt.PointingHandCursor)

    def command_cleaner(self, command):
        vcontroller = str(self.preferred_controller_idx)
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
                self.run_command(f"{' '.join(script[0].split(':', 1))} {script[1].replace('emupath', os.path.dirname(command.split('"')[0])).replace('vcontroller',vcontroller)}", popup=False)
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
        if hasattr(self, "vpad") and self.vpad:
            try:
                self.vpad.stop()
            except Exception as e:
                print(f"Error stopping vpad: {e}")

        for worker in getattr(self, "active_workers", []):
            try:
                worker.wait()
            except Exception as e:
                print(f"Error waiting for worker: {e}")
        # 3. Call parent closeEvent (lets Qt finish teardown)
        super().closeEvent(event)

        # 4. Explicit accept (optional, Qt usually does this itself if not ignored)
        event.accept()

    def display_output(self, output):
        print(output)

    def add_game_to_grid(self, game_name):
        self.game_names.append(game_name)  # Store game name

    def sort_games(self):
        # Check cache first
        if self.sort_by in self.game_cache:
            return self.game_cache[self.sort_by]

        sorted_games = {}
        match self.sort_by:
            case 'alphabetical':
                for game in self.game_names:
                    sorted_games[game[0].upper()] = sorted_games.get(game[0].upper(),[]) + [game]
                sorted_games = {key: sorted_games[key] for key in sorted(sorted_games)}
                
            case 'emulator':
                for game in self.game_names:
                    emu = self.game_to_emulator.get(game, 'Unknown')
                    sorted_games[emu] = sorted_games.get(emu,[]) + [game]
                sorted_games = {key: sorted_games[key] for key in sorted(sorted_games)}
            
            case _:
                for game in self.game_names:
                    sorted_games[game[0].upper()] = sorted_games.get(game[0].upper(),[]) + [game]
                sorted_games = {key: sorted_games[key] for key in sorted(sorted_games)}
        
        # Cache the result
        self.game_cache[self.sort_by] = sorted_games
        self.save_game_cache()
        return sorted_games

    def get_games_fingerprint(self):
        """Generate a fingerprint of the current game list and executables to validate cache."""
        # Combine game names and executables to create a unique signature
        data_to_hash = "".join(sorted(self.game_names)) + "".join(sorted(self.game_executables))
        return hashlib.md5(data_to_hash.encode()).hexdigest()

    def load_game_cache(self):
        """Load the game cache from disk if valid."""
        if not os.path.exists(self.CACHE_FILE):
            return

        try:
            with open(self.CACHE_FILE, 'r') as f:
                data = json.load(f)
            
            # Check fingerprint
            current_fingerprint = self.get_games_fingerprint()
            if data.get('fingerprint') == current_fingerprint:
                self.game_cache = data.get('cache', {})
                print("Game cache loaded successfully.")
            else:
                print("Game cache outdated. Rebuilding.")
        except Exception as e:
            print(f"Failed to load game cache: {e}")

    def save_game_cache(self):
        """Save the game cache to disk."""
        try:
            data = {
                'fingerprint': self.get_games_fingerprint(),
                'cache': self.game_cache
            }
            with open(self.CACHE_FILE, 'w') as f:
                json.dump(data, f)
        except Exception as e:
            print(f"Failed to save game cache: {e}")

    def _create_emulator_header_box(self, emulator_name, size):
        """Create a visual emulator header box with icon if image exists."""
        icon_path = f"./images/{emulator_name}.png"
        
        if not os.path.exists(icon_path):
            return None
        
        # Create container label styled like a game button
        container = QLabel()
        container.setFixedSize(round(size/2), round(size/2))
        container.setStyleSheet("""
            QLabel {
                background-color: rgba(255, 255, 255, 2);
                border: 1px solid rgba(255, 255, 255, 15);
                border-radius: 20px;
            }
        """)
        
        # Apply rounded corner mask
        path = QPainterPath()
        path.addRoundedRect(0, 0, size, size, 20, 20)
        container.setMask(QRegion(path.toFillPolygon().toPolygon()))
        
        # Create layout for the container
        layout = QVBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Load and add emulator icon
        pixmap = QPixmap(icon_path)
        icon_size = int(size * 0.2)
        scaled_pixmap = pixmap.scaled(icon_size, icon_size, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        
        icon_label = QLabel()
        icon_label.setPixmap(scaled_pixmap)
        icon_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(icon_label)
        
        return container

    def recalculate_grid_layout(self):
        if not self.games_loaded:
            return

        self.games_in_grid = []
        self.row_offsets = []  # Track the offset (indentation) for each row
        for i in reversed(range(self.grid_layout.count())):
            self.grid_layout.itemAt(i).widget().setParent(None)

        sorted_games = self.sort_games()
        
        # Filter games if in favorites mode
        if self.current_grid == 'favorites':
            filtered_games = {}
            for first_letter, game_names in sorted_games.items():
                favorited = [name for name in game_names if self.clean_game_name(name) in self.favorite_games]
                if favorited:
                    filtered_games[first_letter] = favorited
            sorted_games = filtered_games
        
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
                    
                    # Try to create emulator header box if sorting by emulator
                    header_widget = None
                    if self.sort_by == 'emulator':
                        header_widget = self._create_emulator_header_box(current_letter, button_size)
                    
                    if header_widget:
                        # Use emulator icon box
                        self.grid_layout.addWidget(header_widget, row, col, Qt.AlignCenter)
                    else:
                        # Use text label (fallback or alphabetical sort)
                        label = QLabel(current_letter)
                        if self.sort_by == 'alphabetical':
                            label.setFont(QFont("Arial", 35, QFont.Bold))
                        else:
                            label.setFont(QFont("Arial", (window_width // 30) - button_margin * 2, QFont.Bold))
                        label.setStyleSheet("color: white;")
                        self.grid_layout.addWidget(label, row, col, Qt.AlignCenter)
                    
                    col += 1
                    self.games_in_grid.append([])  # Add new row for letter/emulator
                    self.row_offsets.append(1)     # This row has an offset of 1 (label takes first slot)

                if col >= buttons_per_row:
                    col = 0
                    row += 1
                    self.games_in_grid.append([])  # Add new row for new line of games
                    self.row_offsets.append(0)     # This row has no offset

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
        button.setFixedSize(button_size, button_size)  # Set fixed size for the button
        button.clicked.connect(lambda: self.run_command(self.command_cleaner(self.find_exec(game_name)), popup=True))
        
        # Check for custom background image for this game (only if simplified UI is disabled)
        game_bg_path = None if self.simplified_ui else self.find_background_image(game_name)
        
        # Create background image layer if image exists
        if game_bg_path:
            padding = 8
            inner_size = button_size - (padding * 2)
            
            # Create a background label that covers the inner area
            bg_label = QLabel(button)
            bg_label.setGeometry(padding, padding, inner_size, inner_size)
            bg_label.setScaledContents(True)
            bg_label.lower()  # Send to back

            # Check cache first
            cache_key = (game_bg_path, inner_size)
            cached_pixmap = self.image_cache.get(cache_key)

            if cached_pixmap:
                bg_label.setPixmap(cached_pixmap)
            else:
                # Async load
                loader = ImageLoader(game_bg_path, inner_size, mode='inner')
                # We use a default arg for bg_label to capture it in the lambda closure correctly
                loader.signals.result.connect(lambda p, l=bg_label, k=cache_key: self.on_image_loaded(p, l, k))
                self.thread_pool.start(loader)
            
            # Apply rounded corner mask to the inner image
            inner_path = QPainterPath()
            inner_path.addRoundedRect(0, 0, inner_size, inner_size, 20, 20)
            bg_label.setMask(QRegion(inner_path.toFillPolygon().toPolygon()))
            
            # Apply semi-transparent overlay for better text visibility (also inner)
            overlay = QLabel(button)
            overlay.setObjectName("overlay")  # Name it so we can find it later
            overlay.setGeometry(padding, padding, inner_size, inner_size)
            overlay.setStyleSheet("background-color: rgba(0, 0, 0, 0);") # Transparent by default
            overlay.setMask(QRegion(inner_path.toFillPolygon().toPolygon()))
            overlay.lower()
            bg_label.lower()  # Make sure bg is behind overlay
            
            # Create selection border frame (initially hidden)
            border_frame = QLabel(button)
            border_frame.setObjectName("selection_border")
            border_frame.setGeometry(0, 0, button_size, button_size)
            border_frame.setStyleSheet("""
                background-color: transparent;
                border: 3px solid cyan;
                border-radius: 20px;
            """)
            border_frame.hide()  # Initially hidden
            border_frame.raise_()  # Bring to front
            
            # Store reference to overlay and border for selection highlighting
            button.has_bg_image = True
            button.overlay_widget = overlay
            button.border_widget = border_frame
            
            # Style button with transparency
            button.setStyleSheet("""
                QPushButton {
                    background-color: rgba(255, 255, 255, 10);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 30);
                    padding: 10px;
                    font-family: Arial;
                    border-radius: 20px;
                }
                QPushButton:hover {
                    background-color: rgba(255, 255, 255, 20);
                }
                QPushButton:pressed {
                    background-color: rgba(255, 255, 255, 5);
                }
            """)
            
            # Apply rounded corner mask to the button itself
            path = QPainterPath()
            path.addRoundedRect(0, 0, button_size, button_size, 20, 20)
            button.setMask(QRegion(path.toFillPolygon().toPolygon()))
        else:
            # Use default styling
            button.has_bg_image = False
            self.style_button(button)


        # Create a QLabel for the emulator logo
        emu = self.set_emulator(self.find_exec(game_name).lower())
        pixmap = QPixmap(f"./images/{emu}.png")
        scaled_pixmap = pixmap.scaled(round(button_size/3), round(button_size/3), Qt.KeepAspectRatio, Qt.SmoothTransformation)
        background_label = QLabel(emu, button)
        background_label.setPixmap(scaled_pixmap)
        background_label.setAlignment(Qt.AlignCenter)
        background_label.setStyleSheet(f"""
            QLabel {{
                background: rgba(0, 0, 0, 100);  /* Semi-transparent dark background for readability */
                color: rgba(255, 255, 255, 70);
                font-size: {max(5, button_size // 15)}px;
                font-family: Arial;
                padding: 5px;
                border-radius: 20px;
            }}
        """)

        # Create a container for the text to separate background from text shadow
        cleaned_name = self.clean_game_name(game_name)
        is_favorited = cleaned_name in self.favorite_games
        
        text_container = QWidget(button)
        if is_favorited:
            # Blueish tint for favorited games
            text_container.setStyleSheet("""
                background-color: rgba(48, 96, 141, 127);
                border-radius: 20px;
            """)
        else:
            text_container.setStyleSheet("""
                background-color: rgba(0, 0, 0, 100);
                border-radius: 20px;
            """)
        text_layout = QVBoxLayout(text_container)
        text_layout.setContentsMargins(0, 0, 0, 0)
        text_layout.setSpacing(0)

        # Create a QLabel to handle text wrapping for the main button text
        label = QLabel(self.clean_game_name(game_name), text_container)
        label.setWordWrap(True)
        label.setAlignment(Qt.AlignCenter)
        
        # Add drop shadow to simulate outline (only affects text now since label bg is transparent)
        shadow = QGraphicsDropShadowEffect()
        shadow.setBlurRadius(2)
        shadow.setColor(QColor("black"))
        shadow.setOffset(1, 1)
        label.setGraphicsEffect(shadow)

        label.setStyleSheet(f"""
            QLabel {{
                background: transparent;
                font-size: {max(15, button_size // 10)}px;
                font-family: Arial;
                color: white;
                padding: 5px;
                border: none;
                font-weight: bold;
            }}
        """)
        text_layout.addWidget(label)

        # Create a layout for the button and add both labels
        layout = QVBoxLayout(button)
        layout.addWidget(background_label)
        layout.addWidget(text_container)
        button.setLayout(layout)
        
        # Hide overlay elements by default if button has background image
        if button.has_bg_image:
            background_label.hide()
            text_container.hide()
        
        # Store references for visibility toggling
        button.emulator_label = background_label
        button.text_container = text_container

        self.grid_layout.addWidget(button, row, col)
        return button

    def on_image_loaded(self, pixmap, bg_label, cache_key):
        try:
            if pixmap:
                bg_label.setPixmap(pixmap)
                self.image_cache.put(cache_key, pixmap)
        except RuntimeError:
            pass # Widget deleted

    def resizeEvent(self, event):
        self.recalculate_grid_layout()
        super().resizeEvent(event)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_W:
            self.handle_dpad_input({'up': True, 'down': False, 'left': False, 'right': False})
        elif event.key() == Qt.Key_S:
            self.handle_dpad_input({'up': False, 'down': True, 'left': False, 'right': False})
        elif event.key() == Qt.Key_A:
            self.handle_dpad_input({'up': False, 'down': False, 'left': True, 'right': False})
        elif event.key() == Qt.Key_D:
            self.handle_dpad_input({'up': False, 'down': False, 'left': False, 'right': True})
        elif event.key() == Qt.Key_Return:
            self.handle_button_a()
        elif event.key() == Qt.Key_F:
            self.handle_button_back()
        elif event.key() == Qt.Key_R:
            self.handle_button_start()
        elif event.key() == Qt.Key_Q:
            self.handle_button_lb()
        elif event.key() == Qt.Key_E:
            self.handle_button_rb()
        elif event.key() == Qt.Key_Space:
            self.handle_button_x()
        else:
            super().keyPressEvent(event)

    def highlight_selected_game(self):
        """
        Highlight the currently selected game in the grid.
        """
        if not self.games_in_grid:
            return  # If there are no games in the grid, do nothing
        
        for row in range(len(self.games_in_grid)):
            for col in range(len(self.games_in_grid[row])):
                button = self.games_in_grid[row][col]
                is_selected = (row, col) == (self.selected_row, self.selected_col)
                
                if hasattr(button, 'has_bg_image') and button.has_bg_image:
                    # Determine if overlay should be shown
                    # Show if global toggle is on OR (selected AND not touched)
                    should_show_overlay = self.show_all_overlays or (is_selected and not self.screen_touched)
                    
                    if should_show_overlay:
                        button.overlay_widget.setStyleSheet("background-color: rgba(0, 0, 0, 100);")
                        if hasattr(button, 'emulator_label'): button.emulator_label.show()
                        if hasattr(button, 'text_container'): button.text_container.show()
                    else:
                        button.overlay_widget.setStyleSheet("background-color: rgba(0, 0, 0, 0);")
                        if hasattr(button, 'emulator_label'): button.emulator_label.hide()
                        if hasattr(button, 'text_container'): button.text_container.hide()
                        
                    # Selection border (only if selected and not touched)
                    if is_selected and not self.screen_touched:
                        button.border_widget.show()
                    else:
                        button.border_widget.hide()
                else:
                    # Default button styling
                    if is_selected and not self.screen_touched:
                        button.setStyleSheet("""
                            QPushButton {
                                background-color: transparent;
                                color: cyan;
                                border: 3px solid cyan;
                                padding: 10px;
                                font-family: Arial;
                                border-radius: 20px;
                            }
                        """)
                    else:
                        self.style_button(button)

        # Ensure the selected game button is visible within the scroll area
        if not self.screen_touched and self.selected_row != -1:
            selected_button = self.games_in_grid[self.selected_row][self.selected_col]
            self.grid_scroll_area.ensureWidgetVisible(selected_button)

    def setFrozen(self, freeze: bool):
        if freeze:
            self._blocker.show()
        else:
            self._blocker.hide()

    def handle_dpad_input(self, dpad_state):
        if not self.games_in_grid:
            return  # If there are no games in the grid, do nothing
        
        if self.stacked_widget.currentWidget() != self.stacked_widget.widget(0):
            return

        if not any(dpad_state.values()):
            return  # If no D-Pad button is actually pressed, do nothing

        # Reset the screen_touched flag since a controller input was detected
        self.screen_touched = False
        self.setFrozen(True)

        if self.selected_row == -1:
            self.selected_row = 0
            self.selected_col = 0
            self.highlight_selected_game()
            return

        current_row_games = self.games_in_grid[self.selected_row]
        current_col_max = len(current_row_games) - 1

        # Calculate current visual position (accounting for offsets)
        current_offset = self.row_offsets[self.selected_row] if hasattr(self, 'row_offsets') and self.selected_row < len(self.row_offsets) else 0
        current_visual_col = self.selected_col + current_offset
        
        prev_row, prev_col = self.selected_row, self.selected_col

        if dpad_state['up']:
            if self.selected_row > 0:
                target_row = self.selected_row - 1
                target_offset = self.row_offsets[target_row] if hasattr(self, 'row_offsets') and target_row < len(self.row_offsets) else 0
                
                # Try to maintain visual column
                target_col = current_visual_col - target_offset
                
                # Clamp to valid range for the target row
                max_col = len(self.games_in_grid[target_row]) - 1
                self.selected_row = target_row
                self.selected_col = max(0, min(target_col, max_col))
                
        elif dpad_state['down']:
            if self.selected_row < len(self.games_in_grid) - 1:
                target_row = self.selected_row + 1
                target_offset = self.row_offsets[target_row] if hasattr(self, 'row_offsets') and target_row < len(self.row_offsets) else 0
                
                # Try to maintain visual column
                target_col = current_visual_col - target_offset
                
                # Clamp to valid range for the target row
                max_col = len(self.games_in_grid[target_row]) - 1
                self.selected_row = target_row
                self.selected_col = max(0, min(target_col, max_col))
                
        elif dpad_state['left']:
            self.selected_col = max(0, self.selected_col - 1)
        elif dpad_state['right']:
            self.selected_col = min(current_col_max, self.selected_col + 1)
            
        # Play sound if selection changed
        if (prev_row, prev_col) != (self.selected_row, self.selected_col):
            self.nav_sound.play()

        self.highlight_selected_game()

    def handle_button_a(self):
        if self.stacked_widget.currentWidget() != self.stacked_widget.widget(0):
            return

        selected_button = self.games_in_grid[self.selected_row][self.selected_col]
        if isinstance(selected_button, QPushButton):
            selected_button.click()

    def handle_button_x(self):
        if self.stacked_widget.currentWidget() != self.stacked_widget.widget(0):
            return
        self.setFrozen(False)
        # Unlock touch mode and hide selection, but keep selected_row/col for memory
        self.screen_touched = True
        self.highlight_selected_game()

    def handle_button_b(self):
        if self.stacked_widget.currentWidget() != self.stacked_widget.widget(0):
            return
        if getattr(self, "_shutting_down", False):
            return
        self._shutting_down = True

        # stop generating new UI inputs
        try:
            self.xinput_handler.timer.stop()
        except Exception:
            pass

        # push a neutral frame so B isn’t stuck “down”, then stop vpad
        if getattr(self, "vpad", None):
            try:
                self.vpad.send_neutral()   # implement: reset+update on the vpad
            except Exception:
                pass
            try:
                self.vpad.stop()
            except Exception:
                pass
            self.vpad = None

        # optional tiny non-blocking delay (lets OS/app settle)
        QTimer.singleShot(0, QApplication.quit)  # or a few ms if you insist

    def handle_button_y(self):
        if self.stacked_widget.currentWidget() != self.stacked_widget.widget(0):
            return

        if self.sort_by == 'alphabetical':
            self.update_sort_by_setting('emulator')
        else:
            self.update_sort_by_setting('alphabetical')

        # Do NOT reset selection or force controller mode here
        # The update_sort_by_setting will handle resetting to "no selection"
        # self.screen_touched = False 
        # self.selected_row = 0
        # self.selected_col = 0
        # self.highlight_selected_game()

    def handle_button_start(self):
        if self.stacked_widget.currentWidget() != self.stacked_widget.widget(0):
            return
        
        
        self.show_all_overlays = not self.show_all_overlays
        self.highlight_selected_game()
    
    def handle_button_back(self):
        """Handle Back/Select button - toggle favorite for selected game"""
        if self.stacked_widget.currentWidget() != self.stacked_widget.widget(0):
            return
        self.toggle_favorite()
    
    def handle_button_lb(self):
        """Handle Left Bumper - toggle between main and favorites grid"""
        if self.stacked_widget.currentWidget() != self.stacked_widget.widget(0):
            return
        # self.screen_touched = False # Removed
        self.toggle_grid_view(tab='main')
    
    def handle_button_rb(self):
        """Handle Right Bumper - toggle between main and favorites grid"""
        if self.stacked_widget.currentWidget() != self.stacked_widget.widget(0):
            return
        # self.screen_touched = False # Removed
        self.toggle_grid_view(tab='favs')

    def init_xinput_handler(self):
        self.xinput_handler = XInputHandler(self.settings_label, self.buttons_label, self, ignore_indices=self.ignored_xinput_indices)
        self.xinput_handler.dpad_signal.connect(self.handle_dpad_input)
        self.xinput_handler.button_a_signal.connect(self.handle_button_a)
        self.xinput_handler.button_b_signal.connect(self.handle_button_b)
        self.xinput_handler.button_x_signal.connect(self.handle_button_x)
        self.xinput_handler.button_y_signal.connect(self.handle_button_y)
        self.xinput_handler.button_start_signal.connect(self.handle_button_start)
        self.xinput_handler.button_back_signal.connect(self.handle_button_back)
        self.xinput_handler.button_lb_signal.connect(self.handle_button_lb)
        self.xinput_handler.button_rb_signal.connect(self.handle_button_rb)

    def update_sort_by_setting(self, sort_by_value):
        self.update_settings('MainWindow', 'sort_by', sort_by_value)
        self.sort_by = sort_by_value
        
        self.reset_selection_mode()
            
        self.recalculate_grid_layout()

    def toggle_navbar(self):
        if self.nav_widget.isVisible():
            self.nav_widget.hide()
            self.hamburger_button.setText("☰")  # Show hamburger icon
        else:
            self.nav_widget.show()
            self.hamburger_button.setText("X")  # Show close icon

    def clean_game_name(self, game_name):
        """
        Cleans the game name by removing extension, region codes, and extra spaces.
        """
        # Remove extension
        root, _ = os.path.splitext(game_name)
        # Remove content in parentheses and brackets (e.g. (USA), [!] etc)
        cleaned_name = re.sub(r'\([^)]*\)|\[[^]]*\]', '', root)
        # Remove extra spaces and strip
        cleaned_name = ' '.join(cleaned_name.split())
        return cleaned_name

    @lru_cache(maxsize=1024)
    def find_background_image(self, game_name):
        """
        Finds the best matching background image for a given game name.
        Prioritizes:
        1. Exact match of cleaned name (removed region codes etc.)
        2. Franchise match (longest prefix match)
        """
        # 1. Clean the game name
        cleaned_name = self.clean_game_name(game_name)
        
        games_img_dir = "./images/games/"
        if not os.path.exists(games_img_dir):
            return None

        # Get list of available images (cached)
        if self.available_game_images is None:
            try:
                self.available_game_images = os.listdir(games_img_dir)
            except OSError:
                self.available_game_images = []
                return None
        
        available_images = self.available_game_images

        # 2. Check for exact match of cleaned name

        # 2. Check for exact match of cleaned name
        for ext in ['.png', '.jpg', '.jpeg', '.webp']:
            candidate = f"{cleaned_name}{ext}"
            # Case insensitive check would be better but for now let's stick to simple check or listdir check
            # To be safe on case-sensitive FS (though Windows is usually not), let's iterate
            for img in available_images:
                if img.lower() == candidate.lower():
                    return os.path.join(games_img_dir, img)
        
        # 2.5. Check for match with hyphens removed (substring match for games with subtitles)
        # This allows "need for speed - carbon - own the city" to match "need for speed carbon.jpg"
        cleaned_name_no_hyphens = ' '.join(cleaned_name.replace("-", " ").split()).lower()
        best_hyphen_match = None
        best_hyphen_match_len = 0
        
        for img in available_images:
            img_root, img_ext = os.path.splitext(img)
            if img_ext.lower() not in ['.png', '.jpg', '.jpeg', '.webp']:
                continue
            img_root_no_hyphens = ' '.join(img_root.replace("-", " ").split()).lower()
            
            # Check if image name is contained in game name (whole word match)
            # We want the longest match to avoid matching "need for speed" when "need for speed carbon" exists
            if img_root_no_hyphens in cleaned_name_no_hyphens:
                if len(img_root_no_hyphens) > best_hyphen_match_len:
                    best_hyphen_match = img
                    best_hyphen_match_len = len(img_root_no_hyphens)
        
        if best_hyphen_match:
            return os.path.join(games_img_dir, best_hyphen_match)

        # 3. Franchise/Regex match
        # Find longest image name that is contained in the cleaned game name (whole word)
        best_match = None
        best_match_len = 0
        
        cleaned_name_lower = cleaned_name.lower()
        
        for image in available_images:
            if not any(image.lower().endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.webp']):
                continue
                
            img_root, _ = os.path.splitext(image)
            img_root_lower = img_root.lower()
            
            # Escape the image root to use in regex
            # We use \b to ensure we match whole words (e.g. "Zelda" in "The Legend of Zelda")
            # but avoid partial matches like "Man" in "Spider-Man" if we only had "Man.png" (unless that's desired, but \b helps)
            pattern = r'\b' + re.escape(img_root_lower) + r'\b'
            
            if re.search(pattern, cleaned_name_lower):
                # We want the longest match
                if len(img_root) > best_match_len:
                    best_match = image
                    best_match_len = len(img_root)
        
        if best_match:
            return os.path.join(games_img_dir, best_match)
            
        return None

    def load_favorites(self):
        """Load favorite games from settings.ini"""
        if self.config.has_section('FavoriteGames'):
            # We stored the actual game name as the value
            self.favorite_games = set()
            for key in self.config.options('FavoriteGames'):
                game_name = self.config.get('FavoriteGames', key)
                self.favorite_games.add(game_name)
        else:
            self.favorite_games = set()
    
    def save_favorites(self):
        """Save favorite games to settings.ini"""
        if not self.config.has_section('FavoriteGames'):
            self.config.add_section('FavoriteGames')
        
        # Clear existing favorites
        for option in self.config.options('FavoriteGames'):
            self.config.remove_option('FavoriteGames', option)
        
        # Add current favorites
        # Key: safe string (lower, underscores), Value: actual cleaned game name
        for game_name in self.favorite_games:
            safe_key = game_name.lower().replace(' ', '_').replace(':', '').replace('/', '')
            self.config.set('FavoriteGames', safe_key, game_name)
        
        with open('settings.ini', 'w') as configfile:
            self.config.write(configfile)
    
    def toggle_favorite(self):
        """Toggle favorite status for currently selected game"""
        if not self.games_in_grid:
            return
        
        selected_button = self.games_in_grid[self.selected_row][self.selected_col]
        # Get game name from button text
        if hasattr(selected_button, 'text_container'):
            game_name = selected_button.text_container.findChild(QLabel).text()
        else:
            return
        
        # Toggle favorite status
        if game_name in self.favorite_games:
            self.favorite_games.remove(game_name)
        else:
            self.favorite_games.add(game_name)
        
        self.save_favorites()
        self.update_button_favorite_indicator(selected_button, game_name)
    
    def update_button_favorite_indicator(self, button, game_name):
        """Update visual indicator for favorite status"""
        if hasattr(button, 'text_container'):
            if game_name in self.favorite_games:
                # Add blueish tint to indicate favorited
                button.text_container.setStyleSheet("""
                    background-color: rgba(48, 96, 141, 127);
                    border-radius: 20px;
                """)
            else:
                # Reset to default
                button.text_container.setStyleSheet("""
                    background-color: rgba(0, 0, 0, 100);
                    border-radius: 20px;
                """)
    
    def switch_to_favorites(self):
        """Switch to favorites grid view"""
        if self.current_grid == 'favorites':
            return  # Already on favorites
        
        self.current_grid = 'favorites'
        self.reset_selection_mode()
        self.recalculate_grid_layout()
    
    def switch_to_main(self):
        """Switch to main grid view"""
        if self.current_grid == 'main':
            return  # Already on main
        
        self.current_grid = 'main'
        self.reset_selection_mode()
        self.recalculate_grid_layout()
    
    def toggle_grid_view(self, tab: str):
        """Toggle between main and favorites grid"""
        if tab == 'favs':
            self.switch_to_favorites()
        else:
            self.switch_to_main()

    def reset_selection_mode(self):
        """Reset selection to touch mode (no highlight)"""
        self.screen_touched = True
        self.selected_row = -1
        self.selected_col = -1
        self.setFrozen(False)  # Unlock touch input
        self.highlight_selected_game()
        self.grid_scroll_area.verticalScrollBar().setValue(0)

    def restart(self):
        QApplication.quit()  # Close the current instance of the application
        os.execl(sys.executable, sys.executable, *sys.argv)  # Restart the application

if __name__ == '__main__':
    config = configparser.ConfigParser()
    config.read('settings.ini')
    fullscreen = config.getboolean('MainWindow', 'fullscreen', fallback=False)
    navbar = config.getboolean('MainWindow', 'navbar', fallback=False)
    sort_by = config.get('MainWindow', 'sort_by', fallback='name') # Added initialization for sort_by

    app = QApplication(sys.argv)
    main_window = MainWindow(fullscreen, navbar, sort_by)
    main_window.show()
    sys.exit(app.exec_())