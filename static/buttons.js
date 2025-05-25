// static/buttons.js
// button and key handlers

//toggle spacebar functionality:
window.spaceMode = localStorage.getItem("spaceMode") || "select"; // "preview" or "select"
function updateSpaceButtonUI() {
    const prewBtn = document.getElementById("prew");
    const selectBtn = document.getElementById("select");

    if (spaceMode === "preview") {
        prewBtn.textContent = "Preview ⇧X 𓈙";
        selectBtn.textContent = "Select ⇧Z";
    } else {
        prewBtn.textContent = "Preview ⇧X";
        selectBtn.textContent = "Select ⇧Z 𓈙";
    }
}
document.addEventListener("DOMContentLoaded", updateSpaceButtonUI);
function toggleSpaceBar() {
    window.spaceMode = (window.spaceMode === "preview") ? "select" : "preview";
    localStorage.setItem("spaceMode", window.spaceMode);
    updateSpaceButtonUI();
}
function onSpaceClick() {
    if (window.spaceMode === "preview") {
        window.handlePreviewButtonClick();
    } else {
        toggleSelectedByButton();
    }
}



function handleTermClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const currentPath = getFocusedPanePath();
    console.log(`'Term' button clicked. Opening terminal from path: ${currentPath}`);
    if (typeof openTerminalOverlay === 'function') {
        openTerminalOverlay();
    } else {
        console.error("openTerminalOverlay not found.");
        if (typeof openMessageBox === 'function') {
            openMessageBox('<div class="message-content-text error-message">Terminal not available.</div>');
        }
    }
}

function handleRunInTermClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const focusedItem = getFocusedItemRowInFocusedPane();
    const itemName = focusedItem ? focusedItem.dataset.itemName : '';
    const command = itemName ? `./${itemName}` : '';
    if (typeof openTerminalOverlay === 'function') {
        if (command) {
            openTerminalOverlay(command);
        } else {
            openTerminalOverlay();
            if (typeof openMessageBox === 'function') {
                openMessageBox('<div class="message-content-text">No item selected. Opened empty terminal.</div>');
            }
        }
    } else {
        console.error("openTerminalOverlay not found.");
    }
}

function copy(items, destinationDir) {
    if (!items || !destinationDir) return;

    const sources = items.map(item => `/hostroot${item.dataset.path}`);
    const destPath = `/hostroot${destinationDir}`;
    const cmd = `cp -aiv ${sources.map(p => `"${p}"`).join(' ')} "${destPath}"`;

    console.log("Copy command:", cmd);

    window._onTerminalExit = () => refreshPanes(null, true);
    openTerminalOverlay(cmd, true);
}

function move(items, destinationDir) {
    if (!items || !destinationDir) return;

    const sources = items.map(item => `/hostroot${item.dataset.path}`);
    const destPath = `/hostroot${destinationDir}`;
    const cmd = `mv -iv ${sources.map(p => `"${p}"`).join(' ')} "${destPath}"`;

    console.log("Move command:", cmd);

    window._onTerminalExit = () => refreshPanes(null, true);
    openTerminalOverlay(cmd, true);
}

function handleCopy(event) {
    event.preventDefault(); event.stopPropagation();
    retainCurrentSelectionsAndFileFocuses();

    let selectedItems = getSelectedItemsInFocusedPane();
    if (!selectedItems.length) {
        const fallback = getFocusedItemRowInFocusedPane();
        if (fallback) selectedItems = [fallback];
    }

    if (selectedItems.some(item => item.dataset.itemName === '..')) {
        alert("Cannot copy the parent directory (..)");
        return;
    }

    const destinationDir = getUnfocusedPanePath();
    if (!destinationDir) {
        alert("Destination directory not found.");
        return;
    }

    copy(selectedItems, destinationDir);
}

function handleMove(event) {
    event.preventDefault(); event.stopPropagation();
    retainCurrentSelectionsAndFileFocuses();

    let selectedItems = getSelectedItemsInFocusedPane();
    if (!selectedItems.length) {
        const fallback = getFocusedItemRowInFocusedPane();
        if (fallback) selectedItems = [fallback];
    }

    if (selectedItems.some(item => item.dataset.itemName === '..')) {
        alert("Cannot move the parent directory (..)");
        return;
    }

    const destinationDir = getUnfocusedPanePath();
    if (!destinationDir) {
        alert("Destination directory not found.");
        return;
    }

    move(selectedItems, destinationDir);
}



function handleSelect(event) {
    const row = getFocusedItemRowInFocusedPane();
    if (!row) return;

    toggleselected(row);      // toggle selection class
    setfilefocus(row);
}

function handleRename() {
    const focusedPane = document.querySelector('.pane-container.panefocus');
    if (!focusedPane) return;

    // Try selected first, fallback to focus
    const selectedItem = focusedPane.querySelector('.file-row.selected') || focusedPane.querySelector('.file-row.focus');
    if (!selectedItem) return;

    const itemName = selectedItem.dataset.itemName;
    if (itemName === '..') return;

    const itemUIPath = selectedItem.dataset.path;
    const sourcePath = itemUIPath === '/'
        ? `/hostroot/${itemName}`
        : `/hostroot${itemUIPath}`;

    const contentHtml = `
        <div class="message-content-text">
            Rename <strong>${itemName}</strong> to:<br>
            <input id="rename-input" type="text" value="${itemName}" style="width: 300px; margin-top: 10px;" />
        </div>
        <div style="display: flex; justify-content: center; gap: 20px; margin-top: 20px;">
            <button id="rename-confirm">Rename</button>
            <button id="rename-cancel">Cancel</button>
        </div>
    `;

    // One-time handler after DOM is ready
    const onReady = (event) => {
        const input = document.getElementById('rename-input');
        const confirmBtn = document.getElementById('rename-confirm');
        const cancelBtn = document.getElementById('rename-cancel');

        if (!input || !confirmBtn) {
            console.error("Missing input or confirm button in rename box.");
            return;
        }

        input.focus();

        // ✨ New: auto-select up to last `.`
        const dotIndex = itemName.lastIndexOf('.');
        if (dotIndex > 0) {
            input.setSelectionRange(0, dotIndex); // selects up to the last dot
        } else {
            input.select(); // fallback if no dot
        }

        const doRename = async () => {
            const newName = input.value.trim();
            if (!newName || newName === itemName) {
                if (typeof overlayclose === 'function') overlayclose(); // nothing changed, just close
                return;
            }
        
            const baseDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
            const destinationPath = `${baseDir}/${newName}`;
        
            try {
                const response = await fetch('/api/rename', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source: sourcePath,
                        destination: destinationPath
                    })
                });
        
                const result = await response.json();
        
                if (response.ok) {
                    retainCurrentSelectionsAndFileFocuses();
                    const focusedPane = document.querySelector('.pane-container.panefocus');
                    const paneId = focusedPane?.id || null;
                        //rename in retained global var
                        if (paneId && window._retainedSelections?.[paneId]) {
                            const retained = window._retainedSelections[paneId];
                            const oldPath = selectedItem.dataset.path;
                            const newPath = oldPath.replace(/[^\/]+$/, newName); // replace last segment
                            // Update focused path if it's the one being renamed
                            if (retained.focused === oldPath) {
                                retained.focused = newPath;
                            }
                            // Update selected paths
                            retained.selected = retained.selected.map(path =>
                                path === oldPath ? newPath : path
                            );
                            console.log(`[retain] renamed ${oldPath} → ${newPath}`);
                        }
        
                    if (typeof overlayclose === 'function') overlayclose();
        
        
                    if (paneId && typeof refreshPanes === 'function') {
                        setTimeout(() => refreshPanes(paneId, true), 50);
                    }
                } else {
                    openMessageBox(`<div class="message-content-text error-message">Rename failed: ${result.error || response.statusText}</div>`);
                }
            } catch (err) {
                openMessageBox(`<div class="message-content-text error-message">Rename error: ${err.message}</div>`);
            }
        };
        

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                doRename();
            }
        });

        confirmBtn.addEventListener('click', doRename);
        cancelBtn?.addEventListener('click', () => {
            if (typeof overlayclose === 'function') overlayclose();
        });

        document.removeEventListener('messageBoxReady', onReady);
    };

    document.addEventListener('messageBoxReady', onReady, { once: true });

    if (typeof openMessageBox === 'function' && !isoverlayvisible()) {
        openMessageBox(contentHtml);
    } else {
        console.error("Cannot open message box — overlay already visible or missing handler.");
    }
}
function handleDuplicateFile() {
    const focusedPane = document.querySelector('.pane-container.panefocus');
    if (!focusedPane) return;

    const selectedItem = focusedPane.querySelector('.file-row.selected') || focusedPane.querySelector('.file-row.focus');
    if (!selectedItem) return;

    const itemName = selectedItem.dataset.itemName;
    if (itemName === '..') return;

    const itemUIPath = selectedItem.dataset.path;
    const sourcePath = itemUIPath === '/' 
        ? `/hostroot/${itemName}`
        : `/hostroot${itemUIPath}`;

    const defaultName = itemName.replace(/(\.[^\.]+)?$/, '_copy$1');

    const contentHtml = `
        <div class="message-content-text">
            Duplicate <strong>${itemName}</strong> to:<br>
            <input id="duplicate-input" type="text" value="${defaultName}" style="width: 300px; margin-top: 10px;" />
        </div>
        <div style="display: flex; justify-content: center; gap: 20px; margin-top: 20px;">
            <button id="duplicate-confirm">Duplicate</button>
            <button id="duplicate-cancel">Cancel</button>
        </div>
    `;

    const onReady = () => {
        const input = document.getElementById('duplicate-input');
        const confirmBtn = document.getElementById('duplicate-confirm');
        const cancelBtn = document.getElementById('duplicate-cancel');

        if (!input || !confirmBtn) return;

        input.focus();
        const dotIndex = itemName.lastIndexOf('.');
        if (dotIndex > 0) {
            input.setSelectionRange(0, dotIndex);
        } else {
            input.select();
        }

        const doDuplicate = async () => {
            const newName = input.value.trim();
            if (!newName || newName === itemName) {
                if (typeof overlayclose === 'function') overlayclose();
                return;
            }

            const baseDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
            const destinationPath = `${baseDir}/${newName}`;

            try {
                const response = await fetch('/api/duplicate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source: sourcePath,
                        destination: destinationPath
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    const paneId = focusedPane.id;
                    if (typeof overlayclose === 'function') overlayclose();
                    if (paneId && typeof refreshPanes === 'function') {
                        setTimeout(() => refreshPanes(paneId, true), 50);
                    }
                } else {
                    openMessageBox(`<div class="message-content-text error-message">Duplicate failed: ${result.error || response.statusText}</div>`);
                }
            } catch (err) {
                openMessageBox(`<div class="message-content-text error-message">Duplicate error: ${err.message}</div>`);
            }
        };

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') doDuplicate();
        });

        confirmBtn.addEventListener('click', doDuplicate);
        cancelBtn?.addEventListener('click', () => {
            if (typeof overlayclose === 'function') overlayclose();
        });

        document.removeEventListener('messageBoxReady', onReady);
    };

    document.addEventListener('messageBoxReady', onReady, { once: true });

    if (typeof openMessageBox === 'function' && !isoverlayvisible()) {
        openMessageBox(contentHtml);
    } else {
        console.error("Cannot open message box — overlay already visible or missing handler.");
    }
}

function handleNewDirFile() {
    const focusedPane = document.querySelector('.pane-container.panefocus');
    if (!focusedPane) return;

    const pathInput = focusedPane.querySelector('.path-input');
    const basePath = pathInput?.value;
    if (!basePath) return;

    const serverBasePath = basePath === '/' ? '/hostroot/' : `/hostroot${basePath}`;

    const contentHtml = `
    <div class="message-content-text">
        Create new <strong>directory</strong> in <strong>${basePath}</strong>:<br>
        <input id="rename-input" type="text" value="new-folder" style="width: 300px; margin-top: 10px;" />
        <label style="display: inline-flex; align-items: center; gap: 6px; margin-top: 10px;">
            <input type="checkbox" id="newfile-checkbox" />
            File
        </label>
    </div>
    <div style="display: flex; justify-content: center; gap: 20px; margin-top: 20px;">
        <button id="rename-confirm">Create</button>
        <button id="rename-cancel">Cancel</button>
    </div>
    `;

    const onReady = (event) => {
        const input = document.getElementById('rename-input');
        const confirmBtn = document.getElementById('rename-confirm');
        const cancelBtn = document.getElementById('rename-cancel');

        if (!input || !confirmBtn) {
            console.error("Missing input or confirm button in new folder box.");
            return;
        }

        input.focus();
        input.select(); // Select whole value so the user can overwrite

        const doCreate = async () => {
            const isFile = document.getElementById('newfile-checkbox')?.checked;
            const endpoint = isFile ? '/api/newfile' : '/api/newdir';
            const newName = input.value.trim();
            if (!newName) {
                if (typeof overlayclose === 'function') overlayclose(); // nothing entered, silently close
                return;
            }

            const fullPath = serverBasePath.endsWith('/')
                ? `${serverBasePath}${newName}`
                : `${serverBasePath}/${newName}`;

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: fullPath })
                });

                const result = await response.json();

                if (response.ok) {
                    retainCurrentSelectionsAndFileFocuses();
                    const paneId = focusedPane?.id || null;

                    if (paneId && window._retainedSelections?.[paneId]) {
                        const retained = window._retainedSelections[paneId];
                        retained.focused = `${basePath}/${newName}`;
                        console.log(`[retain] created and selected: ${basePath}/${newName}`);
                    }

                    if (typeof overlayclose === 'function') overlayclose();

                    if (paneId && typeof refreshPanes === 'function') {
                        refreshPanes(paneId, true);
                    }
                } else {
                    openMessageBox(`<div class="message-content-text error-message">Create failed: ${result.error || response.statusText}</div>`);
                }
            } catch (err) {
                openMessageBox(`<div class="message-content-text error-message">Create error: ${err.message}</div>`);
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                doCreate();
            }
        });
        const inputLabel = document.querySelector('.message-content-text strong');
        const checkbox = document.getElementById('newfile-checkbox');
        checkbox.addEventListener('change', () => {
            inputLabel.textContent = checkbox.checked ? 'file' : 'directory';
        });

        confirmBtn.addEventListener('click', doCreate);
        cancelBtn?.addEventListener('click', () => {
            if (typeof overlayclose === 'function') overlayclose();
        });

        document.removeEventListener('messageBoxReady', onReady);
    };

    document.addEventListener('messageBoxReady', onReady, { once: true });

    if (typeof openMessageBox === 'function' && !isoverlayvisible()) {
        openMessageBox(contentHtml);
    } else {
        console.error("Cannot open message box — overlay already visible or missing handler.");
    }
}



function handleDelete() {
    retainCurrentSelectionsAndFileFocuses();
    let selectedItems = getSelectedItemsInFocusedPane();
    
    if (!selectedItems || selectedItems.length === 0) {
        const fallbackItem = getFocusedItemRowInFocusedPane();
        if (fallbackItem) {
            selectedItems = [fallbackItem];
        }
    }

    const paths = selectedItems.map(item => {
        const path = item.dataset.path;
        return `/hostroot${path}`;
    });

    // Check for ".." (parent dir) in selection
    if (selectedItems.some(item => item.dataset.itemName === '..')) {
        if (!confirm("Are you trying to delete the entire current directory (..)?")) {
            return;
        }
    }

    if (paths.length > 0) {
        const commandString = `rm -Rv ${paths.map(p => `"${p}"`).join(' ')}`;
        console.log("Delete command:", commandString);
    
        const focusedPane = document.querySelector('.pane-container.panefocus');
        const focusedPaneId = focusedPane?.id || null;

        window._onTerminalExit = () => {
            refreshPanes(focusedPaneId, true); // Refresh only that pane, with retained state
        };
    
        openTerminalOverlay(commandString, true); // true = exit terminal when done
    }
}


//prepopulate the terminal to open file in micro
function openFileHandler() {
    const archiveExtensions = [
        '.zip', '.rar', '.7z', '.tar',
        '.tar.gz', '.tgz', '.tar.bz2', '.tbz', '.tbz2',
        '.tar.xz', '.txz', '.gz', '.bz2', '.xz',
        '.lzma', '.cab', '.iso', '.lz', '.Z',
        '.sit', '.sitx', '.hqx', '.bin', '.arj', '.arc'
    ];

    const focusedItem = getFocusedItemRowInFocusedPane();
    if (!focusedItem || focusedItem.dataset.itemName === '..') return;

    const fileName = focusedItem.dataset.itemName;
    const itemPath = focusedItem.dataset.path;
    const fullPath = `/hostroot${itemPath}`;
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    const lowerName = fileName.toLowerCase();
    const isArchive = archiveExtensions.some(ext => lowerName.endsWith(ext));

    const focusedPane = document.querySelector('.pane-container.panefocus');
    const focusedPaneId = focusedPane?.id || null;

    if (isArchive) {
        let command;

        if (lowerName.endsWith('.zip')) {
            command = `cd "${dirPath}" && unzip "${fileName}"`;
        } else {
            command = `cd "${dirPath}" && unar -o . "${fileName}"`;
        }

        window._onTerminalExit = () => {
            refreshPanes(focusedPaneId, true);
        };
        openTerminalOverlay(command, true);
        return;
    }

    // Not an archive → open in micro
    const command = `micro "${fileName}"`;
    openTerminalOverlay(command, false, dirPath);
}

function handleUpload() {
    const panePath = '/hostroot' + getFocusedPanePath(); // e.g. "/home/user/documents"
    if (window.uppy) {
        window.uppy.setMeta({ targetPath: panePath });
        openUppyContainer();
    } else {
        console.error("Uppy is not initialized");
    }
}

function handleDownload() {
    const focusedPane = document.querySelector('.pane-container.panefocus');
    const focusedFile = focusedPane?.querySelector('.file-row.focus[data-item-type="file"]');

    if (!focusedFile) {
        alert("No file is focused.");
        return;
    }

    const logicalPath = focusedFile.getAttribute('data-path'); // e.g. /home/user/file.txt
    const hostrootPath = '/hostroot' + logicalPath;
    const relPath = hostrootPath.replace(/^\/+/, '');
    const encodedPath = relPath.split('/').map(encodeURIComponent).join('/');
    const downloadUrl = `/down/${encodedPath}`;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = ''; // use Content-Disposition header from Flask
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}




function handleArchive(event) {
    event.preventDefault();
    event.stopPropagation();
    retainCurrentSelectionsAndFileFocuses();

    const focusedItem = getFocusedItemRowInFocusedPane();
    if (!focusedItem) return;

    const currentDir = getFocusedPanePath();
    const cwd = `/hostroot${currentDir}`;
    const focusedPane = document.querySelector('.pane-container.panefocus');
    const focusedPaneId = focusedPane?.id || null;

    let selectedItems = getSelectedItemsInFocusedPane();
    if (!selectedItems || selectedItems.length === 0) {
        selectedItems = [focusedItem];
    }

    if (selectedItems.some(item => item.dataset.itemName === '..')) {
        alert('Cannot zip ".."!');
        return;
    }

    // 🧩 Create ZIP archive from selected files
    const relNames = selectedItems.map(item => `"${item.dataset.itemName}"`).join(' ');
    let zipName;

    if (selectedItems.length > 1) {
        const dirBase = currentDir.split('/').filter(Boolean).pop() || 'archive';
        zipName = `${dirBase}.zip`;
    } else {
        zipName = `${selectedItems[0].dataset.itemName}.zip`;
    }

    const zipCommand = `cd "${cwd}" && zip -r -0 "${zipName}" ${relNames}`;

    window._onTerminalExit = () => {
        refreshPanes(focusedPaneId, true);
    };
    openTerminalOverlay(zipCommand, true);
}

function runInTerm(event) {
    event?.preventDefault();
    event?.stopPropagation();

    retainCurrentSelectionsAndFileFocuses();

    const focusedItem = getFocusedItemRowInFocusedPane();
    if (!focusedItem) return;

    const uiPath = getFocusedPanePath();
    const cwd = `/hostroot${uiPath}`;
    const focusedPane = document.querySelector('.pane-container.panefocus');
    const focusedPaneId = focusedPane?.id || null;

    let selectedItems = getSelectedItemsInFocusedPane();
    if (!selectedItems || selectedItems.length === 0) {
        selectedItems = [focusedItem];
    }

    const target = selectedItems.find(item => item.dataset.itemName !== '..');
    if (!target) return;

    const itemName = target.dataset.itemName;

    const isPython = itemName.toLowerCase().endsWith('.py');
    const command = isPython
        ? `cd "${cwd}" && python "${itemName}"`
        : `cd "${cwd}" && chmod a+x "${itemName}" && "./${itemName}"`;

    window._onTerminalExit = () => {
        refreshPanes(focusedPaneId, true);
    };

    openTerminalOverlay(command, true);
}



function selectAllHandler() {
    const focusedPane = document.querySelector('.pane-container.panefocus');
    if (!focusedPane) return;

    const items = focusedPane.querySelectorAll('.file-row');
    items.forEach(item => {
        if (item.dataset.itemName !== '..') {
            item.classList.add('selected');
        }
    });
}

function deselectHandler() {
    const focusedPane = document.querySelector('.pane-container.panefocus');
    if (!focusedPane) return;

    const items = focusedPane.querySelectorAll('.file-row.selected');
    items.forEach(item => {
        item.classList.remove('selected');
    });
}

function handleLogoutClick(){
    window.location.href = "/logout";
}

function initButtons() {
    const buttonHandlers = {
        'logout': handleLogoutClick,
        'term': handleTermClick,
        'upload': handleUpload,
        'download': handleDownload,
        'archive': handleArchive,
        
        'select': handleSelect,
        'prew': handlePreviewButtonClick,
        'rename': handleRename,
        'copy': handleCopy,
        'move': handleMove,
        'newdir': handleNewDirFile,
        'delete': handleDelete,
        'run_in_term': runInTerm

    };

    for (const [id, handler] of Object.entries(buttonHandlers)) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', handler);
        }
    }

    // Initialize the userscripts button
    if (typeof initUserscriptsButton === 'function') {
        initUserscriptsButton();
    } else {
        console.error("initUserscriptsButton not found.");
    }
}

function globalEnterHandler(event) {
    if (typeof isoverlayvisible === 'function' && isoverlayvisible()) return;

    const activeElement = document.activeElement;
    if (activeElement && activeElement.classList.contains('path-input')) {
        const pane = activeElement.closest('.pane-container');
        if (pane && pane.id) {
            console.log(`Enter key on path-input. Reloading pane: ${pane.id}`);
            event.preventDefault();
            event.stopPropagation();
            loadPaneContent(pane.id);
            return;
        }
    }

    //insert other condition
    handlePreviewButtonClick();

}

function handleColumnHeaderClick(event) {
    const header = event.target.closest('.column-header');
    if (!header) return;

    const pane = header.closest('.pane-container');
    if (!pane) return;

    const paneId = pane.id;
    const column = header.dataset.column;

    if (!column) return;

    const sortKey = `pane_${paneId}_sort_by`;
    const orderKey = `pane_${paneId}_sort_order`;

    const currentSortBy = localStorage.getItem(sortKey) || 'name';
    let currentOrder = localStorage.getItem(orderKey) || 'asc';

    if (currentSortBy === column) {
        currentOrder = currentOrder === 'asc' ? 'desc' : 'asc';
    } else {
        localStorage.setItem(sortKey, column);
        currentOrder = 'asc';
    }

    localStorage.setItem(sortKey, column);
    localStorage.setItem(orderKey, currentOrder);

    loadPaneContent(paneId); // Re-render with new sorting
}

document.addEventListener('DOMContentLoaded', initButtons);
