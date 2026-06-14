# To-Do Desktop

A small cross-platform desktop client (Electron) for the self-hosted To-Do board.
It opens your board in its own native window, remembers your server address and
window size, keeps you logged in, opens external links in your browser, shows
native OS notifications for task reminders, and keeps working when the server is
offline — your changes are stored locally and sync automatically when it's back.

No server address is bundled. You enter it on first launch (e.g. `http://192.168.1.50:8090`).

## Install (download a build)

Grab the file for your OS from the [Releases](../../releases) page:

| OS       | File                          | How to install |
|----------|-------------------------------|----------------|
| macOS    | `To-Do-*.dmg`                 | Open the DMG, drag To-Do to Applications. First launch: right-click → Open (unsigned). |
| Windows  | `To-Do-Setup-*.exe`           | Run the installer. |
| Linux    | `To-Do-*.AppImage`            | `chmod +x To-Do-*.AppImage` then run it. Works on any distro. |
| Linux    | `todo-desktop_*_amd64.deb`    | `sudo apt install ./todo-desktop_*_amd64.deb` |

After installing, launch it and enter your server's address.

## Run from source (development)

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm start
```

## Build it yourself

```bash
npm run dist:mac      # macOS  -> release/*.dmg, *.zip   (build on a Mac)
npm run dist:win      # Windows -> release/*.exe          (build on Windows)
npm run dist:linux    # Linux  -> release/*.AppImage, *.deb, *.snap
```

Builds land in `release/`. macOS/Windows builds must be produced on that OS.
Unsigned apps run fine for personal use (you click through one security prompt).

### Snap

`npm run dist:linux` also produces a `.snap`. Install it directly:

```bash
sudo snap install --dangerous --classic ./release/todo-desktop_*_amd64.snap
```

To publish to the **Snap Store** (so anyone can `snap install`), you need a free
[snapcraft](https://snapcraft.io) developer account, then `snapcraft login` and
`snapcraft upload --release=stable ./release/*.snap`.

### Flatpak / Flathub

A Flatpak can be built with electron-builder's `flatpak` target (requires
`flatpak` + `flatpak-builder` and the Freedesktop runtime installed). Publishing
to **Flathub** is a separate process: you submit an app manifest to the
[flathub/flathub](https://github.com/flathub/flathub) repository for review.
For "install on any Linux machine" with no store, the **AppImage** is the simplest option.

## Releases

Pushing a tag like `v1.0.0` triggers GitHub Actions to build macOS, Windows, and
Linux installers and attach them to a GitHub Release automatically.

```bash
npm version patch        # bumps version + creates a git tag
git push --follow-tags
```

## License

MIT
