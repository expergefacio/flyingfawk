// lynx.js


function arrowUpHandler(event) {
    const currentFocusedRow = document.querySelector('.pane-container.panefocus').querySelector('.file-row.focus');
    const previousRow = currentFocusedRow.previousElementSibling;

    if (previousRow) {
        setfilefocus(previousRow);
        previousRow.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    }
}
function arrowDownHandler(event) {
    const currentFocusedRow = document.querySelector('.pane-container.panefocus').querySelector('.file-row.focus');
    const nextRow = currentFocusedRow.nextElementSibling;

    if (nextRow) {
        setfilefocus(nextRow);
        nextRow.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    }
}

function arrowRightHandler(event) {
    const currentFocusedRow = document.querySelector('.pane-container.panefocus').querySelector('.file-row.focus');
    const focusedPane = currentFocusedRow.closest('.pane-container');
    const itemType = currentFocusedRow.dataset.itemType;

    if (itemType === 'dir') {
        const targetPath = currentFocusedRow.dataset.path;
        const pathInput = focusedPane.querySelector('.path-input');
        pathInput.value = targetPath;
        loadPaneContent(focusedPane.id);
    }
}

function arrowLeftHandler(event) {
    const focusedPane = document.querySelector('.pane-container.panefocus');
    const pathInput = focusedPane.querySelector('.path-input');
    const previousPath = pathInput?.value || '/';

    // Get the folder we were just in
    const parts = previousPath.split('/').filter(Boolean);
    const folderWeWereIn = parts.at(-1); // e.g., "deletables"

    const parentRow = focusedPane.querySelector('.file-row[data-item-name=".."]');
    if (parentRow) {
        const parentPath = parentRow.dataset.path;
        pathInput.value = parentPath;

        const onContentLoaded = (e) => {
            if (e.detail.paneId !== focusedPane.id) return;
            focusedPane.removeEventListener('paneContentLoaded', onContentLoaded);

            // Find the folder with matching name
            const matchingRow = focusedPane.querySelector(`.file-row[data-item-type="dir"][data-item-name="${CSS.escape(folderWeWereIn)}"]`);

            if (matchingRow) {
                setfilefocus(matchingRow);
                matchingRow.scrollIntoView({ behavior: 'instant', block: 'nearest' });
            } else {
                console.warn('No matching folder found for:', folderWeWereIn);
            }
        };

        focusedPane.addEventListener('paneContentLoaded', onContentLoaded);
        loadPaneContent(focusedPane.id);
    }
}

