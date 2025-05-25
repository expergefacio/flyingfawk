# preview_video.py

import os
import subprocess
from flask import Blueprint, request, Response, abort
from urllib.parse import unquote

video_preview = Blueprint('video_preview', __name__)

def is_audio_only(path):
    ext = os.path.splitext(path)[1].lower()
    return ext in ['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.oga', '.opus']


@video_preview.route('/video')
def stream_video():
    raw_path = request.args.get('v')
    seek_time = float(request.args.get('t', 0))

    if not raw_path:
        abort(400, 'Missing video path')

    safe_path = unquote(raw_path)
    if not os.path.isfile(safe_path):
        abort(404, 'File not found')

    if is_audio_only(safe_path):
        cmd = [
            'ffmpeg',
            '-ss', str(seek_time),
            '-i', safe_path,
            '-f', 'lavfi',
            '-t', '600',  # dummy length if duration unknown
            '-i', 'color=size=16x16:rate=10:color=black',
            '-shortest',
            '-f', 'mp4',
            '-vcodec', 'libx264',
            '-acodec', 'aac',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            'pipe:1'
        ]
    else:
        cmd = [
            'ffmpeg',
            '-ss', str(seek_time),
            '-i', safe_path,
            '-f', 'mp4',
            '-vcodec', 'libx264',
            '-acodec', 'aac',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            'pipe:1'
        ]


    print(f"[FFmpeg] Running: {' '.join(cmd)}")

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)

    def generate():
        try:
            while True:
                chunk = proc.stdout.read(4096)
                if not chunk:
                    break
                yield chunk
        finally:
            proc.terminate()
            print("[FFmpeg] Terminated process.")

    return Response(generate(), mimetype='video/mp4')


@video_preview.route('/gstream')
def stream_video_gstreamer():
    raw_path = request.args.get('v')
    seek_time = float(request.args.get('t', 0))

    if not raw_path:
        abort(400, 'Missing video path')

    safe_path = unquote(raw_path)
    if not os.path.isfile(safe_path):
        abort(404, 'File not found')

    # Convert seek_time to nanoseconds for GStreamer
    seek_ns = int(seek_time * 1e9)

    # Construct GStreamer command pipeline
    cmd = [
        'gst-launch-1.0',
        f'filesrc location={safe_path}', '!',
        'decodebin', '!',
        'x264enc speed-preset=ultrafast tune=zerolatency', '!',
        'mp4mux fragment-duration=1000 streamable=true', '!',
        'fdsink fd=1'
    ]

    print(f"[GStreamer] Running: {' '.join(cmd)}")

    try:
        proc = subprocess.Popen(' '.join(cmd), stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, shell=True)

        def generate():
            try:
                while True:
                    chunk = proc.stdout.read(4096)
                    if not chunk:
                        break
                    yield chunk
            finally:
                proc.terminate()
                print("[GStreamer] Terminated process.")

        return Response(generate(), mimetype='video/mp4')
    except Exception as e:
        print(f"[GStreamer] Failed to start pipeline: {e}")
        abort(500, 'GStreamer pipeline failed')
