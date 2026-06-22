/**
 * VerseVibe 全屏看图页（方案 C）
 * 由 LinkedIn 弹层内的「⤢ 全屏看图」按钮触发：
 * content script 把该帖的图片/正文/原帖链接写入 storage.local，并新开本页面。
 * 本页面读取数据，在自有的、完全可控的深色全屏布局里最大化呈现图片，
 * 支持多图切换、滚轮缩放、拖拽平移、键盘操作。完全不依赖 LinkedIn 的 DOM。
 */

interface ViewerPayload {
    title?: string;
    text?: string;
    url?: string;
    images: string[];
}

const root = document.getElementById('vv-viewer-root') as HTMLElement;

function injectStyle() {
    const style = document.createElement('style');
    style.textContent = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: #0b0b0c; color: #e8e8ea;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif; }
#vv-viewer-root { height: 100vh; display: flex; flex-direction: column; }

.vv-topbar { display: flex; align-items: center; gap: 12px; padding: 10px 16px;
  background: rgba(20,20,22,.92); border-bottom: 1px solid #232327; flex: 0 0 auto; }
.vv-title { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; max-width: 46vw; opacity: .92; }
.vv-counter { font-size: 13px; opacity: .7; min-width: 56px; }
.vv-spacer { flex: 1 1 auto; }
.vv-btn { appearance: none; border: 1px solid #34343a; background: #1b1b1f; color: #e8e8ea;
  border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer; line-height: 1; }
.vv-btn:hover { background: #26262c; }
.vv-link { color: #6db3ff; text-decoration: none; font-size: 13px; }
.vv-link:hover { text-decoration: underline; }

.vv-stage { position: relative; flex: 1 1 auto; overflow: hidden; display: flex;
  align-items: center; justify-content: center; background:
  repeating-conic-gradient(#101012 0% 25%, #0b0b0c 0% 50%) 50% / 28px 28px; }
.vv-img { max-width: 100%; max-height: 100%; user-select: none; -webkit-user-drag: none;
  transform-origin: center center; transition: transform .04s linear;
  will-change: transform; cursor: grab; }
.vv-img.dragging { cursor: grabbing; transition: none; }

.vv-nav { position: absolute; top: 50%; transform: translateY(-50%); z-index: 5;
  width: 46px; height: 72px; border: none; border-radius: 10px; cursor: pointer;
  background: rgba(0,0,0,.42); color: #fff; font-size: 26px; line-height: 1; }
.vv-nav:hover { background: rgba(0,0,0,.66); }
.vv-prev { left: 14px; } .vv-next { right: 14px; }
.vv-zoomhint { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%);
  z-index: 5; font-size: 12px; opacity: .55; background: rgba(0,0,0,.4);
  padding: 4px 10px; border-radius: 999px; white-space: nowrap; }

.vv-thumbs { flex: 0 0 auto; display: flex; gap: 8px; padding: 8px 12px; overflow-x: auto;
  background: rgba(18,18,20,.92); border-top: 1px solid #232327; }
.vv-thumb { flex: 0 0 auto; width: 72px; height: 54px; object-fit: cover; border-radius: 6px;
  cursor: pointer; opacity: .55; border: 2px solid transparent; background: #000; }
.vv-thumb:hover { opacity: .85; }
.vv-thumb.active { opacity: 1; border-color: #6db3ff; }

.vv-textpanel { position: absolute; right: 0; top: 0; bottom: 0; width: min(420px, 84vw);
  background: rgba(16,16,18,.97); border-left: 1px solid #2a2a30; padding: 18px 20px;
  overflow-y: auto; transform: translateX(100%); transition: transform .22s ease; z-index: 8; }
.vv-textpanel.open { transform: translateX(0); }
.vv-textpanel h3 { margin: 0 0 10px; font-size: 14px; opacity: .7; font-weight: 600; }
.vv-textpanel .vv-body { white-space: pre-wrap; line-height: 1.6; font-size: 15px; }

.vv-empty { margin: auto; opacity: .6; font-size: 15px; text-align: center; line-height: 1.8; }
`;
    document.head.appendChild(style);
}

function buildUI(payload: ViewerPayload) {
    const images = (payload.images || []).filter(Boolean);
    let idx = 0;
    let scale = 1;
    let tx = 0;
    let ty = 0;

    root.innerHTML = '';

    // ---- 顶栏 ----
    const topbar = document.createElement('div');
    topbar.className = 'vv-topbar';
    const title = document.createElement('div');
    title.className = 'vv-title';
    title.textContent = payload.title || 'LinkedIn 帖子';
    const counter = document.createElement('div');
    counter.className = 'vv-counter';
    const spacer = document.createElement('div');
    spacer.className = 'vv-spacer';

    const textBtn = document.createElement('button');
    textBtn.className = 'vv-btn';
    textBtn.textContent = '正文';
    const origLink = document.createElement('a');
    origLink.className = 'vv-link';
    origLink.textContent = '看原帖 ↗';
    origLink.target = '_blank';
    origLink.rel = 'noopener noreferrer';
    origLink.href = payload.url || '#';
    if (!payload.url) origLink.style.display = 'none';

    topbar.append(title, spacer, counter, textBtn, origLink);
    root.appendChild(topbar);

    // ---- 舞台 ----
    const stage = document.createElement('div');
    stage.className = 'vv-stage';
    root.appendChild(stage);

    if (!images.length) {
        const empty = document.createElement('div');
        empty.className = 'vv-empty';
        empty.textContent = '没有抓到可显示的图片。\n可点右上「看原帖」回到 LinkedIn 查看。';
        stage.appendChild(empty);
        counter.textContent = '0 / 0';
        textBtn.style.display = payload.text ? '' : 'none';
        wireTextPanel();
        return;
    }

    const img = document.createElement('img');
    img.className = 'vv-img';
    img.draggable = false;
    stage.appendChild(img);

    const prev = document.createElement('button');
    prev.className = 'vv-nav vv-prev';
    prev.textContent = '‹';
    const next = document.createElement('button');
    next.className = 'vv-nav vv-next';
    next.textContent = '›';
    stage.append(prev, next);

    const hint = document.createElement('div');
    hint.className = 'vv-zoomhint';
    hint.textContent = '滚轮缩放 · 拖拽平移 · 双击复位 · ← → 切换';
    stage.appendChild(hint);

    // ---- 缩略图条 ----
    const thumbs = document.createElement('div');
    thumbs.className = 'vv-thumbs';
    const thumbEls: HTMLImageElement[] = [];
    images.forEach((src, i) => {
        const t = document.createElement('img');
        t.className = 'vv-thumb';
        t.src = src;
        t.addEventListener('click', () => go(i));
        thumbs.appendChild(t);
        thumbEls.push(t);
    });
    if (images.length > 1) root.appendChild(thumbs);

    function applyTransform() {
        img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }
    function resetView() {
        scale = 1; tx = 0; ty = 0; applyTransform();
    }
    function render() {
        img.src = images[idx];
        counter.textContent = `${idx + 1} / ${images.length}`;
        prev.style.visibility = images.length > 1 ? 'visible' : 'hidden';
        next.style.visibility = images.length > 1 ? 'visible' : 'hidden';
        thumbEls.forEach((t, i) => t.classList.toggle('active', i === idx));
        const active = thumbEls[idx];
        if (active) active.scrollIntoView({ block: 'nearest', inline: 'center' });
        resetView();
    }
    function go(i: number) {
        idx = (i + images.length) % images.length;
        render();
    }

    prev.addEventListener('click', () => go(idx - 1));
    next.addEventListener('click', () => go(idx + 1));

    // 滚轮缩放（以光标为中心）
    stage.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = img.getBoundingClientRect();
        const cx = e.clientX - (rect.left + rect.width / 2);
        const cy = e.clientY - (rect.top + rect.height / 2);
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const newScale = Math.min(8, Math.max(1, scale * factor));
        const ratio = newScale / scale;
        // 让缩放围绕光标位置
        tx = (tx - cx) * ratio + cx;
        ty = (ty - cy) * ratio + cy;
        scale = newScale;
        if (scale === 1) { tx = 0; ty = 0; }
        applyTransform();
    }, { passive: false });

    // 拖拽平移
    let dragging = false;
    let sx = 0, sy = 0, stx = 0, sty = 0;
    img.addEventListener('pointerdown', (e) => {
        if (scale <= 1) return;
        dragging = true; img.classList.add('dragging');
        sx = e.clientX; sy = e.clientY; stx = tx; sty = ty;
        img.setPointerCapture(e.pointerId);
    });
    img.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        tx = stx + (e.clientX - sx);
        ty = sty + (e.clientY - sy);
        applyTransform();
    });
    const endDrag = () => { dragging = false; img.classList.remove('dragging'); };
    img.addEventListener('pointerup', endDrag);
    img.addEventListener('pointercancel', endDrag);
    img.addEventListener('dblclick', resetView);

    // 键盘
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') go(idx - 1);
        else if (e.key === 'ArrowRight') go(idx + 1);
        else if (e.key === '0') resetView();
        else if (e.key === 'Escape') window.close();
    });

    wireTextPanel();
    render();

    function wireTextPanel() {
        const panel = document.createElement('div');
        panel.className = 'vv-textpanel';
        const h = document.createElement('h3');
        h.textContent = '帖子正文';
        const body = document.createElement('div');
        body.className = 'vv-body';
        body.textContent = payload.text || '（未抓取到正文）';
        panel.append(h, body);
        root.appendChild(panel);
        textBtn.addEventListener('click', () => panel.classList.toggle('open'));
        if (!payload.text) textBtn.style.opacity = '.5';
    }
}

async function init() {
    injectStyle();
    const params = new URLSearchParams(location.search);
    const key = params.get('k') || '';
    let payload: ViewerPayload = { images: [] };
    if (key) {
        try {
            const data = await browser.storage.local.get(key);
            if (data && data[key]) payload = data[key] as ViewerPayload;
            // 读取后清理，避免 storage 堆积
            await browser.storage.local.remove(key);
        } catch (e) {
            console.warn('[VerseVibe viewer] 读取数据失败', e);
        }
    }
    if (payload.title) document.title = `VerseVibe · ${payload.title}`;
    buildUI(payload);
}

init();
