import os
from pathlib import Path
from flask import Blueprint, request, jsonify
import threading
from flask import Response, stream_with_context
import json

# Text preview	/api/preview/text?path=/hostroot/etc/hosts
# File metadata	/api/preview/meta?path=/hostroot/etc/hosts
# Folder size	/api/preview/foldersize?path=/hostroot/var/log


preview_text_meta_bp = Blueprint('preview_text_meta', __name__, url_prefix='/api/preview')


@preview_text_meta_bp.route('/text')
def get_text_file():
    path = request.args.get('path')
    if not path:
        return "Missing 'path' parameter", 400

    max_size = 5 * 1024 * 1024  # 5MB

    try:
        if os.path.getsize(path) > max_size:
            return "File too big to return as text", 200

        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()

    except Exception as e:
        return f"Could not read file as text: {str(e)}", 200


@preview_text_meta_bp.route('/meta')
def get_file_metadata():
    path = request.args.get('path')
    if not path:
        return jsonify({'error': 'Missing "path" parameter'}), 400

    try:
        stat = os.stat(path)
        meta = {
            'path': path,
            'size_bytes': stat.st_size,
            'last_modified': stat.st_mtime,
            'last_accessed': stat.st_atime,
            'created': stat.st_ctime,
            'is_file': os.path.isfile(path),
            'is_dir': os.path.isdir(path),
        }
        return jsonify(meta)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@preview_text_meta_bp.route('/foldersize')
def calculate_folder_size():
    path_str = request.args.get('path')
    if not path_str:
        return jsonify({'error': 'Missing "path" parameter'}), 400

    path = Path(path_str)
    if not path.exists():
        return jsonify({'error': f"Path does not exist: {path}"}), 404
    if not path.is_dir():
        return jsonify({'error': f"Path is not a directory: {path}"}), 400

    def size_generator():
        try:
            total_bytes = 0
            for root, dirs, files in os.walk(path, onerror=lambda e: None):
                for f in files:
                    try:
                        fp = os.path.join(root, f)
                        if os.path.isfile(fp):
                            total_bytes += os.path.getsize(fp)
                    except Exception:
                        continue
            result = {'path': str(path), 'total_size_bytes': total_bytes}
        except Exception as e:
            result = {'error': str(e)}

        yield json.dumps(result)

    return Response(stream_with_context(size_generator()), mimetype='application/json')

@preview_text_meta_bp.route('/folderpreview')
def folder_preview():
    path = request.args.get('path')
    if not path:
        return jsonify({'error': 'Missing "path" parameter'}), 400

    folder = Path(path)
    if not folder.exists() or not folder.is_dir():
        return jsonify({'error': 'Path is not a directory'}), 400

    try:
        entries = sorted(folder.iterdir(), key=lambda p: p.name.lower())[:10]

        preview = []
        for entry in entries:
            preview.append({
                'name': entry.name,
                'is_dir': entry.is_dir(),
                'size': entry.stat().st_size if entry.is_file() else None,
                'modified': entry.stat().st_mtime
            })

        return jsonify({'entries': preview})

    except Exception as e:
        return jsonify({'error': str(e)}), 500