# Ad Attention Score Tracker

A browser extension that tracks how long you view or interact with ads and builds an **attention score**. Browse normally — the extension detects ad-like content, measures view time (in viewport), hover time, and clicks, then aggregates a single score. Longer attention and more interaction mean a higher score.

## Features

- **Automatic ad detection**: Detects common ad patterns (e.g. `data-ad`, `adsbygoogle`, sponsored blocks, ad iframes).
- **View time**: When an ad is ≥50% visible in the viewport, time is counted.
- **Hover & clicks**: Hover duration and clicks on ads add extra points.
- **Score formula**: `view_seconds × 0.001 + hover_seconds × 0.002 + clicks × 10`.
- **Per-site breakdown**: Popup shows total score and recent activity by site.
- **Reset**: Clear all data from the popup.

## Installation (Chrome / Edge)

1. **Load unpacked**
   - Open `chrome://extensions` (or `edge://extensions`).
   - Turn on **Developer mode** (top right).
   - Click **Load unpacked** and select the `Attention` folder (the one containing `manifest.json`).

2. **Optional icons**
   - To show custom icons, add PNGs: `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`, and add the `default_icon` and `icons` entries back into `manifest.json`.

## Deployment (Chrome Web Store)

1. **Zip the extension**
   - From the parent of `Attention`, run:
     ```bash
     zip -r AdAttentionScore.zip Attention -x "*.DS_Store" -x "Attention/.git*"
     ```
   - Or zip the contents of `Attention` (so `manifest.json` is at the root of the zip).

2. **Publish**
   - Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).
   - Create a new item, upload the zip, set description and screenshots.
   - Pay the one-time developer fee if required, then submit for review.

## Files

| File           | Purpose |
|----------------|--------|
| `manifest.json` | Extension manifest (Manifest V3). |
| `content.js`    | Runs on pages; finds ad candidates, tracks visibility and interaction, sends reports. |
| `content.css`   | Optional styles (e.g. subtle ad outline); can be left minimal. |
| `background.js` | Service worker; receives reports, computes score, stores in `chrome.storage.local`. |
| `popup.html/css/js` | Popup UI: total score, recent activity, reset button. |

## Privacy

- All data is stored locally in the browser (`chrome.storage.local`).
- No data is sent to any external server.
- No account or login required.

## License

MIT.
