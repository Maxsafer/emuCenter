# EmuCenter Backend

Backend service for launching games and applications from the EmuCenter React Native app.

## Installation

```bash
cd backend
npm install
```

## Running the Server

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will start on `http://localhost:3001` by default.

## API Endpoints

### POST /launch
Launch an application or game.

**Request Body:**
```json
{
  "command": "path/to/application"
}
```

**With Scripts:**
```json
{
  "command": "/path/to/game?pre:setup_script=arg1,post:cleanup=arg2"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Application launched successfully"
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "platform": "darwin",
  "timestamp": "2025-12-08T09:00:00.000Z"
}
```

## Platform Support

- **Windows**: Direct .exe execution
- **macOS**: Uses `open` command for .app bundles
- **Linux**: Direct binary execution

## Command Format

The command can include optional scripts separated by `?`:

```
main_command?script_type:script_name=value,script_type2:script_name2=value2
```

**Examples:**

1. Simple launch:
   ```
   /Applications/Steam.app
   ```

2. With pre-launch script:
   ```
   /usr/bin/game?pre:setup=/path/to/setup.sh
   ```

3. Multiple scripts:
   ```
   C:\\Games\\game.exe?pre:controller=xinput0,post:cleanup=reset
   ```
