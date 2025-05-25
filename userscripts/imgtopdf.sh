#!/bin/sh

# Converts all JPG images in a directory to a PDF using img2pdf.
# Expects call as: script -d <directory> -f <file>
# The -f argument is accepted but ignored by the img2pdf command itself.

DIR=""

# Parse command line options (-d and -f both require arguments)
while getopts ":d:f:" opt; do
  case $opt in
    d) DIR="$OPTARG" ;; # Store directory argument
    f) ;;             # Ignore file argument value but consume the option
    \?) echo "Error: Invalid option -$OPTARG" >&2; exit 1 ;;
    :) echo "Error: Option -$OPTARG requires an argument." >&2; exit 1 ;;
  esac
done

# Check if the required directory argument was provided
if [ -z "$DIR" ]; then
    echo "Error: Usage: $0 -d <directory> [-f <file>]" >&2
    exit 1
fi

# --- Core Script Logic using img2pdf ---

# Change directory first
cd "$DIR" || { echo "Error: Cannot change directory to '$DIR'" >&2; exit 1; }
echo "Processing images in $(pwd) using img2pdf..." # Report current directory

# Find all .jpg files in the current directory, sort them, and pass them to img2pdf
# Using find -print0 and xargs -0 is robust for filenames with spaces/special characters.
# sort -z ensures correct page order.
find -L . -maxdepth 1 -iname '*.jpg' -print0 | sort -z | xargs -0 img2pdf -o output.pdf || { echo "Error: img2pdf failed in $(pwd)" >&2; exit 1; }

echo "Conversion successful: output.pdf created in $(pwd)"

exit 0 # Indicate success
