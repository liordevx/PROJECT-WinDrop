document.addEventListener('DOMContentLoaded', async () => {
    const hostnameLabel = document.getElementById('hostnameLabel');
    const hotspotToggle = document.getElementById('hotspotToggle');
    const dirPath = document.getElementById('dirPath');
    const changeDirBtn = document.getElementById('changeDirBtn');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const hideBtn = document.getElementById('hideBtn');
    const quitBtn = document.getElementById('quitBtn');

    const tokenLabel = document.getElementById('tokenLabel');
    const copyTokenBtn = document.getElementById('copyTokenBtn');

    // Fetch initial status
    const status = await window.electronAPI.getStatus();
    hostnameLabel.textContent = `Hostname: ${status.hostname}`;
    hotspotToggle.checked = status.hotspotOn;
    tokenLabel.textContent = status.token;

    copyTokenBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(status.token);
        copyTokenBtn.textContent = '✅';
        setTimeout(() => { copyTokenBtn.textContent = '📋'; }, 2000);
    });
    
    // Default dir path based on current location (this will be updated correctly in a real scenario)
    dirPath.textContent = status.uploadDir || "Default (./uploads)";

    const showQRBtn = document.getElementById('showQRBtn');
    const qrModal = document.getElementById('qrModal');
    const qrImage = document.getElementById('qrImage');
    const closeQRBtn = document.getElementById('closeQRBtn');

    if (status.hotspotOn) {
        showQRBtn.style.display = 'block';
    }

    // Toggle Hotspot
    hotspotToggle.addEventListener('change', async (e) => {
        const turnOn = e.target.checked;
        hotspotToggle.disabled = true; // disable while toggling
        showQRBtn.style.display = 'none'; // hide while toggling
        try {
            await window.electronAPI.toggleHotspot(turnOn);
            if (turnOn) {
                showQRBtn.style.display = 'block';
            }
        } catch (err) {
            console.error(err);
            // Revert if failed
            hotspotToggle.checked = !turnOn;
            if (!turnOn) {
                showQRBtn.style.display = 'block';
            }
        }
        hotspotToggle.disabled = false;
    });

    showQRBtn.addEventListener('click', async () => {
        try {
            showQRBtn.textContent = 'Loading...';
            showQRBtn.disabled = true;
            const dataUrl = await window.electronAPI.getHotspotQR();
            qrImage.src = dataUrl;
            qrModal.style.display = 'flex';
        } catch (e) {
            alert('Failed to get Hotspot credentials: ' + e.message);
        } finally {
            showQRBtn.textContent = 'Show Hotspot QR Code';
            showQRBtn.disabled = false;
        }
    });

    closeQRBtn.addEventListener('click', () => {
        qrModal.style.display = 'none';
    });

    // Change Directory
    changeDirBtn.addEventListener('click', async () => {
        const selectedDir = await window.electronAPI.selectDirectory();
        if (selectedDir) {
            dirPath.textContent = selectedDir;
        }
    });

    // Minimize Window
    minimizeBtn.addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
    });

    // Hide Window (Now acts as Quit)
    hideBtn.addEventListener('click', () => {
        window.electronAPI.quitApp();
    });

    // Quit Application
    quitBtn.addEventListener('click', () => {
        window.electronAPI.quitApp();
    });

    // Handle incoming items
    window.electronAPI.onItemReceived((data) => {
        const card = document.getElementById('lastReceivedCard');
        const timeSpan = document.getElementById('lastReceivedTime');
        const contentDiv = document.getElementById('lastReceivedContent');
        
        card.style.display = 'block';
        timeSpan.textContent = data.time;
        
        if (data.type === 'text') {
            contentDiv.textContent = data.content;
        } else if (data.type === 'image') {
            contentDiv.textContent = '📸 Image saved: ' + data.filename;
        }
    });

    // Settings
    const saveToFileCheckbox = document.getElementById('saveToFileCheckbox');
    const copyToClipboardCheckbox = document.getElementById('copyToClipboardCheckbox');

    function updateSettings() {
        window.electronAPI.updateSettings(saveToFileCheckbox.checked, copyToClipboardCheckbox.checked);
    }

    saveToFileCheckbox.addEventListener('change', updateSettings);
    copyToClipboardCheckbox.addEventListener('change', updateSettings);

    // Sync settings on startup
    updateSettings();

    // Send to iPhone functionality
    const sendTextInput = document.getElementById('sendTextInput');
    const sendFileBtn = document.getElementById('sendFileBtn');
    const queueForIphoneBtn = document.getElementById('queueForIphoneBtn');
    const queueStatus = document.getElementById('queueStatus');

    let selectedFile = null;

    sendFileBtn.addEventListener('click', async () => {
        const fileInfo = await window.electronAPI.selectFile();
        if (fileInfo) {
            selectedFile = fileInfo;
            sendTextInput.value = ''; // Clear text if file is selected
            queueStatus.textContent = `File selected: ${selectedFile.name}`;
        }
    });

    sendTextInput.addEventListener('input', () => {
        if (sendTextInput.value.trim().length > 0) {
            selectedFile = null;
            queueStatus.textContent = 'Text entered.';
        } else {
            queueStatus.textContent = 'Nothing queued.';
        }
    });

    queueForIphoneBtn.addEventListener('click', async () => {
        if (selectedFile) {
            await window.electronAPI.queueItem({
                type: 'file',
                filepath: selectedFile.path, // electron allows access to absolute path
                filename: selectedFile.name
            });
            queueStatus.textContent = `✅ Ready for iPhone: ${selectedFile.name}`;
            queueStatus.style.color = 'var(--success-color)';
        } else if (sendTextInput.value.trim()) {
            await window.electronAPI.queueItem({
                type: 'text',
                content: sendTextInput.value.trim()
            });
            queueStatus.textContent = '✅ Ready for iPhone: [Text]';
            queueStatus.style.color = 'var(--success-color)';
        } else {
            queueStatus.textContent = 'Please enter text or select a file first.';
            queueStatus.style.color = 'var(--danger-color)';
        }
        
        setTimeout(() => { queueStatus.style.color = '#aaa'; }, 3000);
    });
});
