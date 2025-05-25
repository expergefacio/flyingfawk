// dropdown_menus.js

const dropdownMenus = {
    '#edit': {
        name: 'Edit',
        items: [
            {
                name: 'Duplicate',
                functionName: 'handleDuplicateFile',
                tooltip: 'Create a copy of the selected file'
            }
        ]
    }
};

function createDropdown(menuId, items) {
    const container = document.createElement('div');
    container.className = 'userscripts-dropdown';
    container.id = `dropdown-${menuId.replace('#', '')}`;

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'dropdown-item';
        el.textContent = item.name;

        if (item.tooltip) {
            el.setAttribute('title', item.tooltip); // visual browser-native tooltip
        }

        el.addEventListener('click', () => {
            const fn = window[item.functionName];
            if (typeof fn === 'function') {
                fn();
            } else {
                console.warn(`Function ${item.functionName} is not defined.`);
            }
        });

        container.appendChild(el);
    });

    return container;
}


function setupDropdownMenus() {
    const activeMenus = {};

    Object.entries(dropdownMenus).forEach(([selector, config]) => {
        const trigger = document.querySelector(selector);
        if (!trigger) return;

        const menu = createDropdown(selector, config.items);
        menu.style.display = 'none';
        document.body.appendChild(menu);
        activeMenus[selector] = menu;

        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const isVisible = menu.style.display === 'block';

            // Close all dropdowns
            Object.values(activeMenus).forEach(m => m.style.display = 'none');

            // Toggle current menu
            if (!isVisible) {
                const rect = trigger.getBoundingClientRect();
                menu.style.position = 'fixed';
                menu.style.top = `${rect.bottom}px`;
                menu.style.left = `${rect.left}px`;
                menu.style.display = 'block';
            }
        });
    });

    // ✅ GLOBAL click-outside listener — only registered once
    document.addEventListener('click', (e) => {
        const isInsideDropdown = e.target.closest('.userscripts-dropdown');
        const isTrigger = Object.keys(dropdownMenus).some(selector => {
            return e.target.closest(selector);
        });

        if (!isInsideDropdown && !isTrigger) {
            Object.values(activeMenus).forEach(m => m.style.display = 'none');
        }
    });
}


document.addEventListener('DOMContentLoaded', setupDropdownMenus);
