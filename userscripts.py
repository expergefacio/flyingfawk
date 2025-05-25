# userscripts.py
# This file defines a Flask Blueprint for listing available userscripts.
# WARNING: This version includes a command to set execute permissions
# on all files in the userscripts directory via subprocess.run with shell=True.
# This is a SIGNIFICANT SECURITY RISK and should be avoided in production environments
# if the userscripts directory can be written to by untrusted sources.

import os
import subprocess
import shlex
from flask import Blueprint, jsonify
import logging

# Define the directory where userscripts are stored within the container
USERSCRIPTS_DIR = '/app/userscripts'

# Define the Blueprint
userscripts_bp = Blueprint('userscripts_bp', __name__, url_prefix='/api/userscripts')

logging.basicConfig(level=logging.DEBUG) # Ensure logging is set up


# --- NEW TEST ENDPOINT ---
@userscripts_bp.route('/test', methods=['GET'])
def test_userscripts_api():
    """Simple test endpoint to confirm the blueprint is reachable."""
    logging.debug("Test userscripts API endpoint reached successfully.")
    return jsonify({"message": "Userscripts API is reachable!"}), 200
# --- END NEW TEST ENDPOINT ---


@userscripts_bp.route('/list', methods=['GET'])
def list_userscripts():
    """
    Executes 'chmod +x *' in the userscripts directory,
    then lists executable files in that directory.
    """
    logging.debug(f"Received request to list userscripts in: {USERSCRIPTS_DIR}")

    # Check if the directory exists
    if not os.path.isdir(USERSCRIPTS_DIR):
        logging.error(f"Userscripts directory not found: {USERSCRIPTS_DIR}")
        return jsonify({"error": f"Userscripts directory not found: {USERSCRIPTS_DIR}"}), 404

    # --- WARNING: SECURITY RISK ---
    # Executing chmod +x via subprocess from a web endpoint allows anyone
    # who can reach this endpoint to make arbitrary files in this directory executable.
    # If an attacker can upload files here, they can execute arbitrary code.
    # Ensure that file uploads to USERSCRIPTS_DIR are strictly controlled and secure.
    # --- REMOVED sudo as it was not found in the container ---
    chmod_command = f'chmod +x {shlex.quote(USERSCRIPTS_DIR)}/*' # Removed 'sudo '
    logging.warning(f"Attempting to execute command to set execute permissions: '{chmod_command}'")

    try:
        # Execute the chmod command
        # shell=True is used for simplicity with wildcards, but adds risk.
        # cwd=USERSCRIPTS_DIR is safer than relying on shell's default CWD.
        chmod_result = subprocess.run(
            chmod_command,
            shell=True,
            cwd=USERSCRIPTS_DIR,
            capture_output=True,
            text=True,
            timeout=10 # Add a timeout
        )

        if chmod_result.returncode != 0:
            logging.error(f"chmod command failed. Return code: {chmod_result.returncode}, Error: {chmod_result.stderr.strip()}")
            # Log the error but still attempt to list scripts.
            pass

        logging.debug("chmod command executed.")

    except FileNotFoundError:
         # This might happen if 'chmod' itself is not in the container's PATH, though unlikely
         logging.error(f"chmod command not found.")
         pass
    except subprocess.TimeoutExpired:
         logging.warning(f"chmod command timed out.")
         pass
    except Exception as e:
        logging.error(f"An error occurred while executing chmod: {e}")
        pass


    # --- Proceed with Listing Executable Files ---
    scripts = []
    try:
        # List all entries in the directory
        entries = os.listdir(USERSCRIPTS_DIR)
        logging.debug(f"Found {len(entries)} entries in {USERSCRIPTS_DIR}")

        # Filter for files that appear to be shell scripts (e.g., end with .sh)
        # and are executable. Checking for '.sh' is a simple filter,
        # checking os.access(path, os.X_OK) is more robust for executability.
        for entry_name in entries:
            full_path = os.path.join(USERSCRIPTS_DIR, entry_name)
            logging.debug(f"Checking entry for listing: {entry_name} at {full_path}") # Log entry being checked

            is_file = os.path.isfile(full_path)
            is_executable = False
            try:
                # Check if the user running the Flask app has execute permission
                is_executable = os.access(full_path, os.X_OK)
            except Exception as e:
                 logging.warning(f"Error checking execute permission for {full_path} during listing: {e}") # Log permission check errors


            logging.debug(f"Is file: {is_file}, Is executable: {is_executable}") # Log results

            if is_file and is_executable:
                 # Optional: Add a simple check for '.sh' extension if preferred
                 # if entry_name.lower().endswith('.sh'):
                 scripts.append(entry_name)
                 logging.debug(f"Identified executable script: {entry_name}")


        # Sort the script names alphabetically
        scripts.sort()

        logging.debug(f"Successfully listed {len(scripts)} executable scripts.")
        return jsonify({"scripts": scripts}), 200

    except PermissionError:
        logging.error(f"Permission denied to list userscripts in: {USERSCRIPTS_DIR}")
        return jsonify({"error": f"Permission denied to access userscripts directory: {USERSCRIPTS_DIR}"}), 403
    except Exception as e:
        logging.error(f"An unexpected error occurred while listing userscripts: {e}")
        return jsonify({"error": f"An internal error occurred: {e}"}), 500

