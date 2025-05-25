// Assumes the following are available globally:
// - openTerminalOverlay(command) (from terminalemulator.js) - NOW ACCEPTS COMMAND ARG
// - openMessageBox(html) (from overlay_handlers.js) // Used for errors/messages
// - overlayclose() (from overlay_handlers.js) // Used to close dropdown or other overlays
// - getFocusedPanePath() (from buttons.js) // Used to get current CWD
// - getFocusedItemRowInFocusedPane() (from buttons.js) // Used to get focused item name
// - escapeHtml(str) (from global_functions.js) // Used for sanitizing strings for HTML display

// Hardcode the base path for userscripts within the container
const USERSCRIPTS_BASE_PATH_HARDCODED = '/app/userscripts/'; // Using hardcoded path


/**
 * Fetches the list of available userscripts from the backend API.
 * @returns {Promise<string[]|{error: string}[]>} A promise that resolves with an array of script filenames,
 * or an array containing a single error object if an error occurred.
 */
async function fetchUserscripts() {
    const listApiUrl = '/api/userscripts/list'; // The backend endpoint

    try {
        const response = await fetch(listApiUrl);
        const data = await response.json();

        if (response.ok && data.scripts && Array.isArray(data.scripts)) {
            console.log("Fetched userscripts:", data.scripts);
            return data.scripts;
        } else {
            console.error("Failed to fetch userscripts:", data.error || response.statusText);
            // Return error message in the array for display in dropdown
            return [{ error: data.error || 'Could not fetch scripts.' }];
        }
    } catch (error) {
        console.error("Network error fetching userscripts:", error);
        // Return network error message in the array for display
        return [{ error: `Network Error: ${error.message}` }];
    }
}


/**
 * Creates and displays a dropdown menu for userscripts.
 * @param {(string|{error: string})[]} scripts - An array of script filenames or an error object.
 * @param {HTMLElement} targetElement - The button element to position the dropdown relative to.
 */
function showUserscriptsDropdown(scripts, targetElement) {
    // Remove any existing dropdowns first
    removeUserscriptsDropdown();

    const dropdown = document.createElement('div');
    dropdown.id = 'userscripts-dropdown';
    dropdown.classList.add('userscripts-dropdown'); // Add class for styling

    if (scripts.length === 0 || (scripts.length === 1 && scripts[0].error)) {
         // Handle both empty array and array with only an error item
         const message = scripts.length === 1 && scripts[0].error ? `Error: ${scripts[0].error}` : 'No scripts found';
         const errorItem = document.createElement('div');
         errorItem.classList.add('dropdown-item', 'error-item');
         errorItem.textContent = message;
         dropdown.appendChild(errorItem);
    } else {
        scripts.forEach(item => {
             if (item.error) {
                 // Should not happen if checked above, but as a failsafe
                 const errorItem = document.createElement('div');
                 errorItem.classList.add('dropdown-item', 'error-item');
                 errorItem.textContent = `Error: ${item.error}`;
                 dropdown.appendChild(errorItem);
             } else {
                // Display script name item
                const scriptName = item;
                const scriptItem = document.createElement('div');
                scriptItem.classList.add('dropdown-item'); // Add class for styling
                scriptItem.textContent = scriptName;
                scriptItem.dataset.scriptName = scriptName; // Store script name for click handler
                dropdown.appendChild(scriptItem);
            }
        });
    }

    // Position the dropdown below the target element
    const rect = targetElement.getBoundingClientRect();
    dropdown.style.position = 'fixed'; // Use fixed positioning
    dropdown.style.top = `${rect.bottom + window.scrollY}px`; // Position below the button
    dropdown.style.left = `${rect.left + window.scrollX}px`; // Align left edge with button
    dropdown.style.zIndex = 1001; // Ensure it's above other content but below overlay

    document.body.appendChild(dropdown);

    // Add click listener to the dropdown for item selection
    dropdown.addEventListener('click', handleDropdownItemClick);

    // Add a click listener to the document to close the dropdown when clicking outside
    // Use a small timeout to prevent the initial button click from closing it immediately
    setTimeout(() => {
        document.addEventListener('click', handleDocumentClickToCloseDropdown);
    }, 50);
}

/**
 * Removes the userscripts dropdown from the DOM.
 */
function removeUserscriptsDropdown() {
    const existingDropdown = document.getElementById('userscripts-dropdown');
    if (existingDropdown) {
        existingDropdown.removeEventListener('click', handleDropdownItemClick);
        document.removeEventListener('click', handleDocumentClickToCloseDropdown);
        existingDropdown.remove();
    }
}

/**
 * Handles clicks inside the userscripts dropdown.
 * Triggers execution if a script item was clicked.
 * Opens the terminal overlay with the generated command.
 * @param {MouseEvent} event - The click event.
 */
async function handleDropdownItemClick(event) {
    const clickedItem = event.target.closest('.dropdown-item');
    // Only proceed if a script item (with data-script-name) was clicked, not an error item
    if (clickedItem && clickedItem.dataset.scriptName) {
        const scriptName = clickedItem.dataset.scriptName;
        console.log(`Script selected: ${scriptName}`);

        // Remove the dropdown immediately
        removeUserscriptsDropdown();

        // --- Proceed with command generation logic ---
        // Get necessary info from the current UI state
        // Assumes these functions are available globally from buttons.js
        const focusedPanePath = typeof getFocusedPanePath === 'function' ? getFocusedPanePath() : null;
        const focusedItemRow = typeof getFocusedItemRowInFocusedPane === 'function' ? getFocusedItemRowInFocusedPane() : null;


        // Validate that a pane is focused (we still need a directory context for -d)
        if (focusedPanePath === null) {
            // Assumes openMessageBox is global
            if (typeof openMessageBox === 'function') {
                openMessageBox('<div class="message-content-text">Please focus a pane first to run a script.</div>');
            } else {
                console.error("openMessageBox function not found.");
            }
            return;
        }

        // --- Determine the arguments to pass to the script ---
        // The script expects -d <directory> and -f <file>
        // -d argument: The directory the script should cd into on the server.
        // This corresponds to the terminal's CWD logic: /hostroot/<focusedPanePath>
        const scriptCwdArg = focusedPanePath === '/' ? '/hostroot/' : '/hostroot' + focusedPanePath;

        // -f argument: The name of the focused item, if any.
        // Pass the focused item's name, or an empty string if nothing is focused.
        const focusedItemName = focusedItemRow ? focusedItemRow.dataset.itemName : ''; // Get FOCUSED ITEM NAME
        // Ensure item name and path are quoted and escaped for the shell command string
        // The backend terminal runs with shell=True, so proper quoting is needed.
        // escapeHtml is for displaying in HTML, not for shell quoting.
        // Simple shell quoting: replace " with \" and wrap in ".
        // For more complex cases, a dedicated shell quoting library might be needed.
        const escapedScriptCwdArg = scriptCwdArg.replace(/"/g, '\\"');
        const escapedFocusedItemName = focusedItemName.replace(/"/g, '\\"');

        const fileArg = focusedItemName ? `-f "${escapedFocusedItemName}"` : ''; // Include -f flag only if an item is focused

        // Build the full command string to be run in the terminal
        // Use the hardcoded path directly
        const scriptPath = USERSCRIPTS_BASE_PATH_HARDCODED + scriptName; // Using hardcoded path
        const escapedScriptPath = scriptPath.replace(/"/g, '\\"');


        // Construct the command string. Include fileArg only if it's not empty.
        // Example: "/app/userscripts/myscript.sh" -d "/hostroot/some/dir" -f "my file.txt"
        const commandString = `"${escapedScriptPath}" -d "${escapedScriptCwdArg}" ${fileArg}`.trim(); // Use trim


        // --- Open the terminal and populate with command ---
        console.log(`Opening terminal with command: ${commandString}`); // Log the command

        // Open the terminal overlay and pass the command to populate immediately
        // Assumes openTerminalOverlay is available globally from terminalemulator.js
        if (typeof openTerminalOverlay === 'function') {
             // Pass the command string to the openTerminalOverlay function
             openTerminalOverlay(commandString);
        } else {
             console.error("openTerminalOverlay function not found.");
             // Fallback: Display command in message box
             // Assumes openMessageBox is global from overlay_handlers.js and escapeHtml is global
             if (typeof openMessageBox === 'function' && typeof escapeHtml === 'function') {
                 openMessageBox(`<div class="message-content-text error-message">Terminal unavailable. Command to run:</div><pre>${escapeHtml(commandString)}</pre>`);
             } else { console.error("openMessageBox or escapeHtml not found for fallback."); }
        }

        // REMOVED: The native confirm() call and the if (userConfirmed) block were removed in previous planning.
    }
    // Handle click on error item (do nothing)
}

/**
 * Handles clicks on the document to close the dropdown if the click is outside.
 * @param {MouseEvent} event - The click event.
 */
function handleDocumentClickToCloseDropdown(event) {
    const dropdown = document.getElementById('userscripts-dropdown');
    // Corrected ID here: looking for button with ID 'userscripts'
    const userscriptsButton = document.getElementById('userscripts');


    // Check if the click was outside the dropdown AND outside the userscripts button
    if (dropdown && !dropdown.contains(event.target) && userscriptsButton && !userscriptsButton.contains(event.target)) {
        removeUserscriptsDropdown();
        console.log("Dropdown closed by clicking outside.");
    }
}


/**
 * Initializes the Userscripts button by adding its event listener.
 * This function should be called by buttons.js on DOMContentLoaded.
 */
async function initUserscriptsButton() {
    // Corrected ID here: looking for button with ID 'userscripts'
    const userscriptsButton = document.getElementById('userscripts');
    if (userscriptsButton) {
        userscriptsButton.addEventListener('click', async (event) => {
            event.preventDefault(); // Prevent any default button action

            // Remove existing dropdown if any
            removeUserscriptsDropdown();

            // Fetch the list of userscripts from the backend
            const scripts = await fetchUserscripts();

            // Show the dropdown with the fetched scripts or error
            showUserscriptsDropdown(scripts, userscriptsButton);
        });
        //console.log("Event listener added for #userscripts");
    } else {
        console.error("Button #userscripts not found!");
    }
}

// Make initUserscriptsButton available globally for buttons.js
window.initUserscriptsButton = initUserscriptsButton;

// Note: handleDropdownItemClick and other helpers are not exposed globally
// as they are only called internally within the userscripts module.