#!/bin/bash

set -e

# Usage
usage() {
    echo "Usage: $0 -d <image-folder> [-f <ignored>]"
    exit 1
}

# Parse args
while getopts "d:f:" opt; do
    case ${opt} in
        d ) IMG_DIR=$OPTARG ;;
        f ) IGNORE=$OPTARG ;;  # Ignored but accepted for compatibility
        * ) usage ;;
    esac
done

if [ -z "$IMG_DIR" ]; then
    usage
fi

if [ ! -d "$IMG_DIR" ]; then
    echo "Error: Directory not found: $IMG_DIR"
    exit 1
fi

echo "Processing image folder: '$IMG_DIR'..."

# Parent folder name for output
BASE_NAME=$(basename "$IMG_DIR")
OUTPUT_PDF="${IMG_DIR}/${BASE_NAME}_ocr.pdf"

# Create temp dir
TEMP_DIR=$(mktemp -d)
echo "Temporary directory: $TEMP_DIR"

# List image files
IMAGES=($(find "$IMG_DIR" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | sort))

if [ ${#IMAGES[@]} -eq 0 ]; then
    echo "No image files found in: $IMG_DIR"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# OCR each image
OCR_OUTPUT_FILES=()
echo "Running OCR on images..."
for IMG in "${IMAGES[@]}"; do
    BASENAME=$(basename "$IMG")
    OUT_NAME="${BASENAME%.*}"
    OUT_PDF="$TEMP_DIR/${OUT_NAME}.pdf"
    echo "  OCR -> $BASENAME"
    tesseract "$IMG" "$TEMP_DIR/$OUT_NAME" pdf
    OCR_OUTPUT_FILES+=("$OUT_PDF")
done

# Merge into final PDF
echo "Combining OCR PDFs..."
pdfunite "${OCR_OUTPUT_FILES[@]}" "$OUTPUT_PDF"

echo "Created final searchable PDF: $OUTPUT_PDF"

# Cleanup
rm -rf "$TEMP_DIR"
echo "Done. Cleaned up temporary files."