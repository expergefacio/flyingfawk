// static/terminalemulator.js

// We append a unique exitCode marker to the command when exitWhenDone is true.
// The marker is timestamp-based (HHMMSSMMM), making it effectively unique per session.
// This allows us to detect when a command has finished via terminal_output.
// exitCode is cleared on terminal close to avoid false triggers on reopen.

var term = null;
var socket = null;

var terminalStatusSpan = null;
var terminalStatusIndicator = null;
var terminalControls = null;
var exitCode = null;
let inputBuffer = '';


function clearTerminalInput() {
    socket.emit('terminal_input', { input: '\x01' }); // Ctrl+A
    socket.emit('terminal_input', { input: '\x0B' }); // Ctrl+K
}

function simulateTyping(commandString) {
    const forbiddenChars = ['\r', '\n']; // prevent accidental execution
    clearTerminalInput()
    for (const char of commandString) {
        if (forbiddenChars.includes(char)) {
            console.warn("Skipped forbidden char in command:", char);
            continue;
        }
        // Emit character as if typed
        if (typeof socket !== 'undefined' && socket.connected) {
            //console.log("Typing char:", char);
            socket.emit('terminal_input', { input: char });
        }
    }
}

function waitForTerminalReadyAndType(commandString, exit = false) {
    const start = Date.now();
    const maxWait = 1500;
    const interval = 5;

    const checkInterval = setInterval(() => {
        const elapsed = Date.now() - start;
        const textarea = document.querySelector('.xterm-helper-textarea');

        const isReady = textarea &&
                        textarea.offsetParent !== null && // visible
                        document.activeElement === textarea; // already focused

        if (isReady && term && typeof term.focus === 'function') {
            const now = new Date();
            const pad = (n, len = 2) => String(n).padStart(len, '0');
            const time = pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds()) + pad(now.getMilliseconds(), 3);

            console.log("Terminal is ready. Typing command...");
            term.focus();
            if (exit){
                exitCode = `__flying_exit_code_${time}__`;
                commandString = commandString + ` && echo "${exitCode}"`;
            }
            simulateTyping(commandString);
            clearInterval(checkInterval);
        }

        if (elapsed > maxWait) {
            console.warn("Timed out waiting for terminal to become ready.");
            clearInterval(checkInterval);
        }
    }, interval);
}

/**
 * Initializes the terminal (xterm.js) and connects to the WebSocket.
 * Should be called when the terminal overlay is opened.
 * @param {HTMLElement} terminalContentElement - The DOM element where xterm.js should be mounted (e.g., the div with id="terminal-content").
 * @param {string} [initialCommand] - Optional command string to type into the terminal on open.
 */
function initializeTerminal(terminalContentElement, initialCommand, exitWhenDone = false, prepopulateCwd = null) { // Added terminalContentElement parameter
    console.log("Initializing terminal...");
    let outputBuffer = '';
    let hasTypedCommand = false;
    // The element where the terminal should be mounted is passed as an argument
    if (!terminalContentElement) {
        console.error("Terminal content element was not provided! Cannot initialize xterm.");
         if (typeof openMessageBox === 'function') {
             openMessageBox('<div class="message-content-text error-message" style="padding: 20px; text-align: center;">Error: Terminal content area not provided for initialization.</div>');
         }
         // Attempt to close the terminal overlay
         if (typeof overlayclose === 'function') overlayclose();
         return; // Stop initialization
    }

    // Clear any previous content (important if re-opening the terminal overlay)
    terminalContentElement.innerHTML = '';

    // Create a new Terminal instance
    term = new Terminal({
        fontSize: 14,
        fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
        cursorBlink: true,
        cursorStyle: 'block',
        theme: { // Basic dark theme
            background: '#1e1e1e',
            foreground: '#cccccc',
            cursor: '#cccccc',
            selectionBackground: '#555555',
            blue: '#5d5dff' // A shade of blue for directory listings etc.
        },
        cols: 80, // Default columns
        rows: 24 // Default rows
    });

    // Get references to status and control elements by searching from the PARENT container
    // The parent container is the one managed by overlay_handlers.js (#terminal-container)
    // FIXED: Use the ID selector #terminal-container
    const parentContainer = terminalContentElement.closest('#terminal-container'); // Search UP from the content element (#terminal-content)
    if (parentContainer) {
        terminalStatusSpan = parentContainer.querySelector('.terminal-status span');
        terminalStatusIndicator = parentContainer.querySelector('.terminal-status .status-indicator');
        terminalControls = parentContainer.querySelector('.terminal-controls');
        console.log("Terminal status/control elements found.");
    } else {
         console.warn("Terminal parent container (#terminal-container) not found using closest from #terminal-content. Status/controls may not update.");
    }


    // Open the terminal in the specified DOM element
    term.open(terminalContentElement); // Use the passed element reference
    console.log("xterm.js instance opened in DOM.");

    term.attachCustomKeyEventHandler((e) => {
        if (e.key === 'Escape') {
            if (document.getElementById('terminal-container')?.classList.contains('visible')) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof overlayclose === 'function') overlayclose();
                return false; // Stop xterm from processing it
            }
        }
        return true; // Allow all other keys
    });

    // --- Connect to Socket.IO ---
    // Assumes SOCKETIO_URL is available globally from index.html
    if (typeof io === 'function' && typeof SOCKETIO_URL !== 'undefined') {
        console.log("Connecting to Socket.IO for terminal at:", SOCKETIO_URL);
        socket = io(SOCKETIO_URL);

        // --- Socket.IO Event Listeners ---
        socket.on('connect', function() {
            console.log('Terminal Socket.IO connected!');
            term.write('\r\n*** Connected to server ***\r\n');
        
            if (terminalStatusSpan && terminalStatusIndicator) {
                terminalStatusSpan.textContent = 'Connected';
                terminalStatusIndicator.classList.remove('status-disconnected');
                terminalStatusIndicator.classList.add('status-connected');
            }
        
            // Prepare prepopulate logic only if needed
            if (initialCommand || prepopulateCwd) {
                let commandToSend = initialCommand;
        
                if (initialCommand && exitWhenDone) {
                    const now = new Date();
                    const pad = (n, len = 2) => String(n).padStart(len, '0');
                    const time = pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds()) + pad(now.getMilliseconds(), 3);
                    exitCode = `__flying_exit_code_${time}__`;
                    commandToSend += ` && echo "${exitCode}"`;
                }
        
                socket.emit('terminal_prepopulate', {
                    command: commandToSend || undefined,
                    cd: prepopulateCwd || undefined
                });
            }
        });

        socket.on('disconnect', function(reason) {
            console.log('Terminal Socket.IO disconnected:', reason);
            term.write(`\r\n*** Disconnected from server (${reason}) ***\r\n`);
            // activeSessionId = null; // Clear SID

            // Update status indicator
             if (terminalStatusSpan && terminalStatusIndicator) {
                terminalStatusSpan.textContent = 'Disconnected';
                terminalStatusIndicator.classList.remove('status-connected');
                terminalStatusIndicator.classList.add('status-disconnected');
             }
        });

        socket.on('connect_error', function(error) {
            console.error('Terminal Socket.IO connection error:', error);
            term.write(`\r\n*** Connection Error: ${error.message} ***\r\n`);
             if (terminalStatusSpan && terminalStatusIndicator) {
                terminalStatusSpan.textContent = 'Connection Error';
                terminalStatusIndicator.classList.remove('status-connected');
                terminalStatusIndicator.classList.add('status-disconnected');
             }
        });


        // Terminal auto-exit logic:
        // We wait for the full command to emit a unique marker (exitCode),
        // but only trigger closure if the marker appears *on its own line*
        // and is surrounded by newlines. This helps avoid premature exits
        // due to echoed input or partially received output.
        // We also tolerate cursor movement codes like ESC[A before the marker

        // Handle incoming data from the server (shell output)
        socket.on('terminal_output', function(data) {
            if (data && data.output) {
                term.write(data.output);
                outputBuffer += data.output;
        
                //  logging for debug premeture exit:
                //  console.log("exitWhenDone")
                //  console.log(exitWhenDone)
                //  console.log("typeof exitCode === 'string'")
                //  console.log(typeof exitCode === 'string')
                //  console.log("data.output.includes(exitCode)")
                //  console.log(data.output.includes(exitCode))
                //  console.log("regex.test(data.output)")
                //  console.log(/^[^\"]*__flying_exit_code_\d+__/m.test(data.output))
                //  console.log('data:')
                //  console.log(data.output) 
                  if (
                    exitWhenDone &&
                    typeof exitCode === 'string' &&
                    outputBuffer.includes(exitCode) &&
                    // Ensures the exitCode is on a line not starting with a quote (i.e., un-echoed)
                    new RegExp(`^[^\"]*${exitCode}`, 'm').test(outputBuffer)
                  ) {
                    console.log(`Detected exit code "${exitCode}" in output. Closing terminal...`);
                    exitCode = null;
                    overlayclose();
                  
                    if (typeof window._onTerminalExit === 'function') {
                      window._onTerminalExit();
                      window._onTerminalExit = null;
                    }
                  }
            }
        });


        // --- xterm.js Event Listener ---
        // Handle user input from the terminal
        term.onData(function(input) {
            //console.log('xterm.js received input:', input);

            // Append printable characters to buffer first
            if (/^[\x20-\x7E]$/.test(input)) {
                inputBuffer += input;
            } else if (input === '\x7F') {
                // Backspace support
                inputBuffer = inputBuffer.slice(0, -1);
            } else if (input === '\r' || input === '\n') {
                const trimmed = inputBuffer.trim().toLowerCase();

                if (trimmed === 'exit') {
                    const confirmExit = confirm("Are you sure? Running 'exit' in tmux will crash the docker-container.");
                    if (!confirmExit) {
                        return;
                    }
                }

                inputBuffer = ''; // Clear after handling Enter
            }

            // Always send input to backend (unless blocked above)
            if (socket && socket.connected) {
                socket.emit('terminal_input', { input });
            } else {
                term.write('\r\n*** Not connected. Input ignored. ***\r\n');
            }
        });




    } else {
         console.error("Socket.IO client library (io) or SOCKETIO_URL is not available. Cannot connect for terminal.");
         term.write('\r\n*** Error: Socket.IO not available. Cannot connect to terminal backend. ***\r\n');
          if (terminalStatusSpan && terminalStatusIndicator) {
                terminalStatusSpan.textContent = 'Socket.IO Error';
                terminalStatusIndicator.classList.remove('status-connected');
                terminalStatusIndicator.classList.add('status-disconnected');
           }
           // Disable input if no socket connection
           term.options.disableStdin = true;
    }
}


/**
 * Opens the terminal overlay and initializes the terminal.
 * This function is called by buttons.js when the "Term" button is clicked.
 * @param {string} [initialCommand] - Optional command string to type into the terminal on open.
 */
function openTerminalOverlay(initialCommand = null, exitWhenDone = false, cwd = null) {
    prepopulateCommand = initialCommand;
    prepopulateCwd = cwd;
    // Use the unified overlay handler to open the terminal container
    // Assumes openTerminalContainer is available globally from overlay_handlers.js
    if (typeof openTerminalContainer === 'function') {
        // openTerminalContainer returns the specific content element where the terminal should go (#terminal-content)
        const terminalContentElement = openTerminalContainer();

        if (terminalContentElement) {
            // Initialize the xterm.js terminal and Socket.IO connection *after* the container is in the DOM
            // Pass the element returned by openTerminalContainer to initializeTerminal
            initializeTerminal(terminalContentElement, initialCommand, exitWhenDone, cwd);
            console.log("Terminal overlay opened.");

            // Optional: Focus the terminal input area immediately
            if (term) {
                 // Use a slight delay to allow xterm to render
                 setTimeout(() => term.focus(), 50);
            }

        } else {
             console.error("openTerminalContainer did not return the terminal content element.");
             // An error message might already be displayed by openTerminalContainer
        }

    } else {
        console.error("openTerminalContainer function not found! Cannot open terminal overlay.");
        // Fallback: display a message box if possible
        if (typeof openMessageBox === 'function') {
             openMessageBox('<div class="message-content-text error-message">Error: Terminal overlay handler not found.</div>');
        }
    }
}


/**
 * Disposes of the active terminal instance and Socket.IO connection.
 * This function should be called when the terminal overlay is closed.
 * It is exposed globally as `_disposeActiveTerminal` for `overlay_handlers.js` to call.
 */
function disposeActiveTerminal() {
    console.log("Disposing active terminal...");
    exitCode = null;
    // Check if term or socket exist before attempting to dispose/disconnect
    if (socket && socket.connected) {
        console.log("Disconnecting terminal Socket.IO...");
        socket.disconnect(); // Disconnect the Socket.IO connection
        socket = null; // Clear the socket reference
    } else if (socket) {
         console.log("Terminal Socket.IO already disconnected.");
         socket = null;
    } else {
         console.log("No terminal Socket.IO connection found.");
    }

    if (term) {
        console.log("Disposing xterm.js instance...");
        term.dispose(); // Dispose of the xterm.js instance
        term = null; // Clear the term reference
        console.log("xterm.js instance disposed.");
    } else {
        console.log("No active xterm.js instance found to dispose.");
    }

     // Reset DOM element references held globally if they were assigned
     // terminalContainer = null; // Removed this top-level var
     terminalStatusSpan = null;
     terminalStatusIndicator = null;
     terminalControls = null;

     // The overlay handler (overlay_handlers.js) is responsible for hiding and clearing
     // the content container after the dispose call.
    
     console.log("Active terminal disposed.");
}

// Expose the open and dispose functions globally for other scripts (like buttons.js and overlay_handlers.js)
window.openTerminalOverlay = openTerminalOverlay;
window._disposeActiveTerminal = disposeActiveTerminal; // Use a distinct name to avoid conflict
