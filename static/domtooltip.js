var bounding_boxes = {}
var tooltipTimer = null;
var currentTooltipTarget = null;
var pointermovelistener = null;


function onPointerMove(e) {
    if (!currentTooltipTarget) return;
    if (!currentTooltipTarget.contains(e.target)) {
        hide_tooltip({ target: currentTooltipTarget });
        currentTooltipTarget = null;
    }
}

document.addEventListener('mouseenter', (e) => {
    if (!(e.target instanceof Element)) return; 

    // If the element has a 'title', convert it to 'data-tooltip' and clear it
    if (e.target.hasAttribute('title')) {
        const title = e.target.getAttribute('title');
        e.target.setAttribute('data-tooltip', title);
        e.target.removeAttribute('title');
    }

    const target = e.target.closest('[data-tooltip]');
    if (target) {
        document.querySelector('#dom_tooltip')?.remove();
        currentTooltipTarget = target;
        const tip = target.getAttribute('data-tooltip');
        show_tooltip(tip, e);
        tooltipTimer = setTimeout(() => {
            const tipEl = document.querySelector('#dom_tooltip');
            if (tipEl) {
                tipEl.style.opacity = '0.85';
            }
        }, 1000);
        document.addEventListener('pointermove', onPointerMove);
    }
}, true);

document.addEventListener('mouseleave', (e) => {
    if (!(e.target instanceof Element)) return; 
    const target = e.target.closest('[data-tooltip]');
    if (target) {
        clearTimeout(tooltipTimer);
        hide_tooltip(e);
        currentTooltipTarget = null;
    }
}, true);

function show_tooltip(tip, evt){
    let mouse_height = evt.clientY
    let mouse_width = evt.clientX
    let m_top = mouse_height + 20
    let m_left = mouse_width + 5
    let viewport_height = window.innerHeight
    let viewport_width = window.innerWidth
    let bb = evt.target.getBoundingClientRect()
    bounding_boxes.target = bb
    let tooltip_bb = pre_render_tooltip(tip)
    bounding_boxes.tip = tooltip_bb
    //topleft
    let position = `top: ${bb.bottom + 3}px; left: ${m_left}px;`
    //tr
    if (mouse_height < viewport_height / 2 && mouse_width > viewport_width){
        position = `top: ${bb.bottom + 3}px; right: ${m_left}px;`
    }
    //br
    if (mouse_height > viewport_height / 2 && mouse_width < viewport_width){
        position = `top: calc(${bb.top + 3}px - 10%); left: ${m_left}px;`
    }

    document.querySelector('body').insertAdjacentHTML('beforeend', `
        <div id='dom_tooltip' style='${position}' >${tip}</div>
    `)

    evt.target.addEventListener('mousemove', follow_pointer)

}

function pre_render_tooltip(tip){
    document.querySelector('body').insertAdjacentHTML('beforeend', `
        <div id='dom_tooltip_prerender'>${tip}</div>`)
    let bb = document.querySelector('#dom_tooltip_prerender').getBoundingClientRect()
    document.querySelector('#dom_tooltip_prerender').remove()
    return bb
}

function hide_tooltip(e){
    const tip = document.querySelector('#dom_tooltip');
    if (tip) tip.remove();
    if (e?.target instanceof Element) {
        e.target.removeEventListener('mousemove', follow_pointer);
    }
    document.removeEventListener('pointermove', onPointerMove);
}


function follow_pointer(e){
    let tip = document.querySelector('#dom_tooltip')
    let bbtarget = bounding_boxes.target
    let bbtip = bounding_boxes.tip
    let mouse_height = e.clientY
    let mouse_width = e.clientX
    let tip_top = e.clientY
    let tip_left = e.clientX
    let window_height = window.innerHeight
    let window_width = window.innerWidth
    let offset_under = 15
    let offset_over = 5
    let quadrant = 'tl'
    if (mouse_height < (window_height / 2) && mouse_width > (window_width / 2)) quadrant = 'tr'
    if (mouse_height > (window_height / 2) && mouse_width < (window_width / 2)) quadrant = 'bl'
    if (mouse_height > (window_height / 2) && mouse_width > (window_width / 2)) quadrant = 'br'
    
    if (quadrant === 'tl'){
        tip_top = mouse_height + offset_under
        tip_left = mouse_width + offset_under
    }
    if (quadrant === 'tr'){
        tip_top = mouse_height + offset_under
        tip_left = mouse_width - bbtip.width - offset_under
    }
    if (quadrant === 'bl'){
        tip_top = mouse_height - bbtip.height - offset_over
        tip_left = mouse_width + offset_over
    }
    if (quadrant === 'br'){
        tip_top = mouse_height - bbtip.height - offset_over
        tip_left = mouse_width - bbtip.width - offset_over
    }

    tip.style['top'] = tip_top + 'px'
    tip.style['left'] = tip_left + 'px'
    
}

let style = `
    #dom_tooltip,
    #dom_tooltip_prerender {
        position: absolute;
        max-width: 50vw;
        max-height: 50vh;
        padding: 2px;
        padding-left: 6px;
        padding-right: 6px;
        font-size: 0.8em;
        border: 1px solid #ccc;
        border-radius: 5px;
        background-color: #f5f5f5;
        opacity: 0;
        transition: opacity 0.15s ease-in-out;
    }

    #dom_tooltip_prerender {
        top: 0;
        left: 0;
    }
    `
function minifyCSS(cssText) {
    return cssText
        .replace(/\s*([{}:;,])\s*/g, '$1')  // remove space around symbols
        .replace(/\s+/g, ' ')               // collapse remaining whitespace
        .replace(/\/\*.*?\*\//g, '')        // remove comments
        .trim();
}

document.querySelector('head').insertAdjacentHTML('beforeend', `<style id="domtooltip">${minifyCSS(style)}</style>`)