# fileoperations.py
# This file defines a Flask Blueprint for handling file rename operations.

import os
from flask import Blueprint, request, jsonify
import logging

logger = logging.getLogger(__name__)

fileoperations_bp = Blueprint('fileoperations_bp', __name__, url_prefix='/api')

@fileoperations_bp.route('/rename', methods=['POST'])
def rename_file():
    """
    Rename a file or directory.
    Expected JSON: { "source": "path/to/old_name", "destination": "path/to/new_name" }
    """
    data = request.get_json()
    if not data or 'source' not in data or 'destination' not in data:
        logger.warning("Rename request: Missing required fields.")
        return jsonify({"error": "Missing 'source' or 'destination' in request."}), 400

    source_path = data['source']
    destination_path = data['destination']

    # Basic input validation
    if not isinstance(source_path, str) or not isinstance(destination_path, str):
        return jsonify({"error": "'source' and 'destination' must be strings."}), 400

    if not os.path.exists(source_path):
        return jsonify({"error": f"Source path does not exist: {source_path}"}), 404

    try:
        os.rename(source_path, destination_path)
        logger.info(f"Renamed {source_path} to {destination_path}")
        return jsonify({"status": "success", "source": source_path, "destination": destination_path}), 200
    except Exception as e:
        logger.error(f"Rename failed from {source_path} to {destination_path}: {e}")
        return jsonify({"error": str(e)}), 500


@fileoperations_bp.route('/newdir', methods=['POST'])
def create_new_directory():
    """
    Create a new directory.
    Expected JSON: { "path": "/hostroot/path/to/new/folder" }
    """
    data = request.get_json()
    if not data or 'path' not in data:
        logger.warning("Newdir request: Missing 'path' field.")
        return jsonify({"error": "Missing 'path' in request."}), 400

    dir_path = data['path']

    if not isinstance(dir_path, str) or not dir_path.strip():
        return jsonify({"error": "'path' must be a non-empty string."}), 400

    try:
        if os.path.exists(dir_path):
            logger.warning(f"Directory already exists: {dir_path}")
            return jsonify({"error": f"Directory already exists: {dir_path}"}), 409  # Conflict

        os.makedirs(dir_path)
        logger.info(f"Created new directory: {dir_path}")
        return jsonify({"status": "success", "path": dir_path}), 200
    except Exception as e:
        logger.error(f"Newdir creation failed at {dir_path}: {e}")
        return jsonify({"error": str(e)}), 500

@fileoperations_bp.route('/newfile', methods=['POST'])
def create_new_file():
    """
    Create a new empty file.
    Expected JSON: { "path": "/hostroot/path/to/new/file.txt" }
    """
    data = request.get_json()
    if not data or 'path' not in data:
        logger.warning("Newfile request: Missing 'path' field.")
        return jsonify({"error": "Missing 'path' in request."}), 400

    file_path = data['path']

    if not isinstance(file_path, str) or not file_path.strip():
        return jsonify({"error": "'path' must be a non-empty string."}), 400

    try:
        if os.path.exists(file_path):
            logger.warning(f"File already exists: {file_path}")
            return jsonify({"error": f"File already exists: {file_path}"}), 409

        # Ensure parent directories exist
        parent_dir = os.path.dirname(file_path)
        os.makedirs(parent_dir, exist_ok=True)

        # Create empty file
        with open(file_path, 'w') as f:
            pass

        logger.info(f"Created new file: {file_path}")
        return jsonify({"status": "success", "path": file_path}), 200

    except Exception as e:
        logger.error(f"Newfile creation failed at {file_path}: {e}")
        return jsonify({"error": str(e)}), 500

@fileoperations_bp.route('/duplicate', methods=['POST'])
def duplicate_file():
    """
    Duplicate a file or directory.
    Expected JSON: { "source": "path/to/original", "destination": "path/to/duplicate" }
    """
    data = request.get_json()
    if not data or 'source' not in data or 'destination' not in data:
        logger.warning("Duplicate request: Missing required fields.")
        return jsonify({"error": "Missing 'source' or 'destination' in request."}), 400

    source_path = data['source']
    destination_path = data['destination']

    # Basic input validation
    if not isinstance(source_path, str) or not isinstance(destination_path, str):
        return jsonify({"error": "'source' and 'destination' must be strings."}), 400

    if not os.path.exists(source_path):
        return jsonify({"error": f"Source path does not exist: {source_path}"}), 404

    try:
        if os.path.isdir(source_path):
            import shutil
            shutil.copytree(source_path, destination_path)
        else:
            import shutil
            shutil.copy2(source_path, destination_path)

        logger.info(f"Duplicated {source_path} to {destination_path}")
        return jsonify({"status": "success", "source": source_path, "destination": destination_path}), 200

    except Exception as e:
        logger.error(f"Duplicate failed from {source_path} to {destination_path}: {e}")
        return jsonify({"error": str(e)}), 500
