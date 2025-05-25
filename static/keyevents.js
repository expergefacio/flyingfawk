//keyevents.js



/**
 * Handles global keydown events. Checks the pressed key and modifier states against registered handlers
 * and calls the corresponding handler if found. Prevents default browser action for handled keys.
 * @param {KeyboardEvent} event - The keydown event.
 * @returns {void}
 */
function handleGlobalKeydown(event) {
    const pressedKey = event.key;
    const tag = document.activeElement?.tagName?.toLowerCase();




    // if overlay is visible
    if (isoverlayvisible()) {
        // Let inline input logic handle Enter, Escape, etc.
        if (
            tag === 'input' || 
            tag === 'textarea' || 
            document.activeElement?.isContentEditable
        ) {
            return;
        }

        if (
            pressedKey === 'Escape' ||
            pressedKey === 'Enter' ||
            (pressedKey === ' ' && window.spaceMode === 'preview')
        ) {
            event.preventDefault();
            event.stopPropagation();
            overlayclose();
            return;
        }
    
        if (pressedKey === 'ArrowDown' || pressedKey === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
    
            window._onOverlayClosed = () => {
                if (pressedKey === 'ArrowDown') {
                    arrowDownHandler(event);
                } else {
                    arrowUpHandler(event);
                }
                handlePreviewButtonClick();
            };
            overlayclose();
            return;
        }
        // Allow Ctrl+A / Meta+A to select preview content
        if (
            ispreviewvisible() &&
            pressedKey.toLowerCase() === 'a' &&
            (event.ctrlKey || event.metaKey)
        ) {
            event.preventDefault();
            event.stopPropagation();

            const container = document.getElementById('preview-content');
            if (container) {
                const range = document.createRange();
                range.selectNodeContents(container);

                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }

            return;
        }

        return; // Ignore all other keys if overlay is open
    }

    //if overlay is closed, i.e. global
    const pressedModifiers = [];
    if (event.shiftKey) pressedModifiers.push('shift');
    if (event.ctrlKey) pressedModifiers.push('ctrl');
    if (event.altKey) pressedModifiers.push('alt');
    if (event.metaKey) pressedModifiers.push('meta');

    const matchingHandlers = keys.filter(keyPair => {
        if (keyPair.key !== pressedKey) return false;
        if (keyPair.modifiers.length !== pressedModifiers.length) return false;
        return keyPair.modifiers.every(requiredModifier =>
            pressedModifiers.includes(requiredModifier)
        );
    });

    if (matchingHandlers.length > 0) {
        if (!isoverlayvisible()) {
            event.preventDefault();
        }
        matchingHandlers.forEach(pair => pair.handler(event));
    }
}


document.addEventListener('keydown', handleGlobalKeydown);



// Basic search trigger
window._searchBuffer = '';
window._searchTimeout = null;
document.addEventListener('keydown', function(event) {
    if (typeof isoverlayvisible === 'function' && isoverlayvisible()) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const isAlphanumeric = /^[a-z0-9]$/i.test(event.key);
    if (!isAlphanumeric) return;

    // Append to buffer
    window._searchBuffer += event.key;

    // Reset timeout
    if (window._searchTimeout) clearTimeout(window._searchTimeout);
    window._searchTimeout = setTimeout(() => {
        window._searchBuffer = '';
    }, 800);

    const focusedPane = document.querySelector('.pane-container.panefocus');
    if (!focusedPane) return;

    const fileRows = Array.from(focusedPane.querySelectorAll('.file-row'));
    const search = window._searchBuffer.toLowerCase();

    for (const row of fileRows) {
        const name = row.dataset.itemName?.toLowerCase();
        if (name && name.startsWith(search)) {
            const currentFocus = getFocusedItemRowInFocusedPane();
            if (currentFocus) currentFocus.classList.remove('focus');
            row.classList.add('focus');
            row.scrollIntoView({ block: 'center', behavior: 'instant' });
            break;
        }
    }
});

/*
// preview close for Enter, preview key and esc
document.addEventListener('keydown', function(event) {
    if (!isoverlayvisible()) return;

    if (window._suppressOverlayKeyOnce) {
        window._suppressOverlayKeyOnce = false;
        return;
    }
    const key = event.key;
    if (key === 'Escape' || 
        key === 'Enter' || 
        (key === ' ' && window.spaceMode === 'preview')) {
        event.preventDefault();
        event.stopPropagation();
        overlayclose();
    }
});*/


