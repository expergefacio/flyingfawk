# videoapi.py
# This file defines a Flask Blueprint for serving video metadata and streaming video content.


#replaced bu preview_video.py


import os
import subprocess
from flask import Blueprint, request, Response, stream_with_context, jsonify # Import jsonify
import re
import json
import urllib.parse
import time
import logging

# Configure logging for this blueprint
logger = logging.getLogger(__name__)


# !!! SECURITY WARNINGS from previous steps still apply !!!
# !!! Path restrictions are based on starting with /home/, /mnt/, or /hostroot/
# !!! This does not prevent directory traversal *within* those directories.
# !!! This also does not check file types beyond what FFmpeg attempts to handle.
# !!! Authentication is not implemented.
# !!! Use with caution.


# List of allowed base directories for video files on the server's filesystem
ALLOWED_BASE_DIRS = ['/home/', '/mnt/', '/hostroot/']


def is_allowed_filepath(requested_path):
    """
    Checks if the requested path is a valid file path within any of the
    allowed base directories. Returns the normalized absolute path if allowed,
    otherwise returns False.
    """
    if not requested_path:
        logger.warning("Access denied: Requested path is empty.")
        return False

    # Normalize the path to resolve '..' and initial symlinks
    # os.path.abspath resolves relative to the *current working directory*
    # of this process. We assume requested_path is already intended as an
    # absolute path within the container's filesystem (e.g., starting with /hostroot/).
    normalized_path = os.path.abspath(requested_path)

    # Strict check: must start with one of the allowed base directories
    if not any(normalized_path.startswith(base_dir) for base_dir in ALLOWED_BASE_DIRS):
        logger.warning(f"Access denied: Path is not within allowed directories: {requested_path} (resolved to {normalized_path})")
        return False

    # Check if it's an actual file
    if not os.path.isfile(normalized_path):
         logger.warning(f"Access denied: Path is not a file or does not exist: {requested_path} (resolved to {normalized_path})")
         return False

    # Check for symlinks pointing outside allowed directories
    # This is a crucial security check if symlinks are possible.
    if os.path.islink(normalized_path):
        real_path = os.path.realpath(normalized_path)
        if not any(real_path.startswith(base_dir) for base_dir in ALLOWED_BASE_DIRS):
             logger.warning(f"Access denied: Symlink points outside allowed directories: {requested_path} (resolves to {real_path})")
             return False
        # If it's a symlink within allowed dirs, use the real path for FFmpeg
        normalized_path = real_path


    logger.debug(f"Access granted: Validated path: {normalized_path}")
    return normalized_path

def get_video_metadata(filepath):
    """
    Gets video metadata (like duration) using ffprobe.
    Returns duration in seconds (float).
    Returns None if ffprobe fails or duration is not found/invalid.
    """
    duration = None
    try:
        command = [
            'ffprobe',
            '-v', 'error', # Suppress verbose output
            '-show_entries', 'format=duration', # Only get duration from format section
            '-of', 'json', # Output in JSON format
            filepath # Input file path
        ]
        # check=True raises CalledProcessError if ffprobe exits with a non-zero status
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        metadata = json.loads(result.stdout)
        # Safely get duration, default to 0 if not found
        duration_str = metadata.get('format', {}).get('duration', '0')
        duration = float(duration_str)
        if duration < 0: duration = 0 # Ensure duration is not negative

    except (FileNotFoundError, subprocess.CalledProcessError, json.JSONDecodeError, ValueError) as e:
        logger.error(f"ffprobe error getting duration for {filepath}: {e}")
        duration = None # Ensure duration is None on error

    logger.debug(f"Metadata: Duration={duration}s")
    return duration

# --- Python function to format time (No longer needed in backend for player HTML) ---
# def format_time(seconds):
#     """Formats seconds into HH:MM:SS or MM:SS string for Python."""
#     if seconds is None or seconds < 0 or not isinstance(seconds, (int, float)):
#         return "00:00"
#     seconds = int(seconds)
#     hours = seconds // 3600
#     minutes = (seconds % 3600) // 60
#     secs = seconds % 60
#     if hours > 0:
#         return f"{hours:02}:{minutes:02}:{secs:02}"
#     return f"{minutes:02}:{secs:02}"
# ------------------------------------

# Define the Blueprint - 'video_bp' is the Blueprint object
# url_prefix will be set when registering in flyingfawk.py (e.g., '/video')
video_bp = Blueprint('video_bp', __name__)


@video_bp.route('/metadata', methods=['GET']) # <--- NEW METADATA ENDPOINT
def get_video_metadata_api():
    """
    API endpoint to get video metadata (duration) for a given file path.
    Returns JSON: {"validated_path": "...", "duration_seconds": ...} or {"error": "...}.
    """
    video_path_request = request.args.get('path')
    logger.debug(f"Received metadata request for path: {video_path_request}")

    if not video_path_request:
        logger.warning("Metadata request missing 'path' parameter.")
        return jsonify({"error": "'path' parameter is required."}), 400

    # The path from the frontend is expected to be the full server path (e.g., /hostroot/...)
    validated_path = is_allowed_filepath(video_path_request)

    if not validated_path:
        # is_allowed_filepath already logs the reason
        return jsonify({"error": "Invalid or restricted file path."}), 403

    duration = get_video_metadata(validated_path)

    if duration is None:
         # get_video_metadata already logs the ffprobe error
         return jsonify({"error": "Could not retrieve video metadata (e.g., duration). FFprobe failed."}), 500

    # Return metadata as JSON
    return jsonify({
        "validated_path": validated_path, # Return the validated server path
        "duration_seconds": duration
    }), 200


@video_bp.route('/') # <--- STREAMING ENDPOINT (Root of the blueprint)
def stream_video():
    """
    Handles requests for the video stream itself (?v=).
    Streams video data using FFmpeg.
    """
    video_path_stream = request.args.get('v')

    if not video_path_stream:
         logger.warning("Stream request missing 'v' parameter.")
         return "Invalid request. 'v' parameter (video path) is required.", 400

    logger.debug(f"Received video stream request for path: {video_path_stream}")
    # The path from the player page is expected to be the full server path (e.g., /hostroot/...)
    validated_path = is_allowed_filepath(video_path_stream)

    if not validated_path:
        logger.warning("Stream request with invalid or restricted path.")
        return "Invalid or restricted file path for streaming.", 403

    # Get requested start time (seek time) from the 't' query parameter
    start_time_str = request.args.get('t')
    seek_time = 0.0 # Default seek time is 0

    if start_time_str:
        try:
             # Attempt to parse time string (e.g., "1:23", "0:01:23.45") or seconds (e.g., "83.45")
             if ':' in start_time_str:
                 parts = list(map(float, start_time_str.split(':')))
                 if len(parts) == 3: # HH:MM:SS
                     seek_time = parts[0] * 3600 + parts[1] * 60 + parts[2]
                 elif len(parts) == 2: # MM:SS
                     seek_time = parts[0] * 60 + parts[1]
                 else:
                     raise ValueError("Invalid time format")
             else: # Seconds
                 seek_time = float(start_time_str)

             # Ensure seek time is not negative
             if seek_time < 0:
                 seek_time = 0

             logger.debug(f"Parsed requested start time: {seek_time}s")

        except (ValueError, TypeError) as e:
             logger.warning(f"Could not parse requested start time '{start_time_str}': {e}. Starting from beginning.")
             seek_time = 0.0 # Fallback to 0 on error
    else:
        logger.debug("No start time requested, starting from beginning.")
        seek_time = 0.0


    def generate():
        """
        Generator function to stream video data chunk by chunk using FFmpeg.
        """
        # FFmpeg command to transcode and stream the video
        # -ss {seek_time} : Seeks to the specified time (applied before -i for faster seeking)
        # -i {input_file} : Input file
        # -f mp4 : Output format is MP4
        # -vcodec libx264 : Video codec (H.264)
        # -acodec aac : Audio codec (AAC)
        # -movflags frag_keyframe+empty_moov : Ensures fragmented MP4 output suitable for streaming
        # pipe:1 : Output to standard output (which Flask reads from)
        command = [
            'ffmpeg',
            *(['-ss', f"{seek_time:.3f}"] if seek_time > 0 else []), # Add -ss only if seek_time > 0
            '-i', validated_path,
            '-f', 'mp4',
            '-vcodec', 'libx264', # You might need to ensure libx264 is available in your FFmpeg build
            '-preset', 'ultrafast',
            '-acodec', 'aac',   # You might need to ensure aac encoder is available
            '-movflags', 'frag_keyframe+empty_moov',
            'pipe:1' # Output to stdout
        ]

        logger.debug(f"FFmpeg command: {' '.join(command)}")

        process = None # Initialize process variable
        try:
            # Start the FFmpeg subprocess
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=-1 # Use default buffer size
            )

            # Stream data chunk by chunk from FFmpeg's stdout
            try:
                while True:
                    chunk = process.stdout.read(4096) # Read in chunks (e.g., 4KB)
                    if not chunk:
                        # No more data from stdout, process might have finished or errored
                        break
                    yield chunk # Yield the chunk to the Flask response

            finally:
                 # Ensure FFmpeg process is terminated if the client disconnects early
                 # process.poll() returns the exit code, or None if still running
                 if process and process.poll() is None:
                      logger.warning("Client disconnected, terminating FFmpeg process.")
                      process.terminate(); # Send SIGTERM
                 if process:
                     process.wait(); # Wait for the process to exit

            # Read any remaining stderr output after the process finishes
            if process:
                 stderr_output = process.stderr.read().decode('utf8')
                 if process.returncode != 0:
                      # Log FFmpeg errors, but exclude termination signal (-15) which is expected on early disconnect
                      if process.returncode != -15:
                           logger.error('FFmpeg Error (subprocess):', stderr_output)
                      else:
                           logger.debug('FFmpeg process terminated by signal -15 (expected on client disconnect).')
                 else:
                      logger.debug('FFmpeg process finished successfully.')
                 if stderr_output:
                      logger.debug('FFmpeg stderr output:\n' + stderr_output)


        except FileNotFoundError:
            logger.error("Error: FFmpeg executable not found. Is FFmpeg installed in the container and in PATH?")
            # You might want to yield an error message chunk here or return an error response
            # For now, the stream will just end.
        except Exception as e:
            logger.error(f"An unexpected error occurred during streaming: {e}")
            # Handle other potential exceptions during subprocess management


    # Set appropriate headers for video streaming
    headers = {
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
        # "Content-Length": os.path.getsize(validated_path) # Optional: include if you can get size without blocking
        # Note: Content-Length is hard to get accurately for transcoded streams without buffering the whole thing
    }

    # Return the response with the generator function and headers
    return Response(stream_with_context(generate()), headers=headers, status=200)


# Removed the blocking while loop and app.run()
# This blueprint will be registered and run by the main flyingfawk app.
