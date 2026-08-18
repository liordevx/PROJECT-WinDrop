# PC-iPhone File Transfer Server

A lightweight Electron desktop application designed for seamless transfer of files, images, and text between your Windows PC and your iPhone. It runs a local Express server and integrates natively with Windows to manage your mobile hotspot, making offline and local-network transfers extremely easy.

## ✨ Features
* **Two-Way Transfers:** Send links and images from your iPhone to your PC, or queue files and text from your PC to be fetched by your iPhone.
* **Smart Clipboard Sync:** Links or text sent from your iPhone are automatically copied directly to your PC's clipboard.
* **Native Hotspot Control:** Can automatically toggle your Windows 10/11 Mobile Hotspot on and off so your iPhone can directly connect when a shared Wi-Fi network isn't available.
* **Instant QR Code:** Dynamically generates a QR code containing your PC's hotspot credentials. Just scan it with your iPhone to connect instantly!
* **Secure API:** Uses token-based authentication to ensure that only your trusted iOS Shortcuts can send or receive data.

## 🚀 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd lior
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run or Build:**
   * **Development Mode:** Run `npm run start:gui` to start the app.
   * **Build Installer:** Run `npm run build:win` to generate a shareable `.exe` Windows installer in the `dist/` directory.

## 📱 How to Use with iOS Shortcuts

Once the application is running, it listens on port `3005`. You can configure your Apple Shortcuts to communicate with the PC using the following API endpoints:

* **Send Text/Link to PC:** 
  * `POST /api/link`
  * **Headers:** `Authorization: <YOUR_TOKEN>`
  * **Body (JSON or Plain Text):** `{ "link": "Text or URL to send" }`
* **Send Image to PC:** 
  * `POST /api/image`
  * **Headers:** `Authorization: <YOUR_TOKEN>`
  * **Body (Multipart/form-data):** Field `image` containing the file.
* **Receive Data from PC:**
  * `GET /api/receive`
  * **Headers:** `Authorization: <YOUR_TOKEN>`
  * Fetch queued text or files that you selected in the PC app UI.

> **Note:** You can find your current `Authorization` token displayed at the top of the PC application window.

## 🛠️ Requirements
* **OS:** Windows 10 or Windows 11 (Required for native PowerShell Mobile Hotspot scripts).
* **Node.js:** v14 or higher recommended.
