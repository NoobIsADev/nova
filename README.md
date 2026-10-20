# Nova Browser

A Chromium-powered Electron desktop browser with a custom dark interface inspired by modern gaming browsers and **DuckDuckGo as the default search engine**.

## Download the Linux AppImage — no building needed

**Linux (x64):** [Download Nova from GitHub Releases](https://github.com/NoobIsADev/nova/releases/tag/v1.4.0). Open **Assets**, select `Nova-Browser-Linux-1.4.0-x64.AppImage`, then on Linux run:

```bash
chmod +x Nova-Browser-Linux-1.4.0-x64.AppImage
./Nova-Browser-Linux-1.4.0-x64.AppImage
```

**If the AppImage is not yet listed:** on Windows, run `PUBLISH-APPIMAGE-TO-GITHUB.bat` from the project folder. The script signs you into GitHub (via GitHub CLI), downloads the already-built v1.4.0 AppImage from the successful GitHub Actions Linux job, and uploads the AppImage plus `latest-linux.yml` to GitHub Releases. You do **not** need to compile or build anything to publish it.

**For later releases:** `.github/workflows/cross-platform-release.yml` builds an AppImage on Linux automatically whenever you push a new `vX.Y.Z` tag, then publishes the Linux files even if Windows or macOS fails. Upload this updated workflow to GitHub once using `UPLOAD-TO-GITHUB.bat`, then continue using `PUBLISH-RELEASE.bat` with an increased version.

## Nova 1.4.1 — one-click GitHub release with ready-made AppImage

**To publish:** On Windows, extract this complete project and double-click
**`PUBLISH-TO-GITHUB.bat`**. It only requires Git for Windows and PowerShell
(no local Node/npm build). Sign in to GitHub if asked. The script safely clones
`NoobIsADev/nova`, copies the updated source, pushes `main` and publishes the
`v1.4.1` tag. This triggers GitHub Actions, which **builds and uploads the Linux
`.AppImage` automatically to GitHub Releases**. Everyone can then download the
AppImage without building anything.

**Download:** https://github.com/NoobIsADev/nova/releases/tag/v1.4.1

The same run makes Windows Setup/portable EXEs and attempts the universal macOS
DMG/ZIP. Linux publishes even if macOS fails. The unsigned macOS build skips
notarization; signed auto-updating Mac releases require Apple Developer signing
credentials. GitHub Actions must be enabled and have permission to write
repository Releases (Repository → Settings → Actions → General → Workflow
permissions → Read and write permissions). If the tag already exists,
increment `package.json` first. Do not commit secrets in the project folder.

**This ZIP contains source and a publishing script, not the compiled AppImage.**
The GitHub Actions run creates and attaches the binary after the script uploads
the release tag; allow a few minutes for the build.

## Nova 1.4.0 — Windows, Linux, macOS, and install-on-close updates

**GitHub repository:** https://github.com/NoobIsADev/nova

This is the same Nova browser with all its tabs, tab groups, DuckDuckGo search,
bookmarks, downloads, history, privacy tabs, and Ghostery ad/tracker blocking
on each operating system. The app is built from one Electron codebase.

### Build and run from source

Install **Node.js 22 LTS+ and npm** on your computer. Then extract this ZIP.

| Platform | Launch from source | Package for distribution | Auto-updating release |
|---|---|---|---|
| Windows 10/11 | `START-NOVA.bat` | `BUILD-WINDOWS.bat` or `npm run build:win` | NSIS **Setup EXE** |
| Linux (x86_64) | `./START-NOVA.sh` | `./BUILD-LINUX.sh` or `npm run build:linux` | **AppImage** |
| macOS (Intel + Apple Silicon) | `START-NOVA.command` | `BUILD-MACOS.command` or `npm run build:mac` on macOS | **Signed DMG** + ZIP updater payload |

Shell scripts may need permission: `chmod +x START-NOVA.sh BUILD-LINUX.sh` (Linux) or
`chmod +x START-NOVA.command BUILD-MACOS.command` (Mac).

Alternatively, run `npm install` then `npm start` to develop on any platform.
The dev version does **not** auto-update. The macOS DMG build must be made on a
Mac; Linux AppImage on Linux; Windows Setup on Windows. GitHub Actions provides
all three build operating systems automatically.

### How automatic updates work

1. Install Nova from a **GitHub Release**, not `npm start`.
2. Nova checks GitHub Releases after approximately 12 seconds and every four
   hours while running, then quietly downloads a newer version.
3. Settings → Updates shows the download's progress. Once downloaded it says
   **ready for the next launch**. **No restart prompt is displayed.**
4. **Close Nova normally.** On Windows Setup and Linux AppImage, the updater
   installs on quit; macOS uses its native signed-app staging/relaunch mechanism.
   Open Nova again *after the installer finishes* to use the newer version.

Only **fully downloaded** updates are ready on quit. A browser closed before
the download finishes will check again when opened. Closing Nova by logging
off/shutting down the operating system can interrupt installations; close it
normally before shutdown. The app intentionally quits when its last window
closes on macOS as well, making install-on-close behavior consistent.

**Update support varies by package:** Windows portable EXEs cannot auto-install;
install Windows Setup. Linux automatic updates require a writable AppImage
file. A downloaded `.AppImage` can be run with
`chmod +x Nova-Browser-Linux-*.AppImage && ./Nova-Browser-Linux-*.AppImage`.
An AppImage launched from a read-only directory cannot replace itself. On Mac,
a **Developer ID signed** application is mandatory for auto-updates; unsigned
DMGs are for manual testing only. Downloads and other features work without
signing, but auto-updating does not.

### Publish a three-platform update from Windows

1. Install Git for Windows. Configure `git config --global user.name "Your Name"`
   and `git config --global user.email "your-github-email"` once, if needed.
2. To upload source changes without publishing, double-click
   **`UPLOAD-TO-GITHUB.bat`**. It pushes to `NoobIsADev/nova` without force pushes.
3. Each new release must have a new higher `version` in `package.json`.
4. Double-click **`PUBLISH-RELEASE.bat`**. It pushes source and the matching
   `v<version>` tag, which triggers `.github/workflows/cross-platform-release.yml`.
5. GitHub Actions builds Windows Setup and portable EXE, Linux AppImage, and
   macOS universal DMG and ZIP on the appropriate build runners; it validates
   and publishes `latest.yml`, `latest-linux.yml`, and `latest-mac.yml` in
   **one GitHub Release** with whichever platforms succeeded, provided the Linux AppImage build succeeded.
6. Watch https://github.com/NoobIsADev/nova/actions and download published
   packages from https://github.com/NoobIsADev/nova/releases.

An upload to the `main` branch **does not** trigger a user-facing update; the
new GitHub Release from a version tag does. Installed versions before updater
support must first be replaced with the latest setup package manually.

### Required macOS signing credentials for full automatic updates

Apple **requires code signing** for Squirrel.Mac auto-updates. For releases to
be signed and notarized, enroll in the paid Apple Developer Program, get a
**Developer ID Application** certificate, export it as a password-protected
`.p12`, and configure these **GitHub repository Actions secrets**:

- `MAC_CSC_LINK` — base64-encoded `.p12` certificate (not a URL)
- `MAC_CSC_KEY_PASSWORD` — password of the exported certificate
- `APPLE_ID` — your Apple account email
- `APPLE_APP_SPECIFIC_PASSWORD` — an Apple app-specific password
- `APPLE_TEAM_ID` — your Apple Developer Team ID

Add secrets under **repository → Settings → Secrets and variables → Actions**.
The certificate and passwords must remain in GitHub secrets: **never commit
credentials, key files, or personal tokens into this project**. CI supplies
these values while packaging. With `MAC_CSC_LINK` and `MAC_CSC_KEY_PASSWORD`
set, the packaged Mac app is marked auto-update capable. Apple notarization
also requires the three `APPLE_*` secrets. The universal build targets both
Apple Silicon and Intel Macs. A `.zip` is published alongside the `.dmg`
because Squirrel.Mac uses it as the update payload.

**Without the Apple secrets**, GitHub Actions still creates an **unsigned Mac
DMG/ZIP** for testing, but the Mac browser explicitly reports that automatic
updates are unavailable. This is an Apple security requirement, not something
Nova can bypass safely. The Mac build may show Gatekeeper restrictions until
it is signed and notarized. For broad distribution, Windows signing is also
recommended to avoid SmartScreen warnings.

### User logo

Nova uses your transparent PNG from https://i.imgur.com/P5SoPEh.png for the
new-tab logo and all platform app icons. Build scripts download it during
packaging. If Imgur blocks downloads in your environment, manually save the
**actual image** as `build/logo.png` before running `npm run build:...` or
pushing a release tag. Ensure it is a valid PNG, not an HTML page. macOS and
Linux use `build/icon.png`, while Windows also generates `build/icon.ico`.

### Version history

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
- Windows installer and portable EXE, Linux AppImage, and macOS universal DMG/ZIP via `electron-builder`.
- Persistent bookmarks/history/settings in Electron's user-data directory.

## Protection details / realistic limitations

Nova uses `@ghostery/adblocker-electron` with Ghostery's **prebuilt ads and tracking lists**. The browser loads a small bundled local filter list immediately and attempts to obtain/cache the stronger community lists on startup. On a fresh installation, an internet connection is necessary to download those lists. In Settings, **Refresh lists** forces a new download.

**YouTube ads:** Network blocking, cosmetic removal, and skip assistance are implemented, but **100% YouTube ad removal is not guaranteed**. YouTube updates its ad-delivery and anti-blocking systems regularly, and an Electron blocker is not identical to Brave's Rust-based Shields or to a fully-fledged browser extension. Some streaming and DRM content may not work, because Electron does not ship with every proprietary playback component.

**Safety and site compatibility:** This is an independently authored starter browser, not a security-equivalent replacement for Brave/Chrome/Firefox. It does not currently implement Chrome Web Store extension support, bookmark synchronization, password management, per-site shield exceptions, or full browser-level sandbox hardening. Chromium/Electron and filter dependencies should be updated regularly. The browser denies sensitive site permissions by default unless the user approves a request. Untrusted websites do not get Electron/Node APIs (`sandbox`, `contextIsolation`, and `nodeIntegration:false`).

The Windows installer is **unsigned** by default; Windows SmartScreen may warn about an unrecognized app. Unsigned Mac builds cannot receive automatic updates. For public distribution, arrange software code signing and further security testing.

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
- `tools/prepare-update-policy.js`: records whether a macOS build was signed for updater eligibility.
- `src/downloads-popover.*`: floating downloads panel.
- `lib/updater.js`: GitHub Releases update service, unattended download and install-on-quit behavior.
- `UPLOAD-TO-GITHUB.bat`: push project source to GitHub without force pushing.
- `PUBLISH-RELEASE.bat`: tag a new version and trigger cross-platform GitHub Actions.
- `BUILD-LINUX.sh` / `BUILD-MACOS.command`: local AppImage and DMG builders.
- `.github/workflows/cross-platform-release.yml`: build and publish Windows, Linux, and macOS packages and updater manifests.

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

### Nova 1.3.2 — Window dragging fix

You can move the frameless Nova Browser window by holding the left mouse button on the
**empty area of the top tab bar** (between the New Tab `+` button and the window controls),
then dragging. Double-click this blank area to maximize or restore the window.
The blank area expands automatically when fewer tabs are open and always maintains
space for dragging when the tab bar fills up. Tabs, tab groups, and minimize/maximize/close
buttons remain interactive.

After editing, run `START-NOVA.bat` to preview or `BUILD-WINDOWS.bat` to make the
installer. To distribute through GitHub auto-updates, run `UPLOAD-TO-GITHUB.bat`
then `PUBLISH-RELEASE.bat` to publish `v1.3.2`.
