import os
import subprocess
import tempfile
from pathlib import Path
from flask import Blueprint, request, jsonify, Response
from PIL import Image

preview_img_bp = Blueprint('preview_img', __name__, url_prefix='/api/preview/image')

MAX_IMAGE_SIZE_MB = 1
COMPRESSION_THRESHOLD_MB = 2


def compress_image(input_path: Path, output_path: Path):
    """Compress image to be under MAX_IMAGE_SIZE_MB if needed."""
    try:
        with Image.open(input_path) as img:
            img = img.convert("RGB")  # Ensure compatibility
            quality = 85
            img.save(output_path, format="JPEG", quality=quality, optimize=True)

            while output_path.stat().st_size > MAX_IMAGE_SIZE_MB * 1024 * 1024 and quality > 20:
                quality -= 5
                img.save(output_path, format="JPEG", quality=quality, optimize=True)

            return True
    except Exception as e:
        print("Compression failed:", e)
        return False


@preview_img_bp.route('/')
def preview_image():
    path = request.args.get('path')
    if not path:
        return jsonify({'error': 'Missing "path" parameter'}), 400

    path = Path(path)
    if not path.exists():
        return jsonify({'error': f'File not found: {path}'}), 404

    ext = path.suffix.lower()
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_output = Path(tmpdir) / "preview.jpg"

            # HEIC and non-JPEG formats conversion
            if ext in ['.heic', '.heif']:
                cmd = ["convert", str(path), str(tmp_output)]  # uses ImageMagick
                subprocess.run(cmd, check=True)
            else:
                # If already a supported format, copy or compress
                size_mb = path.stat().st_size / (1024 * 1024)
                if size_mb > COMPRESSION_THRESHOLD_MB:
                    compress_image(path, tmp_output)
                else:
                    with Image.open(path) as img:
                        img.convert("RGB").save(tmp_output, format="JPEG", quality=85)

            with open(tmp_output, "rb") as f:
                data = f.read()

            response = Response(data, mimetype="image/jpeg")
            response.headers["X-Preview-Format"] = "jpeg"
            response.headers["Access-Control-Expose-Headers"] = "X-Preview-Format"
            return response

    except subprocess.CalledProcessError as e:
        return jsonify({'error': 'Image conversion failed', 'details': str(e)}), 500
    except Exception as e:
        import traceback
        print("UNHANDLED EXCEPTION DURING IMAGE PREVIEW:")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
