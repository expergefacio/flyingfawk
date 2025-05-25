// static/templates.js

/**
 * Object to hold HTML template functions.
 */
var tmpl = {};

/**
 * Generates the HTML string for a single file or directory row in the list.
 * @param {object} item - The item data object from the server API.
 * Expected keys: name, is_directory, subpath (UI path),
 * formatted_size, formatted_modified, formatted_created, file_extension
 * @returns {string} The HTML string for the row.
 */
tmpl.file_row = function(item) {
    const rowClasses = item.is_directory ? 'file-row filetype_directory' : 'file-row';
    const itemPath = item.subpath || '/'; // Ensure path is not null/undefined
    const itemName = item.name || ''; // Ensure name is not null/undefined

    return `<div class="${rowClasses}" data-item-type="${item.is_directory ? 'dir' : 'file'}" data-path="${itemPath}" data-item-name="${itemName}">
                <div class="file-cell file-name">${item.name}</div>
                <div class="file-cell file-extension">${item.file_extension}</div>
                <div class="file-cell file-size">${item.formatted_size}</div>
                <div class="file-cell file-modified">${item.formatted_modified}</div>
                <div class="file-cell file-created">${item.formatted_created}</div>
            </div>`;
};
