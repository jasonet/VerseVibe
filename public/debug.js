const urlParams = new URLSearchParams(window.location.search);
const isMock = urlParams.get('verse-vibe-mock') === '1';
const indicator = document.getElementById('status-indicator');
const consoleEl = document.getElementById('debug-console');

if (isMock) {
    if (indicator) {
        indicator.innerHTML = '<span class="mock-active">Mock 模式已启用</span>';
        indicator.style.color = '#4caf50';
    }
} else {
    if (indicator) {
        indicator.innerHTML = '<span>标准模式 (实际调用 API)</span>';
    }
}

function log(msg) {
    if (!consoleEl) return;
    const div = document.createElement('div');
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    consoleEl.appendChild(div);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

log("Debug page loaded.");
