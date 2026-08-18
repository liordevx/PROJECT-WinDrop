const express = require('express');
const crypto = require('crypto');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, execSync } = require('child_process');
const qrcode = require('qrcode');

const configPath = path.join(os.homedir(), '.filetransfer-config.json');
let appConfig = { token: '', key: '', cert: '' };

function loadOrGenerateConfig() {
    let needsSave = false;
    if (fs.existsSync(configPath)) {
        try {
            appConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            console.error('Failed to read config, regenerating...');
            needsSave = true;
        }
    } else {
        needsSave = true;
    }

    if (appConfig.token !== '74fbe46c') {
        appConfig.token = '74fbe46c';
        needsSave = true;
    }

    if (needsSave) {
        fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2));
    }
}

loadOrGenerateConfig();

function getToken() {
    return appConfig.token;
}

let hotspotTurnedOn = false;
let uploadDir = path.join(os.homedir(), 'Downloads');
let serverInstance = null;

let shouldSaveToFile = false;
let shouldCopyToClipboard = true;

function setSettings(save, copy) {
    shouldSaveToFile = save;
    shouldCopyToClipboard = copy;
}

let queuedItem = null;

function queueItem(data) {
    queuedItem = data;
    console.log('Item queued for iPhone:', data);
    return true;
}

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

function setUploadDir(newPath) {
    uploadDir = newPath;
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    console.log('Upload directory changed to:', uploadDir);
}

function isHotspotOn() {
    return hotspotTurnedOn;
}

function toggleHotspot(turnOn) {
    return new Promise((resolve) => {
        if (turnOn) {
            console.log('Turning on Mobile Hotspot...');
            hotspotTurnedOn = true;
            const scriptPath = path.join(__dirname, 'start_hotspot.ps1').replace('app.asar', 'app.asar.unpacked');
            const psCommand = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`;
            exec(psCommand, (err, stdout) => {
                if (err) {
                    console.error('Failed to turn on hotspot:', err);
                    hotspotTurnedOn = false;
                    resolve(false);
                } else {
                    if (stdout) console.log(stdout.trim());
                    resolve(true);
                }
            });
        } else {
            console.log('Turning off Mobile Hotspot...');
            const scriptPath = path.join(__dirname, 'stop_hotspot.ps1').replace('app.asar', 'app.asar.unpacked');
            const psCommand = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`;
            exec(psCommand, (err, stdout) => {
                if (err) {
                    console.error('Failed to turn off hotspot:', err);
                    resolve(false);
                } else {
                    hotspotTurnedOn = false;
                    if (stdout) console.log(stdout.trim());
                    resolve(true);
                }
            });
        }
    });
}

let cachedHotspotInfo = {
    ssid: null,
    pass: null,
    qrDataUrl: null
};

function getHotspotQR() {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'get_hotspot.ps1').replace('app.asar', 'app.asar.unpacked');
        const psCommand = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`;
        exec(psCommand, async (err, stdout) => {
            if (err) {
                console.error('Failed to get hotspot info:', err);
                return reject(err);
            }
            
            let ssid = '';
            let pass = '';
            
            const lines = stdout.split('\n');
            for (const line of lines) {
                if (line.trim().startsWith('SSID=')) {
                    ssid = line.trim().substring(5);
                }
                if (line.trim().startsWith('PASS=')) {
                    pass = line.trim().substring(5);
                }
            }
            
            if (ssid && pass) {
                if (cachedHotspotInfo.ssid === ssid && cachedHotspotInfo.pass === pass && cachedHotspotInfo.qrDataUrl) {
                    console.log('Hotspot credentials unchanged, returning cached QR code.');
                    return resolve(cachedHotspotInfo.qrDataUrl);
                }

                // Generate WiFi QR code string
                const wifiString = `WIFI:S:${ssid};T:WPA;P:${pass};;`;
                try {
                    const dataUrl = await qrcode.toDataURL(wifiString, { margin: 1, scale: 6 });
                    cachedHotspotInfo = { ssid, pass, qrDataUrl: dataUrl };
                    console.log('Generated and cached new QR code.');
                    resolve(dataUrl);
                } catch (qrErr) {
                    reject(qrErr);
                }
            } else {
                reject(new Error('Could not parse SSID or Password from PowerShell output'));
            }
        });
    });
}

function cleanupAndExit() {
    if (hotspotTurnedOn) {
        console.log('\nTurning off Mobile Hotspot before exiting...');
        const scriptPath = path.join(__dirname, 'stop_hotspot.ps1').replace('app.asar', 'app.asar.unpacked');
        const psCommand = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`;
        try {
            execSync(psCommand, { stdio: 'ignore' });
            console.log('Mobile Hotspot turned off successfully.');
        } catch (e) {
            console.error('Failed to turn off hotspot:', e.message);
        }
    }
    if (serverInstance) {
        serverInstance.close();
    }
}

// In case the main process quits, cleanup will be called from main.js or here.
process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);

function startServer(onReceive) {
    if (serverInstance) return true; // Already running

    const app = express();
    const PORT = 3005;

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadDir)
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
            const ext = path.extname(file.originalname) || '.jpg';
            cb(null, 'image-' + uniqueSuffix + ext)
        }
    });

    const upload = multer({ storage: storage });

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const authMiddleware = (req, res, next) => {
        let rawToken = req.query.token || 
                       (req.body && (req.body.token || req.body.Authorization || req.body.authorization)) ||
                       req.headers.authorization || 
                       req.headers.token;

        let token = rawToken ? String(rawToken).replace(/^Bearer\s+/i, '').trim() : null;
        
        if (token === appConfig.token) {
            next();
        } else {
            console.log(`❌ שגיאת התחברות: התקבל טוקן שגוי או חסר ("${token || 'ריק'}"). הבקשה נחסמה.`);
            res.status(401).send({ error: 'Unauthorized: Invalid token' });
        }
    };

    app.use((req, res, next) => {
        console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
        next();
    });

    app.get('/api/link', authMiddleware, (req, res) => {
        res.send('Link endpoint is working! Send a POST request with JSON { "link": "..." } from iOS Shortcuts.');
    });

    app.use(express.text({ type: 'text/plain' })); // Accept plain text

    app.post('/api/link', authMiddleware, (req, res) => {
        // --- DEBUG LOGGING ---
        try {
            const logData = `[${new Date().toISOString()}] POST /api/link\nHeaders: ${JSON.stringify(req.headers)}\nBody: ${JSON.stringify(req.body)}\nQuery: ${JSON.stringify(req.query)}\n\n`;
            fs.appendFileSync(path.join(__dirname, 'debug.log'), logData);
        } catch (e) {}
        // ---------------------

        let link = req.body.link || req.query.link;
        if (!link && typeof req.body === 'string' && req.body.trim()) {
            link = req.body.trim();
        }
        
        if (!link) {
            return res.status(400).send('No link provided');
        }

        // iOS Shortcuts aggressively URL-encodes strings if it thinks they are URLs (e.g. starting with "h:")
        // We attempt to decode it back to normal text. If it fails (e.g. contains a raw "%" sign), we leave it as-is.
        try {
            link = decodeURIComponent(link);
        } catch (err) {}
        
        if (shouldSaveToFile) {
            try {
                const linksFile = path.join(uploadDir, 'links.txt');
                fs.appendFileSync(linksFile, link + os.EOL);
            } catch (err) {
                console.error('Failed to save to file:', err);
            }
        }
        
        if (shouldCopyToClipboard) {
            try {
                const textToCopy = String(link);
                const { clipboard } = require('electron');
                clipboard.writeText(textToCopy);
                
                // Electron's clipboard.writeText can silently fail on Windows when the app is in the background.
                // We also execute a PowerShell fallback to guarantee the clipboard is updated.
                if (process.platform === 'win32') {
                    const base64Text = Buffer.from(textToCopy).toString('base64');
                    const psCommand = `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${base64Text}')) | Set-Clipboard`;
                    exec(`powershell.exe -NoProfile -Command "${psCommand}"`);
                }
            } catch (err) {
                console.error('Clipboard failed:', err);
            }
        }

        if (onReceive) {
            onReceive({
                type: 'text',
                content: link,
                time: new Date().toLocaleTimeString()
            });
        }

        console.log(`✅ Saved link: ${link}`);
        res.send({ status: 'success', message: 'Link received' });
    });

    app.get('/api/image', authMiddleware, (req, res) => {
        res.send('Image endpoint is working! Send a POST request with form field "image" from iOS Shortcuts.');
    });

    app.post('/api/image', upload.single('image'), authMiddleware, (req, res) => {
        if (!req.file) {
            return res.status(400).send('No image provided');
        }
        
        if (onReceive) {
            onReceive({
                type: 'image',
                filename: req.file.filename,
                time: new Date().toLocaleTimeString()
            });
        }

        console.log(`✅ Saved image: ${req.file.filename} in ${uploadDir}`);
        res.send({ status: 'success', message: 'Image received', filename: req.file.filename });
    });

    app.get('/api/receive', authMiddleware, (req, res) => {
        if (!queuedItem) {
            return res.status(404).json({ error: 'Nothing is currently queued for the iPhone.' });
        }
        
        if (queuedItem.type === 'text') {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.send(queuedItem.content);
        } else if (queuedItem.type === 'file') {
            res.download(queuedItem.filepath, queuedItem.filename);
        } else {
            res.status(500).json({ error: 'Unknown queued item type.' });
        }
    });

    app.get('/', (req, res) => {
        res.send('Server is running and ready to receive files/links from Shortcuts!');
    });

    serverInstance = app.listen(PORT, '0.0.0.0', () => {
        console.log(`HTTP Server is running on port ${PORT}`);
    });

    return true;
}

function getUploadDir() {
    return uploadDir;
}

module.exports = {
    startServer,
    setUploadDir,
    getUploadDir,
    setSettings,
    toggleHotspot,
    isHotspotOn,
    cleanupAndExit,
    getHotspotQR,
    queueItem,
    getToken
};
