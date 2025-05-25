import os
import subprocess
import tempfile
from pathlib import Path
from flask import Blueprint, request, jsonify

preview_docs_bp = Blueprint('preview_docs', __name__, url_prefix='/api/preview')


def convert_to_html_preview(file_path: str) -> tuple[str, Path, callable]:
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    tmpdir = tempfile.TemporaryDirectory()
    output_dir = Path(tmpdir.name)

    result = subprocess.run([
        "libreoffice",
        "--headless",
        "--convert-to", "html",
        "--outdir", str(output_dir),
        str(file_path)
    ], capture_output=True)

    if result.returncode != 0:
        tmpdir.cleanup()
        raise RuntimeError(f"LibreOffice conversion failed:\n{result.stderr.decode(errors='ignore')}")

    html_files = list(output_dir.glob("*.html"))
    if not html_files:
        tmpdir.cleanup()
        raise FileNotFoundError("No HTML file generated during preview.")

    with open(html_files[0], "r", encoding="utf-8", errors="ignore") as f:
        html = f.read()

    return html, output_dir, tmpdir.cleanup


def inline_images_in_html(html: str, image_dir: Path) -> str:
    import re
    import base64

    def replace_img_src(match):
        src = match.group(1)
        img_path = image_dir / src
        if not img_path.exists():
            return match.group(0)  # Leave original if file missing

        with open(img_path, "rb") as img_file:
            encoded = base64.b64encode(img_file.read()).decode()
            mime_type = "image/png"  # LibreOffice always uses PNG
            return f'<img src="data:{mime_type};base64,{encoded}"'

    # Match <img src="..."> and replace src
    return re.sub(r'<img src="([^"]+)"', replace_img_src, html)


@preview_docs_bp.route('/doc')
def preview_document():
    path = request.args.get('path')
    if not path:
        return jsonify({'error': 'Missing "path" parameter'}), 400

    cleanup_fn = lambda: None  # no-op fallback
    try:
        html, output_dir, cleanup_fn = convert_to_html_preview(path)
        html = inline_images_in_html(html, output_dir)
        return html
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            cleanup_fn()
        except Exception:
            pass  # Ignore cleanup errors
