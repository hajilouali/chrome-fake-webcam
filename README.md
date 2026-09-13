# Fake Webcam

A Chrome extension that plays a pre-recorded video or a static photo instead of your real webcam, on whichever sites you choose — with live zoom, pan, and play/pause control.

🇮🇷 در همین مخزن، [این فایل به فارسی](README.fa.md) هم موجود است.

> **Disclaimer:** This project is provided for **educational and testing purposes only**. You are solely responsible for how you use it, including compliance with the terms of service, laws, and regulations of any site or context where you use it. The author accepts no liability for misuse or unauthorized use.

## Why

Some sites ask for camera access just to record a short video or grab a still photo (ID verification, "liveness" checks, avatar capture, etc.). This extension lets you feed them a video or photo of your choosing instead of your real camera — per site, with full control over framing.

## Features

- **Video mode** — loop a video file as your fake camera feed
- **Photo mode** — show a static photo instead
- **Zoom & pan** — reframe the fake feed by dragging and zooming; adjustments apply live, even to a call that's already in progress
- **Play / Pause** — freeze or resume the fake video at any moment, right from the toolbar popup
- **Automatic audio** — if your video file has its own sound, it's sent as your "microphone" too; otherwise your real microphone is used normally
- **Per-site control** — turn it on by default everywhere, or override individual sites from the popup
- **Bilingual UI** — switch between English and Persian anywhere in the extension (popup, settings, test page)
- **100% local** — your photo/video is stored in the browser's own IndexedDB storage; nothing is ever uploaded anywhere

## Install (unpacked / developer mode)

1. Download or `git clone` this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. The extension icon appears in the toolbar.

## Usage

1. Click the extension icon. From the popup you can directly:
   - Pick a **photo** and/or **video** file.
   - Switch between **Photo** / **Video** mode.
   - **Play/Pause** the fake video at any time.
   - Enable it **by default for all sites**, or just **for the current site**.
2. Click **Zoom / Pan** in the popup to open the full settings page, where you can:
   - Drag on the live preview to pan, and use the slider to zoom.
   - Manage the list of per-site overrides.
3. Visit a site that requests camera access — it gets your chosen photo/video instead of your real camera.

## Testing it yourself

[`test.html`](test.html) is a small standalone page for manually verifying the extension: it shows whether the extension was detected on the page, requests `getUserMedia`, and prints the resulting track/audio details. Open it directly (`file://.../test.html`) or host it anywhere — it doesn't depend on anything else in this repo.

> Chrome only injects extensions into `file://` pages if **"Allow access to file URLs"** is enabled for the extension (`chrome://extensions` → its Details page). This is a Chrome-wide restriction, not specific to this extension.

## How it works

- A `MAIN`-world content script (`inject.js`) overrides `navigator.mediaDevices.getUserMedia` and `enumerateDevices` before any page script runs. When video is requested and the extension is enabled for that site, it draws your chosen photo/video onto a `<canvas>` (applying the current zoom/pan crop every frame) and returns `canvas.captureStream()` as the video track — a real, valid `MediaStreamTrack` that works with WebRTC, recording, etc.
- Audio, if requested, either comes from your video file's own soundtrack (via `HTMLMediaElement.captureStream()`) or your real microphone, depending on what's available.
- An isolated-world content script (`content-bridge.js`) bridges between the page-world override and the extension's settings/storage, since `MAIN`-world scripts have no access to `chrome.*` APIs.
- Your media files live in the extension's own `IndexedDB` (accessed directly by the popup/options pages, and relayed to content scripts through the background service worker, since content scripts can't reach the extension's storage directly).

## Project structure

| File | Role |
|---|---|
| `manifest.json` | Extension configuration (Manifest V3) |
| `inject.js` | Runs in the page's main world; overrides `getUserMedia`/`enumerateDevices` and builds the canvas-based fake stream |
| `content-bridge.js` | Bridges `inject.js` to the extension's stored settings/media |
| `site-key.js` | Shared helper that turns a URL into a consistent "site" key/label |
| `i18n.js` | Shared English/Persian translation strings and helpers |
| `background.js` | Service worker; serves stored media to content scripts (which can't access the extension's own storage directly) |
| `media-store.js` | Shared IndexedDB helpers (used by `background.js`, `options.js`, `popup.js`) |
| `popup.html` / `popup.js` / `popup.css` | Toolbar popup: quick file pick, mode, play/pause, per-site toggle |
| `options.html` / `options.js` / `options.css` | Full settings page: file management, zoom/pan editor, site exceptions list |
| `test.html` | Standalone manual test page |

## Limitations

- **`.mov` (QuickTime) files often won't play** — this is a Chrome limitation (it generally doesn't support the QuickTime container), not something this extension can work around. Convert to `.mp4` or `.webm` first.
- Sites with an unusually strict Content-Security-Policy on `media-src` may behave differently.
- This replaces the *camera*, not screen-share (`getDisplayMedia`) or the `ImageCapture.takePhoto()` API.

## Privacy

Your photo/video files never leave your browser — they're stored locally in IndexedDB and are only read by this extension. No network requests, no external servers.

## License

[MIT](LICENSE)
