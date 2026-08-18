const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getStatus: () => ipcRenderer.invoke('get-status'),
    toggleHotspot: (turnOn) => ipcRenderer.invoke('toggle-hotspot', turnOn),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    hideWindow: () => ipcRenderer.send('hide-window'),
    quitApp: () => ipcRenderer.send('quit-app'),
    onItemReceived: (callback) => ipcRenderer.on('item-received', (event, data) => callback(data)),
    updateSettings: (saveToFile, copyToClipboard) => ipcRenderer.send('update-settings', { saveToFile, copyToClipboard }),
    getHotspotQR: () => ipcRenderer.invoke('get-hotspot-qr'),
    queueItem: (data) => ipcRenderer.invoke('queue-item', data),
    selectFile: () => ipcRenderer.invoke('select-file')
});
