/**
 * VerseVibe PDF 沉浸式翻译阅读器（混合架构）
 *
 * 插件只做"胶水层"：取字节 → 左栏 pdf.js 原页预览 → POST 到本地服务 → 下载双语 PDF。
 * PDF 的解析 / 翻译 / 重建全部在本地 Python 服务（server/）完成，复用 Gemma pipeline。
 *
 * 由 background 通过 chrome-extension://<id>/pdfreader.html?... 打开：
 * - ?url=<在线PDF>      通过 background fetchPdf（绕 CORS）取字节
 * - ?local=1            显示本地文件选择 / 拖拽区，用 file.arrayBuffer() 读字节
 *
 * 左栏：pdf.js 渲染原页 Canvas（纯前端，不依赖本地服务，可立即看到原文）。
 * 导出：点「翻译并导出双语 PDF」→ POST 字节到 config.pdfServerUrl → 下载返回的 PDF。
 */

import * as pdfjsLib from 'pdfjs-dist';
// pdf.js worker：用 Vite 的 ?url 导入，走官方推荐的 workerSrc（扩展页 CSP 允许同源 worker）。
// @ts-ignore —— ?url 是 Vite 专有后缀，无类型声明
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import browser from 'webextension-polyfill';
import { config, configReady } from '@/entrypoints/utils/config';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const root = document.getElementById('vv-pdf-root') as HTMLElement;

interface ReaderState {
    pdfDoc: pdfjsLib.PDFDocumentProxy | null;
    currentPage: number;
    totalPages: number;
    scale: number;
    /** 原始 PDF 字节，用于 POST 到本地服务（在线/本地两种来源都缓存到这里） */
    sourceBytes: Uint8Array | null;
    sourceName: string;
    exporting: boolean;
    /** 翻译完成后生成的双语 PDF（Blob），供二次下载按钮使用 */
    resultBlob: Blob | null;
    resultName: string;
}

const state: ReaderState = {
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.2,
    sourceBytes: null,
    sourceName: 'document.pdf',
    exporting: false,
    resultBlob: null,
    resultName: 'bilingual.pdf',
};

// ---------- 样式注入 ----------
function injectStyle() {
    const style = document.createElement('style');
    style.textContent = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: #0b0b0c; color: #e8e8ea;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif; }
#vv-pdf-root { height: 100vh; display: flex; flex-direction: column; }

.vv-topbar { display: flex; align-items: center; gap: 10px; padding: 8px 14px;
  background: rgba(20,20,22,.94); border-bottom: 1px solid #232327; flex: 0 0 auto; flex-wrap: wrap; }
.vv-title { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; max-width: 32vw; opacity: .92; }
.vv-spacer { flex: 1 1 auto; }
.vv-btn { appearance: none; border: 1px solid #34343a; background: #1b1b1f; color: #e8e8ea;
  border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer; line-height: 1.2; }
.vv-btn:hover:not(:disabled) { background: #26262c; }
.vv-btn:disabled { opacity: .45; cursor: not-allowed; }
.vv-btn.primary { background: #2b6cb0; border-color: #3b82c4; color: #fff; }
.vv-btn.primary:hover:not(:disabled) { background: #3b82c4; }
.vv-counter { font-size: 13px; opacity: .75; min-width: 64px; text-align: center; }
.vv-progress { font-size: 12px; opacity: .85; }
.vv-progress.err { color: #ff9a9a; opacity: 1; }
.vv-progress.ok { color: #8be9a8; opacity: 1; }

.vv-body { flex: 1 1 auto; display: flex; overflow: hidden; }
.vv-pane { flex: 1 1 50%; overflow: auto; padding: 16px; }
.vv-pane.left { background: #18181b; border-right: 1px solid #232327; display: flex; justify-content: center; }
.vv-pane.right { background: #131316; }
.vv-canvas-wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.vv-page-canvas { box-shadow: 0 6px 24px rgba(0,0,0,.5); background: #fff; max-width: 100%; }

.vv-status-card { max-width: 760px; margin: 0 auto; background: #1d1d21; border: 1px solid #2a2a30;
  border-radius: 10px; padding: 18px 20px; line-height: 1.7; font-size: 14px; }
.vv-status-card h3 { margin: 0 0 10px; font-size: 15px; }
.vv-status-card code { background: #111; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.vv-status-card .hint { opacity: .7; font-size: 13px; margin-top: 10px; }

.vv-dropzone { margin: auto; text-align: center; opacity: .85; padding: 48px 32px;
  border: 2px dashed #3a3a42; border-radius: 16px; max-width: 460px; }
.vv-dropzone.drag { opacity: 1; border-color: #6db3ff; background: rgba(109,179,255,.06); }
.vv-dropzone p { line-height: 1.8; font-size: 14px; }
.vv-dropzone .vv-btn { margin-top: 12px; }

.vv-status-wrap { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px;
  border: 1px solid #34343a; border-radius: 8px; background: #161618; }
.vv-status-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex: 0 0 auto; }
.vv-status-dot.vv-up { background: #4ade80; box-shadow: 0 0 6px #4ade80; }
.vv-status-dot.vv-down { background: #f87171; box-shadow: 0 0 6px #f87171; }
.vv-status-dot.vv-unknown { background: #888; }
.vv-status-label { font-size: 12px; opacity: .9; white-space: nowrap; max-width: 200px;
  overflow: hidden; text-overflow: ellipsis; }
.vv-start-btn { padding: 3px 10px !important; font-size: 12px !important; }
.vv-launch-card { margin-top: 14px; padding: 14px 16px; border: 1px solid #3a3a42; border-radius: 10px;
  background: #161618; font-size: 13px; line-height: 1.7; }
.vv-launch-card code { background: #111; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.vv-launch-card .vv-step { margin: 6px 0; }
.vv-launch-card .vv-num { display: inline-block; width: 18px; height: 18px; border-radius: 50%;
  background: #2b6cb0; color: #fff; text-align: center; line-height: 18px; font-size: 11px; margin-right: 6px; }

/* 翻译结果双语对照卡片 */
.vv-tran-list { display: flex; flex-direction: column; gap: 10px; max-width: 760px; margin: 0 auto; }
.vv-tran-pagehead { font-size: 12px; opacity: .5; margin: 6px 0 2px; padding-left: 2px; letter-spacing: .5px; }
.vv-tran-card { background: #1d1d21; border: 1px solid #2a2a30; border-radius: 10px; padding: 11px 14px; }
.vv-tran-card.vv-tran-card-fail { border-color: #5a3a3a; }
.vv-tran-card .vv-orig { font-size: 13px; opacity: .55; line-height: 1.5; margin-bottom: 7px;
  border-left: 2px solid #3a3a42; padding-left: 10px; }
.vv-tran-card .vv-trans { font-size: 15px; line-height: 1.7; color: #eaf2ff; }
.vv-tran-card.vv-tran-card-fail .vv-trans { color: #ffb0b0; }
`;
    document.head.appendChild(style);
}

// ---------- UI 构建 ----------
function buildShell() {
    root.innerHTML = '';

    const topbar = document.createElement('div');
    topbar.className = 'vv-topbar';

    const title = document.createElement('div');
    title.className = 'vv-title';
    title.textContent = 'PDF 沉浸式翻译';

    const prev = mkBtn('‹ 上一页', () => goTo(state.currentPage - 1));
    const counter = document.createElement('span');
    counter.className = 'vv-counter';
    const next = mkBtn('下一页 ›', () => goTo(state.currentPage + 1));

    const spacer = document.createElement('div');
    spacer.className = 'vv-spacer';

    const progress = document.createElement('span');
    progress.className = 'vv-progress';

    // 服务状态指示灯（绿=运行中 / 红=未运行）+ 启动按钮
    const statusWrap = document.createElement('div');
    statusWrap.className = 'vv-status-wrap';
    const statusDot = document.createElement('span');
    statusDot.className = 'vv-status-dot vv-unknown';
    statusDot.title = '检测本地服务状态…';
    const statusLabel = document.createElement('span');
    statusLabel.className = 'vv-status-label';
    statusLabel.textContent = '检测中…';
    const startBtn = mkBtn('▶ 启动服务', () => downloadLauncher());
    startBtn.classList.add('vv-start-btn');
    startBtn.style.display = 'none';
    statusWrap.append(statusDot, statusLabel, startBtn);

    const openLocal = mkBtn('📂 打开本地 PDF', () => pickLocalFile());
    const exportBtn = mkBtn('🌐 翻译', () => exportBilingual());
    exportBtn.classList.add('primary');
    // 二次下载按钮：翻译完成后才可用
    const downloadBtn = mkBtn('⬇ 下载双语 PDF', () => downloadResult());
    downloadBtn.disabled = true;

    topbar.append(title, prev, counter, next, spacer, progress, statusWrap, openLocal, exportBtn, downloadBtn);
    root.appendChild(topbar);

    const body = document.createElement('div');
    body.className = 'vv-body';
    const left = document.createElement('div');
    left.className = 'vv-pane left';
    const right = document.createElement('div');
    right.className = 'vv-pane right';
    body.append(left, right);
    root.appendChild(body);

    return { title, counter, progress, left, right, prev, next, exportBtn, downloadBtn, statusDot, statusLabel, startBtn };
}

function mkBtn(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'vv-btn';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
}

const ui = buildShell();

// ---------- 本地文件入口 ----------
function renderDropzone() {
    ui.left.innerHTML = '';
    const dz = document.createElement('div');
    dz.className = 'vv-dropzone';
    dz.innerHTML = `
      <p><strong>选择或拖入 PDF 文件</strong></p>
      <p class="hint" style="opacity:.55;font-size:12px;margin-top:14px">本地 PDF 在浏览器内解析预览，不会上传。<br/>导出双语 PDF 时才把字节发给本地翻译服务。</p>
    `;
    const btn = mkBtn('选择 PDF 文件', () => pickLocalFile());
    btn.classList.add('primary');
    dz.appendChild(btn);

    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('drag');
        const f = e.dataTransfer?.files?.[0];
        if (f && /\.pdf$/i.test(f.name)) loadFile(f);
    });
    ui.left.appendChild(dz);

    renderStatusHelp();
}

function pickLocalFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,application/pdf';
    input.addEventListener('change', () => {
        const f = input.files?.[0];
        if (f) loadFile(f);
    });
    input.click();
}

async function loadFile(file: File) {
    const buf = await file.arrayBuffer();
    // 缓存字节供导出用（独立一份，pdf.js 会 detach 它收到的 buffer）
    state.sourceBytes = new Uint8Array(buf);
    state.sourceName = file.name;
    ui.title.textContent = file.name;
    await loadPdf(new Uint8Array(state.sourceBytes));
}

// ---------- 在线 URL：经 background 取字节（绕跨域 CORS） ----------
async function loadFromUrl(url: string) {
    setProgress('正在下载 PDF…');
    const result = await browser.runtime.sendMessage({ type: 'fetchPdf', url }) as
        { success: boolean; reason?: string; dataUrl?: string };
    if (!result || !result.success) {
        throw new Error(`下载失败: ${result?.reason || '未知错误'}`);
    }
    const buf = await fetch(result.dataUrl!).then((r) => r.arrayBuffer());
    // 缓存字节供导出用 —— 必须在交给 pdf.js 之前拷贝一份独立的，
    // 否则 pdf.js 会把底层 ArrayBuffer transfer 到 worker，导出时读到的是空 buffer。
    state.sourceBytes = new Uint8Array(buf);
    state.sourceName = decodeFilename(url);
    ui.title.textContent = state.sourceName;
    await loadPdf(new Uint8Array(state.sourceBytes));
}

function decodeFilename(url: string): string {
    try {
        const u = new URL(url);
        const seg = u.pathname.split('/').filter(Boolean).pop() || u.hostname;
        return decodeURIComponent(seg);
    } catch {
        return url.split('/').pop() || url;
    }
}

// ---------- pdf.js 加载与渲染（仅预览，纯前端） ----------
// 注意：pdf.js 会 transfer/detach 传入的 Uint8Array 底层 buffer，
// 所以这里接收的 data 必须是一份「用完即弃」的拷贝，不能复用 state.sourceBytes 本体。
async function loadPdf(data: Uint8Array) {
    setProgress('正在解析 PDF…');
    const doc = await pdfjsLib.getDocument({ data }).promise;
    state.pdfDoc = doc;
    state.totalPages = doc.numPages;
    state.currentPage = 1;
    updateCounter();
    await renderPage(1);
    setProgress(`共 ${doc.numPages} 页 · 点右上「翻译并导出」生成双语 PDF`);
    renderStatusHelp();
}

async function renderPage(pageNum: number) {
    if (!state.pdfDoc) return;
    const page = await state.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: state.scale });
    ui.left.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'vv-canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.className = 'vv-page-canvas';
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    wrap.appendChild(canvas);
    ui.left.appendChild(wrap);

    // pdf.js v6：推荐只传 canvas + viewport（内部自取 2d context）
    const renderTask = page.render({ canvas, viewport });
    await renderTask.promise;
}

// ---------- 服务状态检测（顶栏指示灯 + 定时刷新） ----------
let statusCheckTimer: number | null = null;
async function checkServerStatus(): Promise<boolean> {
    const serverUrl = ((config as any).pdfServerUrl || 'http://127.0.0.1:8765').replace(/\/+$/, '');
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const resp = await fetch(`${serverUrl}/health`, { signal: ctrl.signal });
        clearTimeout(timer);
        if (resp.ok) {
            const info = await resp.json().catch(() => ({}));
            setStatusUI(true, info?.backend ? `运行中·${info.backend}` : '运行中');
            return true;
        }
        setStatusUI(false, `服务返回 ${resp.status}`);
        return false;
    } catch {
        setStatusUI(false, '未运行');
        return false;
    }
}

function setStatusUI(up: boolean, label: string) {
    ui.statusDot.classList.remove('vv-up', 'vv-down', 'vv-unknown');
    ui.statusDot.classList.add(up ? 'vv-up' : 'vv-down');
    ui.statusLabel.textContent = label;
    ui.statusDot.title = label;
    ui.startBtn.style.display = up ? 'none' : '';
    ui.exportBtn.disabled = !up;
    ui.exportBtn.title = up ? '' : '本地服务未运行，请先启动';
}

function startStatusPolling() {
    if (statusCheckTimer !== null) return;
    checkServerStatus();
    // 每 5 秒刷新一次状态（用户启动服务后会自动变绿）
    statusCheckTimer = window.setInterval(checkServerStatus, 5000);
}

// ---------- 启动服务（生成并下载 .command 启动器，用户双击运行）----------
// 浏览器扩展无法直接拉起进程，这里生成一个双击即用的 macOS .command 文件供下载。
function downloadLauncher() {
    const launcher = `#!/bin/bash
# VerseVibe PDF 翻译服务启动器（自动生成）—— 双击运行
# 放到仓库 server/ 目录下，或任意位置都可（会 cd 到自身目录）。
set -e
cd "$(dirname "$0")"

# 优先 ServBay Python（其 libexpat 与 Python 匹配；Homebrew 的可能冲突）
PY=""
for cand in "/Applications/ServBay/package/python/3.13/current/bin/python3" \\
            "/Applications/ServBay/package/python/3.13/3.13.11/bin/python3.13" \\
            /Applications/ServBay/package/python/*/3.*/bin/python3.* ; do
  if [ -x "$cand" ] && "$cand" -c "from xml.parsers import expat" 2>/dev/null; then PY="$cand"; break; fi
done
if [ -z "$PY" ] && command -v python3 >/dev/null 2>&1 && python3 -c "from xml.parsers import expat" 2>/dev/null; then
  PY="python3"
fi
if [ -z "$PY" ]; then
  echo "未找到可用的 Python 3（需 expat 正常）。若用 ServBay，确认已装其 Python 包。"
  read -p "按回车关闭…" _; exit 1
fi

echo "使用 Python: $PY"; "$PY" --version
if ! "$PY" -c "import fitz, reportlab, flask, flask_cors, requests" 2>/dev/null; then
  echo "首次运行，安装依赖…"
  "$PY" -m pip install -r requirements.txt 2>/dev/null || "$PY" -m pip install PyMuPDF reportlab flask flask-cors requests
fi
echo "启动服务 http://127.0.0.1:8765 （关闭此窗口停止）"
exec "$PY" server.py
`;
    const blob = new Blob([launcher], { type: 'application/x-shellscript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'start_pdf_server.command';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showLauncherGuide();
}

function showLauncherGuide() {
    // 在右栏显示启动步骤指引
    const existing = ui.right.querySelector('.vv-launch-card');
    if (existing) return;
    const card = document.createElement('div');
    card.className = 'vv-launch-card';
    card.innerHTML = `
      <strong>启动本地翻译服务</strong>
      <div class="vv-step"><span class="vv-num">1</span>已下载启动器 <code>start_pdf_server.command</code>（在下载文件夹）</div>
      <div class="vv-step"><span class="vv-num">2</span>把它放到本仓库的 <code>server/</code> 目录（与 server.py 同级）</div>
      <div class="vv-step"><span class="vv-num">3</span>双击运行（首次可能需右键 → 打开，绕过 macOS 门禁）</div>
      <div class="vv-step"><span class="vv-num">4</span>终端出现 <code>Running on http://127.0.0.1:8765</code> 即启动成功</div>
      <div class="vv-step">↑ 顶栏指示灯变绿后，即可点「翻译并导出双语 PDF」。</div>
      <div class="hint" style="margin-top:8px;opacity:.6;font-size:12px">提示：仓库已自带 <code>server/start.command</code>，可直接双击那个文件。</div>
    `;
    ui.right.appendChild(card);
}

// ---------- 右栏：帮助 / 状态 ----------
function renderStatusHelp() {
    ui.right.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'vv-status-card';
    const serverUrl = (config as any).pdfServerUrl || 'http://127.0.0.1:8765';
    card.innerHTML = `
      <h3>混合架构 · 本地服务导出</h3>
      <p>左栏是原页预览（pdf.js 渲染）。点击右上 <strong>「翻译并导出双语 PDF」</strong>，
      会把 PDF 发给本地服务处理（解析 + 翻译 + 重建左右双语 PDF），完成后自动下载。</p>
      <p>本地服务地址：<code>${escapeHtml(serverUrl)}</code></p>
      <p class="hint">顶栏指示灯显示服务状态。未运行时点 <strong>「▶ 启动服务」</strong> 下载启动器。<br/>
      大文档翻译可能需要几分钟（每段一次模型请求）。</p>
    `;
    ui.right.appendChild(card);
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// ---------- 翻译并在右侧实时显示，生成 PDF 供二次下载 ----------
interface TranParagraph { orig: string; translated: string; ok: boolean; }
interface TranPage { page_index: number; paragraphs: TranParagraph[]; }
interface TranslateResult {
    pages: TranPage[];
    pdf_base64: string;
    filename: string;
    total_paragraphs: number;
    failed: number;
}

async function exportBilingual() {
    if (state.exporting) return;
    if (!state.sourceBytes || state.sourceBytes.byteLength === 0) {
        setProgressErr('PDF 数据为空，请重新打开文件（可能因切换页面后数据失效）');
        return;
    }
    state.exporting = true;
    ui.exportBtn.disabled = true;
    ui.downloadBtn.disabled = true;
    setProgress('正在上传并翻译…（大文档可能数分钟）');
    renderRightLoading();

    const serverUrl = ((config as any).pdfServerUrl || 'http://127.0.0.1:8765').replace(/\/+$/, '');
    const minFontSize = (config as any).minFontSize ?? 8.0;

    const form = new FormData();
    form.append('file', new Blob([state.sourceBytes as BlobPart], { type: 'application/pdf' }), state.sourceName);
    const modelName = (config as any).model?.[config.service] || 'gemma-4-26B-A4B-it-ultra-uncensored-heretic-Q4_K_S.gguf';
    form.append('model', modelName);
    form.append('target_lang', config.to || 'zh-Hans');
    form.append('min_cjk_font_size', String(minFontSize));

    try {
        let resp: Response;
        try {
            resp = await fetch(`${serverUrl}/translate`, { method: 'POST', body: form });
        } catch {
            setProgressErr(`无法连接本地服务，请确认 server.py 正在运行（${serverUrl}）`);
            renderStatusHelp();
            return;
        }
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: resp.statusText }));
            setProgressErr(`翻译失败：${(err as any).error || resp.statusText}`);
            renderStatusHelp();
            return;
        }
        const result = (await resp.json()) as TranslateResult;
        // 缓存生成的双语 PDF（base64 → Blob），供「下载」按钮
        state.resultBlob = base64ToBlob(result.pdf_base64, 'application/pdf');
        state.resultName = result.filename || (state.sourceName.replace(/\.pdf$/i, '') + '_双语.pdf');
        // 右侧实时展示双语对照
        renderTranslationResult(result);
        const okMsg = result.failed > 0
            ? `✓ 翻译完成（${result.total_paragraphs} 段，${result.failed} 段失败已回退原文）`
            : `✓ 翻译完成（${result.total_paragraphs} 段）`;
        setProgressOk(okMsg + ' · 可点「⬇ 下载双语 PDF」');
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setProgressErr(`翻译失败：${msg}`);
        console.error('[pdfreader] 翻译失败', e);
        renderStatusHelp();
    } finally {
        state.exporting = false;
        ui.exportBtn.disabled = false;
        ui.downloadBtn.disabled = !state.resultBlob;
    }
}

/** 二次下载：把已生成的双语 PDF 落地到本地 */
async function downloadResult() {
    if (!state.resultBlob) return;
    const url = URL.createObjectURL(state.resultBlob);
    try {
        await browser.downloads.download({ url, filename: state.resultName, saveAs: true });
    } catch {
        const a = document.createElement('a');
        a.href = url;
        a.download = state.resultName;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    setProgressOk('已开始下载双语 PDF');
}

function base64ToBlob(b64: string, type: string): Blob {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes as BlobPart], { type });
}

function renderRightLoading() {
    ui.right.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'vv-status-card';
    card.innerHTML = `<h3>正在翻译…</h3><p>已把 PDF 发给本地服务处理。完成后这里会显示左右双语对照，
      并可点「⬇ 下载双语 PDF」保存。</p><p class="hint">大文档每段一次模型请求，可能数分钟。</p>`;
    ui.right.appendChild(card);
}

function renderTranslationResult(result: TranslateResult) {
    ui.right.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'vv-tran-list';
    let totalShown = 0;
    result.pages.forEach((page) => {
        if (!page.paragraphs.length) return;
        const pageHead = document.createElement('div');
        pageHead.className = 'vv-tran-pagehead';
        pageHead.textContent = `第 ${page.page_index} 页`;
        list.appendChild(pageHead);
        page.paragraphs.forEach((p) => {
            const card = document.createElement('div');
            card.className = 'vv-tran-card' + (p.ok ? '' : ' vv-tran-card-fail');
            const orig = document.createElement('div');
            orig.className = 'vv-orig';
            orig.textContent = p.orig;
            const trans = document.createElement('div');
            trans.className = 'vv-trans';
            trans.textContent = p.translated || '（无译文）';
            card.append(orig, trans);
            list.appendChild(card);
            totalShown++;
        });
    });
    if (totalShown === 0) {
        const empty = document.createElement('div');
        empty.className = 'vv-status-card';
        empty.innerHTML = `<p>未提取到可翻译的文本（可能是扫描版 / 纯图片 PDF）。</p>`;
        ui.right.appendChild(empty);
        return;
    }
    ui.right.appendChild(list);
}

// ---------- 导航 ----------
async function goTo(pageNum: number) {
    if (!state.pdfDoc) return;
    const p = Math.max(1, Math.min(state.totalPages, pageNum));
    if (p === state.currentPage) return;
    state.currentPage = p;
    updateCounter();
    await renderPage(p);
    setProgress(`第 ${p}/${state.totalPages} 页`);
}

function updateCounter() {
    ui.counter.textContent = state.totalPages ? `${state.currentPage} / ${state.totalPages}` : '';
    ui.prev.disabled = state.currentPage <= 1;
    ui.next.disabled = state.currentPage >= state.totalPages;
}

function setProgress(text: string) {
    ui.progress.textContent = text;
    ui.progress.classList.remove('err', 'ok');
}
function setProgressErr(text: string) {
    ui.progress.textContent = text;
    ui.progress.classList.add('err');
    ui.progress.classList.remove('ok');
}
function setProgressOk(text: string) {
    ui.progress.textContent = text;
    ui.progress.classList.add('ok');
    ui.progress.classList.remove('err');
}

// ---------- 初始化 ----------
async function init() {
    injectStyle();
    await configReady;
    const params = new URLSearchParams(location.search);

    // 无论哪种模式，都启动服务状态轮询（顶栏指示灯 + 启动按钮）
    startStatusPolling();

    if (params.get('local') === '1') {
        renderDropzone();
        setProgress('请选择本地 PDF 文件');
        return;
    }
    const url = params.get('url');
    if (url) {
        try {
            await loadFromUrl(url);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            renderDropzone();
            setProgressErr(`加载失败：${msg}`);
        }
        return;
    }
    renderDropzone();
}

init();
