#!/usr/bin/env bash

set -euo pipefail

UUID="cursor-locator@yazdanianamir.github.io"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

npm run build

mkdir -p "$EXTENSION_DIR"

rsync -a --delete dist/ "$EXTENSION_DIR/"
rsync -a schemas/ "$EXTENSION_DIR/schemas/"
rsync -a locale/ "$EXTENSION_DIR/locale/"
rsync -a metadata.json "$EXTENSION_DIR/"

glib-compile-schemas "$EXTENSION_DIR/schemas"

echo "Installed to:"
echo "$EXTENSION_DIR"