# Use a lightweight official Python image
# python:3.9-slim-bookworm is a good balance of size and recent Debian base
FROM python:3.9-slim-bookworm

# Set the working directory inside the container
# This is where your host directory containing the app code will be mounted
WORKDIR /app

# Install necessary system packages, including ImageMagick
# We combine update and install in one RUN instruction for efficiency
# and clean up the apt cache to keep the image size down.
# Added 'bash' as a shell option, and 'procps' for 'ps' command (useful for debugging)
RUN apt-get update && \
    apt-get install -y --no-install-recommends --fix-missing \
    ffmpeg tesseract-ocr imagemagick poppler-utils bash procps sudo tmux \
    micro openssh-client unar zip unzip \
    libreoffice-core \
    libreoffice-impress \
    libreoffice-writer \
    libreoffice-calc \
    libheif1 \
    libde265-0 \
    fonts-dejavu-core \
    gir1.2-gtk-3.0 \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav && \
    rm -rf /var/lib/apt/lists/* && \
    if ! which ffprobe > /dev/null; then echo "Error: ffprobe was not installed correctly!" >&2; exit 1; fi && \
    if ! which pdftoppm > /dev/null; then echo "Error: pdftoppm was not installed correctly!" >&2; exit 1; fi && \
    if ! which bash > /dev/null; then echo "Error: bash was not installed correctly!" >&2; exit 1; fi


    
RUN libreoffice --version || (echo "LibreOffice failed!" >&2 && exit 1)
# Install Flask and watchdog (for auto-reloading)
# Added gunicorn as a common production WSGI server
RUN pip install --upgrade pip
RUN pip install --no-cache-dir \
    Flask watchdog gunicorn img2pdf \
    Flask-SocketIO python-socketio eventlet docker ffmpeg-python

# --- Reverted: Create user and group with specific UID/GID ---
# These commands are for Debian-based images like python:*-slim

# Create a group with GID 1000
RUN addgroup --gid 1000 appgroup

# Create a user with UID 1000 and add them to the group with GID 1000
RUN adduser --uid 1000 --gid 1000 --disabled-password --gecos "" appuser

ARG DOCKER_GID=988
RUN groupadd -g $DOCKER_GID docker_group || true
RUN usermod -aG docker_group appuser

# Change ownership of the working directory to the new user/group
# This is CRUCIAL so the user 'appuser' can read/write files in the mounted volume
RUN chown appuser:appgroup /app

RUN echo 'appuser ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/appuser && \
    chmod 0440 /etc/sudoers.d/appuser
    
# --- Reverted: Switch back to the appuser ---
USER appuser
# --- End Reverted ---

# Command to run the Flask application
CMD ["python", "flyingfawk.py"]
