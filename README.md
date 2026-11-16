# TabVault

**TabVault** is a privacy-first Google Chrome extension (Manifest V3) built with React and Tailwind CSS for saving, organizing, scheduling, and encrypting browser tabs and links locally.

## Features

- **Quick Tab & Link Capture:** Save the active browser tab in one click or paste any URL with automatic title detection (including YouTube video metadata).
- **Encrypted Private Mode:** A password-protected space isolated from Standard mode. All URLs, titles, favorites, and folder names in Private Mode are encrypted client-side using **PBKDF2** key derivation and **AES-256-GCM** via the native Web Crypto API.
- **Recurring Reminders & Alarms:** Schedule one-time, weekly, or monthly reminders powered by Chrome's `alarms` and `notifications` APIs, complete with startup alarm recovery, snooze controls, and audio alerts.
- **Nested Folders & Calendar View:** Organize links in nested folders with drag-and-drop support, search and filter by favorites or schedule status, and manage upcoming reminders in an interactive monthly calendar.
- **Local Backup & Safety Controls:** Export and import your vault as JSON (with password verification when encrypted data is included) and reset storage safely via a 5-second cancelable countdown.
- **Accessible & Customizable UI:** Includes Light, Dark, and Forest themes, adjustable window presets, and smooth text scaling from 85% to 140%.

## Tech Stack

- **Frontend:** React, Tailwind CSS, Vite
- **Extension Platform:** Chrome Manifest V3 (Service Worker background script, `storage.local`, `alarms`, `notifications`, `tabs`, `activeTab`)
- **Cryptography:** Web Crypto API (`PBKDF2` + `AES-256-GCM`)

## Installation (Local Development)

1. Clone this repository:
   ```bash
   git clone https://github.com/Martin-Lashkari-pub/laterbox_React-Tailwind.git
   cd laterbox_React-Tailwind
   ```
2. Install dependencies and build the extension:
   ```bash
   npm install
   npm run build
   ```
3. Open `chrome://extensions/` in Google Chrome.
4. Enable **Developer mode** in the top-right corner.
5. Click **Load unpacked** and select the generated `dist/` folder.

## Privacy & Security

All bookmarks, folders, reminders, and settings are stored strictly locally on your device in `chrome.storage.local`. TabVault has no external backend, collects no telemetry, and never transmits user data to third-party servers.
