# To-Do Desktop

A small cross-platform desktop client (Electron) for the self-hosted To-Do board.
It opens your board in its own native window, remembers your server address and
window size, keeps you logged in, opens external links in your browser, shows
native OS notifications for task reminders, and keeps working when the server is
offline — your changes are stored locally and sync automatically when it's back.

No server address is bundled. You enter it on first launch (e.g. `http://192.168.1.50:8090`).

## Install (Linux)

Grab a file from the [Releases](../../releases) page:

| Format   | File                          | How to install |
|----------|-------------------------------|----------------|
| AppImage | `To-Do-*.AppImage`            | `chmod +x To-Do-*.AppImage` then run it. Works on any distro, no install needed. |
| Deb      | `todo-desktop_*_amd64.deb`    | `sudo apt install ./todo-desktop_*_amd64.deb` |

Prefer a **snap**? Build one in one command (see "Build it yourself" below) — snaps
aren't built in CI because snapcraft needs a desktop keyring that headless runners lack.

After installing, launch it and enter your server's address (e.g. `http://192.168.x.x:xxxx`).

On a phone, use the web app directly in your browser instead (open the server URL and "Add to Home Screen").

## Run from source (development)

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm start
```

## Build it yourself

```bash
npm run dist          # all Linux targets -> release/*.AppImage, *.deb, *.snap
npm run dist:appimage # just the AppImage
npm run dist:snap     # just the snap
```

Builds land in `release/`.

### Snap Store / Flathub

The release `.snap` installs directly (`sudo snap install --dangerous ./release/*.snap`).
To publish to the **Snap Store** (so anyone can `snap install todo`), you need a free
[snapcraft](https://snapcraft.io) developer account, then `snapcraft login` and
`snapcraft upload --release=stable ./release/*.snap`.

For **Flathub**, build a Flatpak with electron-builder's `flatpak` target (needs
`flatpak` + `flatpak-builder` + the Freedesktop runtime) and submit an app manifest
to the [flathub/flathub](https://github.com/flathub/flathub) repo for review.

## Releases

Pushing a tag like `v1.0.0` triggers GitHub Actions to build the Linux installers
(AppImage + deb) and attach them to a GitHub Release automatically.

```bash
npm version patch        # bumps version + creates a git tag
git push --follow-tags
```

## License

MIT
