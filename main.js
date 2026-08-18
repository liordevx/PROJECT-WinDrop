const { app, BrowserWindow, globalShortcut, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const { startServer, setUploadDir, getUploadDir, toggleHotspot, isHotspotOn, cleanupAndExit } = require('./server');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    process.exit(0);
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.setAlwaysOnTop(true);
        mainWindow.focus();
        mainWindow.setAlwaysOnTop(false);
    }
});

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 850,
        show: false,
        frame: false,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show(); // Show the window immediately
    });


}

app.whenReady().then(() => {
    createWindow();

    // Start the Express server
    startServer((data) => {
        if (mainWindow) {
            mainWindow.webContents.send('item-received', data);
            
            const bounds = mainWindow.getBounds();
            if (bounds.height < 650) {
                mainWindow.setBounds({ ...bounds, height: 680 });
            }
        }
    });

    // Register global shortcut
    const ret = globalShortcut.register('CommandOrControl+Alt+S', () => {
        if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
            mainWindow.minimize();
        } else {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.setAlwaysOnTop(true);
            mainWindow.focus();
            mainWindow.setAlwaysOnTop(false);
        }
    });

    if (!ret) {
        dialog.showErrorBox('Shortcut Conflict', 'Could not register Ctrl+Alt+S because another application is already using it.');
    }

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    cleanupAndExit();
    globalShortcut.unregisterAll();
});

// IPC Handlers
ipcMain.handle('get-status', () => {
    const { getToken } = require('./server');
    return {
        hostname: os.hostname(),
        serverRunning: true,
        hotspotOn: isHotspotOn(),
        uploadDir: getUploadDir(),
        token: getToken()
    };
});

ipcMain.on('update-settings', (event, { saveToFile, copyToClipboard }) => {
    const { setSettings } = require('./server');
    setSettings(saveToFile, copyToClipboard);
});

ipcMain.handle('toggle-hotspot', async (event, turnOn) => {
    return await toggleHotspot(turnOn);
});

ipcMain.handle('get-hotspot-qr', async () => {
    const { getHotspotQR } = require('./server');
    return await getHotspotQR();
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const selectedDir = result.filePaths[0];
        setUploadDir(selectedDir);
        return selectedDir;
    }
    return null;
});

ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        return {
            path: filePath,
            name: path.basename(filePath)
        };
    }
    return null;
});

ipcMain.on('minimize-window', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.on('hide-window', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});
ipcMain.on('quit-app', () => {
    app.quit();
});

ipcMain.handle('queue-item', (event, data) => {
    const { queueItem } = require('./server');
    return queueItem(data);
});
