// static/main.js
document.addEventListener('click', function(event) {
    const header = event.target.closest('.column-header');
    const newTabButton = event.target.closest('.newtab');

    if (header) {
        handleColumnHeaderClick(event);
        return;
    }

    if (newTabButton) {
        const paneId = newTabButton.closest('.pane-container')?.id;
        if (!paneId) return;
        addNewTabToPane(paneId);
        return;
    }

    toggleselectedhandler(event);
});

document.addEventListener('dblclick', function(event) {
    const clickedRow = event.target.closest('.file-row');
    if (!clickedRow) return;

    const parentPane = clickedRow.closest('.pane-container');
    if (!parentPane) return;

    const itemType = clickedRow.dataset.itemType;

    if (itemType === 'dir') {
        const pathInput = parentPane.querySelector('.path-input');
        const targetPath = clickedRow.dataset.path;

        if (pathInput && targetPath !== undefined) {
            pathInput.value = targetPath;
            loadPaneContent(parentPane.id);
        }
    } else {
        // Set focus so openFileHandler uses the correct item
        setfilefocus(clickedRow);
        openFileHandler();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    ['left-pane', 'right-pane'].forEach(paneId => {
        const input = document.querySelector(`#${paneId} .path-input`);
        const savedPath = localStorage.getItem(`pane_${paneId}_last_path`) || '/';
        if (input) input.value = savedPath;

        // Ensure at least one tab exists
        const stored = JSON.parse(localStorage.getItem('paneTabs') || '{}');
        if (!stored[paneId] || stored[paneId].length === 0) {
            updateTabOnFolderLoad(paneId, savedPath);
        } else {
            loadTabsForPane(paneId);
        }

        loadPaneContent(paneId);
    });
});

document.addEventListener('DOMContentLoaded', () => {
    window.uppy = new Uppy.Uppy({ autoProceed: false })  // UMD style

        .use(Uppy.Dashboard, {
            inline: true,
            target: '#uppy-content',
            showProgressDetails: true,
            proudlyDisplayPoweredByUppy: false
        })
        .use(Uppy.XHRUpload, {
            endpoint: '/up',
            fieldName: 'file',
            formData: true,
            bundle: false
        });

        uppy.on('file-added', (file) => {
            const realName = file.name;
            uppy.setFileMeta(file.id, {
                relativePath: realName,
                filename: realName,
                name: realName
            });
            console.log("📎 Dashboard file-added patched:", file.id, file.meta);
        });
        
        uppy.on('upload-error', (file, error, response) => {
            console.warn(`Upload error for ${file.name}:`, error);
        
            const status = response?.status;
            const body = response?.body;
        
            if (status === 409 && body?.error) {
                alert(`Upload failed: ${body.error} (${body.filename})`);
            } else {
                alert(`Upload failed for ${file.name}: ${error}`);
            }
        });

        uppy.on('complete', (result) => {
            const uploadedPaths = [];
            const uploadStartedPath = getFocusedPanePath();
        
            for (const file of result.successful) {
                if (file.response && file.response.body?.saved) {
                    uploadedPaths.push(...file.response.body.saved);
                }
            }
        
            const focusedPane = document.querySelector('.pane-container.panefocus');
            if (!focusedPane) return;
        
            const paneId = focusedPane.id;
        
            // If overlay is still open, allow normal focus/selection
            if (document.getElementById('overlay')?.classList.contains('visible')) {
                const onPaneReady = () => {
                    focusedPane.removeEventListener('paneContentLoaded', onPaneReady);
        
                    if (uploadedPaths.length === 1) {
                        const logicalPath = uploadedPaths[0].replace(/^\/hostroot/, '');
                        const selector = `.pane-container#${paneId} .file-row[data-path="${logicalPath}"]`;
                        const fileRow = document.querySelector(selector);
                        if (fileRow) {
                            const existingFocus = document.querySelector(`.pane-container#${paneId} .file-row.focus`);
                            if (existingFocus) existingFocus.classList.remove('focus');
                            fileRow.classList.add('focus');
                        }
                    } else {
                        uploadedPaths.forEach(path => {
                            const logicalPath = path.replace(/^\/hostroot/, '');
                            const selector = `.pane-container#${paneId} .file-row[data-path="${logicalPath}"]`;
                            const fileRow = document.querySelector(selector);
                            if (fileRow) fileRow.classList.add('selected');
                        });
                    }
                };
        
                focusedPane.addEventListener('paneContentLoaded', onPaneReady);
                refreshPanes(paneId); // no retain
                overlayclose();
                //uppy.cancelAll();
        
            } else {
                // Overlay was closed before upload finished: do a retained refresh instead
                if (getFocusedPanePath() === uploadStartedPath) {
                    retainCurrentSelectionsAndFileFocuses()
                    refreshPanes(paneId, true);
                }
                //uppy.cancelAll();
            }
        });
        

    //console.log("Uppy initialized.");
    document.querySelectorAll('.pane-container').forEach(pane => {
        pane.addEventListener('dragover', (e) => {
            e.preventDefault(); // required to allow drop
            if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault(); // needed for file drop
                pane.classList.add('droppable');
            }
        });
    
        pane.addEventListener('dragleave', () => {
            pane.classList.remove('droppable');
        });
    
        pane.addEventListener('drop', (e) => {
            const hasFiles = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0;
            if (!hasFiles) return;

            e.preventDefault();
            pane.classList.remove('droppable');
        

            if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) {
                console.log("Ignored drop: no files.");
                return;
            }
            
            const files = Array.from(e.dataTransfer.files);
            if (files.length === 0) return;
        
            const pathInput = pane.querySelector('.path-input');
            const logicalPath = pathInput?.value || '/';
            const targetPath = '/hostroot' + logicalPath;
        
            console.log(`Dropped ${files.length} file(s) to: ${logicalPath}`);
            files.forEach(f => console.log(`→ ${f.name}`));
            console.log(`Upload target path: ${targetPath}`);
        
            const uppyState = uppy.getState();
            if (!uppyState.currentUploads || Object.keys(uppyState.currentUploads).length === 0) {
                if (Object.keys(uppyState.files).length > 0) {
                    console.log("Clearing stale Uppy files before drop.");
                    //uppy.cancelAll();
                }
            } else {
                console.warn("Uppy is currently uploading. Drop ignored to avoid conflict.");
                return;
            }
        
            uppy.setMeta({ targetPath });
        
            files.forEach(file => {
                console.log("ADDING FILE", {
                    name: file.name,
                    file,
                    meta: {
                      ...uppy.getState().meta,
                      relativePath: file.name,
                      filename: file.name,
                      name: file.name,
                    }
                  });
                uppy.addFile({
                  name: file.name, // ← this is fine
                  type: file.type,
                  data: file,
                  source: 'drag-n-drop',
                  meta: {
                    ...uppy.getState().meta,
                    relativePath: file.name,
                    filename: file.name,        // ✅ ADD THIS
                    name: file.name             // ✅ AND THIS (Uppy uses this in meta)
                  }
                });
              });

            openUppyContainer();
        });
        
        
    });
});


//init tabs
document.addEventListener('DOMContentLoaded', () => {
    ['left-pane', 'right-pane'].forEach(paneId => {
        const pane = document.getElementById(paneId);
        const input = pane?.querySelector('.path-input');
        if (!pane || !input) return;

        const allTabs = JSON.parse(localStorage.getItem('paneTabs') || '{}');
        let entry = allTabs[paneId];

        if (!entry || !Array.isArray(entry.tabs) || entry.tabs.length === 0) {
            const lastPath = localStorage.getItem(`pane_${paneId}_last_path`) || '/';
            entry = {
                active: 0,
                tabs: [{
                    path: lastPath,
                    name: lastPath.split('/').filter(Boolean).pop() || '/',
                    selected: [],
                    focused: null,
                    focusedIndex: -1
                }]
            };
            allTabs[paneId] = entry;
            localStorage.setItem('paneTabs', JSON.stringify(allTabs));
        }

        const activeTab = entry.tabs[entry.active] || entry.tabs[0];
        input.value = activeTab.path;

        window._retainedSelections = {
            [paneId]: {
                selected: activeTab.selected || [],
                focused: activeTab.focused || null,
                focusedIndex: activeTab.focusedIndex ?? -1
            }
        };

        loadTabsForPane(paneId);
        loadPaneContent(paneId).then(() => {
            restoreRetainedSelections(paneId);
        });
    });
});

