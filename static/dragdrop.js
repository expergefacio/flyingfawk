// dragdrop.js

let isDragging = false;
let dragData = {
    items: [],
    originPane: null,
    ghost: null,
    target: null,
    modifiers: { shift: false, ctrl: false, meta: false, alt: false }
};

// Track modifier keys globally
document.addEventListener('keydown', e => {
    dragData.modifiers.shift = e.shiftKey;
    dragData.modifiers.ctrl = e.ctrlKey;
    dragData.modifiers.meta = e.metaKey;
    dragData.modifiers.alt = e.altKey;
    updateGhostLabel();
});

document.addEventListener('keyup', e => {
    dragData.modifiers.shift = e.shiftKey;
    dragData.modifiers.ctrl = e.ctrlKey;
    dragData.modifiers.meta = e.metaKey;
    dragData.modifiers.alt = e.altKey;
    updateGhostLabel();
});

// Setup manual drag handler per pane
function setupManualDrag(paneId) {
    const pane = document.getElementById(paneId);
    if (!pane) return;

    pane.querySelectorAll('.file-row').forEach(row => {
        row.addEventListener('mousedown', e => {
            if (e.button !== 0) return; // only left click

            const selected = pane.querySelectorAll('.file-row.selected');
            dragData.items = selected.length ? Array.from(selected) : [row];
            dragData.originPane = paneId;

            isDragging = true;

            let startX = e.clientX;
            let startY = e.clientY;
            let hasMoved = false;
            dragData.startX = startX;
            dragData.startY = startY;
            dragData.hasMoved = false;
        });
    });
}

// Track cursor position and move ghost
document.addEventListener('mousemove', e => {
    if (!isDragging) return;

    // Only trigger drag after moving > 4px
    if (!dragData.hasMoved) {
        const dx = Math.abs(e.clientX - dragData.startX);
        const dy = Math.abs(e.clientY - dragData.startY);
        if (dx < 4 && dy < 4) return;

        dragData.hasMoved = true;

        // Start the ghost now
        dragData.ghost = document.createElement('div');
        document.body.appendChild(dragData.ghost);
        updateGhostLabel();

        dragData.ghost.style.position = 'fixed';
        dragData.ghost.style.background = '#eee';
        dragData.ghost.style.padding = '4px 8px';
        dragData.ghost.style.border = '1px solid #999';
        dragData.ghost.style.zIndex = '10000';
    }

    // Now that we've moved enough, continue with normal drag logic
    if (!dragData.ghost) return;
    dragData.ghost.style.left = `${e.clientX + 12}px`;
    dragData.ghost.style.top = `${e.clientY + 12}px`;

    const hoveredEl = document.elementFromPoint(e.clientX, e.clientY);
    const newTarget = hoveredEl?.closest('.filetype_directory') || hoveredEl?.closest('.tab');

    if (dragData.target !== newTarget) {
        dragData.target?.classList.remove('droppable');
        dragData.target = newTarget;
        if (dragData.target) {
            dragData.target.classList.add('droppable');
        }
    }

    updateGhostLabel();
});

// Handle drop manually
document.addEventListener('mouseup', e => {
    if (!isDragging || !dragData.hasMoved) {
        isDragging = false;
        dragData = {
            items: [],
            originPane: null,
            ghost: null,
            target: null,
            modifiers: { shift: false, ctrl: false, meta: false, alt: false }
        };
        return;
    }

    isDragging = false;

    dragData.ghost?.remove();
    dragData.target?.classList.remove('droppable');
    let targetPath = dragData.target?.dataset.path;

    if (!targetPath && dragData.target?.id?.includes('-file-list')) {
        const paneId = dragData.target.id.replace('-file-list', '');
        const input = document.querySelector(`#${paneId} .path-input`);
        targetPath = input?.value || '/';
    }
    const srcPane = document.getElementById(dragData.originPane);
    const srcPath = srcPane?.querySelector('.path-input')?.value || '/';

    const action = getDropAction(srcPath, targetPath, dragData.modifiers);

    console.log(`[manual drop] ${action.toUpperCase()} to`, targetPath);
    console.log('Dragged items:', dragData.items);

    if (action === 'copy') {
        copy(dragData.items, targetPath);
    } else {
        move(dragData.items, targetPath);
    }

    dragData = {
        items: [],
        originPane: null,
        ghost: null,
        target: null,
        modifiers: { shift: false, ctrl: false, meta: false, alt: false }
    };
});



function updateGhostLabel() {
    if (!dragData.ghost || !dragData.items.length) return;
    let targetPath = dragData.target?.dataset.path;

    if (!targetPath && dragData.target?.id?.includes('-file-list')) {
        const paneId = dragData.target.id.replace('-file-list', '');
        const input = document.querySelector(`#${paneId} .path-input`);
        targetPath = input?.value || '/';
    }
    const srcPane = document.getElementById(dragData.originPane);
    const srcPath = srcPane?.querySelector('.path-input')?.value || '/';

    const action = getDropAction(srcPath, targetPath, dragData.modifiers);
    const icon = action === 'copy' ? '➕📄' : '🚚📄';
    const label = dragData.items.length === 1
        ? dragData.items[0].dataset.itemName
        : `${dragData.items.length} items`;

    dragData.ghost.textContent = `${icon} ${label}`;
}

function getDropAction(srcPath, destPath, modifiers) {
    srcPath = typeof srcPath === 'string' ? srcPath : '/';
    destPath = typeof destPath === 'string' ? destPath : '/';

    const srcTop = srcPath.split('/')[1];
    const destTop = destPath.split('/')[1];

    if (modifiers.shift) return 'copy';
    if (modifiers.ctrl || modifiers.meta || modifiers.alt) return 'move';
    return srcTop === destTop ? 'move' : 'copy';
}

function setupTabDropHandlers(paneId) {
    const pane = document.getElementById(paneId);
    if (!pane) return;

    const tabs = pane.querySelectorAll('.pane-tabs .tab');
    tabs.forEach(tab => {
        const tabPath = tab.dataset.path;
        if (!tabPath) {
            console.warn('[dragdrop] Tab missing data-path:', tab);
            return;
        }

        tab.addEventListener('mouseenter', () => {
            if (!isDragging || !dragData.hasMoved) return;

            dragData.target?.classList.remove('droppable');
            dragData.target = tab;
            tab.classList.add('droppable');
            updateGhostLabel();
        });

        tab.addEventListener('mouseleave', () => {
            if (!isDragging || !dragData.hasMoved) return;

            if (dragData.target === tab) {
                dragData.target = null;
            }
            tab.classList.remove('droppable');
            updateGhostLabel();
        });
    });
}
/*
function setupPaneDropTargets() {
    ['left-pane', 'right-pane'].forEach(paneId => {
        const list = document.getElementById(`${paneId}-file-list`);
        console.log(`Listening for drops on: ${paneId}-file-list`);
        if (!list) {
            console.warn(`[dragdrop] Missing drop target for ${paneId}`);
            return;
        }

        list.addEventListener('mouseenter', () => {
            if (!isDragging || !dragData.hasMoved) return;

            dragData.target?.classList.remove('droppable');
            dragData.target = list;
            list.classList.add('droppable');
            updateGhostLabel();
        });

        list.addEventListener('mouseleave', () => {
            if (!isDragging || !dragData.hasMoved) return;

            if (dragData.target === list) {
                dragData.target = null;
            }
            list.classList.remove('droppable');
            updateGhostLabel();
        });
    });
}
*/

document.addEventListener('DOMContentLoaded', () => {
    //setupPaneDropTargets();
    ['left-pane', 'right-pane'].forEach(paneId => {
      const pane = document.getElementById(paneId);
      if (!pane) {
        console.warn(`[dragdrop] Pane not found: ${paneId}`);
        return;
      }
  
      pane.addEventListener('paneContentLoaded', () => {
        console.log(`setupManualDrag: ${paneId}`);
        setupManualDrag(paneId);
      });

      pane.addEventListener('paneTabsUpdated', () => {
        console.log(`setupTabDropHandlers: ${paneId}`);
        setupTabDropHandlers(paneId);
      });
    });
  });