// Installed by the host on every load, including pages saved with an older bootstrap.
export function visualViewportScript(methods: { viewportReady: string; viewportChanged: string; scrollRequest: string }): string {
    return `(function () {
var methods = ${JSON.stringify(methods)};
var viewport = null;
var expected = 0;
var touch = null;
var momentum = 0;
var style = document.createElement('style');
document.head.appendChild(style);
function request(value) {
    window.parent.postMessage({ jsonrpc: '2.0', method: methods.scrollRequest, params: value }, '*');
}
function stopMomentum() {
    if (momentum) { cancelAnimationFrame(momentum); momentum = 0; }
}
function apply(top) {
    window.scrollTo({ top: top, left: window.scrollX, behavior: 'instant' });
    expected = window.scrollY;
}
window.addEventListener('message', function (event) {
    var data = event.data;
    if (event.source !== window.parent || !data || data.jsonrpc !== '2.0' || data.method !== methods.viewportChanged) { return; }
    var next = data.params;
    if (next === null) {
        viewport = null;
        style.textContent = '';
        stopMomentum();
        return;
    }
    if (!next || !Number.isFinite(next.top) || next.top < 0 || !Number.isFinite(next.height) || next.height <= 0) { return; }
    if (viewport === null) {
        style.textContent = 'html{overflow-x:auto!important;overflow-y:hidden!important;scroll-behavior:auto!important;overflow-anchor:none!important}';
    }
    viewport = next;
    apply(next.top);
});
function nestedScroll(path, delta, axis) {
    for (var i = 0; i < path.length; i++) {
        var node = path[i];
        if (node === document.body || node === document.documentElement) { break; }
        if (!node || node.nodeType !== 1) { continue; }
        var css = getComputedStyle(node);
        var horizontal = axis === 'x';
        var overflow = horizontal ? css.overflowX : css.overflowY;
        if (!/^(auto|scroll|overlay)$/.test(overflow)) { continue; }
        var end = horizontal ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight;
        if (end <= 1) { continue; }
        var position = horizontal ? node.scrollLeft : node.scrollTop;
        var overscroll = horizontal ? css.overscrollBehaviorX : css.overscrollBehaviorY;
        if (overscroll === 'contain' || overscroll === 'none' || (delta < 0 ? position > 0 : position < end - 1)) { return true; }
    }
    return false;
}
window.addEventListener('wheel', function (event) {
    if (!viewport || !event.isTrusted || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) { return; }
    if (!event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) { return; }
    if (nestedScroll(event.composedPath(), event.deltaY, 'y') || !event.cancelable) { return; }
    event.preventDefault();
    stopMomentum();
    var unit = event.deltaMode === 2 ? viewport.height : event.deltaMode === 1 ? 16 : 1;
    request({ by: event.deltaY * unit });
}, { passive: false });
window.addEventListener('keydown', function (event) {
    if (!viewport || !event.isTrusted || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) { return; }
    var target = event.target;
    if (target && (target.isContentEditable || (typeof target.closest === 'function' && target.closest('input,textarea,select,[role="slider"],[role="spinbutton"],[role="listbox"],[role="combobox"],[role="tree"],[role="grid"],[role="menu"]')))) { return; }
    if (event.key === ' ' && target && typeof target.closest === 'function' && target.closest('button,[role="button"]')) { return; }
    var page = Math.max(40, viewport.height * 0.9);
    var delta = event.key === 'ArrowDown' ? 40 : event.key === 'ArrowUp' ? -40 : event.key === 'PageDown' ? page : event.key === 'PageUp' ? -page : event.key === ' ' ? (event.shiftKey ? -page : page) : 0;
    var edge = event.key === 'Home' ? 'start' : event.key === 'End' ? 'end' : null;
    if ((!delta && !edge) || nestedScroll(event.composedPath(), delta || (edge === 'start' ? -1 : 1), 'y')) { return; }
    event.preventDefault();
    stopMomentum();
    request(edge ? { edge: edge } : { by: delta });
});
window.addEventListener('touchstart', function (event) {
    stopMomentum();
    touch = null;
    if (!viewport || !event.isTrusted || event.touches.length !== 1) { return; }
    var point = event.touches[0];
    touch = { x: point.clientX, y: point.clientY, time: performance.now(), velocity: 0, own: null, path: event.composedPath() };
}, { passive: true });
window.addEventListener('touchmove', function (event) {
    if (!viewport || !touch || event.defaultPrevented || event.touches.length !== 1) { touch = null; return; }
    var point = event.touches[0];
    var delta = touch.y - point.clientY;
    var horizontal = touch.x - point.clientX;
    if (touch.own === null) {
        if (Math.max(Math.abs(delta), Math.abs(horizontal)) < 4) { return; }
        touch.own = Math.abs(delta) >= Math.abs(horizontal) && !nestedScroll(touch.path, delta, 'y');
    }
    if (!touch.own || !event.cancelable) { return; }
    event.preventDefault();
    var now = performance.now();
    touch.velocity = Math.max(-4, Math.min(4, delta / Math.max(1, now - touch.time)));
    touch.x = point.clientX;
    touch.y = point.clientY;
    touch.time = now;
    request({ by: delta });
}, { passive: false });
window.addEventListener('touchend', function () {
    if (!touch) { return; }
    var velocity = touch.own && performance.now() - touch.time < 80 ? touch.velocity : 0;
    touch = null;
    var last = performance.now();
    var tick = function (now) {
        momentum = 0;
        if (!viewport || Math.abs(velocity) < 0.02) { return; }
        var elapsed = Math.min(32, now - last);
        last = now;
        var decay = Math.exp(-elapsed / 180);
        request({ by: velocity * 180 * (1 - decay) });
        velocity *= decay;
        momentum = requestAnimationFrame(tick);
    };
    if (Math.abs(velocity) >= 0.02) { momentum = requestAnimationFrame(tick); }
}, { passive: true });
window.addEventListener('touchcancel', function () { touch = null; stopMomentum(); }, { passive: true });
window.addEventListener('scroll', function () {
    if (!viewport || Math.abs(window.scrollY - expected) < 1) { return; }
    // Focus, fragment links and scrollIntoView can scroll an overflow-hidden document.
    expected = window.scrollY;
    request({ to: expected });
}, { passive: true });
window.parent.postMessage({ jsonrpc: '2.0', method: methods.viewportReady }, '*');
})();`;
}
