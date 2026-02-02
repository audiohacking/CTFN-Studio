#!/bin/bash
# Generate CTFNStudio.icns from PNG logo for macOS app bundle
# Preserves transparency (alpha channel) from the source PNG.

set -e

PNG_FILE="frontend/public/ctfn-icon.png"
ICONSET_DIR="build/macos/CTFNStudio.iconset"
OUTPUT_ICNS="build/macos/CTFNStudio.icns"

if [ ! -f "$PNG_FILE" ]; then
    echo "Error: Logo PNG not found at $PNG_FILE"
    exit 1
fi

# Prefer ImageMagick 7 (magick) or 6 (convert); fallback to sips
USE_IM=
if command -v magick &> /dev/null; then
    USE_IM=magick
elif command -v convert &> /dev/null; then
    USE_IM=convert
fi

if [ -z "$USE_IM" ] && ! command -v sips &> /dev/null; then
    echo "Error: ImageMagick (magick/convert) or sips required. Install with: brew install imagemagick"
    exit 1
fi

rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

echo "Generating icon sizes from PNG (preserving/adding transparency)..."

# If source has no alpha (e.g. black background), make black transparent. Preserve alpha if present.
# -fuzz 2% only affects near-black so logo colors (yellow, orange, red, etc.) are unchanged
if [ -n "$USE_IM" ]; then
    if [ "$USE_IM" = "magick" ]; then
        TRANS_OPTS="-fuzz 2% -transparent black -background none -alpha set -alpha on"
    else
        TRANS_OPTS="-fuzz 2% -transparent black -background none -alpha set -alpha on"
    fi
else
    TRANS_OPTS=""
fi

sizes=(16 32 128 256 512)
for size in "${sizes[@]}"; do
    echo "  Generating ${size}x${size}..."
    double=$((size * 2))
    if [ -n "$USE_IM" ]; then
        # Make black transparent, then resize; PNG32 keeps alpha in output
        if [ "$USE_IM" = "magick" ]; then
            magick "$PNG_FILE" $TRANS_OPTS -resize ${size}x${size} "PNG32:$ICONSET_DIR/icon_${size}x${size}.png"
            magick "$PNG_FILE" $TRANS_OPTS -resize ${double}x${double} "PNG32:$ICONSET_DIR/icon_${size}x${size}@2x.png"
        else
            convert "$PNG_FILE" $TRANS_OPTS -resize ${size}x${size} "PNG32:$ICONSET_DIR/icon_${size}x${size}.png"
            convert "$PNG_FILE" $TRANS_OPTS -resize ${double}x${double} "PNG32:$ICONSET_DIR/icon_${size}x${size}@2x.png"
        fi
    else
        sips -z $size $size "$PNG_FILE" --out "$ICONSET_DIR/icon_${size}x${size}.png"
        sips -z $double $double "$PNG_FILE" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png"
    fi
done

echo "Creating .icns file..."
iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICNS"

rm -rf "$ICONSET_DIR"

echo "✓ Icon created: $OUTPUT_ICNS (with transparency)"
ls -lh "$OUTPUT_ICNS"
