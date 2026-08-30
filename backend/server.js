const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { exec, spawn, execFileSync } = require('child_process');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const platform = os.platform();

// Config directory for persistent storage
const CONFIG_DIR = (process.env.IS_ELECTRON && process.env.USER_DATA_PATH)
    ? path.join(process.env.USER_DATA_PATH, 'config')
    : path.join(__dirname, 'config');

// Images live next to the source in dev, but under userData when packaged —
// the install dir may be read-only, so uploads must land in USER_DATA_PATH.
const BUNDLED_IMAGES_DIR = path.join(__dirname, 'images');
const IMAGES_DIR = (process.env.IS_ELECTRON && process.env.USER_DATA_PATH)
    ? path.join(process.env.USER_DATA_PATH, 'images')
    : BUNDLED_IMAGES_DIR;

async function ensureImagesDir() {
    // Custom emulator-icon uploads need their directory in every mode
    try { await fs.mkdir(CUSTOM_EMU_ICONS_DIR, { recursive: true }); } catch { /* exists */ }

    if (IMAGES_DIR === BUNDLED_IMAGES_DIR) return;
    await fs.mkdir(IMAGES_DIR, { recursive: true });
    try {
        // One-time, non-destructive seed of bundled defaults (logo.png etc.)
        for (const f of await fs.readdir(BUNDLED_IMAGES_DIR)) {
            const dest = path.join(IMAGES_DIR, f);
            try { await fs.access(dest); } catch { await fs.copyFile(path.join(BUNDLED_IMAGES_DIR, f), dest); }
        }
    } catch (e) {
        console.warn('[Images] seed failed:', e.message);
    }
}

// Emulator icons: the 13 bundled ones migrated from the original EmuCenter,
// plus user uploads (custom dir wins; writable in userData when packaged).
const BUNDLED_EMU_ICONS_DIR = path.join(__dirname, 'emu-icons');
const CUSTOM_EMU_ICONS_DIR = (process.env.IS_ELECTRON && process.env.USER_DATA_PATH)
    ? path.join(process.env.USER_DATA_PATH, 'emu-icons')
    : path.join(__dirname, 'emu-icons-custom');

// Canonical emulator detection - shared idea with the frontend catalog:
// map whatever the user typed/named to the bundled icon's base name.
const EMU_CANONICAL_MATCHERS = [
    ['visualboyadvance-m', /vba|visual\s*boy|visualboyadvance/i],
    ['project64', /project\s*64|pj64/i],
    ['duckstation', /duckstation/i],
    ['pcsx2', /pcsx2/i],
    ['rpcs3', /rpcs3/i],
    ['ppsspp', /ppsspp/i],
    ['dolphin', /dolphin/i],
    ['desmume', /desmume/i],
    ['citra', /citra/i],
    ['yuzu', /yuzu/i],
    ['eden', /eden/i],
    ['xemu', /xemu/i],
    ['xenia', /xenia/i],
];

const ICON_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

function findIconFile(dir, baseName) {
    let entries;
    try {
        entries = require('fs').readdirSync(dir);
    } catch {
        return null;
    }
    const lower = baseName.toLowerCase();
    for (const f of entries) {
        if (!ICON_EXTENSIONS.includes(path.extname(f).toLowerCase())) continue;
        if (path.parse(f).name.toLowerCase() === lower) return path.join(dir, f);
    }
    return null;
}

function findEmulatorIcon(name) {
    // 1. Custom upload under the emulator's own name always wins
    const custom = findIconFile(CUSTOM_EMU_ICONS_DIR, name);
    if (custom) return custom;

    // 2. Canonical detection ("vba" -> visualboyadvance-m.png)
    const match = EMU_CANONICAL_MATCHERS.find(([, re]) => re.test(name));
    if (match) {
        return findIconFile(CUSTOM_EMU_ICONS_DIR, match[0])
            || findIconFile(BUNDLED_EMU_ICONS_DIR, match[0]);
    }

    // 3. Exact bundled name as a last resort
    return findIconFile(BUNDLED_EMU_ICONS_DIR, name);
}

const pickFileScript = path.join(__dirname, 'scripts', 'PickFile.ps1');
const pickFolderScript = path.join(__dirname, 'scripts', 'PickFolder.ps1');

// Virtual controller aggregator (ViGEm) - any physical pad drives one
// stable virtual pad that emulators are configured against.
const { VirtualPadAggregator } = require('./virtualPad');
const virtualPad = new VirtualPadAggregator();

// IGDB API Configuration
let igdbAccessToken = null;
let igdbTokenExpiry = 0;

/**
 * Get IGDB Configuration from file
 */
async function getIGDBConfig() {
    try {
        const filePath = path.join(CONFIG_DIR, 'igdb.json');
        const data = await fs.readFile(filePath, 'utf8');
        const config = JSON.parse(data);

        // Handle wrapped data structure from frontend ({ data: { clientId, ... } })
        if (config.data && config.data.clientId && config.data.clientSecret) {
            return config.data;
        }
        // Handle flat structure just in case
        if (config.clientId && config.clientSecret) {
            return config;
        }
    } catch (err) {
        // Ignore file not found
    }
    return null;
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve images as static files
app.use('/images', express.static(IMAGES_DIR));

// Bundled UI sounds (read-only, so no USER_DATA_PATH indirection needed)
app.use('/sounds', express.static(path.join(__dirname, 'sounds')));

/**
 * Get IGDB access token (cached, auto-refreshes)
 */
async function getIGDBToken() {
    // Return cached token if still valid (with 5 min buffer)
    if (igdbAccessToken && Date.now() < igdbTokenExpiry - 300000) {
        return igdbAccessToken;
    }

    const config = await getIGDBConfig();
    if (!config) {
        console.log('[IGDB] No credentials configured. Skipping IGDB.');
        return null;
    }

    console.log('[IGDB] Fetching new access token...');

    try {
        const response = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                grant_type: 'client_credentials'
            })
        });

        if (!response.ok) {
            throw new Error(`Token request failed: ${response.status}`);
        }

        const data = await response.json();
        igdbAccessToken = data.access_token;
        igdbTokenExpiry = Date.now() + (data.expires_in * 1000);

        console.log('[IGDB] Token obtained, expires in', data.expires_in, 'seconds');
        return igdbAccessToken;
    } catch (error) {
        console.error('[IGDB] Token error:', error.message);
        return null;
    }
}

/**
 * Search IGDB for a game and get its cover image URL.
 * Returns the cover URL, null when IGDB answered "no cover" (cacheable),
 * or undefined when the lookup could not run at all (missing credentials,
 * network/auth failure) - callers must NOT cache undefined, or a transient
 * failure pins the game to "no cover" until restart.
 */
/**
 * IGDB allows ~4 requests/second per client id. The library-sized cover
 * burst at app boot was answered with 429s for everything, so all IGDB
 * lookups go through one lane with a spacing delay. Together with the
 * on-disk cover cache and the persistent negative cache, traffic drops
 * to zero once the library has been seen.
 */
let igdbLane = Promise.resolve();
function queueIGDB(task) {
    const run = igdbLane.then(task, task);
    const pause = () => new Promise(resolve => setTimeout(resolve, 400));
    igdbLane = run.then(pause, pause);
    return run;
}

/**
 * Persistent negative cover cache (CONFIG_DIR/covers-negative.json):
 * "IGDB has nothing for this file" answers survive restarts, so a
 * library full of unmatched homebrew/rips does not re-hammer IGDB on
 * every boot. Entries expire after 30 days; deleting a game's image
 * clears its entry, and saving new IGDB credentials clears them all.
 * Only authoritative misses land here - rate limits and network
 * failures (undefined) are never persisted.
 */
const NEGATIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
let negativeCovers = null;
function loadNegativeCovers() {
    if (negativeCovers) return negativeCovers;
    negativeCovers = new Map();
    try {
        const raw = require('fs').readFileSync(path.join(CONFIG_DIR, 'covers-negative.json'), 'utf8');
        for (const [k, v] of Object.entries(JSON.parse(raw))) negativeCovers.set(k, v);
    } catch { /* first run */ }
    return negativeCovers;
}
async function saveNegativeCovers() {
    try {
        await ensureConfigDir();
        await fs.writeFile(
            path.join(CONFIG_DIR, 'covers-negative.json'),
            JSON.stringify(Object.fromEntries(loadNegativeCovers()), null, 2),
            'utf8'
        );
    } catch (e) {
        console.warn('[Image] negative-cache save failed:', e.message);
    }
}

async function getIGDBCover(gameName) {
    const config = await getIGDBConfig();
    if (!config) return undefined;

    const token = await getIGDBToken();
    if (!token) return undefined;

    // cleanGameName knows the full extension list; a slimmer copy here once
    // missed .ciso/.gcm/.7z etc., so searches went out as "Game.ciso" and
    // IGDB found nothing while the same setup worked for .iso/.gba libraries.
    const searchName = cleanGameName(gameName);

    console.log(`[IGDB] Searching for: "${searchName}"`);

    try {
        // Search for game
        const searchResponse = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: {
                'Client-ID': config.clientId,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'text/plain'
            },
            body: `search "${searchName}"; fields name,cover; limit 1;`
        });

        if (!searchResponse.ok) {
            console.error('[IGDB] Search failed:', searchResponse.status);
            return undefined;
        }

        const games = await searchResponse.json();
        if (!games || games.length === 0 || !games[0].cover) {
            console.log('[IGDB] No cover found for:', searchName);
            return null;
        }

        const coverId = games[0].cover;
        console.log(`[IGDB] Found game: "${games[0].name}" with cover ID: ${coverId}`);

        // Get cover image URL
        const coverResponse = await fetch('https://api.igdb.com/v4/covers', {
            method: 'POST',
            headers: {
                'Client-ID': config.clientId,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'text/plain'
            },
            body: `fields url; where id = ${coverId};`
        });

        if (!coverResponse.ok) {
            console.error('[IGDB] Cover fetch failed:', coverResponse.status);
            return undefined;
        }

        const covers = await coverResponse.json();
        if (!covers || covers.length === 0) {
            return null;
        }

        // Convert to high-res URL (cover_big = 264x374, 720p = 720x1080)
        let coverUrl = covers[0].url;
        coverUrl = coverUrl.replace('t_thumb', 't_cover_big');
        coverUrl = coverUrl.startsWith('//') ? 'https:' + coverUrl : coverUrl;

        console.log(`[IGDB] Cover URL: ${coverUrl}`);
        return coverUrl;

    } catch (error) {
        console.error('[IGDB] Error:', error.message);
        return undefined;
    }
}

// In-memory cache for IGDB results
const igdbCache = new Map();

// Config directory for persistent storage
// Declared at top of file


// Ensure config directory exists
const ensureConfigDir = async () => {
    try {
        await fs.mkdir(CONFIG_DIR, { recursive: true });
    } catch (err) {
        // Directory already exists
    }
};

/**
 * GET /config/:key
 * Load config from file
 */
app.get('/config/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const filePath = path.join(CONFIG_DIR, `${key}.json`);

        try {
            const data = await fs.readFile(filePath, 'utf8');
            console.log(`[Config] Loaded: ${key}`);
            res.json({ success: true, data: JSON.parse(data) });
        } catch (err) {
            if (err.code === 'ENOENT') {
                // File doesn't exist - return null (not an error)
                console.log(`[Config] Not found: ${key}`);
                res.json({ success: true, data: null });
            } else {
                throw err;
            }
        }
    } catch (error) {
        console.error('[Config] Load error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /config/:key
 * Save config to file
 */
app.post('/config/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const { data } = req.body;

        await ensureConfigDir();

        const filePath = path.join(CONFIG_DIR, `${key}.json`);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');

        // New IGDB credentials must take effect immediately: drop the cached
        // token and the negative cover-lookup results from earlier attempts,
        // which otherwise pin every cover to 404 until the app restarts.
        if (key === 'igdb') {
            igdbAccessToken = null;
            igdbTokenExpiry = 0;
            igdbCache.clear();
            // New credentials should retry everything, persisted misses included
            loadNegativeCovers().clear();
            saveNegativeCovers();
        }

        console.log(`[Config] Saved: ${key}`);
        res.json({ success: true });
    } catch (error) {
        console.error('[Config] Save error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /config/:key
 * Delete config file
 */
app.delete('/config/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const filePath = path.join(CONFIG_DIR, `${key}.json`);

        try {
            await fs.unlink(filePath);
            console.log(`[Config] Deleted: ${key}`);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[Config] Delete error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Parse command to handle scripts (pre/post launch commands)
 * Format: "main_command?script1:arg1=value1,script2:arg2=value2"
 */
function parseCommand(command) {
    const parts = command.split('?');
    const mainCommand = parts[0];
    const scripts = [];

    if (parts.length > 1) {
        const scriptParts = parts[1].split(',');

        for (const scriptPart of scriptParts) {
            const [scriptInfo, value] = scriptPart.split('=');
            const [scriptType, scriptName] = scriptInfo.split(':');

            scripts.push({
                type: scriptType.trim(),
                name: scriptName?.trim() || '',
                value: value?.trim() || ''
            });
        }
    }

    return { mainCommand, scripts };
}

/**
 * A short, subtle rumble on every connected physical pad as tactile
 * press-feedback when a launch lands - the splash's haptic twin.
 * Windows-only (XInput). The virtual pad's own slot is skipped so the
 * pulse is not fed back through the aggregator. Fire-and-forget: the
 * launch must never wait on it.
 */
async function rumbleLaunchFeedback() {
    if (platform !== 'win32') return;
    try {
        const xinput = await import('xinput-ffi');
        const slots = [];
        for (let i = 0; i < 4; i++) {
            if (virtualPad.running && i === virtualPad.slot) continue;
            try {
                await xinput.getState({ dwUserIndex: i, translate: false });
                slots.push(i);
            } catch { /* not connected */ }
        }
        if (!slots.length) return;
        console.log(`[Launch] Rumble feedback on pads: ${slots.join(', ')}`);
        const buzz = (low, high) => Promise.all(slots.map(i =>
            xinput.setState(low, high, { dwUserIndex: i, usePercent: true }).catch(() => { /* pad left */ })));
        await buzz(35, 25);
        await new Promise(r => setTimeout(r, 160));
        await buzz(0, 0);
    } catch { /* xinput-ffi absent (non-Windows build) - no haptics */ }
}

// Debounced: one launch per human intent (see /launch)
let lastLaunchAt = 0;

// Live launch children - the authoritative "is a game still running"
// answer. IPC events can in principle be lost and counters can drift;
// this set cannot: entries leave only when the process really exits.
const liveChildren = new Set();

/**
 * Launch the main game command detached with output ignored. exec() would
 * buffer the child's stdout with a 1MB cap and KILL the process when it
 * overflows - xenia logs enough at boot to hit that within seconds, which
 * looked like "launches and then closes". The launcher has no business
 * capturing emulator output anyway, and this also lets /launch respond as
 * soon as the game starts instead of when it exits.
 *
 * cwd must be a writable directory, ideally the emulator's own folder: a
 * packaged build's backend inherits the install dir (C:\Program Files\
 * EmuCenter) as cwd, where xenia canary fail-fasts (0xc0000409 in
 * ucrtbase) seconds into boot because it cannot write relative to cwd.
 * Portable emulators in general expect to run from their own directory.
 */
function launchDetached(command, cwd) {
    return new Promise((resolve, reject) => {
        console.log(`Launching: ${command} (cwd: ${cwd})`);
        const child = spawn(command, [], {
            shell: platform === 'win32' ? 'cmd.exe' : '/bin/sh',
            cwd,
            detached: true,
            stdio: 'ignore',
            windowsHide: false,
        });
        child.once('error', reject);
        child.once('spawn', () => {
            // Tell the Electron shell (fork IPC) that a game is running:
            // the backend is a background process with no foreground
            // rights on Windows, so the emulator window opens BEHIND the
            // fullscreen launcher until the shell promotes it
            // (bringGameForward). cmd /c and /bin/sh -c both wait for
            // the emulator, so this child's exit tracks the game's exit.
            // `remaining` carries the authoritative live count;
            // /launch-status exposes it for diagnostics.
            liveChildren.add(child);
            child.once('exit', () => {
                liveChildren.delete(child);
                console.log(`[Launch] Game process exited (${liveChildren.size} still running)`);
                if (process.send) {
                    try { process.send({ type: 'game-exited', remaining: liveChildren.size }); } catch { /* shell gone */ }
                }
            });
            if (process.send) {
                try { process.send({ type: 'game-started', remaining: liveChildren.size, pid: child.pid }); } catch { /* shell gone */ }
            }
            child.unref();
            resolve();
        });
    });
}

/**
 * Execute a command with proper platform handling
 */
function executeCommand(command) {
    return new Promise((resolve, reject) => {
        console.log(`Executing: ${command} `);

        // Platform-specific command execution
        const options = {
            shell: platform === 'win32' ? 'cmd.exe' : '/bin/sh',
            windowsHide: false, // Show window on Windows
        };

        const child = exec(command, options, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message} `);
                reject(error);
                return;
            }
            if (stderr && !stderr.includes('deprecated')) {
                console.error(`stderr: ${stderr} `);
            }
            if (stdout) {
                console.log(`stdout: ${stdout} `);
            }
            resolve({ stdout, stderr });
        });

        // Detach the process so it continues running after the server response
        child.unref();
    });
}

/**
 * POST /launch
 * Launch a game or application
 */
app.post('/launch', async (req, res) => {
    try {
        const { command, preferredController } = req.body;

        if (!command || typeof command !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid command provided'
            });
        }

        const { mainCommand, scripts } = parseCommand(command);

        // One launch per human intent: the virtual pad echoes physical
        // input one frame later and double A-presses happen easily on a
        // handheld, which used to spawn a SECOND emulator instance. That
        // hidden instance then kept the shell's running-games count above
        // zero, so the launcher stayed minimized after the real game
        // closed. Anything inside 1.5s is the same press.
        const nowMs = Date.now();
        if (nowMs - lastLaunchAt < 1500) {
            console.log('[Launch] Duplicate launch ignored (debounce)');
            // ignored:true lets the frontend keep the spinner without
            // counting a second play for the same human press.
            return res.json({ success: true, ignored: true, message: 'Duplicate launch ignored' });
        }
        lastLaunchAt = nowMs;

        // Tactile press-feedback right away (the card spinner is the
        // visual half, drawn by the frontend on the pressed card)
        rumbleLaunchFeedback();

        // Template tokens in script values, ported from the original EmuCenter's
        // command_cleaner: 'vcontroller' becomes the preferred controller index,
        // 'emupath' the directory of the (quoted) emulator executable. The main
        // command is left untouched, faithful to the original. When the virtual
        // pad aggregator is running, its slot wins over the manual setting -
        // that is the whole point: emulators bind to the stable virtual pad.
        const aggregatorSlot = virtualPad.running ? virtualPad.slot : -1;
        const vcontroller = String(aggregatorSlot >= 0
            ? aggregatorSlot
            : (Number.isInteger(preferredController) ? preferredController : -1));
        const exeMatch = mainCommand.match(/^\s*"([^"]+)"/);
        const emupath = exeMatch ? path.dirname(exeMatch[1]) : '';
        for (const script of scripts) {
            script.value = script.value
                .replace(/vcontroller/g, vcontroller)
                .replace(/emupath/g, emupath);
        }

        // Execute pre-launch scripts
        for (const script of scripts.filter(s => s.type === 'pre')) {
            console.log(`Executing pre - launch script: ${script.name} `);
            try {
                await executeCommand(`${script.name} ${script.value} `);
                // Small delay between scripts
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Pre - launch script failed: ${error.message} `);
                // Continue anyway - don't fail the launch
            }
        }

        // Original-EmuCenter-format runner scripts ("?python:./scripts/x.py=args")
        // execute before launch as "<runner> <script> <args>", matching the
        // original's command_cleaner behavior where all hooks ran pre-launch.
        for (const script of scripts.filter(s => s.type !== 'pre' && s.type !== 'post')) {
            console.log(`Executing runner script: ${script.type} ${script.name} `);
            try {
                await executeCommand(`${script.type} ${script.name} ${script.value} `);
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Runner script failed: ${error.message} `);
                // Continue anyway - don't fail the launch
            }
        }

        // Launch from the emulator's own directory (see launchDetached's
        // comment on why cwd matters); fall back to the home dir, which is
        // at least writable - never the read-only install dir we inherit.
        let launchCwd = os.homedir();
        if (emupath) {
            try { await fs.access(emupath); launchCwd = emupath; } catch { /* fall back */ }
        }

        // Execute main command (fire-and-forget; see launchDetached)
        await launchDetached(mainCommand, launchCwd);

        // Execute post-launch scripts
        for (const script of scripts.filter(s => s.type === 'post')) {
            console.log(`Executing post - launch script: ${script.name} `);
            try {
                await executeCommand(`${script.name} ${script.value} `);
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Post - launch script failed: ${error.message} `);
            }
        }

        res.json({
            success: true,
            message: 'Application launched successfully'
        });

    } catch (error) {
        console.error('Launch error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to launch application'
        });
    }
});

/**
 * GET /launch-status
 * How many launched games are still actually running. Diagnostic mirror
 * of the fork-IPC `remaining` count; the shell no longer polls it - the
 * game-exited message drives the foreground hand-back.
 */
app.get('/launch-status', (req, res) => {
    res.json({ running: liveChildren.size });
});

/**
 * POST /scan
 * Scan a directory for game files
 * Body: { gamesPath: string, excludedExtensions: string[] }
 */
app.post('/scan', async (req, res) => {
    try {
        const { gamesPath, excludedExtensions = [] } = req.body;

        if (!gamesPath || typeof gamesPath !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid gamesPath provided'
            });
        }

        console.log(`[Scan] Scanning directory: ${gamesPath} `);
        console.log(`[Scan] Excluded extensions: `, excludedExtensions);

        const fs = require('fs');
        const path = require('path');

        // Check if directory exists
        if (!fs.existsSync(gamesPath)) {
            console.error(`[Scan] Directory does not exist: ${gamesPath} `);
            return res.status(400).json({
                success: false,
                error: `Directory does not exist: ${gamesPath} `
            });
        }

        // Check if it's a directory
        const stats = fs.statSync(gamesPath);
        if (!stats.isDirectory()) {
            console.error(`[Scan] Path is not a directory: ${gamesPath} `);
            return res.status(400).json({
                success: false,
                error: `Path is not a directory: ${gamesPath} `
            });
        }

        // Read directory contents
        const files = fs.readdirSync(gamesPath);
        console.log(`[Scan] Found ${files.length} items in directory`);

        // Filter out hidden entries and excluded extensions. Directories ARE
        // included - PS3 titles and extracted games are folders, and the
        // legacy version listed them (this is how rpcs3 games show up).
        const games = files.filter(file => {
            const fullPath = path.join(gamesPath, file);

            if (file.startsWith('.')) return false;

            try {
                fs.statSync(fullPath);
            } catch (e) {
                console.warn(`[Scan] Error checking ${file}: `, e.message);
                return false;
            }

            // Exclusion matches the end of the name OR any dot-segment, so
            // ".bin" also catches double extensions like "track01.bin.ecm"
            // (the legacy behavior), and extensionless entries like
            // "backups" can be excluded by name.
            const lower = file.toLowerCase();
            const segments = lower.split('.').slice(1).map(s => '.' + s);
            const isExcluded = excludedExtensions.some(ext => {
                const e = ext.toLowerCase();
                return lower.endsWith(e) || segments.includes(e);
            });

            if (isExcluded) {
                console.log(`[Scan] Excluded: ${file} `);
                return false;
            }

            return true;
        }).map(file => ({
            name: file,
            path: path.join(gamesPath, file)
        }));

        console.log(`[Scan] Discovered ${games.length} games`);
        games.forEach(game => console.log(`[Scan] - ${game.name} `));

        res.json({
            success: true,
            games,
            count: games.length
        });

    } catch (error) {
        console.error('[Scan] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to scan directory'
        });
    }
});

/**
 * Clean game name - remove region codes, file extensions, etc.
 * Known extensions are stripped iteratively so double extensions
 * ("track01.bin.ecm") fully unwrap, while unknown dot-segments
 * ("Game v1.2") survive untouched.
 */
const GAME_EXTENSION_RE = /\.(iso|zip|7z|rar|gb|gba|gbc|nds|3ds|cia|wbfs|wad|rvz|gcm|gcz|ciso|cso|chd|bin|cue|img|mdf|ecm|nsp|xci|xex|zar|elf|pbp|z64|n64|v64|nes|sfc|smc|srl)$/i;

function cleanGameName(name) {
    let cleaned = name;
    // Strip known extensions until none remain
    let prev;
    do {
        prev = cleaned;
        cleaned = cleaned.replace(GAME_EXTENSION_RE, '');
    } while (cleaned !== prev);
    // Remove region codes in parentheses or brackets
    cleaned = cleaned.replace(/\s*[\[\(](USA|EUR|JAP|JPN|Europe|Japan|World|En|Fr|De|Es|It|Ko|Zh|Rev\s*\d*|v\d+(\.\d+)?|Disc\s*\d+)[\]\)]/gi, '');
    // Clean up multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

/**
 * Handhelds spend half their lives offline: an IGDB cover is downloaded
 * into IMAGES_DIR the first time it is found, named exactly like a
 * custom cover (cleanGameName + .jpg), so every later request hits the
 * local exact-match step with no network involved at all. Cover art
 * effectively never changes; the refresh path is the card's delete
 * button, which removes the file and lets the next view re-query IGDB.
 * If the download itself fails (offline mid-first-fetch), fall back to
 * redirecting to the IGDB CDN like before, with the placeholder
 * gradient as the final fallback.
 */
function safeImageBaseName(name) {
    // Windows-forbidden filename characters; game names come from real
    // files so this is almost always the identity
    return name.replace(/[<>:"/\\|?*]/g, '-').trim();
}

async function downloadCoverToImages(url, cleanedName) {
    const base = safeImageBaseName(cleanedName);
    if (!base) return null;
    const dest = path.join(IMAGES_DIR, `${base}.jpg`);
    const tmp = `${dest}.download`;
    try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const buf = Buffer.from(await resp.arrayBuffer());
        if (!buf.length) return null;
        // Write-then-rename so a torn download can never be served
        await fs.writeFile(tmp, buf);
        await fs.rename(tmp, dest);
        console.log(`[Image] Cached IGDB cover locally: ${path.basename(dest)} (${buf.length} bytes)`);
        return path.basename(dest);
    } catch (e) {
        try { require('fs').unlinkSync(tmp); } catch { /* nothing partial left */ }
        console.log(`[Image] Cover download failed (${e.message}) - serving remote URL`);
        return null;
    }
}

/**
 * GET /game-image/:gameName
 * Find best matching image for a game name (case-insensitive, smart matching)
 */
app.get('/game-image/:gameName', async (req, res) => {
    try {
        const gameName = decodeURIComponent(req.params.gameName);
        const cleanedName = cleanGameName(gameName);
        const cleanedNameLower = cleanedName.toLowerCase();

        const imagesDir = IMAGES_DIR;

        // Check if images directory exists
        if (!require('fs').existsSync(imagesDir)) {
            return res.status(404).json({ success: false, error: 'Images directory not found' });
        }

        // Get available images
        const availableImages = require('fs').readdirSync(imagesDir);
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
        const images = availableImages.filter(f =>
            imageExtensions.some(ext => f.toLowerCase().endsWith(ext))
        );

        // 1. Exact match (case-insensitive) - both the raw clean name and
        // the sanitized form that cached IGDB downloads are saved under
        const exactBases = [...new Set([cleanedName, safeImageBaseName(cleanedName)])];
        for (const ext of imageExtensions) {
            for (const base of exactBases) {
                const candidate = `${base}${ext}`.toLowerCase();
                for (const img of images) {
                    if (img.toLowerCase() === candidate) {
                        console.log(`[Image] Exact match: ${img} for ${gameName}`);
                        return res.redirect(`/images/${encodeURIComponent(img)}`);
                    }
                }
            }
        }

        // 2. Hyphen/space normalized match (substring)
        const normalizedName = cleanedNameLower.replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
        let bestHyphenMatch = null;
        let bestHyphenLen = 0;

        for (const img of images) {
            const imgRoot = img.replace(/\.[^/.]+$/, ''); // Remove extension
            const normalizedImg = imgRoot.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ');

            // Check if image name is contained in game name
            if (normalizedName.includes(normalizedImg) && normalizedImg.length > bestHyphenLen) {
                bestHyphenMatch = img;
                bestHyphenLen = normalizedImg.length;
            }
        }

        if (bestHyphenMatch) {
            console.log(`[Image] Hyphen match: ${bestHyphenMatch} for ${gameName}`);
            return res.redirect(`/images/${encodeURIComponent(bestHyphenMatch)}`);
        }

        // 3. Franchise/word boundary match (longest match wins)
        let bestMatch = null;
        let bestMatchLen = 0;

        for (const img of images) {
            const imgRoot = img.replace(/\.[^/.]+$/, '');
            const imgLower = imgRoot.toLowerCase();

            // Word boundary regex
            const pattern = new RegExp('\\b' + imgLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');

            if (pattern.test(cleanedNameLower) && imgRoot.length > bestMatchLen) {
                bestMatch = img;
                bestMatchLen = imgRoot.length;
            }
        }

        if (bestMatch) {
            console.log(`[Image] Franchise match: ${bestMatch} for ${gameName}`);
            return res.redirect(`/images/${encodeURIComponent(bestMatch)}`);
        }

        // 4. Try IGDB API as fallback
        console.log(`[Image] No local match for: ${gameName}, trying IGDB...`);

        // Check cache first
        const cacheKey = cleanedNameLower;
        if (igdbCache.has(cacheKey)) {
            const cachedUrl = igdbCache.get(cacheKey);
            if (cachedUrl) {
                console.log(`[Image] IGDB cache hit: ${cachedUrl}`);
                // A memory hit means the earlier download attempt failed
                // (otherwise the local exact match would have won) - retry
                // pinning it to disk, then fall back to the remote URL
                const saved = await downloadCoverToImages(cachedUrl, cleanedName);
                if (saved) return res.redirect(`/images/${encodeURIComponent(saved)}`);
                return res.redirect(cachedUrl);
            } else {
                // Cached as "not found"
                return res.status(404).json({ success: false, error: 'No matching image found' });
            }
        }

        // Persistent negative cache: known misses skip IGDB entirely
        const negAt = loadNegativeCovers().get(cacheKey);
        if (negAt && Date.now() - negAt < NEGATIVE_TTL_MS) {
            return res.status(404).json({ success: false, error: 'No matching image found' });
        }

        // Fetch from IGDB (throttled - see queueIGDB)
        const igdbUrl = await queueIGDB(() => getIGDBCover(gameName));

        // Cache hits and authoritative misses (null), never infrastructure
        // failures (undefined) - those must retry on the next request.
        if (igdbUrl !== undefined) {
            igdbCache.set(cacheKey, igdbUrl);
            if (igdbUrl === null) {
                loadNegativeCovers().set(cacheKey, Date.now());
                saveNegativeCovers();
            } else {
                loadNegativeCovers().delete(cacheKey);
            }
        }

        if (igdbUrl) {
            console.log(`[Image] IGDB found: ${igdbUrl}`);
            const saved = await downloadCoverToImages(igdbUrl, cleanedName);
            if (saved) return res.redirect(`/images/${encodeURIComponent(saved)}`);
            return res.redirect(igdbUrl);
        }

        // No match anywhere
        console.log(`[Image] No match found anywhere for: ${gameName}`);
        return res.status(404).json({ success: false, error: 'No matching image found' });

    } catch (error) {
        console.error('[Image] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        platform,
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /emulator-icon/:name
 * Best-match icon for an emulator: custom upload > canonical match > exact.
 */
app.get('/emulator-icon/:name', (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const file = findEmulatorIcon(name);
    if (file) {
        return res.sendFile(file);
    }
    res.status(404).json({ success: false, error: 'No icon found' });
});

/**
 * POST /upload-emulator-icon
 * Custom icon for an emulator (multipart: emulatorName + image).
 */
const emuIconStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, CUSTOM_EMU_ICONS_DIR);
    },
    filename: function (req, file, cb) {
        const emulatorName = req.body.emulatorName;
        if (!emulatorName) return cb(new Error('Emulator name is required'));
        // Sanitized: the emulator name becomes the file base name
        const safe = emulatorName.replace(/[^a-z0-9 _.-]/gi, '_').trim();
        cb(null, `${safe}${path.extname(file.originalname).toLowerCase()}`);
    }
});
const uploadEmuIcon = multer({ storage: emuIconStorage });

app.post('/upload-emulator-icon', uploadEmuIcon.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image file provided' });
        }
        console.log(`[EmuIcon] Custom icon uploaded for: ${req.body.emulatorName}`);
        res.json({ success: true, filename: req.file.filename });
    } catch (error) {
        console.error('[EmuIcon] Upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /virtual-pad
 * Status of the virtual controller aggregator
 */
app.get('/virtual-pad', (req, res) => {
    res.json({ success: true, status: virtualPad.getStatus() });
});

/**
 * POST /virtual-pad
 * Enable or disable the aggregator. Body: { enabled: boolean }
 */
app.post('/virtual-pad', async (req, res) => {
    try {
        const { enabled } = req.body;
        const status = enabled ? await virtualPad.start() : await virtualPad.stop();
        res.json({ success: !status.error, status });
    } catch (error) {
        console.error('[VirtualPad] toggle error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Execute a platform-specific dialog command
 */
async function runDialogCommand(command) {
    return new Promise((resolve) => {
        const options = {
            shell: platform === 'win32' ? 'cmd.exe' : '/bin/sh',
        };

        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                console.error(`Dialog error: ${error.message}`);
                resolve(null);
                return;
            }
            const result = stdout.trim();
            resolve(result || null);
        });
    });
}

/**
 * macOS 'choose file' hands .app bundles over as directory paths, and
 * /bin/sh exec of a directory dies instantly ("is a directory", exit 126)
 * while the fire-and-forget launcher still reports success - a silent
 * no-op launch. Resolve the bundle to its real executable instead.
 */
function resolveMacAppBundle(selectedPath) {
    const trimmed = selectedPath.replace(/\/+$/, '');
    if (!trimmed.toLowerCase().endsWith('.app')) return selectedPath;

    let execName = null;
    try {
        // plutil ships with macOS and handles binary plists
        const xml = execFileSync(
            '/usr/bin/plutil',
            ['-convert', 'xml1', '-o', '-', path.join(trimmed, 'Contents', 'Info.plist')],
            { encoding: 'utf8' }
        );
        const match = xml.match(/<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/);
        if (match) execName = match[1];
    } catch { /* fall back to the bundle name */ }
    if (!execName) execName = path.basename(trimmed, '.app');

    const binPath = path.join(trimmed, 'Contents', 'MacOS', execName);
    if (require('fs').existsSync(binPath)) {
        console.log(`[Picker] Resolved app bundle to executable: ${binPath}`);
        return binPath;
    }
    console.warn(`[Picker] Could not resolve executable inside ${trimmed}; keeping bundle path`);
    return selectedPath;
}

/**
 * POST /pick-file
 * Open native file picker dialog
 */
app.post('/pick-file', async (req, res) => {
    try {
        let selectedPath = null;

        if (platform === 'darwin') {
            // macOS - Use AppleScript via osascript
            const script = `
                set selectedFile to choose file with prompt "Select Emulator Executable" of type {"public.unix-executable", "com.apple.application-bundle", "public.executable", "public.data"}
                POSIX path of selectedFile
            `;
            selectedPath = await runDialogCommand(`osascript -e '${script}'`);
            if (selectedPath) {
                selectedPath = resolveMacAppBundle(selectedPath);
            }

        } else if (platform === 'win32') {
            // Windows - Use PowerShell script
            const command = `powershell -ExecutionPolicy Bypass -File "${pickFileScript}"`;
            const { stdout, stderr } = await new Promise((resolve) => {
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[Picker] PowerShell PickFile error: ${error.message}`);
                        resolve({ stdout: '', stderr: error.message });
                    } else {
                        resolve({ stdout, stderr });
                    }
                });
            });
            selectedPath = stdout.trim();

        } else if (platform === 'linux') {
            // Linux - Use Zenity (must be installed) or KDialog
            // Try Zenity first
            selectedPath = await runDialogCommand('zenity --file-selection --title="Select Emulator Executable"');
        }

        if (selectedPath) {
            console.log(`[Picker] Selected file: ${selectedPath}`);
            res.json({ success: true, path: selectedPath });
        } else {
            console.log('[Picker] Selection cancelled');
            res.json({ success: false, cancelled: true });
        }

    } catch (error) {
        console.error('[Picker] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /pick-directory
 * Open native directory picker dialog
 */
app.post('/pick-directory', async (req, res) => {
    try {
        let selectedPath = null;

        if (platform === 'darwin') {
            // macOS
            const script = `
                set selectedFolder to choose folder with prompt "Select Games Directory"
                POSIX path of selectedFolder
            `;
            selectedPath = await runDialogCommand(`osascript -e '${script}'`);

        } else if (platform === 'win32') {
            // Windows - PowerShell FolderBrowserDialog
            const command = `powershell -ExecutionPolicy Bypass -File "${pickFolderScript}"`;
            const { stdout, stderr } = await new Promise((resolve) => {
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[Picker] PowerShell PickFolder error: ${error.message}`);
                        resolve({ stdout: '', stderr: error.message });
                    } else {
                        resolve({ stdout, stderr });
                    }
                });
            });
            selectedPath = stdout.trim();

        } else if (platform === 'linux') {
            // Linux - Zenity
            selectedPath = await runDialogCommand('zenity --file-selection --directory --title="Select Games Directory"');
        }

        if (selectedPath) {
            // Remove trailing slash if present (common in macOS output)
            if (selectedPath.endsWith(path.sep)) selectedPath = selectedPath.slice(0, -1);

            console.log(`[Picker] Selected directory: ${selectedPath}`);
            res.json({ success: true, path: selectedPath });
        } else {
            console.log('[Picker] Selection cancelled');
            res.json({ success: false, cancelled: true });
        }

    } catch (error) {
        console.error('[Picker] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, IMAGES_DIR);
    },
    filename: function (req, file, cb) {
        // Use game name from body if available, otherwise original name
        // We expect gameName in the body
        const gameName = req.body.gameName;
        if (!gameName) {
            return cb(new Error('Game name is required'));
        }

        const ext = path.extname(file.originalname);
        const cleanedName = cleanGameName(gameName);
        cb(null, `${cleanedName}${ext}`);
    }
});

const upload = multer({ storage: storage });

/**
 * POST /upload-image
 * Upload a custom image for a game
 */
app.post('/upload-image', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image file provided' });
        }

        console.log(`[Image] Uploaded custom image for: ${req.body.gameName}`);

        // Clear cache for this game
        const cleanedName = cleanGameName(req.body.gameName);
        const cacheKey = cleanedName.toLowerCase();
        igdbCache.delete(cacheKey);

        res.json({
            success: true,
            filename: req.file.filename,
            path: `/images/${req.file.filename}`
        });
    } catch (error) {
        console.error('[Image] Upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /delete-image
 * Delete a custom image for a game
 */
app.delete('/delete-image', async (req, res) => {
    try {
        const { gameName } = req.body;
        if (!gameName) {
            return res.status(400).json({ success: false, error: 'Game name is required' });
        }

        const cleanedName = cleanGameName(gameName);
        const imagesDir = IMAGES_DIR;

        // Find matching files
        const files = await fs.readdir(imagesDir);
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];

        let deleted = false;

        for (const file of files) {
            const fileBase = path.parse(file).name;
            if (fileBase === cleanedName && imageExtensions.includes(path.extname(file).toLowerCase())) {
                await fs.unlink(path.join(imagesDir, file));
                console.log(`[Image] Deleted custom image: ${file}`);
                deleted = true;
            }
        }

        // Clear caches so the next view re-queries IGDB fresh - this is
        // the per-game "refresh cover" path
        const cacheKey = cleanedName.toLowerCase();
        igdbCache.delete(cacheKey);
        if (loadNegativeCovers().delete(cacheKey)) saveNegativeCovers();

        if (deleted) {
            res.json({ success: true, message: 'Image deleted successfully' });
        } else {
            res.json({ success: false, message: 'No custom image found to delete' });
        }

    } catch (error) {
        console.error('[Image] Delete error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Re-enable the aggregator on boot if the saved settings ask for it
async function restoreVirtualPad() {
    try {
        const data = await fs.readFile(path.join(CONFIG_DIR, 'settings.json'), 'utf8');
        const settings = JSON.parse(data);
        if (settings && settings.virtualPadEnabled) {
            console.log('[VirtualPad] Restoring aggregator from saved settings...');
            await virtualPad.start();
        }
    } catch { /* no settings yet, or aggregator unavailable */ }
}

ensureImagesDir().then(() => {
    app.listen(PORT, () => {
        console.log(`EmuCenter backend running on port ${PORT} `);
        console.log(`Platform: ${platform} `);
        console.log(`Images directory: ${IMAGES_DIR}`);
        console.log(`Ready to launch applications!`);
        restoreVirtualPad();
    });
});

