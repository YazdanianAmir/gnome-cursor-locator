# Cursor Locator

A modern GNOME Shell extension for quickly locating the mouse cursor using a smooth spotlight overlay effect.

Designed for GNOME Shell 50 with a focus on:

- performance
- smooth animations
- multi-monitor support
- modern Adwaita preferences
- lightweight rendering
- clean TypeScript architecture

The extension darkens the screen and highlights the current cursor position using a flashlight-style spotlight effect.

---

## Features

- Spotlight-style cursor locator overlay
- Optional mouse jiggle detection
- Keyboard shortcut trigger
- Multi-monitor support
- Smooth Cairo-rendered overlay animations
- Lightweight rendering pipeline
- Adwaita preferences UI
- GSettings integration
- Internationalization support
- GNOME Shell 50 compatible
- Fedora Silverblue tested

---

## Preview

The extension creates a fullscreen dimming overlay while keeping the cursor area highlighted and fully visible.

Inspired by:

- macOS cursor locator behaviors
- accessibility spotlight effects
- focus overlays

---

## Compatibility

- GNOME Shell 50
- Wayland
- Fedora Silverblue tested

---

## Architecture

The extension is written in TypeScript and compiled using `tsc`.

Runtime code remains fully compatible with GNOME Shell/GJS.

Project structure:

```text
src/
├── extension.ts
├── locatorOverlay.ts
├── prefs.ts
└── constants.ts
```

Key design goals:

- clean lifecycle management
- minimal repainting
- low actor churn
- clean resource destruction
- modular architecture
- modern GNOME APIs

---

## Rendering

The spotlight overlay uses:

- `St.DrawingArea`
- Cairo rendering
- fullscreen overlay actors
- optimized repaint batching
- GLib polling only while active

The overlay:

- darkens all monitors
- tracks the cursor position
- renders a spotlight around the cursor
- fades out on user interaction

---

## Preferences

The extension includes a modern Adwaita preferences window.

Available settings:

- keyboard shortcut
- spotlight radius
- animation duration
- optional jiggle detection

---

## Development

### Requirements

- Node.js
- TypeScript
- GNOME Shell 50
- Wayland

### GNOME Shell Development Environment

Install the GNOME Shell devkit environment:

```bash
sudo rpm-ostree install mutter-devkit
```

Then reboot into the new deployment.

Optional useful development packages:

```bash
sudo rpm-ostree install \
  gnome-shell-devel \
  gettext
```

---

## Install Dependencies

```bash
npm install
```

---

## Build

```bash
npm run build
```

---

## Deploy Locally

```bash
npm run deploy
```

---

## Launch GNOME Shell Devkit

```bash
npm run devkit
```

---

## Build + Deploy + Launch Devkit

```bash
npm run dev
```

---

## Lint and Typecheck

```bash
npm run test
```

---

## Full Validation

```bash
npm run check
```

---

## Package Release ZIP

```bash
npm run package
```

---

## Internationalization

The extension supports gettext translations.

Translation files are located in:

```text
locale/<lang>/LC_MESSAGES/
```

### Extract translatable strings

```bash
mkdir -p po

xgettext \
  --from-code=UTF-8 \
  --language=JavaScript \
  --keyword=_ \
  --output=po/cursor-locator.pot \
  src/*.ts metadata.json
```

### Create a new translation

Example Romanian translation:

```bash
msginit \
  --locale=ro_RO.UTF-8 \
  --input=po/cursor-locator.pot \
  --output=po/ro.po
```

### Compile translations

```bash
mkdir -p locale/ro/LC_MESSAGES

msgfmt \
  po/ro.po \
  -o locale/ro/LC_MESSAGES/cursor-locator.mo
```

---

## Packaging

The extension is packaged for:

- local development installs
- extensions.gnome.org deployment

Packaging includes:

- compiled TypeScript output
- GSettings schemas
- compiled schemas
- gettext translations

---

## Repository Structure

```text
.
├── dist/
├── locale/
├── po/
├── release/
├── schemas/
├── scripts/
├── src/
├── metadata.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## License

GPL-3.0-or-later

---

## Author

Amir Yazdanian