//keybinds.js
/**
 * We have some creative choices here, but i need keys to work on linux through vnc,
 * mac without F-keys and whatnot of other choices, however you can change anything
 * here to yout own liking :)
 */

const keys = [
    { key: "Tab",       modifiers: [],          handler: tab},

    { key: "Backspace", modifiers: ["meta"],    handler: handleDelete },
    { key: "Delete",    modifiers: [],          handler: handleDelete},

    { key: "Enter",     modifiers: [],          handler: globalEnterHandler },
    //{ key: "Enter",   modifiers: [],          handler: handlePreviewButtonClick }, //part of globalEnterHandler now
    { key: "Enter",     modifiers: ["shift"],   handler: handleRename },
    //{ key: "F2",      modifiers: [],          handler: handleRename }, //windows way


    { key: " ",         modifiers: [],          handler: onSpaceClick },
    { key: " ",         modifiers: ["ctrl"],    handler: toggleSpaceBar },
    { key: " ",         modifiers: ["shift"],   handler: toggleSelectedByButton },
    { key: "d",         modifiers: ["meta"],    handler: deselectAllInPane },
    { key: "a",         modifiers: ["meta"],    handler: selectAllHandler },
    { key: "a",         modifiers: ["ctrl"],    handler: selectAllHandler },
    { key: "d",         modifiers: ["meta"],    handler: deselectHandler },
    { key: "d",         modifiers: ["ctrl"],    handler: deselectHandler },
    { key: "o",         modifiers: ["meta"],    handler: openFileHandler },
    { key: "o",         modifiers: ["ctrl"],    handler: openFileHandler },
    { key: "n",         modifiers: ["meta"],    handler: handleNewDirFile },
    { key: "n",         modifiers: ["ctrl"],    handler: handleNewDirFile },
    //{ key: "Enter",   modifiers: [],          handler: openFileHandler }, //windows way

    //buttons (bottom row) attached to shift-Z->M
    { key: "Z",         modifiers: ["shift"],   handler: toggleSelectedByButton },
    { key: "X",         modifiers: ["shift"],   handler: handlePreviewButtonClick },
    { key: "C",         modifiers: ["shift"],   handler: handleRename },
    { key: "V",         modifiers: ["shift"],   handler: handleCopy },
    { key: "B",         modifiers: ["shift"],   handler: handleMove },
    { key: "N",         modifiers: ["shift"],   handler: handleNewDirFile },
    { key: "M",         modifiers: ["shift"],   handler: handleDelete },
    { key: ":",         modifiers: ["shift"],   handler: runInTerm }, //run in term

    //lynx like nav
    { key: "ArrowUp",   modifiers: [],          handler: arrowUpHandler },
    { key: "ArrowDown", modifiers: [],          handler: arrowDownHandler },
    { key: "ArrowLeft", modifiers: [],          handler: arrowLeftHandler },
    { key: "ArrowRight",modifiers: [],          handler: arrowRightHandler },

    //toggle hidden files
    { key: ".",         modifiers: ["meta", "shift"], handler: toggleDotfilesHandler },
    { key: ":",         modifiers: ["ctrl", "shift"], handler: toggleDotfilesHandler }
];

function void_(){

}