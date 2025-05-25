# flyingfawk.py
# This file defines the main Flask application and registers the API Blueprint.
import os
import eventlet
eventlet.monkey_patch()
#import eventlet.wsgi
from flask import Flask, render_template, request, redirect, url_for, session
from datetime import timedelta
import sys
import logging
from flask_socketio import SocketIO
from api import api_bp
#from werkzeug._reloader import run_with_reloader
import terminalapi
from userscripts import userscripts_bp
from videoapi import video_bp
from preview_docs import preview_docs_bp
from preview_text_meta import preview_text_meta_bp
from preview_pdf import preview_pdf_bp
from preview_img import preview_img_bp
from preview_video import video_preview
from fileoperations import fileoperations_bp
from updownapi import updown_bp
from werkzeug.middleware.proxy_fix import ProxyFix
from flask import g

USERNAME = 'admin'
PASSWORD = '123456'  # 🔒 change to something less 1996 if you care

# Configure logging - Keep DEBUG level for Flask/Werkzeug logs
logging.basicConfig(level=logging.DEBUG, stream=sys.stderr)

# Get the logger for watchdog
watchdog_logger = logging.getLogger('watchdog')
# Set its level to WARNING or higher to ignore DEBUG and INFO messages
watchdog_logger.setLevel(logging.WARNING)
logging.debug("Watchdog logger level set to WARNING.")

# Log the SECRET_KEY being used
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'a_default_secret_key')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if username == USERNAME and password == PASSWORD:
            session['user'] = username
            return redirect(url_for('index_dual_pane'))
        return "Invalid credentials", 403
    return render_template('login.html')

@app.before_request
def check_authentication():
    if request.endpoint == 'login' or request.endpoint == 'static':
        return  # allow login page and static files
    if 'user' not in session:
        return redirect(url_for('login'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# Set SESSION_PERMANENT to True and define PERMANENT_SESSION_LIFETIME
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=31) # Explicitly set lifetime
logging.debug(f"SESSION_PERMANENT set to True, PERMANENT_SESSION_LIFETIME set to {app.config['PERMANENT_SESSION_LIFETIME']}.")

app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_KEY_BITS'] = 256

# Revert SameSite to Lax and Secure to False
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False # Revert to False for HTTP
logging.debug(f"SESSION_COOKIE_SAMESITE set to 'Lax', SESSION_COOKIE_SECURE set to False.")

# Explicitly set cookie domain and path, and httpOnly
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['SESSION_COOKIE_HTTPONLY'] = False # Set httpOnly to False for debugging
logging.debug(f"SESSION_COOKIE_PATH set to '/', SESSION_COOKIE_HTTPONLY set to False.")

# Initialize SocketIO instance
# Explicitly set async_mode to 'eventlet'
# Set logger=False and engineio_logger=False to reduce clutter
socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins=[
    #"http://example.com",
    "http://localhost:8096"
], logger=False, engineio_logger=False)
logging.debug("SocketIO initialized with reduced logging.")

# Explicitly register terminal handlers
# Call the new function from terminalapi.py after creating the socketio instance
# This line should now be reached and execute without syntax errors
# terminalapi.register_handlers(socketio) # Call the registration function
# logging.debug("Terminal API Handlers explicitly registered.")

terminalapi.init_terminal_handlers(socketio)

# --- Flask Route (Serves the Static HTML Structure) ---
# This route remains in the main app.
@app.route('/')
def index_dual_pane(subpath=''):
    """Serves the main dual pane file browser HTML page."""
    logging.debug(f"--- index_dual_pane START (Serving HTML) ---")
    logging.debug(f"Initial subpath from URL (will be parsed by JS): '{subpath}'")
    logging.debug("Rendering template 'index.html'")
    # Pass the streaming_base_url to the template so JS knows where to build stream links
    # Note: streaming_base_url is now read in api.py, but the template still needs it.
    # We can either read it again here, or pass the Flask app config object to the template.
    # Reading it again here is simpler for this direct refactoring.
    streaming_base_url = os.environ.get('STREAMING_SERVICE_BASE_URL', '/video') # Default to blueprint prefix
    # Pass the SocketIO base URL to the template as well, for the frontend JS
    # By default, it's the same as the Flask app URL
    socketio_url = request.url_root # Or configure a specific URL if needed
    return render_template('index.html', streaming_base_url=streaming_base_url, socketio_url=socketio_url) # ADDED socketio_url


# --- Register Blueprints ---

app.register_blueprint(api_bp)
app.register_blueprint(userscripts_bp)
app.register_blueprint(video_bp, url_prefix='/video')
app.register_blueprint(preview_docs_bp)
app.register_blueprint(preview_text_meta_bp)
app.register_blueprint(preview_pdf_bp)
app.register_blueprint(preview_img_bp)
app.register_blueprint(video_preview)
app.register_blueprint(fileoperations_bp)
app.register_blueprint(updown_bp)

# Add after_request handler to log session state
@app.after_request
def log_session_state(response):
    # Log the session contents before the response is sent (where it's serialized)
    # logging.debug(f"After Request: Final Flask session contents before save: {dict(session)}")
    return response

# --- App Entry Point ---
if __name__ == '__main__':
    # Removed check for GUI_ROOT existence here - it's checked within get_directory_data in api.py
    # Removed check for STREAMING_SERVICE_BASE_URL here - it's used in api.py

    # Start the SocketIO server
    logging.info("Starting SocketIO server...")
    # Use host='0.0.0.0' to make it accessible from outside the container
    # Use port=5000 as configured in docker-compose.yml
    # debug=True enables Flask's debugger and SocketIO debugger if logger=True
    # We set SocketIO logger=False earlier, so this primarily affects Flask debug.
    # The eventlet server automatically handles the listening.
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
    logging.info("SocketIO server stopped.")
