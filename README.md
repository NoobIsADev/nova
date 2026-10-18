# Nova Browser

A Chromium-powered Electron desktop browser with a custom dark interface inspired by modern gaming browsers and **DuckDuckGo as the default search engine**.

## Quick start (Windows)

1. Install **Node.js 22 or newer** from https://nodejs.org/ (npm is included).
2. Extract the complete Nova-Browser ZIP.
3. Double-click **`START-NOVA.bat`**. The first run downloads dependencies.
4. To make a standalone app, double-click **`BUILD-WINDOWS.bat`**. Finished `.exe` files appear in `dist/`.

Alternatively, from the source folder:

```bash
npm install
npm start
```

Build for Windows:

```bash
npm run build:win
```

Linux AppImage (run on Linux):

```bash
npm install
npm run build:linux
```

> Packaging on the corresponding operating system is recommended. Windows builds should be performed on Windows.

## Nova 1.3 — GitHub sync and automatic Windows updates

**Repository:** https://github.com/NoobIsADev/nova

### Upload source to GitHub (double-click)

1. Install **Git for Windows** from https://git-scm.com/download/win (in addition to Node.js / npm). Sign in through the Git Credential Manager popup if asked.
2. Extract this ZIP, then double-click **`UPLOAD-TO-GITHUB.bat`** in the root of the project.
3. It initializes Git if needed, connects to `NoobIsADev/nova`, preserves the existing GitHub history, stages and commits the source, rebases onto the current `main`, then pushes. It never force-pushes. If Git asks for a name/email, configure those using the commands printed in the window and retry.
4. Run the same script again whenever you change the source. **A normal source push does not release a browser update.**

### Publish an update to installed browsers

1. Edit the `version` in `package.json` **to a new, higher version** for each new release, e.g. `1.3.1`.
2. Double-click **`PUBLISH-RELEASE.bat`**. It uploads the latest source, checks that the version tag is unused, and pushes `v<version>` to GitHub.
3. GitHub Actions (`.github/workflows/windows-release.yml`) builds both a Windows NSIS Setup installer and a portable EXE. On success, it publishes a public GitHub Release with `latest.yml`, installer, portable EXE, and blockmaps.
4. Download the **Setup** installer from https://github.com/NoobIsADev/nova/releases/latest and install it. **Only installed Windows Setup builds auto-install updates**; npm development launches and portable EXEs do not.
5. After that initial installation, Nova checks GitHub Releases at startup (after ~12 seconds) and every 4 hours, automatically downloads a newer published version, and prompts to restart. Selecting Later keeps the browser running; the update applies on exit.

Nova v1.3.0 is the first auto-update-capable version; any previous v1.2 or older installer needs a manual one-time update to v1.3.0. For a real update test, publish `v1.3.0`, install its setup, then bump to `1.3.1` and publish `v1.3.1`. The latest GitHub Release **must** contain the installer and `latest.yml`.

**Security and distribution:** This sample release workflow creates **unsigned** Windows binaries. SmartScreen may show warnings. Before distributing broadly, set up Authenticode signing and ensure your GitHub account and release workflow are trusted, since users will execute updates published by this repository. Never paste a GitHub personal access token into this project. Git for Windows authenticates through the Windows credential manager; GitHub Actions uses its short-lived automatic `GITHUB_TOKEN`.

**Logo requirement:** The Windows release runner downloads `https://i.imgur.com/P5SoPEh.png` via `tools/prepare-logo.ps1`. If Imgur blocks this in GitHub Actions, save the transparent image as `build/logo.png` locally, add and upload that file, and retry publishing **with a new version tag**. The script will use the local file.

## Nova 1.3.1 update

- The bookmarks bar automatically hides (including its 36px of vertical space) when there are **zero saved bookmarks**. No empty hint or separator remains.
- Saving the first bookmark with Ctrl+D or the star icon automatically reveals the bar on all tabs. Removing the last bookmark automatically hides it again, including removal from the History/Bookmarks UI or the bookmark context menu.
- Settings → Appearance → Bookmarks Bar and Ctrl+Shift+B still control the preference when bookmarks exist. If you previously switched the bar off, re-enable it to see saved bookmarks.
- `PUBLISH-RELEASE.bat` can publish v1.3.1 to GitHub Releases and trigger an update for installed v1.3.0 browsers; `UPLOAD-TO-GITHUB.bat` uploads source without creating a release.

## Nova 1.2 update

- The bottom-left **sidebar logo tile was removed**. The sidebar only appears on the New Tab page.
- The start page now contains **only your centered logo and the DuckDuckGo search field**. No Explore area, privacy advertisement, quick-launch area, bookmarks cards, or footer.
- **Bookmarks are a real browser-wide bar under the address bar**, including on external websites. Click a bookmark to open it, middle-click for a new tab, right-click to remove it or open it in a new tab, and use the chevron on the right to access all bookmarks. Save/remove the active website with `Ctrl+D` or the star icon. Hide/show the bar with `Ctrl+Shift+B` or Settings → Appearance.
- **Tabs automatically shrink** as the strip fills up, reducing to favicons when there are many tabs. When the window is too narrow for every icon, use a wider window or collapse groups.
- **Tab groups (Tab Islands)** sit within the tab strip with colored labels and a count. Drag a tab onto the **center** of another tab to group them; drop on the left/right edge to reorder. Drag a tab onto a colored group label to add it to that group.
- **Right-click a tab** → Add tab to group → New group or an existing group. **Right-click a group label** to rename it, choose its color, collapse/expand it, add tabs, ungroup tabs, or close the whole group. Click a group label to collapse or expand it.
- Groups are **kept for the current browser session**, rather than restored on relaunch (the project does not yet restore open tabs between launches).
- The previous **Brave-style downloads dropdown** and ad blocking remain unchanged.

## Nova 1.1 visual update

- The greeting, eyebrow label, and tagline are **removed** from the new tab page. The user's transparent logo is centered above the DuckDuckGo search field.
- The left logo/wordmark **no longer appears in the top tab bar**. The browser's own new-tab favicon and other in-app brand icons use your image.
- The sidebar only appears on **New Tab**, not websites, settings, downloads, or history. Turn it on/off under Settings → Appearance.
- The toolbar Downloads button (or `Ctrl+J`) now opens a **real floating panel over webpages** rather than opening a new tab. It shows progress, pause/resume, cancel, open file, show in folder, recent downloads, and a link to the full downloads page.
- **Windows installer/taskbar icons:** Your PNG is converted to an ICO containing 16, 24, 32, 48, 64, 128, and 256px icon frames, preserving transparency.

### Automatic logo setup

The logo URL you supplied is **https://i.imgur.com/P5SoPEh.png**.

When you double-click `START-NOVA.bat` or `BUILD-WINDOWS.bat`, npm automatically downloads the image and creates `build/logo.png`, `build/icon.png`, and `build/icon.ico` before launch/build. **The logo download needs to succeed for the updated app to start/build.**

If Imgur blocks automated downloads on your network, open that URL yourself and save the original transparent PNG in the browser project's `build` folder as **`logo.png`**. Then rerun the `.bat` file; the converter uses your local image instead and generates the Windows icon without downloading anything. Don't save the Imgur webpage/HTML as a PNG.

A running old copy of Nova needs to be closed before rebuilding; if you previously pinned Nova to Windows taskbar, unpin the old icon and pin the newly built app after installation so Windows doesn't cache the old shortcut graphic.

## Features

- Chromium website tabs backed by Electron `WebContentsView` — **not iframes**.
- DuckDuckGo search from both the address bar and start page; type a URL to navigate.
- Built-in Ghostery ads + tracking filter lists, plus a bundled offline fallback list.
- YouTube-specific cosmetic ad hiding and skippable-ad helper when shields are on.
- Toggle shields globally from the address-bar shield or Settings.
- Minimal new tab page, global bookmarks toolbar, colored tab groups, history, and download list.
- Separate private tabs with a non-persistent session and no recorded browsing history.
- Dark interface with customizable accent color and a sidebar limited to the New Tab page.
- Windows installer and portable EXE via `electron-builder`.
- Persistent bookmarks/history/settings in Electron's user-data directory.

## Protection details / realistic limitations

Nova uses `@ghostery/adblocker-electron` with Ghostery's **prebuilt ads and tracking lists**. The browser loads a small bundled local filter list immediately and attempts to obtain/cache the stronger community lists on startup. On a fresh installation, an internet connection is necessary to download those lists. In Settings, **Refresh lists** forces a new download.

**YouTube ads:** Network blocking, cosmetic removal, and skip assistance are implemented, but **100% YouTube ad removal is not guaranteed**. YouTube updates its ad-delivery and anti-blocking systems regularly, and an Electron blocker is not identical to Brave's Rust-based Shields or to a fully-fledged browser extension. Some streaming and DRM content may not work, because Electron does not ship with every proprietary playback component.

**Safety and site compatibility:** This is an independently authored starter browser, not a security-equivalent replacement for Brave/Chrome/Firefox. It does not currently implement Chrome Web Store extension support, bookmark synchronization, password management, per-site shield exceptions, or full browser-level sandbox hardening. Chromium/Electron and filter dependencies should be updated regularly. The browser denies sensitive site permissions by default unless the user approves a request. Untrusted websites do not get Electron/Node APIs (`sandbox`, `contextIsolation`, and `nodeIntegration:false`).

The Windows installer is **unsigned**; Windows SmartScreen may warn about an unrecognized app. For public distribution, arrange software code signing and further security testing.

## Useful shortcuts

| Action | Shortcut |
|---|---|
| New tab | Ctrl+T |
| Close tab | Ctrl+W |
| Address bar | Ctrl+L |
| Private tab | Ctrl+Shift+N |
| Switch tabs | Ctrl+Tab |
| Bookmark current site | Ctrl+D |
| Show/hide bookmarks bar | Ctrl+Shift+B |
| Reload | Ctrl+R |
| Reload without cache | Ctrl+Shift+R |
| Find in page | Ctrl+F |
| History | Ctrl+H |
| Recent downloads dropdown | Ctrl+J |
| Zoom | Ctrl + / Ctrl - / Ctrl 0 |
| Back / Forward | Alt+Left / Alt+Right |

## Project structure

- `main.js`: tabs, navigation, permissions, history, download handling, ad blocking, keyboard shortcuts.
- `src/chrome.*`: the browser frame, tabs, toolbar, and sidebar.
- `src/internal.*`: new tab, settings, history, and downloads pages.
- `preload.js`, `internal-preload.js`, `downloads-preload.js`: scoped and isolated bridges.
- `lib/navigation.js`: URL parsing and DuckDuckGo search normalization.
- `src/filters-fallback.txt`: limited offline domain filter list.
- `tools/prepare-logo.ps1`, `tools/prepare-logo.js`: fetch and convert the user-provided PNG for Windows icons.
- `build/logo.png`, `build/icon.ico`, `build/icon.png`: generated assets, created when you start/build.
- `src/downloads-popover.*`: floating downloads panel.
- `lib/updater.js`: GitHub Releases update service and install prompts.
- `UPLOAD-TO-GITHUB.bat`: push project source to GitHub without force pushing.
- `PUBLISH-RELEASE.bat`: tag a new version and trigger GitHub Actions.
- `.github/workflows/windows-release.yml`: build and publish update-ready Windows releases.

## Testing

```bash
npm run check
```

This validates all JavaScript and runs the Node navigation tests. Testing the actual desktop window requires installing Electron on your machine.

## Credits

- Electron: https://www.electronjs.org/
- Ghostery adblocker: https://github.com/ghostery/adblocker (MPL-2.0)
- DuckDuckGo: https://duckduckgo.com/

Nova is not affiliated with Brave, Opera, YouTube, DuckDuckGo, or Ghostery.
