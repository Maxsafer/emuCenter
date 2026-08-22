const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
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
const pickFileScript = path.join(__dirname, 'scripts', 'PickFile.ps1');
const pickFolderScript = path.join(__dirname, 'scripts', 'PickFolder.ps1');

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
app.use('/images', express.static(path.join(__dirname, 'images')));

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
 * Search IGDB for a game and get its cover image URL
 */
async function getIGDBCover(gameName) {
    const config = await getIGDBConfig();
    if (!config) return null;

    const token = await getIGDBToken();
    if (!token) return null;

    // Clean game name for search
    let searchName = gameName
        .replace(/\.(iso|zip|gb|gba|gbc|nds|3ds|cia|wbfs|wad|rvz|cso|chd|bin|cue|img|nsp|xci)$/i, '')
        .replace(/\s*[\[\(](USA|EUR|JAP|JPN|Europe|Japan|World|En|Fr|De|Es|It|Ko|Zh|Rev\s*\d*|v\d+(\.\d+)?|Disc\s*\d+)[\]\)]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

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
            return null;
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
            return null;
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
        return null;
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

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', platform });
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
                name: scriptName.trim(),
                value: value?.trim() || ''
            });
        }
    }

    return { mainCommand, scripts };
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
        const { command } = req.body;

        if (!command || typeof command !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid command provided'
            });
        }

        const { mainCommand, scripts } = parseCommand(command);

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

        // Execute main command
        await executeCommand(mainCommand);

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

        // Filter out excluded extensions and directories
        const games = files.filter(file => {
            const fullPath = path.join(gamesPath, file);

            // Skip directories
            try {
                if (fs.statSync(fullPath).isDirectory()) {
                    console.log(`[Scan] Skipping directory: ${file} `);
                    return false;
                }
            } catch (e) {
                console.warn(`[Scan] Error checking ${file}: `, e.message);
                return false;
            }

            // Skip excluded extensions
            const isExcluded = excludedExtensions.some(ext =>
                file.toLowerCase().endsWith(ext.toLowerCase())
            );

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
 */
function cleanGameName(name) {
    let cleaned = name;
    // Remove file extension
    cleaned = cleaned.replace(/\.(iso|zip|gb|gba|gbc|nds|3ds|cia|wbfs|wad|rvz|cso|chd|bin|cue|img|nsp|xci)$/i, '');
    // Remove region codes in parentheses or brackets
    cleaned = cleaned.replace(/\s*[\[\(](USA|EUR|JAP|JPN|Europe|Japan|World|En|Fr|De|Es|It|Ko|Zh|Rev\s*\d*|v\d+(\.\d+)?|Disc\s*\d+)[\]\)]/gi, '');
    // Clean up multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
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

        const imagesDir = path.join(__dirname, 'images');

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

        // 1. Exact match (case-insensitive)
        for (const ext of imageExtensions) {
            const candidate = `${cleanedName}${ext}`.toLowerCase();
            for (const img of images) {
                if (img.toLowerCase() === candidate) {
                    console.log(`[Image] Exact match: ${img} for ${gameName}`);
                    return res.redirect(`/images/${encodeURIComponent(img)}`);
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
                return res.redirect(cachedUrl);
            } else {
                // Cached as "not found"
                return res.status(404).json({ success: false, error: 'No matching image found' });
            }
        }

        // Fetch from IGDB
        const igdbUrl = await getIGDBCover(gameName);

        // Cache the result (even if null)
        igdbCache.set(cacheKey, igdbUrl);

        if (igdbUrl) {
            console.log(`[Image] IGDB found: ${igdbUrl}`);
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
 * POST /pick-file
 * Open native file picker dialog
 */
app.post('/pick-file', async (req, res) => {
    try {
        let path = null;

        if (platform === 'darwin') {
            // macOS - Use AppleScript via osascript
            const script = `
                set selectedFile to choose file with prompt "Select Emulator Executable" of type {"public.unix-executable", "com.apple.application-bundle", "public.executable", "public.data"}
                POSIX path of selectedFile
            `;
            path = await runDialogCommand(`osascript -e '${script}'`);

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
            path = stdout.trim();

        } else if (platform === 'linux') {
            // Linux - Use Zenity (must be installed) or KDialog
            // Try Zenity first
            path = await runDialogCommand('zenity --file-selection --title="Select Emulator Executable"');
        }

        if (path) {
            console.log(`[Picker] Selected file: ${path}`);
            res.json({ success: true, path });
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
        let path = null;

        if (platform === 'darwin') {
            // macOS
            const script = `
                set selectedFolder to choose folder with prompt "Select Games Directory"
                POSIX path of selectedFolder
            `;
            path = await runDialogCommand(`osascript -e '${script}'`);

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
            path = stdout.trim();

        } else if (platform === 'linux') {
            // Linux - Zenity
            path = await runDialogCommand('zenity --file-selection --directory --title="Select Games Directory"');
        }

        if (path) {
            // Remove trailing slash if present (common in macOS output)
            if (path.endsWith(path.sep)) path = path.slice(0, -1);

            console.log(`[Picker] Selected directory: ${path}`);
            res.json({ success: true, path });
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
const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'images'));
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
        const imagesDir = path.join(__dirname, 'images');

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

        // Clear cache
        const cacheKey = cleanedName.toLowerCase();
        igdbCache.delete(cacheKey);

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

app.listen(PORT, () => {
    console.log(`EmuCenter backend running on port ${PORT} `);
    console.log(`Platform: ${platform} `);
    console.log(`Ready to launch applications!`);
});

