#!/bin/sh

# Renames files matching the pattern 'page<number>.jpg' to 'pageNNNN.jpg' format.
# Processes all files in the directory but only renames those matching the pattern.
# Uses find -exec for robustness with filenames containing spaces.
# Expects call as: script -d <directory> -f <file>
# The -f argument is accepted but ignored.
# Pads the number to 4 digits (e.g., 1 -> 0001, 12 -> 0012, 123 -> 0123, 1234 -> 1234).

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

# --- Core Script Logic ---

# Change directory
cd "$DIR" || { echo "Error: Cannot change directory to '$DIR'" >&2; exit 1; }
echo "Processing files in $(pwd)..." # Report current directory

# Find all files (-type f) matching the pattern 'page*.jpg' in the current directory.
# -exec allows running a command for each found file.
# {} is a placeholder for the found filename.
# \; terminates the -exec command.
# The sh -c command is used to execute a small inline script for each file,
# which allows us to use variables and multiple commands (like basename, sed, printf, mv).
find -L . -maxdepth 1 -type f -iname 'page*.jpg' -exec sh -c '
    # This code runs for each file found by find.
    # $1 is the filename passed by find.
    filename="$1"
    basename_filename=$(basename "$filename")

    # Check if the filename matches the "page<number>.jpg" pattern using grep
    if echo "$basename_filename" | grep -qE "^page[0-9]+\.jpg$"; then
        # Extract the number using sed
        number=$(echo "$basename_filename" | sed -n "s/^page\([0-9]\+\)\.jpg$/\1/p")

        # If number extraction was successful
        if [ -n "$number" ]; then
            # Pad the number to 4 digits
            padded_number=$(printf "%04d" "$number")

            # Construct the new filename
            new_filename="page${padded_number}.jpg"

            # Rename only if different
            if [ "$basename_filename" != "$new_filename" ]; then
                # Use mv relative to the current directory (which find is run in)
                mv "$filename" "$new_filename"
                echo "Renamed '\''$basename_filename'\'' to '\''$new_filename'\''" # Report rename, quoting for clarity
            fi
        fi
    fi
' sh {} \; # Pass the found filename {} as $1 to the inline sh script

echo "Renaming complete."

exit 0 # Indicate successful execution
