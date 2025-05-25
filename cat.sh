#!/bin/zsh

# Script to recursively cat files in a folder (excluding __pycache__ and specific JS/Map files) and save output with path and name.

# Get target directory from the first argument, default to current directory '.'
target_dir="${1:-.}"

# Set the name of the output file
output_file="recursive_cat_output.txt"

# Check if the target directory exists and is a directory
if [ ! -d "$target_dir" ]; then
  echo "Error: Target directory '$target_dir' not found or is not a directory." >&2
  exit 1
fi

# Clear the output file if it exists, or create a new empty file
> "$output_file"

echo "Processing files in '$target_dir' (excluding __pycache__, socket.io.min.js, socket.io.min.js.map, xterm.js, xterm.js.map)..."

# Use find to recursively locate files (-type f)
# Exclude directories named __pycache__ and their contents (-path '*/__pycache__*' -prune)
# Exclude specific files by name (-not -name 'filename')
# -o : logical OR to combine the directory exclusion rule with the file type and name rules
# -print0 : Output file paths separated by null characters (safer for paths with spaces or special characters)
find "$target_dir" \
    -path '*/__pycache__*' -prune \
    -o -type f \
    -not -name 'socket.io.min.js' \
    -not -name 'socket.io.min.js.map' \
    -not -name 'uppy.min.js' \
    -not -name 'uppy.min.js.map' \
    -not -name 'xterm.js' \
    -not -name 'xterm.js.map' \
    -not -name 'flyingfawk.jpeg' \
    -not -name 'favicon.png' \
    -print0 | while IFS= read -r -d '' file_path; do
  # Process each file path found by find

  # Get the base name (filename) from the full path
  filename=$(basename "$file_path")

  # Output a header line with the file path and name to the output file
  echo "// --- File: $file_path (Name: $filename) ---" >> "$output_file"

  # Output the content of the file to the output file
  cat "$file_path" >> "$output_file"

  # Add a blank line after the file content for separation between files
  # Ensure the newline is correctly interpreted by the receiving '>>'
  echo "" >> "$output_file"
  echo "" >> "$output_file"

done

# Print a final message indicating completion and the output file name
echo "Recursive cat complete. Output saved to $output_file"