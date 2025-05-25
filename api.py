import os
import sys
import logging
from flask import Blueprint, jsonify, request
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.DEBUG, stream=sys.stderr)

api_bp = Blueprint('api_bp', __name__, url_prefix='/api')

GUI_ROOT = os.environ.get('GUI_ROOT', '/hostroot')


def format_size(size_in_bytes):
    if size_in_bytes is None:
        return "-"
    if not isinstance(size_in_bytes, (int, float)):
        return "Invalid Size"
    size_in_bytes = max(0, size_in_bytes)
    units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    index = 0
    while size_in_bytes >= 1024 and index < len(units) - 1:
        size_in_bytes /= 1024
        index += 1
    return f"{size_in_bytes:.2f}{units[index]}"


def format_datetime(timestamp):
    if timestamp is None:
        return "-"
    try:
        if isinstance(timestamp, (int, float)):
            return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
    except (ValueError, TypeError):
        pass
    return "Invalid Date"


def get_directory_data(base_root_path, current_subpath, show_dotfiles=False, sort_by='name', order='asc'):
    clean_subpath = current_subpath.strip('/') if current_subpath else ''
    if clean_subpath.startswith('/'):
        clean_subpath = clean_subpath[1:]

    requested_path = os.path.join(base_root_path, clean_subpath)
    current_ui_path = '/' + clean_subpath if clean_subpath else '/'

    pane_data = {
        'current_path': current_ui_path,
        'items': [],
        'is_file': False,
        'error': None,
        'name': None
    }

    try:
        abs_root = os.path.abspath(base_root_path)
        abs_path = os.path.abspath(requested_path)
    except Exception:
        pane_data['error'] = f"Error resolving path: {current_ui_path}"
        return pane_data

    if not abs_path.startswith(abs_root):
        pane_data['error'] = f"Invalid path: {current_ui_path}"
        return pane_data

    if not os.path.exists(abs_path):
        pane_data['error'] = f"Path not found: {current_ui_path}"
        return pane_data

    if not os.path.isdir(abs_path):
        pane_data['is_file'] = True
        pane_data['name'] = os.path.basename(current_ui_path)
        return pane_data

    try:
        entries = os.listdir(abs_path)
    except PermissionError:
        pane_data['error'] = f"Permission denied to access: {current_ui_path}"
        return pane_data
    except Exception as e:
        pane_data['error'] = f"Error listing directory: {e}"
        return pane_data

    dirs, files = [], []

    if abs_path != abs_root:
        parent_path = os.path.dirname(abs_path)
        rel_parent = os.path.relpath(parent_path, base_root_path).replace('\\', '/')
        parent_ui_path = '/' if rel_parent in ('.', '') else '/' + rel_parent
        pane_data['items'].append({
            'name': '..',
            'is_directory': True,
            'size': None,
            'last_modified': None,
            'created': None,
            'file_extension': None,
            'subpath': parent_ui_path
        })

    for name in entries:
        if name in ('.', '..'):
            continue
        if not show_dotfiles and name.startswith('.'):
            continue

        full_path = os.path.join(abs_path, name)
        rel_path = os.path.join(clean_subpath, name).replace('\\', '/')
        ui_path = '/' + rel_path

        try:
            stat = os.stat(full_path)
            is_dir = os.path.isdir(full_path)
            size = stat.st_size
            last_modified = stat.st_mtime
            created = stat.st_ctime
            ext = None
            if not is_dir:
                _, ext = os.path.splitext(name)
                ext = ext.lstrip('.').lower()

            info = {
                'name': name,
                'is_directory': is_dir,
                'size': size,
                'last_modified': last_modified,
                'created': created,
                'file_extension': ext,
                'subpath': ui_path,
                'formatted_size': format_size(size),
                'formatted_modified': format_datetime(last_modified),
                'formatted_created': format_datetime(created),
            }

            (dirs if is_dir else files).append(info)
        except Exception:
            continue

    # Sorting
    valid_sort_keys = {'name', 'file_extension', 'size', 'last_modified', 'created'}
    sort_key = sort_by if sort_by in valid_sort_keys else 'name'
    reverse = order == 'desc'

    def sort_value(item):
        val = item.get(sort_key)
        return val.lower() if isinstance(val, str) else (val if val is not None else -1)

    dirs.sort(key=sort_value, reverse=reverse)
    files.sort(key=sort_value, reverse=reverse)

    pane_data['items'].extend(dirs)
    pane_data['items'].extend(files)
    return pane_data


@api_bp.route('/list/')
@api_bp.route('/list/<path:subpath>')
def list_items_api(subpath=''):
    show_dotfiles = request.args.get('show_dotfiles', 'false').lower() == 'true'
    sort_by = request.args.get('sort_by', 'name').lower()
    order = request.args.get('order', 'asc').lower()
    if order not in ('asc', 'desc'):
        order = 'asc'

    data = get_directory_data(GUI_ROOT, subpath, show_dotfiles, sort_by, order)
    return jsonify(data)
