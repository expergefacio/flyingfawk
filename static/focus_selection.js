//focus_selection.js
function setpanefocus(paneid) {
    const previouslyFocusedPane = document.querySelector('.pane-container.panefocus');
    if (previouslyFocusedPane && previouslyFocusedPane.id !== paneid) {
        previouslyFocusedPane.classList.remove('panefocus');
    }
    const newPaneElement = document.getElementById(paneid);
    if (newPaneElement && newPaneElement.classList) {
        newPaneElement.classList.add('panefocus');
    }
}

document.addEventListener('click', function(event) {
    const clickedPane = event.target.closest('.pane-container');
    if (clickedPane) {
        setpanefocus(clickedPane.id);
    }
});

function setfilefocus(rowElement) {
    const paneElement = rowElement.closest('.pane-container');
    if (!paneElement) return;

    const previouslyFocusedRowInPane = paneElement.querySelector('.file-row.focus');
    if (previouslyFocusedRowInPane && previouslyFocusedRowInPane !== rowElement) {
        previouslyFocusedRowInPane.classList.remove('focus');
    }

    if (rowElement && rowElement.classList) {
        rowElement.classList.add('focus');
    }
}

function deselectAllInPane(event) {
    const selectedRows = document.querySelectorAll('.pane-container.panefocus .file-row.selected');
    selectedRows.forEach(row => row.classList.remove('selected'));
}


function toggleselected(filerow) {
    filerow.classList.toggle('selected');
}
//space click toggles selecton
//ctrl/meta + lmb toggles selection
//shift + lmb twice select/deselect range
function toggleselectedhandler(event) {
    const clickedRow = event.target.closest('.file-row');
    if (!clickedRow) return;

    const paneElement = clickedRow.closest('.pane-container');
    if (!paneElement) return;

    const previouslyFocusedRowInPane = paneElement.querySelector('.file-row.focus');

    if (event.ctrlKey || event.metaKey) {
        toggleselected(clickedRow);
    } else if (event.shiftKey) {
        if (previouslyFocusedRowInPane && previouslyFocusedRowInPane.closest('.pane-container') === paneElement) {
            const allRowsInPane = Array.from(paneElement.querySelectorAll('.file-row'));
            const previousIndex = allRowsInPane.indexOf(previouslyFocusedRowInPane);
            const currentIndex = allRowsInPane.indexOf(clickedRow);
            const startIndex = Math.min(previousIndex, currentIndex);
            const endIndex = Math.max(previousIndex, currentIndex);
            const targetSelectedState = previouslyFocusedRowInPane.classList.contains('selected');

            for (let i = startIndex; i <= endIndex; i++) {
                const rowToSelect = allRowsInPane[i];
                if (targetSelectedState) {
                    rowToSelect.classList.remove('selected');
                } else {
                    rowToSelect.classList.add('selected');
                }
            }
        } else {
            clickedRow.classList.add('selected');
        }
    }

    setfilefocus(clickedRow);
}

//to be called by event, not prgrammaticly like 
//cause of check folde size :)
function toggleSelectedByButton(){
    if (isoverlayvisible()) return;

    const row = getFocusedItemRowInFocusedPane();
    if (!row) return;

    toggleselected(row);

    //if (row.classList.contains('selected') && row.dataset.itemType === 'dir') {
    //    queueFolderSizeOverlay(row.dataset.path);
    //}
}


function tab(event) {
    if (isoverlayvisible()) return;
    document.getElementById('left-pane').classList.toggle('panefocus');
    document.getElementById('right-pane').classList.toggle('panefocus');
    shiftClickFirstFile = null;
}





let shiftSelectionAnchor = null;


function handleShiftArrowNavigation(event) {
    if (isoverlayvisible()) return;
    if (!event.shiftKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;

    const pane = document.querySelector('.pane-container.panefocus');
    if (!pane) return;

    const allRows = Array.from(pane.querySelectorAll('.file-row'));
    const currentFocus = pane.querySelector('.file-row.focus');
    if (!currentFocus) return;

    const currentIndex = allRows.indexOf(currentFocus);
    const direction = event.key === 'ArrowUp' ? -1 : 1;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= allRows.length) return;

    const nextRow = allRows[nextIndex];
    if (!nextRow || nextRow.dataset.itemName === '..') return;

    // First Shift+Arrow sets the anchor and intent
    if (!shiftSelectionAnchor) {
        shiftSelectionAnchor = {
            row: currentFocus,
            mode: currentFocus.classList.contains('selected') ? 'deselect' : 'select'
        };
    }

    const anchorIndex = allRows.indexOf(shiftSelectionAnchor.row);
    const start = Math.min(anchorIndex, nextIndex);
    const end = Math.max(anchorIndex, nextIndex);

    for (let i = start; i <= end; i++) {
        if (shiftSelectionAnchor.mode === 'select') {
            allRows[i].classList.add('selected');
        } else {
            allRows[i].classList.remove('selected');
        }
    }

    setfilefocus(nextRow);
    nextRow.scrollIntoView({ block: 'nearest' });
    event.preventDefault();
}

document.addEventListener('keydown', handleShiftArrowNavigation);
document.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') {
        shiftSelectionAnchor = null;
    }
});