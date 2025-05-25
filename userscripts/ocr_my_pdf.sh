#!/bin/bash

set -e

# Usage function
usage() {
    echo "Usage: $0 -d <directory> -f <filename>"
    exit 1
}

# Parse arguments
while getopts "d:f:" opt; do
    case ${opt} in
        d ) DIR=$OPTARG ;;
        f ) FILE=$OPTARG ;;
        * ) usage ;;
    esac
done

if [ -z "$DIR" ] || [ -z "$FILE" ]; then
    usage
fi

INPUT_PDF="$DIR/$FILE"

if [ ! -f "$INPUT_PDF" ]; then
    echo "Error: File not found: $INPUT_PDF"
    exit 1
fi

echo "Processing '$FILE' in '$DIR'..."

# Create temporary working directory
TEMP_DIR=$(mktemp -d)
echo "Temporary directory: $TEMP_DIR"

# Convert PDF to JPEG images
echo "Converting PDF pages to JPEG images using pdftoppm..."
pdftoppm -jpeg "$INPUT_PDF" "$TEMP_DIR/page"
echo "PDF to image conversion complete."

# Run OCR on each image and create a searchable PDF for each page
echo "Running Tesseract OCR on each image..."
OCR_OUTPUT_FILES=()
for IMG in "$TEMP_DIR"/page-*.jpg; do
    BASENAME=$(basename "$IMG" .jpg)
    OUT_PDF="$TEMP_DIR/$BASENAME.pdf"
    echo "  OCR -> $BASENAME"
    tesseract "$IMG" "$TEMP_DIR/$BASENAME" pdf
    OCR_OUTPUT_FILES+=("$OUT_PDF")
done
echo "OCR complete."

# Combine all OCR'ed pages into one final PDF
FINAL_PDF="$DIR/ocr_$FILE"
echo "Combining individual PDFs into final searchable PDF..."
pdfunite "${OCR_OUTPUT_FILES[@]}" "$FINAL_PDF"
echo "Created: $FINAL_PDF"

# Cleanup
rm -rf "$TEMP_DIR"
echo "Done. Cleaned up temporary files."
