# EmuCenter Migration - Quick Start Guide

## What's New

Your app now includes a complete game/emulator launcher with:
- **Game library management** with cover images
- **Favorites and Recently Played** tracking
- **Multiple sorting options** (alphabetical, by emulator)
- **Tab navigation** (All/Favorites/Recent)
- **Cross-platform support** (Windows, macOS, Linux)

## Setup Instructions

### 1. Install Dependencies

Frontend (already has expo-file-system):
```bash
# No additional dependencies needed for frontend
npm install
```

Backend:
```bash
cd backend
npm install
```

### 2. Start the Backend Server

```bash
cd backend
npm start
```

The server will run on `http://localhost:3001`.

### 3. Configure Emulators

Use the app to add emulators:
1. Tap the settings icon
2. Add emulator with:
   - Name (e.g., "dolphin")
   - Display name (e.g., "Dolphin (GameCube/Wii)")
   - Executable path
   - Games directory path
   - Command template (e.g., `exepath game`)

### 4. Add Game Cover Images (Optional)

Place game cover images in the app's document directory:
- Images should match cleaned game names
- Supported formats: PNG, JPG, JPEG, WEBP
- The app uses smart matching (exact name, franchise, etc.)

## Features

### Game Management
- **Auto-discovery**: Games are automatically discovered from emulator directories
- **Smart naming**: Automatically cleans region codes, extensions, etc.
- **Cover images**: Supports custom cover art with intelligent matching

### Organization
- **Favorites**: Long-press any game to favorite/unfavorite
- **Recent Games**: Automatically tracks last 9 played games
- **Sorting**: Switch between alphabetical and emulator grouping

### Launching
- **One-tap launch**: Tap any game to launch
- **Script support**: Pre/post-launch scripts (format: `command?pre:script=arg`)
- **Cross-platform**: Works on Windows, macOS, and Linux

## File Structure

```
/hooks
  - useGames.ts         # Game management with favorites/recents
  - useEmulators.ts     # Emulator configuration
  - useSettings.ts      # App settings (sort, volume, theme)

/components
  - GameCard.tsx        # Game display with covers
  - TabIndicator.tsx    # Tab navigation UI
  - SectionHeader.tsx   # Group headers (A-Z or emulator)

/utils
  - gameNameCleaner.ts  # Name processing utilities
  - imageMatching.ts    # Cover image matching logic

/types
  - game.ts             # Game/emulator type definitions

/backend
  - server.js           # Express server for launching games
```

## Next Steps

1. **Add emulators** via settings
2. **Import game covers** to document directory  
3. **Launch games** and build your library
4. **Customize** sort order and UI preferences

## Troubleshooting

**Games not launching?**
- Ensure backend server is running
- Check command template is correct
- Verify game paths exist

**No cover images?**
- Place images in app document directory
- Use cleaned game names for filenames
- Check supported formats (PNG, JPG, WEBP)

**Performance issues?**
- Enable "Simplified UI" in settings
- This disables cover images for better performance

## Original Python Features Migrated

✅ Game library with cover images  
✅ Favorites system  
✅ Recent games tracking  
✅ Multiple sort modes  
✅ Emulator management  
✅ Cross-platform launching  
✅ Command templates with scripts  
✅ Smart name cleaning  
✅ Image matching algorithm  

## What's Different from Python Version

- **Touch-first UI** instead of controller navigation
- **Mobile-optimized** layouts and interactions
- **Backend service** required for game launching
- **AsyncStorage** instead of INI files
- **React Native** instead of PyQt5
