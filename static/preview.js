// static/preview.js

// current design scheeme is to contain the functionality within the individual
// functions pr preview,
// openPreview, closePreview, and others tie heavily into the main flow:
// keyevent.js, overlay_handlers.js, and so on, 
/**
 * Opens the preview overlay and displays the provided content.
 * This function is responsible ONLY for preparing content and calling the unified overlay handler.
 * @param {string|HTMLElement} content - The content to display. Can be an HTML string or an existing DOM element.
 */
function openPreview(content) {
    // Call the unified overlay handler to open the preview container
    // Assumes openPreviewContainer is available globally from overlay_handlers.js
    if (typeof openPreviewContainer === 'function') { // Safety check
        openPreviewContainer(content);
         console.log("Called openPreviewContainer from preview.js");
    } else {
        console.error("openPreviewContainer function not found!");
        // Fallback: try openMessageBox if it's available
        if (typeof openMessageBox === 'function') { // Safety check
            openMessageBox('<div class="message-content-text error-message">Error displaying preview: Overlay handler not found.</div>');
        } else { console.error("openMessageBox not found."); }
    }
}

/**
 * Closes (hides) the preview overlay.
 * This function exists primarily so handlePreviewButtonClick can toggle.
 */
function closePreview() {
    if (typeof overlayclose === 'function') {
        overlayclose();
        console.log("Called overlayclose from preview.js closePreview.");
    } else {
         console.error("overlayclose function not found!");
    }
}

function toggleMetadata() {
    const metaBox = document.getElementById('metadata');
    const previewBox = document.getElementById('preview-content');
    if (!metaBox || !previewBox) return;

    const showingMetadata = !metaBox.classList.contains('visible');

    if (showingMetadata) {
        console.log("showingMetadata")
        metaBox.classList.add('visible');
        previewBox.classList.remove('visible');
    } else {
        metaBox.classList.remove('visible');
        previewBox.classList.add('visible');
        return; // no need to fetch metadata if hiding it
    }

    // Get the currently focused item in the active pane
    const focusedPane = document.querySelector('.pane-container.panefocus');
    if (!focusedPane) return;

    const focusedItem = focusedPane.querySelector('.file-row.focus');
    if (!focusedItem) return;

    const logicalPath = focusedItem.dataset.path;
    if (!logicalPath) return;

    const fullPath = '/hostroot' + logicalPath;

    fetch(`/api/preview/meta?path=${encodeURIComponent(fullPath)}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                metaBox.innerHTML = `<div class="message-content-text error-message">Error loading metadata:<br>${data.error}</div>`;
                return;
            }

            const formatTime = (ts) => new Date(ts * 1000).toLocaleString();

            metaBox.innerHTML = `
                <div class="message-content-text" style="padding: 20px;">
                    <strong>Metadata for:</strong><br>
                    <div style="margin-top: 10px; font-family: monospace;">${data.path}</div>
                    <hr style="margin: 10px 0;">
                    <ul style="list-style: none; padding: 0; font-size: 0.9em;">
                        <li><strong>Size:</strong> ${data.size_bytes.toLocaleString()} bytes</li>
                        <li><strong>Created:</strong> ${formatTime(data.created)}</li>
                        <li><strong>Last modified:</strong> ${formatTime(data.last_modified)}</li>
                        <li><strong>Last accessed:</strong> ${formatTime(data.last_accessed)}</li>
                        <li><strong>Type:</strong> ${data.is_dir ? 'Directory' : (data.is_file ? 'File' : 'Other')}</li>
                    </ul>
                </div>
            `;
        })
        .catch(err => {
            metaBox.innerHTML = `<div class="message-content-text error-message">Failed to fetch metadata:<br>${err.message}</div>`;
        });
}


/**
 * Handles the preview button click.
 * Finds the focused item and delegates to type-specific handlers.
 * Also handles closing the preview if already open.
 */
function handlePreviewButtonClick(event = null) {
    if (typeof isoverlayvisible === 'function' && isoverlayvisible()) {
        overlayclose();
        return;
    }

    const focusedItemRow = typeof getFocusedItemRowInFocusedPane === 'function' ? getFocusedItemRowInFocusedPane() : null;

    if (focusedItemRow === null) {
        if (typeof openMessageBox === 'function') {
            openMessageBox('<div class="message-content-text">Please focus an item to preview.</div>');
        } else { console.error("openMessageBox function not found."); }
        return;
    }

    const itemPath = focusedItemRow.dataset.path;
    const itemName = focusedItemRow.dataset.itemName;
    const itemType = focusedItemRow.dataset.itemType;

    if (itemType === 'dir') {
         handleDirectoryPreview(itemPath, itemName);
    } else if (itemType === 'file') {
        const fileExtension = itemName.split('.').pop().toLowerCase();
        // --- Check for Text File Extensions ---
        if ([
               'doc', 'docx', 'odt', 'rtf', 'sxw',
               'xls', 'xlsx', 'ods', 'csv', 'tsv', 'dbf',
               'ppt', 'pptx', 'odp', 'sxi',
               'fodt', 'fods', 'fodp'
           ].includes(fileExtension)) {
            handleOfficeDocPreview(itemPath, itemName);
        } else if ([
                'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif',
                'webp', 'heic', 'heif', 'ico', 'pbm', 'pgm', 'ppm',
                'pnm', 'svg', 'eps', 'raw', 'psd'
            ].includes(fileExtension)) {
                handleImagePreview(itemPath, itemName);
        } else if ([
               'pdf'
            ].includes(fileExtension)) {
                handlePDFPreview(itemPath, itemName);
        } else if ([
                // Video container formats
                '3g2', '3gp', 'amv', 'asf', 'avi', 'avm2', 'avs', 'avs2', 'avs3', 'bik', 'dirac', 'divx',
                'drc', 'dv', 'f4v', 'flv', 'gxf', 'ismv', 'm1v', 'm2p', 'm2ts', 'm4v', 'mkv', 'mov', 'mp2',
                'mp4', 'mpg', 'mpeg', 'mpe', 'mpv', 'mxf', 'nut', 'ogg', 'ogv', 'ps', 'rm', 'rmvb', 'roq',
                'ts', 'vob', 'webm', 'wm', 'wmv', 'yuv', 'y4m',

                // Audio formats (demuxable or raw audio streams)
                'aac', 'ac3', 'adts', 'alac', 'amr', 'ape', 'dts', 'eac3', 'f32', 'f64', 'flac', 'g722',
                'g723', 'g726', 'gsm', 'm4a', 'mka', 'mlp', 'mp3', 'mpa', 'mpc', 'oga', 'ogg', 'opus',
                'ra', 'ram', 'sbc', 'spx', 'tta', 'voc', 'wav', 'w64', 'wma', 'wv'
            ].includes(fileExtension)) {
                handleVideoPreview(itemPath, itemName);
                //old_handleVideoPreview(itemPath, itemName);
        } else {
            // Try to load as "pure" text (.txt, .md, .py, .css, .html, .* ... )
            handleGenericFilePreview(itemPath, itemName, fileExtension);
        }
     } else {
        // Handle unexpected item types (Gemeni added this, i guess its for files that are neither files or dirs)
        handleGenericFilePreview(itemPath, itemName, itemType);
     }
}


/**
 * Handler for previewing a directory.
 * @param {string} itemPath - The UI path of the directory.
 * @param {string} itemName - The name of the directory.
 */
function handleDirectoryPreview(itemPath, itemName) {
    const escapedName = typeof escapeHtml === 'function' ? escapeHtml(itemName) : itemName;
    const escapedPath = typeof escapeHtml === 'function' ? escapeHtml(itemPath) : itemPath;

    
    const previewContentHtml = `
        <div style="padding: 20px; text-align: left; color: #333;">
            <h2>Directory: ${escapedName}</h2>
            <p><strong>Path:</strong> ${escapedPath}</p>
            <p id="folder-size-line" data-path="${escapedPath}">Size: <em>calculating...</em></p>
            <div id="folder-preview-list">Loading contents...</div>
        </div>
    `;
    openPreview(previewContentHtml);
    queueFolderSizeOverlay(itemPath);

    console.time('folder-preview'); 
    // Fetch folder contents
    fetch(`/api/preview/folderpreview?path=${encodeURIComponent('/hostroot' + itemPath)}`)
        .then(res => res.json())
        .then(data => {
            console.timeEnd('folder-preview');
            const container = document.getElementById('folder-preview-list');
            if (!container) return;

            if (data.error) {
                container.innerHTML = `<p style="color: red;">Error: ${escapeHtml(data.error)}</p>`;
                return;
            }

            if (!data.entries || data.entries.length === 0) {
                container.innerHTML = `<p>No contents in this folder.</p>`;
                return;
            }

            const listHtml = data.entries.map(entry => {
                const icon = entry.is_dir ? '📁' : '📄';
                const size = entry.is_dir ? '' : ` (${(entry.size / 1024).toFixed(1)} KB)`;
                return `<div>${icon} ${escapeHtml(entry.name)}${size}</div>`;
            }).join('');

            container.innerHTML = `<div><strong>Contents:</strong><div style="margin-top: 10px;">${listHtml}</div></div>`;
        })
        .catch(err => {
            const container = document.getElementById('folder-preview-list');
            if (container) {
                container.innerHTML = `<p style="color: red;">Failed to load folder contents.</p>`;
            }
            console.error("Folder preview fetch failed:", err);
        });
}


function handleGenericFilePreview(itemPath, itemName, fileExtension) {
    // Try to fetch the content as text if there's no known handler
    fetch(`/api/preview/text?path=${encodeURIComponent('/hostroot' + itemPath)}`)
        .then(response => {
            if (!response.ok) throw new Error("Not a text-readable file");
            return response.text();
        })
        .then(text => {
            openPreview(`
                <div style="padding: 20px;">
                    <h3>${escapeHtml(itemName)}</h3>
                    <pre style="white-space: pre-wrap;">${escapeHtml(text)}</pre>
                </div>
            `);
        })
        .catch((err) => {
            openPreview(`
                <div style="padding: 20px; color: #888; text-align: center;">
                    Cannot preview this file type.
                </div>
            `);
        });
}


// Make the main button handler available globally for buttons.js
window.handlePreviewButtonClick = handlePreviewButtonClick;




/**
 * Handles previewing office documents (doc, xls, ppt, etc.) via HTML conversion.
 * Calls backend /api/preview/html endpoint to get the HTML version.
 */
function handleOfficeDocPreview(itemPath, itemName) {
    const previewContentHtml = `
        <div style="text-align: center; color: #555; padding: 20px;">
            <p>Loading preview for <strong>${typeof escapeHtml === 'function' ? escapeHtml(itemName) : itemName}</strong>...</p>
        </div>
    `;
    openPreview(previewContentHtml); // Initial loading message

    // 🔧 Prepend /hostroot to make it Docker-visible
    const serverPath = '/hostroot' + itemPath;

    fetch(`/api/preview/doc?path=${encodeURIComponent(serverPath)}`)
        .then(response => {
            if (!response.ok) throw new Error("Failed to load document preview.");
            return response.text();
        })
        .then(html => {
            const previewContentArea = document.getElementById('preview-content');
            if (previewContentArea) {
                previewContentArea.innerHTML = html;
            } else {
                console.error("preview-content container not found!");
            }
        })
        .catch(error => {
            console.error("Preview error:", error);
            if (typeof openMessageBox === 'function') {
                openMessageBox('<div class="message-content-text error-message">Unable to preview document.</div>');
            }
        });
}


async function handlePDFPreview(itemPath, itemName) {
    const serverPath = '/hostroot' + itemPath;
    let currentPage = 1;
    let totalPages = 1;
    const outerContainer = document.createElement('div');
    outerContainer.id = 'preview_img_container';
    
    outerContainer.innerHTML = `

      <div id="preview_img_wrapper">

        <div id="preview_img_inner">
            <img id="pdf-image" />
        </div>
      </div>
      <div id="preview_img_buttons" style="text-align: center;">
        <div style="margin-top: 10px;">
          <button id="pdf-prev-page">◀ Prev</button>
          <span>
            Page <input type="number" id="pdf-page-input" min="1" value="1" style="width: 50px; text-align: center;"> of <span id="pdf-page-count">?</span>
          </span>
          <button id="pdf-next-page">Next ▶</button>
            <span style="margin-left: 20px;">
                <button id="pdf-zoom-in">+</button>
                <span id="pdf-zoom-display" style="margin: 0 5px;"></span>
                <button id="pdf-zoom-out">−</button>
            </span>
        </div>
      </div>
    `;


    openPreview(outerContainer); // show container early

    const img = document.getElementById('pdf-image');
    const prevBtn = document.getElementById('pdf-prev-page');
    const nextBtn = document.getElementById('pdf-next-page');
    const pageInput = document.getElementById('pdf-page-input');
    const pageCountSpan = document.getElementById('pdf-page-count');

    async function loadPage(page) {
        const url = `/api/preview/pdf/page?path=${encodeURIComponent(serverPath)}&page=${page}`;
        const response = await fetch(url);
        if (!response.ok) {
            outerContainer.innerHTML = `<p>Failed to load PDF page ${page}</p>`;
            return;
        }
    
        totalPages = parseInt(response.headers.get('X-PDF-Page-Count') || '1', 10);
        currentPage = page;
    
        const blob = await response.blob();
        img.src = URL.createObjectURL(blob);
    
        pageInput.value = currentPage;
        pageCountSpan.textContent = totalPages;
    
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
    }

    prevBtn.onclick = () => loadPage(currentPage - 1);
    nextBtn.onclick = () => loadPage(currentPage + 1);

    loadPage(1);
    pageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = parseInt(pageInput.value, 10);
            if (!isNaN(val) && val >= 1 && val <= totalPages) {
                loadPage(val);
            } else {
                pageInput.value = currentPage; // Reset if invalid
            }
        }
    });
    function handleArrowKeys(e) {
        if (document.activeElement === pageInput) return;
    
        if (e.key === 'ArrowLeft' && currentPage > 1) {
            e.preventDefault();
            loadPage(currentPage - 1);
        } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
            e.preventDefault();
            loadPage(currentPage + 1);
        }
    }
    document.addEventListener('keydown', handleArrowKeys);
    
    document.addEventListener('overlayclosed', () => {
        document.removeEventListener('keydown', handleArrowKeys);
    }, { once: true });
    prev_img_zoom_init();
}


async function handleImagePreview(itemPath, itemName) {
    const serverPath = itemPath === '/' ? '/hostroot/' + itemName : '/hostroot' + itemPath;
    const encodedPath = encodeURIComponent(serverPath);
    const url = `/api/preview/image?path=${encodedPath}`;

    const previewHtml = `

        <div id="preview_img_container">
            <div id="preview_img_wrapper">

                <div id="preview_img_inner">
                    <img src="${url}"/>
                </div>
            </div>
            <div id="preview_img_buttons" style="text-align: center;">
                <div style="margin-top: 10px;">
                    <span style="margin-left: 20px;">
                        <button id="pdf-zoom-in">+</button>
                        <span id="pdf-zoom-display" style="margin: 0 5px;"></span>
                        <button id="pdf-zoom-out">−</button>
                    </span>
                </div>
            </div>
        </div>
    `;
    openPreview(previewHtml);
    prev_img_zoom_init();
}
window.handleImagePreview = handleImagePreview;




async function handleVideoPreview(itemPath, itemName) {
    console.log(`[handleVideoPreview] Previewing video: ${itemName} from ${itemPath}`);

    const serverPath = itemPath === '/' ? '/hostroot/' + itemName : '/hostroot' + itemPath;
    const encodedPath = encodeURIComponent(serverPath);

    // Step 1: Fetch metadata
    let metadata;
    try {
        const res = await fetch(`/video/metadata?path=${encodedPath}`);
        if (!res.ok) throw new Error(await res.text());
        metadata = await res.json();
    } catch (err) {
        console.error("[handleVideoPreview] Failed to load metadata:", err);
        if (typeof openMessageBox === 'function') {
            openMessageBox(`<div class="message-content-text error-message">Failed to load video metadata: ${escapeHtml(err.message)}</div>`);
        }
        return;
    }

    // Step 2: Build the preview HTML
    const videoHtml = `
        <div class="video-wrapper">
        <video id="videoPlayer" autoplay>
            <source src="/video?v=${encodeURIComponent(metadata.validated_path)}" type="video/mp4">
        </video>
        <div class="video-controls">
            <button id="playPause">⏸</button>
            <span id="currentTime">0:00</span>
            <input type="range" id="seekBar" min="0" max="${metadata.duration_seconds}" step="0.1" value="0">
            <span id="duration">${formatTime(metadata.duration_seconds)}</span>
            <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="1">
        </div>
        </div>
    `;

    const videostyles = `
        .video-wrapper {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        #videoPlayer {
            flex-grow: 1;
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: black;
        }

        .video-controls {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 8px;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: sans-serif;
            color: white;
        }

        #seekBar {
            flex-grow: 1;
        }

        #volumeSlider {
            width: 80px;
            flex-shrink: 0;
        }
    `;
    if (!document.getElementById('video-preview-style')) {
        document.querySelector('head').insertAdjacentHTML('beforeend', `<style id="video-preview-style">${minifyCSS(videostyles)}</style>`)
    }
    openPreview(videoHtml);

    // Step 3: Wait for DOM and wire up logic
    await new Promise(r => requestAnimationFrame(r));

    let video = document.getElementById('videoPlayer');
    const playPause = document.getElementById('playPause');
    const currentTimeEl = document.getElementById('currentTime');
    const durationEl = document.getElementById('duration');
    const seekBar = document.getElementById('seekBar');
    const volumeSlider = document.getElementById('volumeSlider');

    let seeking = false;
    const storedVolume = localStorage.getItem('video_volume');
    if (storedVolume !== null) {
        video.volume = parseFloat(storedVolume);
        volumeSlider.value = storedVolume;
    }

    function formatTime(sec) {
      const s = Math.floor(sec % 60).toString().padStart(2, '0');
      const m = Math.floor((sec / 60) % 60).toString().padStart(2, '0');
      const h = Math.floor(sec / 3600).toString();
      return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
    }

    playPause.addEventListener('click', () => {
        if (video.paused) {
            video.play();
            playPause.textContent = '⏸';
        } else {
            video.pause();
            playPause.textContent = '▶';
        }
    });

    volumeSlider.addEventListener('input', () => {
        const vol = parseFloat(volumeSlider.value);
        video.volume = vol;
        localStorage.setItem('video_volume', vol);
    });

    let currentSeekOffset = 0;
    seekBar.addEventListener('mousedown', () => seeking = true);
    seekBar.addEventListener('mouseup', () => {
        seeking = false;
        const time = parseFloat(seekBar.value);
        const wasPlaying = !video.paused;
        currentSeekOffset = time;
    
        const container = video.parentElement;
        const oldVideo = video;
    
        const newVideo = document.createElement('video');
        newVideo.id = 'videoPlayer';
        newVideo.autoplay = true;
        newVideo.innerHTML = `<source src="/video?v=${encodeURIComponent(metadata.validated_path)}&t=${time}" type="video/mp4">`;
        newVideo.volume = oldVideo.volume;
    
        // Abort old network request *before* replacing
        oldVideo.pause();
        oldVideo.removeAttribute('src');
        oldVideo.load();
    
        container.replaceChild(newVideo, oldVideo);
        video = newVideo;
    
        if (wasPlaying) {
            video.play().catch(err => {
                if (err.name !== 'AbortError') console.warn("Seeked video play failed:", err);
            });
        }
    });
    

    video.addEventListener('timeupdate', () => {
        const absoluteTime = currentSeekOffset + video.currentTime;
        if (!seeking) seekBar.value = absoluteTime;
        currentTimeEl.textContent = formatTime(absoluteTime);
    });

    function handleKeySeek(e) {
        if (!video) return;
        if (e.key === 'ArrowRight') {
            const newTime = currentSeekOffset + video.currentTime + 15;
            if (newTime < metadata.duration_seconds) {
                seekBar.value = newTime;
                seekBar.dispatchEvent(new Event('mouseup'));
            }
        } else if (e.key === 'ArrowLeft') {
            const newTime = Math.max(0, currentSeekOffset + video.currentTime - 17);
            seekBar.value = newTime;
            seekBar.dispatchEvent(new Event('mouseup'));
        }
    }
    document.addEventListener('keydown', handleKeySeek);

    window._disposeActiveVideoPlayer = function () {
        console.log("Disposing video preview...");
        document.removeEventListener('keydown', handleKeySeek);
        if (video) {
            try {
                video.pause();
                video.removeAttribute('src');
                video.load();
                video.remove();
            } catch (e) {
                console.warn("Video cleanup failed", e);
            }
            video = null; // 🧼 kill reference
        }
        currentSeekOffset = 0; // 🧹 kill offset
    };
    

    document.addEventListener('overlayclosed', () => {
        if (typeof window._disposeActiveVideoPlayer === 'function') {
            window._disposeActiveVideoPlayer();
        }
    }, { once: true });

    console.log("volume:", video.volume, "muted:", video.muted);
}

function prev_img_zoom_init() {
    const wrapper = document.getElementById('preview_img_wrapper');
    const img = wrapper?.querySelector('img');
    const zoomInBtn = document.getElementById('pdf-zoom-in');
    const zoomOutBtn = document.getElementById('pdf-zoom-out');
    const zoomDisplay = document.getElementById('pdf-zoom-display');
  
    if (!img || !wrapper) return;

    function applyContainZoom(img, wrapper, zoom = 1) {
        const containerW = wrapper.clientWidth;
        const containerH = wrapper.clientHeight;
      
        const naturalW = img.naturalWidth;
        const naturalH = img.naturalHeight;
      
        if (!naturalW || !naturalH) return;
      
        const aspectRatio = naturalW / naturalH;
      
        let targetW = containerW;
        let targetH = targetW / aspectRatio;
      
        if (targetH > containerH) {
          targetH = containerH;
          targetW = targetH * aspectRatio;
        }
      
        targetW *= zoom;
        targetH *= zoom;
      
        img.style.width = `${targetW}px`;
        img.style.height = `${targetH}px`;
    }


    img.onload = () => applyContainZoom(img, wrapper, zoom); 
      
  
    let zoom = 1; // 1 = 100%
    const minZoom = 0.1;
    const maxZoom = 5;
    const step = 0.1;
  
    function updateZoom(newZoom) {
        zoom = Math.max(0.1, Math.min(maxZoom, newZoom));
        applyContainZoom(img, wrapper, zoom);
        zoomDisplay.textContent = `${Math.round(zoom * 100)}%`;
    }
  
    if (zoomInBtn) zoomInBtn.onclick = () => updateZoom(zoom + step);
    if (zoomOutBtn) zoomOutBtn.onclick = () => updateZoom(zoom - step);
  
    // Handle Ctrl+Scroll
    wrapper.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
  
      e.preventDefault();
      const delta = e.deltaY || e.wheelDelta;
      updateZoom(zoom - Math.sign(delta) * step);
    }, { passive: false });
  
    // Handle pinch zoom (touchpad, touchscreen)
    let lastTouchDist = null;
    wrapper.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2) return;
  
      e.preventDefault();
      const [touch1, touch2] = e.touches;
      const dist = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
  
      if (lastTouchDist !== null) {
        const delta = dist - lastTouchDist;
        updateZoom(zoom + delta * 0.005); // scale sensitivity
      }
  
      lastTouchDist = dist;
    }, { passive: false });
  
    wrapper.addEventListener('touchend', () => {
      lastTouchDist = null;
    });
  
    updateZoom(1); // Init zoom

    // Drag to pan (mouse only)
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    wrapper.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left-click
        isDragging = true;
        wrapper.classList.add('dragging');
        startX = e.clientX;
        startY = e.clientY;
        scrollLeft = wrapper.scrollLeft;
        scrollTop = wrapper.scrollTop;
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        wrapper.scrollLeft = scrollLeft - dx;
        wrapper.scrollTop = scrollTop - dy;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        wrapper.classList.remove('dragging');
    });

    // Prevent touch dragging from interfering
    wrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) e.preventDefault(); // prevent scroll/pan
    }, { passive: false });

  }
  