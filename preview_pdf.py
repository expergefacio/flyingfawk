import subprocess
import tempfile
import os
from pathlib import Path
from flask import Blueprint, request, send_file, jsonify
from io import BytesIO
import time
from glob import glob


TEMP_PDF_PREVIEW_DIR = Path("/tmp/pdf_previews")
TEMP_PDF_PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

preview_pdf_bp = Blueprint('preview_pdf', __name__, url_prefix='/api/preview/pdf')


def get_pdf_page_count(path: str) -> int:
    try:
        result = subprocess.run(
            ["pdfinfo", path],
            capture_output=True, text=True, check=True
        )
        for line in result.stdout.splitlines():
            if line.lower().startswith("pages:"):
                return int(line.split(":")[1].strip())
        return 0
    except Exception:
        return 0


@preview_pdf_bp.route('/page')
def preview_pdf_page():
    path = request.args.get('path')
    page = int(request.args.get('page', 1))

    try:
        print(f"Request to preview page {page} of: {path}")

        if not path:
            print("Missing path")
            return jsonify({'error': 'Missing "path" parameter'}), 400
        if page < 1:
            print("Invalid page number")
            return jsonify({'error': 'Page must be >= 1'}), 400

        for f in TEMP_PDF_PREVIEW_DIR.glob("*.jpg"):
            f.unlink(missing_ok=True)
        print("Old JPGs cleared")

        total_pages = get_pdf_page_count(path)
        print(f"Total pages: {total_pages}")
        if total_pages == 0:
            return jsonify({'error': 'Could not determine PDF page count'}), 500
        if page > total_pages:
            return jsonify({'error': f'PDF only has {total_pages} pages'}), 416

        output_base = TEMP_PDF_PREVIEW_DIR / "preview"
        result = subprocess.run([
            "pdftoppm", "-jpeg", "-f", str(page), "-l", str(page),
            path, str(output_base)
        ], capture_output=True, text=True)

        print("pdftoppm returncode:", result.returncode)
        print("stderr:", result.stderr.strip())
        print("stdout:", result.stdout.strip())

        if result.returncode != 0:
            return jsonify({'error': 'pdftoppm failed', 'details': result.stderr.strip()}), 500

        # Try to find any preview-*.jpg in the output directory
        matches = list(TEMP_PDF_PREVIEW_DIR.glob("preview-*.jpg"))

        if not matches:
            return jsonify({'error': f'Expected preview image not found in {TEMP_PDF_PREVIEW_DIR}'}), 500

        actual_path = matches[0]
        print(f"Found image: {actual_path}")
        
        with open(actual_path, 'rb') as f:
            image_bytes = f.read()

        print("Image successfully read, sending response")
        from flask import Response
        response = Response(image_bytes, mimetype='image/jpeg')
        response.headers["X-PDF-Page-Count"] = str(total_pages)
        response.headers["Access-Control-Expose-Headers"] = "X-PDF-Page-Count"
        return response

    except Exception as e:
        import traceback
        print("UNHANDLED EXCEPTION DURING PDF PREVIEW:")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@preview_pdf_bp.route('/pdfpagecount')
def pdf_info():
    path = request.args.get('path')
    if not path:
        return jsonify({'error': 'Missing "path" parameter'}), 400

    total_pages = get_pdf_page_count(path)
    return jsonify({'total_pages': total_pages})


@preview_pdf_bp.route('/debugtest')
def debug_test():
    test_path = Path("/tmp/pdf_previews/preview-001.jpg")
    if not test_path.exists():
        return jsonify({'error': 'Image not found'}), 404

    with open(test_path, 'rb') as f:
        image_bytes = f.read()

    from flask import Response
    response = Response(image_bytes, mimetype='image/jpeg')
    response.headers["X-Debug"] = "yes"
    response.headers["Access-Control-Expose-Headers"] = "X-Debug"
    return response