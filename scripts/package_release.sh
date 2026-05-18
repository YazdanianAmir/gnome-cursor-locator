
#!/usr/bin/env bash

set -euo pipefail

UUID="$(jq -r '.uuid' metadata.json)"
NAME="$(jq -r '.name' metadata.json | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"

RELEASE_DIR="release"
BUILD_DIR="$(mktemp -d)"

npm run build

mkdir -p "$BUILD_DIR"

rsync -a dist/ "$BUILD_DIR/"
rsync -a schemas/ "$BUILD_DIR/schemas/"
rsync -a locale/ "$BUILD_DIR/locale/"
rsync -a metadata.json "$BUILD_DIR/"

glib-compile-schemas "$BUILD_DIR/schemas"

mkdir -p "$RELEASE_DIR"

ZIP_NAME="${NAME}.zip"

(
    cd "$BUILD_DIR"

    zip -qr \
        "$OLDPWD/$RELEASE_DIR/$ZIP_NAME" \
        .
)

rm -rf "$BUILD_DIR"

echo "Created:"
echo "$RELEASE_DIR/$ZIP_NAME"