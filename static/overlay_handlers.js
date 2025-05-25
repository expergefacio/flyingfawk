// static/overlay_handlers.js

// References to the main overlay and content containers
let overlay = null;
let messageBox = null;
let previewContainer = null;
let terminalContainer = null;
let texteditorContainer = null; // For future use
let uppyContainer = null;

// References to the content divs within containers
let messageContent = null;
let previewContent = null;
let terminalContent = null;
let texteditorContent = null;
let uppyContent = null;

// References to close buttons
let closeMessageButton = null;
let closePreviewButton = null;
let closeTerminalButton = null;
let closeTexteditorButton = null;
let closeUppyButton = null;


// Assume _disposeActiveTerminal is available globally from terminalemulator.js
// It is exposed as window._disposeActiveTerminal
// Assume _disposeActiveVideoPlayer is available globally from preview_video.js
// It is exposed as window._disposeActiveVideoPlayer


/**
 * Initializes overlay element references. Should be called on DOMContentLoaded.
 */
function initializeOverlayElements() {
    overlay = document.getElementById('overlay');
    messageBox = document.getElementById('message-box');
    previewContainer = document.getElementById('preview-container');
    terminalContainer = document.getElementById('terminal-container');
    texteditorContainer = document.getElementById('texteditor-container');
    uppyContainer = document.getElementById('uppy-container');

    messageContent = document.getElementById('message-content');
    previewContent = document.getElementById('preview-content');
    terminalContent = document.getElementById('terminal-content');
    texteditorContent = document.getElementById('texteditor-content');
    uppyContent = document.getElementById('uppy-content')

    closeMessageButton = document.getElementById('close-message');
    closePreviewButton = document.getElementById('close-preview');
    closeTerminalButton = document.getElementById('close-terminal');
    closeTexteditorButton = document.getElementById('close-texteditor');
    closeUppyButton = document.getElementById('close-uppy');
    
    toggleMetaButton = document.getElementById('show-metadata');

    // Add check for all critical elements
    if (!overlay || !messageBox || !previewContainer || !terminalContainer || !texteditorContainer ||
        !messageContent || !previewContent || !terminalContent || !texteditorContent ||
        !closeMessageButton || !closePreviewButton || !closeTerminalButton || !closeTexteditorButton) {
        console.error("Overlay or one or more content/close elements not initialized! Some overlay features may not work.");
        // Consider displaying a critical message if the overlay system is broken
    } else {
        //console.log("Overlay elements initialized.");
    }
}


/**
 * Closes (hides) the entire overlay and all content containers.
 */
function overlayclose() {
    if (!overlay) {
        console.error("Overlay element not initialized!");
        return;
    }

    // === ADDED/MODIFIED: Check which container is active and call its specific cleanup if needed ===
    // We check if the container itself has the 'visible' class which our open functions add
    if (terminalContainer && terminalContainer.classList.contains('visible')) {
        // Call the dispose function defined in terminalemulator.js
        if (typeof window._disposeActiveTerminal === 'function') {
            console.log("Overlay closing: Active container is Terminal. Calling dispose...");
            window._disposeActiveTerminal(); // Call the terminal disposal function
        } else {
            console.error("Terminal dispose function not found (_disposeActiveTerminal).");
        }
    } else if (previewContainer && previewContainer.classList.contains('visible')) {
         // Call the dispose function defined in preview_video.js for the video player
         if (typeof window._disposeActiveVideoPlayer === 'function') {
            document.dispatchEvent(new CustomEvent('videoPreviewOverlayClosed'));
            console.log("Overlay closing: Active container is Preview. Calling dispose...");
            window._disposeActiveVideoPlayer(); // Call the video player disposal function
         }
     }
    // TODO: Add similar checks and cleanup calls for text editor, etc.
    // === END ADDED/MODIFIED ===


    // Remove the .visible class from the main overlay to trigger fade out
    overlay.classList.remove('visible');

    // Remove specific 'show' classes
    overlay.classList.remove('show-message', 'show-preview', 'show-terminal', 'show-texteditor');


    // Optional: Remove no-scroll class from body
    document.body.classList.remove('no-scroll');

    // Optional: Clear content after transition ends to free up memory/resources
    // Use a timeout matching the CSS transition duration (or slightly more)
    const transitionDuration = parseFloat(getComputedStyle(overlay).transitionDuration) * 1000;
    setTimeout(() => {
        // Only clear if the overlay is still NOT visible (prevents clearing if immediately reopened)
        if (!overlay.classList.contains('visible')) {
            // Content clearing happens here AFTER potential dispose calls
            // Clearing HTML here for terminal/editor/preview might be redundant if dispose cleans up DOM,
            // but a safe fallback.
            if (messageContent) messageContent.innerHTML = '';
            if (previewContent) previewContent.innerHTML = '';
            // --- MODIFIED: Do NOT clear terminalContent here ---
            // The terminalemulator.js now handles clearing terminalContent based on command input.
            // if (terminalContent) terminalContent.innerHTML = ''; // Removed this line
            // --- END MODIFIED ---
            if (texteditorContent) texteditorContent.innerHTML = ''; // Content of editorContent managed by editor JS
        }
    }, transitionDuration || 300); // Default to 300ms if transitionDuration is 0 or not found

    if (typeof window._onOverlayClosed === 'function') {
        const hook = window._onOverlayClosed;
        window._onOverlayClosed = null;
        hook(); // call after full cleanup
    }
    console.log("Overlay closed.");
}

/**
 * Hides all content containers within the overlay.
 * Called before showing a specific container.
 */
function hideAllOverlayContainers() {
    if (messageBox) {
        messageBox.style.display = 'none';
        messageBox.classList.remove('visible');
    }
    if (previewContainer) {
        previewContainer.style.display = 'none';
        previewContainer.classList.remove('visible');
    }
    if (terminalContainer) {
        terminalContainer.style.display = 'none';
        terminalContainer.classList.remove('visible');
    }
    if (texteditorContainer) {
        texteditorContainer.style.display = 'none';
        texteditorContainer.classList.remove('visible');
    }
    if (uppyContainer) {
        uppyContainer.style.display = 'none';
        uppyContainer.classList.remove('visible');
    }
}


/**
 * Opens the overlay with the message box content.
 * @param {string} html - The HTML content to display inside the message box.
 */
function openMessageBox(html) {
    // Check if overlay elements were successfully initialized
    if (!overlay || !messageBox || !messageContent) {
        console.error("Message box overlay elements not initialized!");
        return;
    }
    // Check if overlay is already visible with another type of content
    if (overlay.classList.contains('visible')) {
        console.warn("Overlay already visible. Cannot open message box.");
        // TODO: Decide how to handle multiple overlay requests (stacking, queuing, replacing)
        // For now, prevent opening a new one if one is already active.
        return;
    }

    // Hide all containers first
    hideAllOverlayContainers();

    // Set content (cleared by hideAll or overlayclose before)
    messageContent.innerHTML = html;

    // Show the message container (using display: flex as set in CSS)
    messageBox.style.display = 'flex';
    messageBox.classList.add('visible'); // Add visible class for individual container transition

    // Show the main overlay background and indicate which content is active (for CSS)
    overlay.classList.add('visible', 'show-message');

    // Add no-scroll class to body
    document.body.classList.add('no-scroll');

    console.log("Message box overlay opened.");
    
    // Fire hook for message box DOM ready
    requestAnimationFrame(() => {
        const event = new CustomEvent('messageBoxReady', {
            detail: {
                html
            }
        });
        document.dispatchEvent(event);
    });
}

 /**
 * Opens the overlay with the preview container content.
 * @param {string|HTMLElement} content - The content to display inside the preview area.
 * Accepts HTML string or a DOM element.
 */
 function openPreviewContainer(content) {
    if (!overlay || !previewContainer || !previewContent) {
        console.error("Preview container overlay elements not initialized!");
        return;
    }

    // Prevent double-open while visible
    if (overlay.classList.contains('visible')) {
        console.warn("Overlay already visible. Cannot open preview container.");
        return;
    }

    // Hide everything else
    hideAllOverlayContainers();

    // Reset preview state /get rid of open "meta"
    const metaBox = document.getElementById('metadata');
    const previewBox = document.getElementById('preview-content');
    if (metaBox && previewBox) {
        metaBox.classList.remove('visible');
        previewBox.classList.add('visible');
        metaBox.innerHTML = ''; // Clear stale metadata
    }

    // 🧹 Step 1: Kill any stray <video> elements before clearing
    const zombieVideos = previewContent.querySelectorAll('video');
    zombieVideos.forEach(v => {
        try {
            console.log("🧹 Killing zombie <video> before preview replace:", v);
            v.pause();
            v.removeAttribute('src');
            v.load();
            v.remove();
        } catch (err) {
            console.warn("Failed to fully kill zombie video:", err);
        }
    });

    // 🧼 Step 2: Clear previous preview content
    previewContent.innerHTML = '';

    // 🧪 Step 3: Inject new content safely
    if (typeof content === 'string') {
        previewContent.innerHTML = content;
    } else if (content instanceof HTMLElement) {
        previewContent.appendChild(content);
    } else {
        console.error("Invalid content type provided to openPreviewContainer.");
        previewContent.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #888;">
                Invalid preview content.
            </div>`;
    }

    // ✅ Step 4: Show the preview container
    previewContainer.style.display = 'flex';
    previewContainer.classList.add('visible');
    overlay.classList.add('visible', 'show-preview');
    document.body.classList.add('no-scroll');

    console.log("Preview container overlay opened.");
}



/**
 * Opens the overlay with the terminal container.
 * Does NOT set innerHTML directly; the terminal logic will render into terminal-content.
 * @returns {HTMLElement|null} The terminal-content div where the terminal should be mounted, or null if elements not found or overlay busy.
 */
function openTerminalContainer() {
     // Check if overlay elements were successfully initialized
     if (!overlay || !terminalContainer || !terminalContent) {
         console.error("Terminal container overlay elements not initialized!");
         return null;
     }
      // Check if overlay is already visible with another type of content
      if (overlay.classList.contains('visible')) {
         console.warn("Overlay already visible. Cannot open terminal container.");
          return null;
      }


     // Hide all containers first
     hideAllOverlayContainers();

     // --- MODIFIED: Removed unconditional clear for terminalContent ---
     // The terminalemulator.js now handles clearing terminalContent based on command input.
     // terminalContent.innerHTML = ''; // Removed this line
     // --- END MODIFIED ---


     // Show the terminal container (using display: flex as set in CSS)
     terminalContainer.style.display = 'flex';
     terminalContainer.classList.add('visible'); // Add visible class for individual container transition


     // Show the main overlay background and indicate which content is active (for CSS)
     overlay.classList.add('visible', 'show-terminal');

     // Add no-scroll class to body
     document.body.classList.add('no-scroll');

     console.log("Terminal container overlay opened.");

     // Return the terminal content div so the caller can mount xterm.js
     return terminalContent;
}

 /**
 * Opens the overlay with the text editor container. (Future Feature)
 * Does NOT set innerHTML directly; the editor logic will render into texteditor-content.
 * @returns {HTMLElement|null} The texteditor-content div where the editor should be mounted, or null if elements not found or overlay busy.
 */
function openTextEditorContainer() {
     // Check if overlay elements were successfully initialized
     if (!overlay || !texteditorContainer || !texteditorContent) {
         console.error("Text editor container overlay elements not initialized!");
         return null;
     }
      // Check if overlay is already visible with another type of content
      if (overlay.classList.contains('visible')) {
         console.warn("Overlay already visible. Cannot open text editor container.");
          return null;
      }

     // Hide all containers first
     hideAllOverlayContainers();

     // Clear previous content
     texteditorContent.innerHTML = '';

     // Show the text editor container (using display: flex as set in CSS)
     texteditorContainer.style.display = 'flex';
     texteditorContainer.classList.add('visible'); // Add visible class for individual container transition


     // Show the main overlay background and indicate which content is active (for CSS)
     overlay.classList.add('visible', 'show-texteditor');

     // Add no-scroll class to body
     document.body.classList.add('no-scroll');

     console.log("Text editor container overlay opened.");

     // Return the text editor content div
     return texteditorContent;
}


/**
 * Checks if the main overlay is currently visible.
 * @returns {boolean} True if the overlay has the 'visible' class, false otherwise.
 */
function isoverlayvisible() {
    if (!overlay) {
        // If elements aren't even initialized, the overlay is definitely not visible.
        // Avoid console error here as it might be called before DOMContentLoaded.
        return false;
    }
    // Check if the main overlay element is visible
    return overlay.classList.contains('visible');
}

// Make the functions available globally
window.overlayclose = overlayclose;
window.openMessageBox = openMessageBox;
window.openPreviewContainer = openPreviewContainer;
window.openTerminalContainer = openTerminalContainer;
window.openTextEditorContainer = openTextEditorContainer;


// Also make the check available globally
// This will overwrite the old isoverlayvisible from global_functions.js if it was loaded first
// It's safer to load overlay_handlers.js *before* global_functions.js or ensure global_functions.js
// checks if the function already exists before defining it. For now, overwrite is fine.
window.isoverlayvisible = isoverlayvisible;


// --- Initialize Event Listeners on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize element references first
    initializeOverlayElements();

    // Add event listeners for all close buttons
    // The close button listener for #close-message is already here from original code
    if (closeMessageButton) closeMessageButton.addEventListener('click', overlayclose);
    // Add listeners for the new close buttons
    if (closePreviewButton) closePreviewButton.addEventListener('click', overlayclose);
    if (closeTerminalButton) closeTerminalButton.addEventListener('click', overlayclose);
    if (closeTexteditorButton) closeTexteditorButton.addEventListener('click', overlayclose);
    if (closeUppyButton) closeUppyButton.addEventListener('click', overlayclose);

    if (toggleMetaButton) toggleMetaButton.addEventListener('click', toggleMetadata);


    // Add event listener to close overlay when clicking the background itself
    if (overlay) {
        overlay.addEventListener('click', (event) => {
            // Check if the click target is the overlay div itself
            // This prevents closing if clicking inside any of the content containers
            if (event.target === overlay) {
                overlayclose();
            }
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (overlay && overlay.classList.contains('visible')) {
                if (overlay.classList.contains('show-message')) {
                    overlayclose();
                }
            }
        }
    });
    //console.log("Overlay close listeners attached.");
});


/**
 * Opens the overlay with the Uppy upload dashboard.
 */
function openUppyContainer() {
    const overlay = document.getElementById('overlay');
    const uppyContainer = document.getElementById('uppy-container');
    const uppyContent = document.getElementById('uppy-content');

    if (!overlay || !uppyContainer || !uppyContent) {
        console.error("Uppy overlay elements not found.");
        return;
    }

    // Prevent double opening
    if (overlay.classList.contains('visible')) {
        console.warn("Overlay already visible. Cannot open Uppy.");
        return;
    }

    hideAllOverlayContainers(); // hide other containers

    uppyContainer.style.display = 'flex';
    uppyContainer.classList.add('visible');

    overlay.classList.add('visible');
    document.body.classList.add('no-scroll');

    console.log("Uppy overlay opened.");
}

// Add to global window
window.openUppyContainer = openUppyContainer;
