// static/column_header_resize.js

// Namespace or object to hold resizing related functions and state
const ColumnResize = {
    // Default column widths (as percentages)
    // Updated for 5 columns: File, Extension, Size, Modified, Created
    DEFAULT_WIDTHS_PERCENT: [30, 15, 15, 20, 20], // Example distribution (summing to 100)
    STORAGE_KEY_PREFIX: 'filebrowser_column_widths_', // Prefix for localStorage keys
    STYLE_TAG_ID_PREFIX: 'column-style-', // Prefix for the dynamically created style tag IDs

    // --- Local Storage Functions ---

    _getStorageKey(paneId) {
        return this.STORAGE_KEY_PREFIX + paneId;
    },

    loadColumnWidths(paneId) {
        const key = this._getStorageKey(paneId);
        const savedWidths = localStorage.getItem(key);
        const expectedLength = this.DEFAULT_WIDTHS_PERCENT.length; // Expecting 5 widths now

        if (savedWidths) {
            try {
                const widths = JSON.parse(savedWidths);
                // Check if loaded widths array is valid and has the expected number of elements
                if (Array.isArray(widths) && widths.length === expectedLength) {
                    return widths; // Return loaded widths (expected to be percentages)
                } else {
                    // If saved data is invalid or doesn't match the current column count, clear it
                    localStorage.removeItem(key);
                    console.warn(`Invalid or mismatched saved column widths for pane ${paneId}. Using defaults.`);
                }
            } catch (e) {
                // If parsing fails, clear the saved data
                localStorage.removeItem(key);
                console.error(`Failed to parse saved column widths for pane ${paneId}:`, e);
            }
        }

        // Return default percentages if no valid saved data is found
        return this.DEFAULT_WIDTHS_PERCENT;
    },


    saveColumnWidths(paneId, widths) { // Expects widths as percentages
        const key = this._getStorageKey(paneId);
        try {
            // Ensure widths are numbers and handle potential NaN after calculations
            const validWidths = widths.map(w => typeof w === 'number' && !isNaN(w) && w >= 0 ? w : (100 / widths.length)); // Fallback to equal distribution if invalid or negative
            localStorage.setItem(key, JSON.stringify(validWidths));
        } catch (e) {
             console.error(`Failed to save column widths for pane ${paneId}:`, e);
        }
    },

    // --- Applying and Getting Widths ---

    /**
     * Applies given widths (as percentages) to the column headers and injects CSS
     * rules to apply widths to the file list cells in a pane.
     * @param {HTMLElement} paneElement - The main pane element.
     * @param {number[]} widthsPercent - An array of column widths in percentages.
     */
    applyColumnWidths(paneElement, widthsPercent) {
        const paneId = paneElement.id;
        const headerElements = paneElement.querySelectorAll('.column-header');

        // Ensure the number of widths matches the number of headers
        if (widthsPercent.length !== headerElements.length) {
             console.warn(`Number of provided widths (${widthsPercent.length}) does not match number of headers (${headerElements.length}) for pane ${paneId}. Using equal distribution.`);
             // Recalculate widths to distribute equally if mismatch occurs
             const equalWidth = 100 / headerElements.length;
             widthsPercent = Array(headerElements.length).fill(equalWidth);
        }


        // Apply widths to header elements using percentages
        headerElements.forEach((header, index) => {
            const width = Math.max(0, widthsPercent[index] || 0); // Ensure not negative or NaN
            // Set width property (used by flexbox basis if grow/shrink allows)
            header.style.width = `${width}%`;
            // Or set flex-basis if flex-grow/shrink are appropriately configured
            // header.style.flexBasis = `${width}%`;
            // header.style.flexGrow = 0; // Prevent growing based on content if using basis
            // header.style.flexShrink = 0; // Prevent shrinking
        });

        // --- Generate and Inject CSS for File List Cells ---
        const styleTagId = this.STYLE_TAG_ID_PREFIX + paneId;
        let styleTag = document.getElementById(styleTagId);

        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = styleTagId;
            document.head.appendChild(styleTag); // Add to the document head
        }

        let cssRules = '';
        // Generate CSS rules for the cells (.file-cell) within this pane's file list container
        // The selector targets cells within the specific pane's file list
        const fileListSelector = `#${paneId} .file-list-container .file-row .file-cell`;
        // const separatorSelector = `#${paneId} .column-header-bar .separator`; // Selector for separators


        // The percentages applied to headers/cells should distribute the *remaining* space
        // after separators are accounted for in the header bar.
        // For file cells, we can apply widths directly as percentages, and flexbox will handle it.
        // The sum of cell widths + separator widths should ideally equal the pane width.
        // We apply widths to file-cells using nth-child selectors.

        widthsPercent.forEach((width, index) => {
             const cellWidthPercent = Math.max(0, width || 0);
             // Target cells based on their position in the row
             cssRules += `${fileListSelector}:nth-child(${index + 1}) { width: ${cellWidthPercent}%; }\n`;
             // Alternative: Use flex-basis for cells. Requires display:flex on .file-row
             // cssRules += `${fileListSelector}:nth-child(${index + 1}) { flex: 0 0 ${cellWidthPercent}%; }\n`;
        });

        // Optional: Add a rule for the last separator's right margin/border if needed
        // cssRules += `#${paneId} .column-header-bar .separator:last-child { border-right: none; }\n`;


        // Update the content of the style tag
        styleTag.textContent = cssRules;
    },


    // --- Resizing Logic ---

    _isResizing: false,
    _currentSeparator: null,
    _currentPane: null,
    _startPageX: 0,
    _startWidthsPx: [], // Store initial widths in pixels
    _adjacentHeaders: [],

    _onMouseMoveBound: null,
    _onMouseUpBound: null,


    _onMouseDown(event) {
        event.preventDefault();

        this._isResizing = true;
        this._currentSeparator = event.target;
        this._currentPane = this._currentSeparator.closest('#left-pane, #right-pane');

        if (!this._currentPane) {
             this._isResizing = false;
             return;
        }

        this._startPageX = event.pageX;

        const headerElements = Array.from(this._currentPane.querySelectorAll('.column-header'));
        const separatorElements = Array.from(this._currentPane.querySelectorAll('.separator'));

        const separatorIndex = separatorElements.indexOf(this._currentSeparator);

        // The headers adjacent to the separator we clicked
        this._adjacentHeaders = [
            headerElements[separatorIndex], // Header to the left of the separator
            headerElements[separatorIndex + 1] // Header to the right of the separator
        ];

        // Store the initial pixel widths of the two adjacent headers
        this._startWidthsPx = [
            this._adjacentHeaders[0].offsetWidth,
            this._adjacentHeaders[1].offsetWidth
        ];

        // Add global listeners for mousemove and mouseup
        document.addEventListener('mousemove', this._onMouseMoveBound);
        document.addEventListener('mouseup', this._onMouseUpBound);

        // Add a class to body to indicate resizing (optional, for global cursor)
        document.body.classList.add('column-resizing'); // Add CSS rule for body.column-resizing cursor: col-resize;
    },

    _onMouseMove(event) {
        if (!this._isResizing) return;

        const deltaX = event.pageX - this._startPageX;

        // Calculate new widths in pixels for the two adjacent headers
        let newLeftWidthPx = this._startWidthsPx[0] + deltaX;
        let newRightWidthPx = this._startWidthsPx[1] - deltaX;

        // --- Add constraints ---
        const minWidthPx = 20; // Minimum pixel width for columns
        const totalWidthPx = this._startWidthsPx[0] + this._startWidthsPx[1]; // Sum of the two columns

        // Ensure left column is not too small
        if (newLeftWidthPx < minWidthPx) {
            const adjustment = minWidthPx - newLeftWidthPx;
            newLeftWidthPx = minWidthPx;
            newRightWidthPx -= adjustment; // Subtract the amount added to the left from the right
        }
        // Ensure right column is not too small (re-check after adjusting left)
        if (newRightWidthPx < minWidthPx) {
             const adjustment = minWidthPx - newRightWidthPx;
             newRightWidthPx = minWidthPx;
             newLeftWidthPx -= adjustment; // Subtract the amount added to the right from the left
        }


        // Apply the new widths using pixels during drag for smooth updates
        // This updates the header elements directly
        this._adjacentHeaders[0].style.width = `${newLeftWidthPx}px`;
        this._adjacentHeaders[1].style.width = `${newRightWidthPx}px`;

        // NOTE: Applying widths to the *table cells/columns* during mousemove is more complex
        // and performance-sensitive. Often, you update the headers smoothly with pixels
        // during drag, and then update the table column widths (likely using percentages
        // recalculated from final pixel widths) only on mouseup.
        // Or, if performance allows, you can apply pixel widths to <col> elements here.
        // Let's stick to updating headers during drag and applying to table on mouseup for now.

    },

    _onMouseUp(event) {
        if (!this._isResizing) return;

        // --- Calculations and Saving (Must happen BEFORE clearing state) ---

        // Get the header bar element to calculate total width for percentage conversion
        const headerBar = this._currentPane.querySelector('.column-header-bar');
        const headerBarWidth = headerBar ? headerBar.offsetWidth : 0;

        const finalHeaderElements = Array.from(this._currentPane.querySelectorAll('.column-header'));

        let finalWidthsPercent = [];
        if (headerBarWidth > 0) {
             // Calculate final widths as percentages relative to the header bar width
             finalWidthsPercent = finalHeaderElements.map(h => (h.offsetWidth / headerBarWidth) * 100);
             // Ensure percentages sum to 100% to avoid layout gaps/overflow in file cells
             // Calculate current sum
             const currentSum = finalWidthsPercent.reduce((sum, width) => sum + width, 0);
             // Adjust if necessary (simple proportional adjustment)
             if (currentSum > 0 && Math.abs(currentSum - 100) > 0.1) { // Check if sum is close to 100 (within tolerance)
                  const adjustmentFactor = 100 / currentSum;
                  finalWidthsPercent = finalWidthsPercent.map(w => w * adjustmentFactor);
             }

        } else {
             // Fallback: If header bar width is zero or unavailable, apply default percentages.
             console.warn(`Header bar width is zero for pane ${this._currentPane.id}. Cannot calculate percentage widths correctly. Applying defaults.`);
             const fallbackWidths = this.loadColumnWidths(this._currentPane.id); // Load last saved percent or defaults
             this.applyColumnWidths(this._currentPane, fallbackWidths); // Re-apply defaults/saved percent
             finalWidthsPercent = fallbackWidths; // Save the fallback widths
        }


        // Save the NEW widths (as percentages)
        this.saveColumnWidths(this._currentPane.id, finalWidthsPercent);


        // Re-apply widths using PERCENTAGES to headers AND inject CSS for table cells
        // This ensures columns scale correctly if the window is resized after drag
        this.applyColumnWidths(this._currentPane, finalWidthsPercent);


        // --- Clear state variables (Must happen AFTER saving and re-applying widths) ---
        this._isResizing = false;
        this._currentSeparator = null;
        this._adjacentHeaders = [];
        this._startPageX = 0;
        this._startWidthsPx = [];
        this._currentPane = null; // Clear pane *after* using its id/elements

        // Remove the global listeners
        document.removeEventListener('mousemove', this._onMouseMoveBound);
        document.removeEventListener('mouseup', this._onMouseUpBound);

        // Remove resizing class from body
        document.body.classList.remove('column-resizing');
    },

    // --- Initialization ---

    /**
     * Initializes column resizing for a single pane.
     * @param {string} paneId - The ID of the pane ('left-pane' or 'right-pane').
     */
    initPaneResizing(paneId) {
        const paneElement = document.getElementById(paneId);
        if (!paneElement) {
            console.error(`Pane element with ID ${paneId} not found.`);
            return;
        }

        const headerBar = paneElement.querySelector('.column-header-bar');
        const separators = paneElement.querySelectorAll('.separator');
        const headerElements = paneElement.querySelectorAll('.column-header');

         // Check if the number of headers and separators is consistent for resizing
        if (!headerBar || headerElements.length === 0 || separators.length !== headerElements.length - 1) {
            console.warn(`Insufficient or mismatched header/separator elements for resizing in pane ${paneId}. Headers: ${headerElements.length}, Separators: ${separators.length}. Applying default widths only.`);
            // Apply default widths even if resizing isn't possible, so render logic can use widths
            const defaultWidths = this.DEFAULT_WIDTHS_PERCENT;
            this.applyColumnWidths(paneElement, defaultWidths); // Apply default widths as percentages
            return; // Do not proceed with adding listeners if elements are missing or mismatched
        }

        // Bind mousemove and mouseup handlers once globally if not already bound
        if (!this._onMouseMoveBound) {
             this._onMouseMoveBound = this._onMouseMove.bind(this);
             this._onMouseUpBound = this._onMouseUp.bind(this);
        }


        // Add mousedown listener to each separator
        separators.forEach(separator => {
            separator.addEventListener('mousedown', this._onMouseDown.bind(this));
        });


        // --- Load and Apply Saved Widths on Init ---
        const savedWidths = this.loadColumnWidths(paneId); // Load saved percentages or defaults

        // Apply loaded/default widths as percentages immediately
        this.applyColumnWidths(paneElement, savedWidths);

        // IMPORTANT: Add a window resize listener to re-apply percentage widths
        // This ensures columns scale correctly when the browser window changes size.
        // Use a small debounce to avoid excessive calls during resizing.
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // Load the *latest saved* widths (or defaults) again, just in case, and re-apply percentages
                // We should load based on the *current* number of headers in case the structure changes dynamically
                 const currentHeaderCount = paneElement.querySelectorAll('.column-header').length;
                 let widthsToApply = this.loadColumnWidths(paneId);

                 // If the loaded widths don't match the current header count, fallback to equal distribution
                 if (widthsToApply.length !== currentHeaderCount) {
                      console.warn(`Window resize: Mismatched loaded widths and current header count for pane ${paneId}. Recalculating equal distribution.`);
                      const equalWidth = 100 / currentHeaderCount;
                      widthsToApply = Array(currentHeaderCount).fill(equalWidth);
                 }

                this.applyColumnWidths(paneElement, widthsToApply);
            }, 100); // 100ms debounce delay
        });

    },

    /**
     * Initializes resizing for all panes on page load.
     * Call this after DOM is ready.
     */
    init: function() {
        // Initialize for both left and right panes
        this.initPaneResizing('left-pane');
        this.initPaneResizing('right-pane');
    }
};

// Call init when the DOM is fully loaded
// Note: The actual data rendering (main.js) also runs on DOMContentLoaded.
// Ensure column_header_resize.js's script tag is before main.js in index.html
// so that applyColumnWidths runs and injects CSS *before* main.js tries to render rows.
document.addEventListener('DOMContentLoaded', () => {
    ColumnResize.init();
});