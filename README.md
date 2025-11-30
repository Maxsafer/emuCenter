# Welcome to EmuCenter!
<p align="center">
   <img src="https://github.com/Maxsafer/emuCenter/blob/b0445116bba8288f029d4bd41e0d4b3b2e284ffa/images/logo.png" alt="logo" width=50%/>
</p>
I made this highly customizable (if you are a programmer. If not, it is still fairly simple to follow the documentation) hub in order to have all of my retro games from different emulators ready to launch from just one place. I have used other alternatives (not getting into details) that did look prettier but did not work a 100% as needed nor would be highly customizable, I preferred the simplicity and optional complexity that this brings to the table.

I specifically made this for my need of having an emulator game hub for my Ayaneo Slide (handheld PC with a touchscreen).

# Table of Contents

1. [EmuCenter Files](#-emucenter-files)
   - [Directories](#directories)
     - [/images](#images)
     - [/scripts](#scripts)
   - [Python files](#python-files)
     - [/app.py](#apppy)
     - [/ui_components.py](#ui_componentspy)
     - [/xinput_handler.py](#xinput_handlerpy)
   - [Configuration files](#configuration-files)
     - [/settings.ini](#settingsini)
2. [Setup EmuCenter](#-setup-emucenter)
   - [Dependencies](#dependencies)
   - [Install EmuCenter](#install-emucenter)
   - [Setting up EmuCenter](#setting-up-emucenter)
3. [Add more emulators](#-add-more-emulators)
   - [My personal configuration](#my-personal-configuration)
4. [Pictures](#-pictures)
5. [How to use](#-how-to-use)
6. [Future development](#-future-development)


# !! EmuCenter-Files

There are multiple folders and files to keep in mind, but the main application runs under `app.py`.

## Directories

### /images

Here is where all emulators icons are stored, they need to be named like the emulator, the image should be a `.png` (with transparent background format). Instructions to add more emulators are ahead in the "How to add more emulators" section.

>*Example for the image file name format:* `./images/emulator.png`

#### /images/games
Game covers can be added for any game/franchise under this folder. The recommended naming convention is a plain name format that can be picked by the regex (although using the exact string as your ROM will also work). You can also set an image for multiple games e.g. `pokemon.png` will be applied to all pokemon games that do not have a matching game cover.

>*Example for the image file name format:* `./images/games/game title name.png`

### /scripts

This is where custom scripts are recommended to be stored in order to execute them from the "[Templates]" section inside `settings.ini`. 

More details about "[Templates]" are ahead in the "Configuration files" > `settings.ini` section.

## Python files

### /app.py

Main application, this is the Python file that should be used when launching the hub.

    python app.py
You can create a shortcut for a batch script that runs the Python app.

### /ui_components.py

This Python file contains the main UI displayed with Qt. It also contains most of the logic that the application uses to function (including touch controls).

### /virtual_pad_vg.py

Creates and manages a virtual Xbox 360 controller using ViGEmBus. Aggregates input from multiple physical XInput controllers into a single virtual controller, with automatic ownership switching based on activity and rumble feedback passthrough.

### /xinput_handler.py

This Python file handles the logic for xinput interpretation (Controller compatibility).

### /xinput_utils.py

Provides shared XInput utilities and structures for detecting connected XInput controllers. Handles cross-platform compatibility by gracefully falling back when XInput DLLs are unavailable.

## Configuration files

### /settings.ini

This file is the core configuration file used for the whole application to work.
|Sections| What is for|
|--|--|
|[MainWindow]|Controls main visual aspects (can be set inside the UI)|
|[Settings]|Defines the emulators to be shown inside the UI Settings tab|
|[Templates]|Template used to launch a game with CLI commands for each emulator|
|[Emulators]|Emupath/emugamespath store the location of an emulator (can be set inside the UI)|
|[FavoriteGames]|List of favorite games with a key value style|


**[MainWindow]:** <br>
Everything inside the MainWindow section can be set inside the UI.

    fullscreen = yes/no
    navbar = yes/no
    sort_by = alphabetical/emulator
|Configuration|Use|
|--|--|
|fullscreen|Sets the application fullscreen on start (yes/no)|
|navbar|Sets the application navigation bar on start to be opened (yes/no)|
|virtual_controller|Enables/disables the virtual controller (yes/no)|
|sort_by|Sets the games sorting order (alphabetical/emulator)|
|exclude|Excluded folder or extension on your game folders (.sav, .bin, .etc)|
|preferred_controller|Scripts that take `vcontroller` as an argument will use this (0-3)|
|nav_sound_volume|Sets the navigation sound volume (0-100)|
|simplified_ui|Turns on or off the cover art for games (yes/no)|

**[Settings]:** <br>

    emulatorname = Really small description
This is manually added to this file when adding a new emulator.

**[Templates]:** <br>
This sets the logic for a game to be launched for each emulator.

    emulatorname  = exepath --flag1 -flagn game ?python:./scripts/customscript.py=param1 paramn emupath,python:./scripts/customscript2.py=param1 vcontroller

|Parameter|Use|
|--|--|
|exepath|Should be used as it is, this string is recognized inside the app and is replaced with the emulator executable path|
|game|Should be used as it is, this string is recognized inside the app and is replaced with the game to run path|
|emupath|Should be used as it is, this string is recognized inside the app and is replaced with the emulator path|
|vcontroller|Should be used as it is, this string is recognized inside the app and is replaced with the index from 0 to 3 for controllers to be passed to custom scripts, set this value in the UI|
|*optional* `?`|Prefix to run any commands recognized by the users CLI, followed by `:` for the script (file) to run, followed by `=` to add parmeters. This prefix should be added at the end, and all scripts and all commands should be separated by `,`|
|*commands* `,`|Between each command a single comma must exist|
|*script* `:`|Prefix to pass the custom script to run|
|*params* `=`|Prefix to pass parameters to a custom script|
|parameters ` `|Between each parameter a single space should exist|

**[Emulators]:** <br>
Everything inside the Emulators section can be set inside the UI.
|Configuration|Use|
|--|--|
|emupath|Path to the emulator.exe|
|emugamespath|Path to the games folder for the emulator|

# !! Setup-EmuCenter
This section goes into detail on how to set everything up in order to get everything working.

## Dependencies

 - Python 3.12+ (could work on older versions, but has not been tested)
 - Python package PyQt5
 - [ViGEmBus](https://github.com/nefarius/ViGEmBus)_1.22.0 by [nefarius](https://github.com/nefarius) - Only tested the version **included in this repo**
 - [vgamepad](https://github.com/yannbouteiller/vgamepad) by [yannbouteiller](https://github.com/yannbouteiller) - **Included in this repo**

You can get Python from their official website:
>https://www.python.org/downloads/

To install PyQt5, package installer for Python `pip` is needed, it should install along with Python:

    pip install PyQt5

## Install EmuCenter

You can either clone or download a zip from GitHub. Place the repo/unzipped folder under your preferred location. You can create a shortcut for a batch script that runs `python app.py`.


## Setting up EmuCenter
Theres an important hierarchy that **should be acknowledged and followed** (atm) for all emulators:

    emulatorname-folder (must have emulator name in folder name and preferably no spaces)
        |- emulatorname.exe
        |- games-folder (can have any name)
            |- retro-game.anyextension

>*Example:* `D:/Downloads/PCSX2-1.6.0/pcsx2-qt.exe` and `D:/Downloads/PCSX2-1.6.0/games`

> **Keep in mind:**  Windows can be tricky, be careful not to have spaces on your path to your emulator `exe`.
PPSSPP installs under "Program Files" so it has been handled inside the settings.ini file.
Folder containing emulatorname.exe must contain emulator name at the moment.

###
**Configure your games and emulators** <br>
To start adding your emulators and games, simply open EmuCenter and navigate to the settings tab, from there everything should be straight forward.

 - **Select Emulator button:** Select your emulator .exe 
 - **Games button:** Select your emulator games folder

>After adding your emulators and games, `System > Reload` for your games to load in.

# !! Add-more-emulators
Adding more emulators is as simple as modifying the `settings.ini` file.

Right now the following emulators have been pre-added and tested. Please be aware that the custom scripts provided by me may not work for every system/emulator version. I encourage users to code their own scripts (if needed) to fit their own needs. The included custom scripts help to start games in fullscreen for emulators that do not support a fullscreen flag nor a flag to not confirm on close. 

As of now I have managed to make Dolphin (and partially YUZU/EDEN) pick the controller you set as primary with a custom script too, depending on the Dolphin version you have, the `ini` will be under `%APPDATA%\Dolphin Emulator\Config\GCPadNew.ini` or if the `ini` is in a different location, pass the location as an argument to the script, this is an example of the template: 
```
[Templates]
dolphin = exepath --config=Dolphin.Interface.ConfirmStop=False --config=Dolphin.Display.Fullscreen=True -b -e game ?python:./scripts/dolphin_p1_xinput.py=vcontroller "D:\Documents\Dolphin Emulator\Config\GCPadNew.ini"
```

### Tested emulators
 - xemu - 0.7.127
 - xenia - master@3d30b2eec
 - project64 - 3.0.1.5664-2df3434
 - visualboyadvance-m - 2.1.9
 - dolphin - 5.0-21460
 - desmume - 0.9.13
 - citra - Nightly 2104
 - yuzu - 1732
 - eden - 0.0.3-rc3
 - ppsspp - 1.17.1
 - duckstation - 0.1-6922-gf41c238c
 - pcsx2 - 1.7.5913
 - rpcs3 - 0.0.32-16637-50ce4cbe Alpha

### Add more emulators
 1. Open EmuCenter installation folder
 2. Add the emulator image icon (as previously described in the "EmuCenter Files" section)
 3. Open settings.ini
 4. Add the emulator under "[Settings]" (as previously described in the "EmuCenter Files" section)
 5. Add the emulator under "[Templates]" (as previously described in the "EmuCenter Files" section)
 6. Launch EmuCenter and proceed to configure the emulator paths from the settings tab (as previously described in the "Setting up EmuCenter" section)

Example:
 1. Open EmuCenter installation folder <br> ![EmuCenter directory](https://i.imgur.com/LNC1QcV.png)
 2. Add emulator image icon (as previously described in the "EmuCenter Files" section) <br> ![images directory](https://i.imgur.com/FTbxVmq.png)
 3. Open settings.ini <br> ![settings.ini](https://i.imgur.com/iZgqRtc.png)
 4. Add emulator under "[Settings]" (as previously described in the "EmuCenter Files" section) <br> ![add emulator under settings](https://i.imgur.com/bDt0wkh.png)
 5. Add emulator under "[Templates]" (as previously described in the "EmuCenter Files" section) <br> ![add emulator under templates](https://i.imgur.com/nV4TyZQ.png)
 6. Launch EmuCenter and proceed to configure the emulator paths from the settings tab (as previously described in the "Setting up EmuCenter" section)

With these steps adding a new emulator should be fairly simple.

## Edge case emulators

**Example for emulators that are a bit different to configure:** <br>
rpcs3 <br>
![rpcs3](https://i.imgur.com/aSnGNdn.png)
> [Templates]: rpcs3 = exepath --no-gui --fullscreen game\PS3_GAME\USRDIR\EBOOT.BIN

<br>yuzu <br>
![YUZU](https://i.imgur.com/SIy6t26.png)
> [Templates]: yuzu = exepath -f -g game



# !! Pictures
This section is purely to showcase my simplistic looking app.

### Game Library
Sorted in alphabetical order:
![alpha](https://i.imgur.com/88vbVAx.png)

Sorted by emulator:
![emu](https://i.imgur.com/FOXOL09.png)

Sorted by alphabetical order with simplified UI:
![alpha](https://i.imgur.com/eTZUT0b.png)

# !! How-to-use
**Touch and Controller Support** <br>
Touch controls are set to simply scroll with your finger and tap, although if dpad input is detected it will block any touch input until `X` is pressed. For controllers, the bindings are:
|Button|Binding|
|--|--|
|A|Launches the selected game|
|X|Unlocks touch controls that get blocked whenever a dpad interacts with the UI|
|B|Closes EmuCenter|
|Y|Toggles between sorting orders (alphabetical and emulator)|
|D-PAD|Navigates the game grid to select the desired game to launch|
|START|Toggles games info cards|
|SELECT/BACK|Tags a game as a favorite (light blue name box)|
|RB|Switches to the favorite games tab|
|LB|Switches to the main tab|

**Launching/closing games** <br>
After setting everything up, just tap on the game that you want to launch. 
Most of the emulators can configure an exit hotkey/shortcut. I have configured on my emulators every game to exit on ESC since most of them already exit like that. Also, it was easy to configure my handheld to do ESC with a custom Ayaneo button or to set a button to "close program" which closes the emulator running.

**Virtual Gamepad** <br>
I added the option to enable a virtual gamepad mostly for handhelds, this way you can set the vritual gamepad as the controller for most emulators beforehand and just have it picked up as you launch games from EmuCenter. This has been super handy with Dolphin and YUZU/EDEN.

**Why block touch controls/mouse on dpad use** <br>
This is specifically made for handhelds/systems that have joystick to mouse bindings, this way there is no double input. Pressing `X` to unlock seems like really easy and fast to use.

**Closing EmuCenter** <br>
When in focus, EmuCenter can be closed with ESC, Ctrl+c and Ctrl+q and with a controller pressing "B".

# !! Future-development
This was a fun project to develop and I intend to work on the interface/navigation or any bugs that are reported.<br>
[Support cool projects like this one! :)](https://www.paypal.com/donate/?hosted_button_id=SRATUX8VNHC9G)