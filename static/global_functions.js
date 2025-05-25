// static/global_functions.js

// The functions defined here are intended to be globally available.
// Define them explicitly on the window object.


// --- localStorage Key for Dotfile Preference ---
const SHOW_DOTFILES_STORAGE_KEY = 'filebrowser_show_dotfiles';
// --- End localStorage Key ---

// Global object to store retained selections and focuses per pane
window._retainedSelections = {};


async function fetchDirectoryData(path, showDotfiles = false, sortBy = 'name', order = 'asc') {
    const apiPath = path.startsWith('/') ? path : '/' + path;
    const encodedApiPath = apiPath.split('/').map(segment => encodeURIComponent(segment)).join('/');

    // Compose query string with dotfile and sorting parameters
    const url = `${API_BASE_URL}${encodedApiPath}?show_dotfiles=${showDotfiles ? 'true' : 'false'}&sort_by=${encodeURIComponent(sortBy)}&order=${encodeURIComponent(order)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            return {
                error: `Server Error: ${response.status} ${response.statusText}`,
                current_path: path,
                items: [],
                is_file: false
            };
        }
        return await response.json();
    } catch (error) {
        return {
            error: `Network Error: ${error.message}`,
            current_path: path,
            items: [],
            is_file: false
        };
    }
}



function renderPaneContent(paneElement, paneData) {
    const pathInput = paneElement.querySelector('.path-input');
    const fileListContainer = paneElement.querySelector('.file-list-container');

    fileListContainer.innerHTML = '';

    if (paneData.error) {
        fileListContainer.innerHTML = `<div class="error-message">${paneData.error}</div>`;
        // Keep the path input value as it was (likely the error path)
    } else if (paneData.is_file) {
         const filePath = paneData.current_path || '/';
         const parentPath = filePath.split('/').slice(0, -1).join('/') || '/';
         fileListContainer.innerHTML = `
             <div class="file-message">
                 Path is a file:<br>${filePath}<br>
                 <a href="#" data-action="navigate" data-pane-id="${paneElement.id}" data-path="${parentPath}">Go to parent directory</a>
             </div>
         `;
         // Keep the path input value as the file path
    } else if (Array.isArray(paneData.items)) {
        let fileListHtml = '';
        paneData.items.forEach(item => {
            fileListHtml += tmpl.file_row(item);
        });
        fileListContainer.innerHTML = fileListHtml;

        fileListContainer.querySelector('.file-row')?.classList.add('focus');

        // The pathInput value is already set by the DOMContentLoaded or dblclick handler

    } else {
        fileListContainer.innerHTML = `<div class="error-message">Internal Error: Invalid data structure received.</div>`;
        // Keep the path input value as it was
    }
}

// loadPaneContent
// Fetches and renders the file list for a given pane, remembering dotfile preference and dispatching a custom event after load

async function loadPaneContent(paneId) {
    const paneElement = document.getElementById(paneId);
    const pathInput = paneElement ? paneElement.querySelector('.path-input') : null;
    const fileListContainer = paneElement ? paneElement.querySelector('.file-list-container') : null;

    // Basic validation of required elements
    if (!paneElement || !fileListContainer || !pathInput) {
        if (paneElement && fileListContainer) {
            fileListContainer.innerHTML = `<div class="error-message">Initialization Error: Required UI elements not found for this pane.</div>`;
        } else {
            console.error("Initialization Error: Main UI structure not found.");
            document.body.innerHTML = `<div class="error-message">Initialization Error: Main UI structure not found.</div>`;
        }
        return;
    }

    const path = pathInput.value || '/';

    // Get dotfile preference
    const showDotfiles = localStorage.getItem(SHOW_DOTFILES_STORAGE_KEY) === 'true';
    // console.log(`loadPaneContent: Reading showDotfiles from localStorage: ${localStorage.getItem(SHOW_DOTFILES_STORAGE_KEY)}. Interpreted as boolean: ${showDotfiles}`);

    // 🆕 Get sorting preferences and apply sort marker
    const { sortBy, sortOrder } = getSortingFromLocalStorage(paneId);

    // console.log(`Loading content for pane ${paneId} at path: ${path} (Show dotfiles: ${showDotfiles}, Sort by: ${sortBy}, Order: ${sortOrder})`);

    fileListContainer.innerHTML = '<p>Loading...</p>';
    let paneData;

    try {
        paneData = await fetchDirectoryData(path, showDotfiles, sortBy, sortOrder);
        renderPaneContent(paneElement, paneData);

        // --- Dispatch custom event (for restoring selections, etc.) ---
        const event = new CustomEvent('paneContentLoaded', { detail: { paneId } });
        paneElement.dispatchEvent(event);
        console.log(`[global_functions] paneContentLoaded dispatched for ${paneId}`);
    } catch (error) {
        fileListContainer.innerHTML = `<div class="error-message">Error loading content for this pane. Please try again.</div>`;
        return;
    }

    // ✅ Centralized post-load logic (after successful load)
    // Update tab!
    if (paneData?.current_path) {
        try {
            localStorage.setItem(`pane_${paneId}_last_path`, paneData.current_path);
            updateTabOnFolderLoad(paneId, paneData.current_path); // ← ADD THIS LINE
        } catch (e) {
            console.warn(`Failed to update path/tab for ${paneId}`, e);
        }
    }
}



function getSortingFromLocalStorage(paneId) {
    const sortKey = `pane_${paneId}_sort_by`;
    const orderKey = `pane_${paneId}_sort_order`;

    // Defaults
    let sortBy = localStorage.getItem(sortKey) || 'name';
    let sortOrder = localStorage.getItem(orderKey) || 'asc';

    // Set defaults if missing
    if (!localStorage.getItem(sortKey)) localStorage.setItem(sortKey, sortBy);
    if (!localStorage.getItem(orderKey)) localStorage.setItem(orderKey, sortOrder);

    const headerBar = document.querySelector(`#${paneId} .column-header-bar`);
    const allHeaders = document.querySelectorAll(`#${paneId} .column-header`);
    allHeaders.forEach(header => {
        const span = header.querySelector('.sortmarker');
        if (span) span.remove();
    });

    // Apply marker to the correct column
    const activeHeader = headerBar.querySelector(`.column-header[data-column="${sortBy}"]`);
    if (activeHeader) {
        const arrow = document.createElement('span');
        arrow.className = 'sortmarker';
        arrow.textContent = sortOrder === 'asc' ? '▼ ' : '▲ ';
        activeHeader.insertBefore(arrow, activeHeader.firstChild);
    }
    return { sortBy, sortOrder };
}

/**
 * Toggles the 'show dotfiles' preference and reloads the focused pane.
 * This function is called by the Cmd/Ctrl+Shift+. keybinding handler.
 * @param {KeyboardEvent} event - The keydown event object (passed by keyevents.js).
 */
function toggleDotfilesHandler(event) { // <--- NEW HANDLER FUNCTION
    // Assumes isoverlayvisible() is available globally from global_functions.js
    if (typeof isoverlayvisible === 'function' && isoverlayvisible()) return; // Don't toggle if overlay is open

    // Get the current preference from localStorage
    let showDotfiles = localStorage.getItem(SHOW_DOTFILES_STORAGE_KEY) === 'true';
    console.log(`Current 'show dotfiles' preference: ${showDotfiles}`);

    // Toggle the preference
    showDotfiles = !showDotfiles;
    console.log(`Toggling 'show dotfiles' preference to: ${showDotfiles}`);

    // Save the new preference to localStorage
    try {
        localStorage.setItem(SHOW_DOTFILES_STORAGE_KEY, showDotfiles ? 'true' : 'false');
        console.log(`Saved new 'show dotfiles' preference: ${showDotfiles}`);
    } catch (e) {
        console.error(`Failed to save 'show dotfiles' preference to localStorage:`, e);
    }

    // Find the currently focused pane
    // Assumes getFocusedPanePath is available globally from buttons.js
    const focusedPanePath = getFocusedPanePath(); // This function also logs if no pane is focused

    if (focusedPanePath !== null) {
        // Find the actual focused pane element by its ID
        const focusedPaneElement = document.querySelector('.pane-container.panefocus');
        if (focusedPaneElement) {
             // Reload the focused pane with the new preference
             // loadPaneContent reads the path from the input field,
             // and the preference is read from localStorage inside loadPaneContent.
             loadPaneContent(focusedPaneElement.id);
             console.log(`Reloading focused pane (${focusedPaneElement.id}) with new dotfile preference.`);
        } else {
             console.error("toggleDotfilesHandler: Could not find the focused pane element.");
        }
    } else {
         console.warn("toggleDotfilesHandler: No pane is focused, cannot reload.");
    }
}

function refreshFocusedPane() {
    const focusedPane = document.querySelector('.pane-container.panefocus');
    if (!focusedPane) {
        console.warn("No focused pane to refresh.");
        return;
    }
    loadPaneContent(focusedPane.id);
}

/**
 * Checks if any overlay (message, preview, terminal, etc.) is visible.
 * Note: This function is likely overridden by the definition in overlay_handlers.js,
 * which has a more accurate check based on the new overlay structure.
 * This version exists for compatibility or as a fallback.
 * @returns {boolean} True if an overlay is considered visible, false otherwise.
 */
window.isoverlayvisible = function() { // Explicitly make global
    // Check the main #overlay element for the 'visible' class
    const overlay = document.getElementById('overlay');
    return overlay ? overlay.classList.contains('visible') : false;
};


/**
 * Checks if the preview overlay is specifically visible.
 * Note: This function is likely overridden by the definition in overlay_handlers.js,
 * which has a more accurate check based on the new overlay structure.
 * This version exists for compatibility or as a fallback.
 * @returns {boolean} True if the preview container within the overlay is visible, false otherwise.
 */
window.ispreviewvisible = function() { // Explicitly make global
     // Check if the main overlay is visible AND the preview container within it is visible
     const overlay = document.getElementById('overlay');
     const previewContainer = document.getElementById('preview-container');
     // Check if the main overlay has the 'show-preview' class as well, if overlay_handlers uses it
     return overlay && overlay.classList.contains('visible') &&
            previewContainer && previewContainer.classList.contains('visible');
            // Add overlay.classList.contains('show-preview') if needed based on CSS/JS
};

/**
 * Escapes HTML special characters in a string.
 * This function is intended to be globally available for sanitizing strings before
 * inserting them into HTML (e.g., for displaying file names, messages, errors).
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
window.escapeHtml = function(str) { // Explicitly make global
    if (typeof str !== 'string') {
        // Handle non-string input gracefully, perhaps return an empty string
        // or the input converted to string, depending on desired behavior.
        // Returning empty string is often safest for HTML insertion.
        console.warn("escapeHtml received non-string input:", str);
        return '';
    }
    const div = document.createElement('div');
    // Use createTextNode and appendChild to automatically handle escaping
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
};


/**
 * Gets the current path of the pane that has the 'panefocus' class.
 * Assumes there is always one pane with 'panefocus' and it contains a '.path-input'.
 * @returns {string|null} The current UI path of the focused pane (e.g., '/', '/subdir'), or null if no focused pane or path input.
 */
function getFocusedPanePath() {
    const focusedPane = document.querySelector('.pane-container.panefocus');
    if (focusedPane) {
        const pathInput = focusedPane.querySelector('.path-input');
        // Return the value from the input, or '/' if input not found or value is empty
        return pathInput && pathInput.value ? pathInput.value : '/';
    }
    // Fallback in case no pane is focused
    console.warn("No pane with 'panefocus' found.");
    return null;
}

/**
 * Gets the currently selected file or directory rows in the focused pane.
 * @returns {HTMLElement[]} An array of selected file or directory row elements.
 */
function getSelectedItemsInFocusedPane() { // Helper function
    const focusedPane = document.querySelector('.pane-container.panefocus');
    if (!focusedPane) {
        console.warn("Cannot get selected items: No pane with 'panefocus' found.");
        return [];
    }
    // Find all elements with both file-row and selected classes within the focused pane
    return Array.from(focusedPane.querySelectorAll('.file-row.selected'));
}

/**
 * Gets the path of the unfocused pane.
 * Assumes there are exactly two panes and one is focused.
 * @returns {string|null} The current UI path of the unfocused pane, or null if not found.
 */
function getUnfocusedPanePath() { // Helper function
    const allPanes = document.querySelectorAll('.pane-container');
    const focusedPane = document.querySelector('.pane-container.panefocus');

    if (allPanes.length !== 2 || !focusedPane) {
        console.warn("Cannot get unfocused pane path: Expected exactly two panes and one focused.");
        return null;
    }

    const unfocusedPane = Array.from(allPanes).find(pane => pane !== focusedPane);

    if (unfocusedPane) {
        const pathInput = unfocusedPane.querySelector('.path-input');
        return pathInput ? pathInput.value : null;
    }

    return null;
}

/**
 * Gets the currently focused file or directory row element in the focused pane.
 * @returns {HTMLElement|null} The focused file or directory row element, or null if none is focused.
 */
function getFocusedItemRowInFocusedPane() { // Helper function
    const focusedPane = document.querySelector('.pane-container.panefocus');
    if (!focusedPane) {
        console.warn("Cannot get focused item: No pane with 'panefocus' found.");
        return null;
    }
    return focusedPane.querySelector('.file-row.focus');
}

// Global object to store retained selections and focuses per pane
window._retainedSelections = {};

/**
 * Captures the selected and focused files (by data-path) for each pane.
 * Stores the information in the global _retainedSelections object keyed by pane ID.
 */
function retainCurrentSelectionsAndFileFocuses(paneId = null) {
    const getSelectionData = (pane) => {
        const fileRows = Array.from(pane.querySelectorAll('.file-row'));
        const selectedPaths = [];
        let focusedPath = null;
        let focusedIndex = -1;

        fileRows.forEach((row, index) => {
            const path = row.getAttribute('data-path');
            if (row.classList.contains('selected')) {
                selectedPaths.push(path);
            }
            if (row.classList.contains('focus')) {
                focusedPath = path;
                focusedIndex = index;
            }
        });

        return {
            selected: selectedPaths,
            focused: focusedPath,
            focusedIndex: focusedIndex
        };
    };

    if (paneId) {
        const pane = document.getElementById(paneId);
        if (!pane) return null;
        return getSelectionData(pane);
    }

    window._retainedSelections = {};

    document.querySelectorAll('.pane-container').forEach(pane => {
        const id = pane.id;
        const data = getSelectionData(pane);
        window._retainedSelections[id] = data;

        console.log(`[retain] ${id} → focusPath: ${data.focused}, focusIndex: ${data.focusedIndex}`);
    });
}



/**
 * Restores previously retained file selections and focus per pane.
 * Relies on the global _retainedSelections object.
 */
function restoreRetainedSelections(paneId) {
    const retained = window._retainedSelections?.[paneId];
    if (!retained) return;

    const { selected, focused, focusedIndex } = retained;
    
    const pane = document.getElementById(paneId);

    const fileRows = Array.from(pane.querySelectorAll('.file-row'));
    let rowToFocus = null;

    fileRows.forEach((row, idx) => {
        const path = row.getAttribute('data-path');
        row.classList.remove('selected', 'focus');

        if (selected.includes(path)) {
            row.classList.add('selected');
        }

        if (!rowToFocus && path === focused) {
            rowToFocus = row;
        }
    });

    if (!rowToFocus && typeof focusedIndex === 'number' && fileRows[focusedIndex]) {
        rowToFocus = fileRows[focusedIndex];
    }

    if (!rowToFocus && fileRows.length > 0) {
        rowToFocus = fileRows[fileRows.length - 1];
    }

    if (rowToFocus) {
        rowToFocus.classList.add('focus');
        setTimeout(() => {
            rowToFocus.scrollIntoView({ block: 'center', behavior: 'instant' });
        }, 0);
        console.log(`[restore] Focused row in "${paneId}" →`, rowToFocus.dataset.path);
    }
}



function refreshPanes(paneid = false, retain = false) {

    const panesToLoad = paneid ? [paneid] : ['left-pane', 'right-pane'];
    const loadedPanes = new Set();

    panesToLoad.forEach(paneId => {
        const pane = document.getElementById(paneId);
        if (!pane) {
            console.warn(`Pane "${paneId}" not found. Skipping.`);
            return;
        }

        const onLoaded = () => {
            pane.removeEventListener('paneContentLoaded', onLoaded);
            if (retain) restoreRetainedSelections(paneId);
            loadedPanes.add(paneId);

            if (retain && loadedPanes.size === panesToLoad.length) {
                delete window._afterPaneRender;
            }
        };

        pane.addEventListener('paneContentLoaded', onLoaded);
        loadPaneContent(paneId);
    });
}


function loadTabsForPane(paneId) {
    const container = document.querySelector(`#${paneId} .pane-tabs`);
    if (!container) return;

    const stored = JSON.parse(localStorage.getItem('paneTabs') || '{}');
    const entry = stored[paneId] || { active: 0, tabs: [] };
    const { tabs, active } = entry;

    // Remove old tab DOMs, keep .newtab intact
    container.querySelectorAll('.tab').forEach(el => el.remove());

    tabs.forEach((tab, index) => {
        const el = document.createElement('div');
        el.className = 'tab';
        el.setAttribute('data-path', tab.path);
        el.textContent = escapeHtml(tab.name || tab.path.split('/').pop() || '/');
        if (index === active) el.classList.add('active');
        

        el.onclick = (e) => {
            if (e.ctrlKey || e.metaKey) {
                tabs.splice(index, 1);
                entry.active = Math.max(0, entry.active >= index ? entry.active - 1 : entry.active);
                stored[paneId] = entry;
                localStorage.setItem('paneTabs', JSON.stringify(stored));
                loadTabsForPane(paneId);
                return;
            }

            if (index !== active) {
                entry.active = index;
                stored[paneId] = entry;
                localStorage.setItem('paneTabs', JSON.stringify(stored));
                loadTabsForPane(paneId);

                const path = tab.path;
                const input = document.querySelector(`#${paneId} .path-input`);
                if (input) input.value = path;
                loadPaneContent(paneId).then(() => {
                    // Restore selection/focus after content renders
                    const restored = {
                        [paneId]: {
                            selected: tab.selected || [],
                            focused: tab.focused || null,
                            focusedIndex: tab.focusedIndex ?? -1
                        }
                    };
                    window._retainedSelections = restored;
                    restoreRetainedSelections(paneId);
                });
            }
        };

        el.ondblclick = (e) => {
            tabs.splice(index, 1);
        
            // Adjust active index if needed
            if (entry.active >= index) {
                entry.active = Math.max(0, entry.active - 1);
            }
        
            stored[paneId] = entry;
            localStorage.setItem('paneTabs', JSON.stringify(stored));
        
            loadTabsForPane(paneId);
        
            const activeTab = entry.tabs[entry.active];
            if (activeTab) {
                const input = document.querySelector(`#${paneId} .path-input`);
                if (input) input.value = activeTab.path;
                loadPaneContent(paneId).then(() => {
                    const restored = {
                        [paneId]: {
                            selected: activeTab.selected || [],
                            focused: activeTab.focused || null,
                            focusedIndex: activeTab.focusedIndex ?? -1
                        }
                    };
                    window._retainedSelections = restored;
                    restoreRetainedSelections(paneId);
                });
            }
        };
        

        container.appendChild(el);
    });

    const plus = container.querySelector('.newtab');
    if (plus) container.appendChild(plus);
    
    const event = new CustomEvent('paneTabsUpdated', { detail: { paneId } });
    document.getElementById(paneId)?.dispatchEvent(event);
    console.log(`[global_functions] paneTabsUpdated dispatched for ${paneId}`);

}


function updateTabOnFolderLoad(paneId, folderPath) {
    const stored = JSON.parse(localStorage.getItem('paneTabs') || '{}');
    const entry = stored[paneId] || { active: 0, tabs: [] };
    const { tabs, active } = entry;

    const currentState = retainCurrentSelectionsAndFileFocuses(paneId) || {};
    const name = folderPath.split('/').filter(Boolean).pop() || '/';

    tabs[active] = {
        path: folderPath,
        name,
        selected: currentState.selected || [],
        focused: currentState.focused || null,
        focusedIndex: currentState.focusedIndex ?? -1
    };

    stored[paneId] = { active, tabs };
    localStorage.setItem('paneTabs', JSON.stringify(stored));
    loadTabsForPane(paneId);
}

function addNewTabToPane(paneId) {
    const pane = document.getElementById(paneId);
    if (!pane) return;

    const input = pane.querySelector('.path-input');
    const currentPath = input?.value || '/';

    const allTabs = JSON.parse(localStorage.getItem('paneTabs') || '{}');
    const entry = allTabs[paneId] || { active: 0, tabs: [] };

    const currentState = retainCurrentSelectionsAndFileFocuses(paneId) || {};
    const newTab = {
        path: currentPath,
        name: currentPath.split('/').filter(Boolean).pop() || '/',
        selected: currentState.selected || [],
        focused: currentState.focused || null,
        focusedIndex: currentState.focusedIndex ?? -1
    };

    entry.tabs.push(newTab);
    entry.active = entry.tabs.length - 1;

    allTabs[paneId] = entry;
    localStorage.setItem('paneTabs', JSON.stringify(allTabs));

    input.value = currentPath;
    loadTabsForPane(paneId);
    loadPaneContent(paneId).then(() => {
        restoreRetainedSelections(paneId);
    });
}


/**
 * Queues and fetches folder size for a directory row and updates its size cell.
 * @param {string} logicalPath - The UI path of the directory (e.g., /home/user/folder)
 */
window.queueFolderSizeOverlay = async function (logicalPath) {
    if (!logicalPath) return;

    const fullPath = '/hostroot' + logicalPath;

    if (!window._folderSizeQueue) window._folderSizeQueue = [];
    if (!window._folderSizeBusy) window._folderSizeBusy = false;

    window._folderSizeQueue.push({ fullPath, logicalPath });

    if (window._folderSizeBusy) return;

    window._folderSizeBusy = true;

    (async function processFolderSizeQueue() {
        while (window._folderSizeQueue.length > 0) {
            const { fullPath, logicalPath } = window._folderSizeQueue.shift();

            try {
                const res = await fetch(`/api/preview/foldersize?path=${encodeURIComponent(fullPath)}`);
                const data = await res.json();

                const selector = `.file-row[data-path="${logicalPath}"]`;
                const row = document.querySelector(selector);
                const sizeCell = row?.querySelector('.file-cell.file-size');

                if (!sizeCell) continue;

                if (data.error) {
                    sizeCell.textContent = 'ERR';
                    row?.classList.add('error-highlight');
                } else {
                    const sizeBytes = data.total_size_bytes;
                    let sizeText;

                    if (sizeBytes < 1024) {
                        sizeText = `${sizeBytes} B`;
                    } else if (sizeBytes < 1024 * 1024) {
                        sizeText = `${(sizeBytes / 1024).toFixed(1)} KB`;
                    } else {
                        sizeText = `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
                    }

                    sizeCell.textContent = sizeText;
                    row?.classList.remove('error-highlight');

                    // ✅ Additionally update preview panel, if it's for the same folder
                    const previewSizeEl = document.getElementById('folder-size-line');
                    const previewPath = previewSizeEl?.dataset?.path;
                    if (previewSizeEl && previewPath === logicalPath) {
                        previewSizeEl.textContent = `Size: ${sizeText}`;
                    }
                }

            } catch (err) {
                const row = document.querySelector(`.file-row[data-path="${logicalPath}"]`);
                const sizeCell = row?.querySelector('.file-cell.file-size');
                if (sizeCell) sizeCell.textContent = 'ERR';
            }
        }
        window._folderSizeBusy = false;
    })();

};
