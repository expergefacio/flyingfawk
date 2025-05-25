# updownapi.py
import os
from flask import Blueprint, request, send_file, current_app


updown_bp = Blueprint('updown', __name__)  # no url_prefix
UPLOAD_DIR = os.path.join(os.getcwd(), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

def stream_to_file(total_content_length, content_type, filename, content_length=None):
    file_path = os.path.join(UPLOAD_DIR, filename)
    current_app.logger.debug(f"Streaming upload to: {file_path}")
    return open(file_path, 'wb')

@updown_bp.before_app_request
def set_stream_factory():
    if request.method == 'POST' and request.path == '/up':
        request.stream_factory = stream_to_file

@updown_bp.route('/up', methods=['POST'])
def upload_file():

    print("=== UPLOAD DEBUG ===")
    print("FILES:", request.files)
    print("FORM:", request.form)
    print("META:", request.form.to_dict())
    print("====================")
    
    target_path = request.form.get('targetPath')
    if not target_path:
        return {"error": "No target path provided"}, 400

    full_path = os.path.normpath(target_path)
    hostroot = os.path.abspath('/hostroot')

    if not full_path.startswith(hostroot):
        return {"error": "Invalid path"}, 403

    os.makedirs(full_path, exist_ok=True)

    saved_files = []

    for file_key in request.files:
        file = request.files[file_key]
        relative_path = request.form.get('relativePath', file.filename)
        save_path = os.path.normpath(os.path.join(full_path, relative_path))

        if not save_path.startswith(full_path):
            return {"error": "Invalid nested path"}, 403

        if os.path.isdir(save_path):
            return {"error": "Directory with that name already exists", "filename": file.filename}, 409

        while os.path.exists(save_path):
            name, ext = os.path.splitext(os.path.basename(save_path))
            new_name = f"{name}_2{ext}"
            save_path = os.path.join(os.path.dirname(save_path), new_name)

        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        file.save(save_path)

        rel_path = os.path.relpath(save_path, hostroot)
        saved_files.append('/' + rel_path)

    return {"status": "ok", "saved": saved_files}


@updown_bp.route('/down/<path:filename>', methods=['GET'])
def download_file(filename):
    hostroot = os.path.abspath('/hostroot')
    safe_path = os.path.normpath('/' + filename.lstrip('/'))

    hostroot = os.path.abspath('/hostroot')
    if not safe_path.startswith(hostroot):
        return {"error": "Invalid path"}, 403

    return send_file(safe_path, as_attachment=True)