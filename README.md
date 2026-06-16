# To-Do Desktop

A cross-platform desktop app (Electron) for the To-Do board. The full UI is
**bundled inside the app** and your data lives **locally on the device**, so it
opens and works with **no server at all**. Point it at a server (optional) and it
**syncs** your local board across devices whenever that server is reachable. Also
shows **native OS reminder notifications**.

![Board](docs/board.png)

> Self-contained and local-first — a server is optional, only used for syncing
> across devices. UI updates ship with the app via the built-in auto-updater.

---

## Why the desktop app

### 💾 Local-first — works with no server
The full board is **bundled in the app** and runs entirely from local storage, so
it opens and works even with no server configured at all. Add a server later (File
→ Sync Server…) and your local changes **sync automatically** whenever it's
reachable; an indicator shows pending changes. Because the UI ships inside the app,
updating it no longer requires touching the server.

### ⬆️ Built-in auto-updates
Installed builds check for new releases and update themselves (AppImage), or notify
you when a new version is available (deb/snap). Check manually any time via File →
Check for Updates…

### 🔔 Native reminder notifications
A background watcher checks your server for due reminders and pops a real **OS
notification** (click it to focus the window) — no browser tab required.

### 🎨 Themes & the full feature set
Everything the web app offers, in a native window: Kanban board, list, and
calendar; projects, labels, subtasks, comments, attachments, time tracking, task
dependencies, recurring tasks, analytics, and selectable **themes**.

![Task detail](docs/task-detail.png)
![Calendar](docs/calendar.png)
![Analytics](docs/analytics.png)

A few of the built-in themes (Settings → Appearance):

| Light | Nord |
|:-----:|:----:|
| ![Light theme](docs/theme-light.png) | ![Nord theme](docs/theme-nord.png) |
| **Midnight** | **Grape** |
| ![Midnight theme](docs/board-midnight.png) | ![Grape theme](docs/theme-grape.png) |

### 🪟 Native niceties
Remembers your window size and server URL, keeps you logged in, opens external
links in your browser, and has a real app icon in your taskbar.

---

## Install (Linux)

Download a file from the [Releases](../../releases) page:

| Format   | File                          | How to install |
|----------|-------------------------------|----------------|
| AppImage | `To-Do-*.AppImage`            | `chmod +x To-Do-*.AppImage` then run it. Works on any distro, no install needed. |
| Deb      | `todo-desktop_*_amd64.deb`    | `sudo apt install ./todo-desktop_*_amd64.deb` |

Prefer a **snap**? Build one in one command (see "Build it yourself") — snaps aren't
built in CI because snapcraft needs a desktop keyring that headless runners lack.

After installing, launch **To-Do** from your menu — it works immediately, no setup.
To sync across devices, add your server under File → Sync Server… (e.g.
`http://192.168.x.x:xxxx`). On a phone, use the web app in your browser ("Add to
Home Screen").

## How it works (bundled UI)

The web UI is bundled at `ui/app.html` and served to the window over a custom
`todoapp://` scheme; the main process injects the configured server URL at load.
All data is stored locally by the in-page layer and synced to the server's REST API
when reachable. To refresh the bundled UI after changing the server's `ui.py`, run:

```bash
# point at any running To-Do server, then commit the regenerated file
./scripts/sync-ui.sh http://192.168.x.x:xxxx
```

## Run from source

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm start
```

## Build it yourself

```bash
npm run dist          # all Linux targets -> release/*.AppImage, *.deb, *.snap
npm run dist:appimage
npm run dist:snap
```

### Snap Store / Flathub
The release `.snap` installs directly (`sudo snap install --dangerous ./release/*.snap`).
Publishing to the **Snap Store** needs a free [snapcraft](https://snapcraft.io)
account (`snapcraft login` then `snapcraft upload`). For **Flathub**, build a
Flatpak (electron-builder's `flatpak` target) and submit a manifest to
[flathub/flathub](https://github.com/flathub/flathub) for review.

## Releases
Pushing a tag like `v1.0.0` triggers GitHub Actions to build the Linux installers
(AppImage + deb) and attach them to a GitHub Release automatically.

## License
MIT
