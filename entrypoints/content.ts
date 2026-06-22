// ⚠️ 必须放在所有会引入 Vue 的 import 之前：在 Vue 模块求值前隐藏 trustedTypes，
// 避免 GitHub 等严格 Trusted Types 站点报 "Creating a TrustedTypePolicy named 'vue'" CSP 违规。
import "@/entrypoints/utils/disableTrustedTypes";
import { handleTranslation, autoTranslateEnglishPage, restoreOriginalContent, restyleExistingTranslations } from "./main/trans";
import { cache } from "./utils/cache";
import { constants } from "@/entrypoints/utils/constant";
import { getCenterPoint } from "@/entrypoints/utils/common";
import './style.css';
import { config, configReady } from "@/entrypoints/utils/config";
import { storage } from "@wxt-dev/storage";
import { mountFloatingBall, unmountFloatingBall, toggleFloatingBallPosition } from "@/entrypoints/utils/floatingBall";
import { mountSelectionTranslator, unmountSelectionTranslator } from "@/entrypoints/utils/selectionTranslator";
import { cancelAllTranslations, translateText } from "@/entrypoints/utils/translateApi";
import { createApp } from 'vue';
import TranslationStatus from '@/components/TranslationStatus.vue';
import { mountNewApiComponent } from "@/entrypoints/utils/newApi";
import { mountVueWithTrustedTypesBypass } from "@/entrypoints/utils/trustedTypes";

const LINKEDIN_WIDE_STYLE_ID = 'versevibe-linkedin-wide-style';
const LINKEDIN_WIDE_CLASS = 'versevibe-linkedin-wide';
const LINKEDIN_WIDE_INLINE_ATTR = 'data-versevibe-linkedin-wide-inline';
const LINKEDIN_POST_TEXT_ZOOM_STYLE_ID = 'versevibe-linkedin-post-text-zoom-style';
const LINKEDIN_POST_TEXT_ZOOM_CLASS = 'versevibe-linkedin-post-text-zoom';
const LINKEDIN_PROMOTED_PROCESSED_ATTR = 'data-versevibe-promoted-checked';
const LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS = 'versevibe-linkedin-promoted-hide-scope';
const LINKEDIN_PROMOTED_HIDE_STYLE_ID = 'versevibe-linkedin-promoted-hide-style';
const LINKEDIN_PROMOTED_HIDDEN_POST_ATTR = 'data-versevibe-promoted-hidden';
const LINKEDIN_PROMOTED_MARKER_ATTR = 'data-versevibe-promoted-marker';
const LINKEDIN_PROMOTED_MARKER_CLASS = 'versevibe-promoted-marker';
const LINKEDIN_PROMOTED_MARKER_TEXT = '此处省略一行';
const LINKEDIN_DIALOG_MINIMAL_CLASS = 'versevibe-linkedin-dialog-minimal';
const LINKEDIN_DIALOG_MINIMAL_STYLE_ID = 'versevibe-linkedin-dialog-minimal-style';
const LINKEDIN_DIALOG_FULLSCREEN_CLASS = 'versevibe-linkedin-dialog-fullscreen';
const LINKEDIN_DIALOG_FULLSCREEN_STYLE_ID = 'versevibe-linkedin-dialog-fullscreen-style';
const LINKEDIN_DIALOG_FULLSCREEN_MARK_ATTR = 'data-vv-ld-fullscreen';
// 标记“最大图片 → 浮层根”这条真实祖先链，用于逐层解除宽高上限/裁切。
const LINKEDIN_MEDIA_MARK_ATTR = 'data-vv-ld-media';
// 方案 C：弹层内「全屏看图」浮动按钮
const LINKEDIN_VIEWER_BTN_ID = 'versevibe-linkedin-viewer-btn';
let linkedinWideRouteTimer: number | null = null;
let linkedinPromotedObserver: MutationObserver | null = null;
let linkedinPromotedTimer: number | null = null;
let linkedinDialogGuardBound = false;
let linkedinDialogGuardHandler: ((event: MouseEvent) => void) | null = null;
let linkedinDialogFullscreenObserver: MutationObserver | null = null;
let linkedinDialogFullscreenSyncTimer: number | null = null;

// ===== GitHub 仓库首页：README 横排到文件列表左侧（左栏 2 行 → 2 列）=====
const GITHUB_README_LEFT_STYLE_ID = 'versevibe-github-readme-left-style';
const GITHUB_README_LEFT_CLASS = 'versevibe-github-readme-left';
const GITHUB_README_ATTR = 'data-vv-gh-readme';   // README 区外框
const GITHUB_FILES_ATTR = 'data-vv-gh-files';     // 文件表格区
const GITHUB_FULLWIDTH_ATTR = 'data-vv-gh-fullwidth'; // 页面布局容器去掉 max-width，整页 100% 自适应
const GITHUB_ORIG_WIDTH_ATTR = 'data-vv-gh-ow';        // 记录 Primer Content 原始 data-width，便于复原
let githubRouteTimer: number | null = null;
let githubObserver: MutationObserver | null = null;
let githubSyncTimer: number | null = null;

// ===== Reddit 评论页：左侧正文贴列阅读优化（放大正文字号）=====
const REDDIT_MAIN_ATTR = 'data-vv-reddit-main';   // 左侧正文贴列容器标记
const REDDIT_ORIG_FS_ATTR = 'data-vv-reddit-orig'; // 记录文本元素原始字号（px），避免反复放大抖动
let redditRouteTimer: number | null = null;
let redditObserver: MutationObserver | null = null;
let redditSyncTimer: number | null = null;

function isLinkedinWidePath(pathname: string): boolean {
    return pathname.startsWith('/feed') || pathname.startsWith('/posts');
}

function isLinkedinFeedPath(pathname: string): boolean {
    // 仅把 Feed 列表页视为“可自动隐藏推广图”的页面；
    // /feed/update/... 属于帖子详情弹层/详情页，不能隐藏媒体。
    return /^\/feed\/?$/.test(pathname);
}

function isLinkedinPostDetailPath(pathname: string): boolean {
    return pathname.startsWith('/posts/') || pathname.startsWith('/pulse/');
}

function getLinkedinWideScaleVars(scale: string): { width: string; gap: string } {
    switch (scale) {
        case '1.5x':
            return { width: 'min(calc(1128px * 1.5), calc(100vw - 24px))', gap: '22px' };
        case '3x':
            return { width: 'min(calc(1128px * 3), calc(100vw - 12px))', gap: '16px' };
        case 'full':
            return { width: 'calc(100vw - 8px)', gap: '12px' };
        case '2x':
        default:
            return { width: 'min(calc(1128px * 2), calc(100vw - 24px))', gap: '20px' };
    }
}

function ensureLinkedinWideStyle(scale: string) {
    const styleVars = getLinkedinWideScaleVars(scale);
    const cssText = `
@media (min-width: 1024px) {
  html.${LINKEDIN_WIDE_CLASS} body main > div:first-child,
  html.${LINKEDIN_WIDE_CLASS} body [class*="application-outlet"],
  html.${LINKEDIN_WIDE_CLASS} body [class*="scaffold-layout-container"] {
    max-width: ${styleVars.width} !important;
    width: ${styleVars.width} !important;
  }

  html.${LINKEDIN_WIDE_CLASS} body .scaffold-layout,
  html.${LINKEDIN_WIDE_CLASS} body [class*="scaffold-layout"] {
    --scaffold-layout-main-column-width: minmax(0, 1fr) !important;
    --scaffold-layout-main-column-max-width: 1fr !important;
    --scaffold-layout-main-column-min-width: 0 !important;
    column-gap: ${styleVars.gap} !important;
  }

  html.${LINKEDIN_WIDE_CLASS} body .scaffold-layout__main,
  html.${LINKEDIN_WIDE_CLASS} body [class*="scaffold-layout__main"],
  html.${LINKEDIN_WIDE_CLASS} body .scaffold-finite-scroll__content,
  html.${LINKEDIN_WIDE_CLASS} body [class*="feed-container"],
  html.${LINKEDIN_WIDE_CLASS} body article,
  html.${LINKEDIN_WIDE_CLASS} body [class*="feed-shared-update"] {
    max-width: none !important;
    width: 100% !important;
    min-width: 0 !important;
  }

  /* 修复 feed 三点菜单/下拉菜单在宽幅模式下被错位到左侧的问题 */
  html.${LINKEDIN_WIDE_CLASS} body .artdeco-dropdown__content,
  html.${LINKEDIN_WIDE_CLASS} body [class*="control-menu"] .artdeco-dropdown__content,
  html.${LINKEDIN_WIDE_CLASS} body [class*="overflow-menu"] .artdeco-dropdown__content,
  html.${LINKEDIN_WIDE_CLASS} body .feed-shared-control-menu__content {
    left: auto !important;
    right: 0 !important;
    inset-inline-start: auto !important;
    transform: none !important;
  }

  /* 修复帖子右上角三点按钮被挤到左侧：强制控制菜单容器靠右 */
  html.${LINKEDIN_WIDE_CLASS} body [class*="feed-shared-control-menu"],
  html.${LINKEDIN_WIDE_CLASS} body [class*="overflow-menu"],
  html.${LINKEDIN_WIDE_CLASS} body [class*="control-menu"] {
    margin-left: auto !important;
    left: auto !important;
    right: 0 !important;
    inset-inline-start: auto !important;
    inset-inline-end: 0 !important;
  }

  html.${LINKEDIN_WIDE_CLASS} body [class*="feed-shared-control-menu"] .artdeco-dropdown,
  html.${LINKEDIN_WIDE_CLASS} body [class*="overflow-menu"] .artdeco-dropdown,
  html.${LINKEDIN_WIDE_CLASS} body [class*="control-menu"] .artdeco-dropdown {
    margin-left: auto !important;
  }
}
`;

    const oldStyle = document.getElementById(LINKEDIN_WIDE_STYLE_ID) as HTMLStyleElement | null;
    if (oldStyle) {
        if (oldStyle.textContent !== cssText) oldStyle.textContent = cssText;
        return;
    }

    const style = document.createElement('style');
    style.id = LINKEDIN_WIDE_STYLE_ID;
    style.textContent = cssText;
    document.head.appendChild(style);
}

function removeLinkedinWideStyle() {
    const style = document.getElementById(LINKEDIN_WIDE_STYLE_ID);
    if (style) style.remove();
}

function applyLinkedinWideInlineWidth(scale: string) {
    const { width } = getLinkedinWideScaleVars(scale);
    const targets = document.querySelectorAll<HTMLElement>(
        [
            'main > div:first-child',
            '[class*="application-outlet"]',
            '[class*="scaffold-layout-container"]',
        ].join(','),
    );

    targets.forEach((el) => {
        el.setAttribute(LINKEDIN_WIDE_INLINE_ATTR, '1');
        el.style.setProperty('max-width', width, 'important');
        el.style.setProperty('width', width, 'important');
    });
}

function clearLinkedinWideInlineWidth() {
    const targets = document.querySelectorAll<HTMLElement>(`[${LINKEDIN_WIDE_INLINE_ATTR}="1"]`);
    targets.forEach((el) => {
        el.removeAttribute(LINKEDIN_WIDE_INLINE_ATTR);
        el.style.removeProperty('max-width');
        el.style.removeProperty('width');
    });
}

function ensureLinkedinPromotedHideStyle() {
    if (document.getElementById(LINKEDIN_PROMOTED_HIDE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = LINKEDIN_PROMOTED_HIDE_STYLE_ID;
    style.textContent = `
/* 整贴隐藏：当 feed 中的帖子被识别为 Promoted/赞助贴时，整张贴隐藏。
   仅作用于不在 dialog / modal 内的节点，避免点开帖子后弹层正文连带被隐藏。 */
html.${LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS} main [${LINKEDIN_PROMOTED_HIDDEN_POST_ATTR}="1"]:not([role="dialog"] *):not(.artdeco-modal *):not(.artdeco-modal-overlay *) {
  display: none !important;
}

/* 占位标记："此处省略一行" */
.${LINKEDIN_PROMOTED_MARKER_CLASS} {
  display: block;
  margin: 6px 0;
  padding: 6px 12px;
  font-size: 12px;
  line-height: 18px;
  color: #8a8a8a;
  font-style: italic;
  background: #f3f4f6;
  border: 1px dashed #d0d4d9;
  border-radius: 6px;
  text-align: center;
  user-select: none;
  pointer-events: none;
}
html.dark .${LINKEDIN_PROMOTED_MARKER_CLASS},
html[data-theme="dark"] .${LINKEDIN_PROMOTED_MARKER_CLASS} {
  color: #a0a4ab;
  background: #1f2329;
  border-color: #3a3f47;
}

/* 兼容旧版：媒体级别的隐藏（图/视频）依旧支持，避免老逻辑的兜底失效 */
html.${LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS} main [data-versevibe-hidden-media="1"] {
  display: none !important;
  visibility: hidden !important;
  max-height: 0 !important;
  overflow: hidden !important;
}

/* 兜底：弹层/帖子详情容器内绝不隐藏，避免点开 post 后看不到内容。
   用 revert 而不是 block，避免破坏弹层内 flex/grid 布局导致图片错位。 */
html.${LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS} [role="dialog"] [${LINKEDIN_PROMOTED_HIDDEN_POST_ATTR}="1"],
html.${LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS} .artdeco-modal [${LINKEDIN_PROMOTED_HIDDEN_POST_ATTR}="1"],
html.${LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS} .artdeco-modal-overlay [${LINKEDIN_PROMOTED_HIDDEN_POST_ATTR}="1"],
html.${LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS} [role="dialog"] [data-versevibe-hidden-media="1"],
html.${LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS} .artdeco-modal [data-versevibe-hidden-media="1"],
html.${LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS} .artdeco-modal-overlay [data-versevibe-hidden-media="1"],
html.${LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS} [class*="lightbox"] [data-versevibe-hidden-media="1"],
html.${LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS} [class*="viewer"] [data-versevibe-hidden-media="1"],
html.${LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS} [class*="feed-update"] [data-versevibe-hidden-media="1"],
html.${LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS} [class*="update-detail"] [data-versevibe-hidden-media="1"] {
  display: revert !important;
  visibility: visible !important;
  max-height: none !important;
  overflow: visible !important;
  opacity: 1 !important;
}

/* 弹层中无论如何都强制让图片/视频/figure 可见，
   避免任何残留规则把帖子正文里的媒体藏起来。 */
[role="dialog"] img,
[role="dialog"] video,
[role="dialog"] figure,
[role="dialog"] picture,
[role="dialog"] [class*="update-components-image"],
[role="dialog"] [class*="feed-shared-image"],
[role="dialog"] [class*="update-components-linkedin-video"],
.artdeco-modal img,
.artdeco-modal video,
.artdeco-modal figure,
.artdeco-modal picture,
.artdeco-modal [class*="update-components-image"],
.artdeco-modal [class*="feed-shared-image"],
.artdeco-modal [class*="update-components-linkedin-video"] {
  display: revert !important;
  visibility: visible !important;
  opacity: 1 !important;
  max-height: none !important;
}
`;
    document.head.appendChild(style);
}

function setLinkedinPromotedHideScopeEnabled(enabled: boolean) {
    if (enabled) {
        ensureLinkedinPromotedHideStyle();
        document.documentElement.classList.add(LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS);
    } else {
        document.documentElement.classList.remove(LINKEDIN_PROMOTED_HIDE_SCOPE_CLASS);
    }
}

function isLinkedinDialogOpen(): boolean {
    if (!window.location.hostname.includes('linkedin.com')) return false;
    if (window.location.pathname.includes('/feed/update/')) return true;
    return !!document.querySelector(
        [
            '[role="dialog"]',
            '[aria-modal="true"]',
            '.artdeco-modal',
            '.artdeco-modal-overlay',
            '[data-test-modal]',
            '[class*="lightbox"]',
            '[class*="viewer"]',
            '[class*="feed-update"]',
            '[class*="update-detail"]',
        ].join(','),
    );
}

function syncLinkedinPromotedHideScope() {
    const shouldHideInFeed = shouldAutoHideLinkedinPromotedMedia();
    // 弹出层打开时暂停推广图隐藏，避免误伤放大图/查看器
    const enabled = shouldHideInFeed && !isLinkedinDialogOpen();
    setLinkedinPromotedHideScopeEnabled(enabled);
}

function ensureLinkedinDialogMinimalStyle() {
    if (document.getElementById(LINKEDIN_DIALOG_MINIMAL_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = LINKEDIN_DIALOG_MINIMAL_STYLE_ID;
    style.textContent = `
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} .artdeco-modal {
  background: #fff !important;
}

/* 默认隐藏弹层中非正文/媒体区域 */
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] header,
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="comment"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="social-actions"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="reactions"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="control-menu"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="overflow-menu"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="footer"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="aside"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="composer"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="engagement"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="action-bar"] {
  display: none !important;
}

/* 保留正文与媒体 */
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] article,
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="update-components-text"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="feed-shared-text"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="update-components-image"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="feed-shared-image"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] img,
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] video,
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] figure {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  max-height: none !important;
}

html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] [class*="main"],
html.${LINKEDIN_DIALOG_MINIMAL_CLASS} [role="dialog"] article {
  max-width: 980px !important;
  margin: 0 auto !important;
}
`;
    document.head.appendChild(style);
}

function syncLinkedinDialogMinimalMode() {
    // 旧的"弹层极简模式"会用宽泛 [class*="..."] 选择器把帖子详情弹层中
    // 与图片/视频媒体共享祖先类名（如 *aside* / *footer* / *engagement*）的
    // 容器一起 display:none，导致点击 feed 帖子后弹层里看不到正文图片。
    // 子选择器即便用 !important 也无法救回已经被 display:none 的祖先。
    // 因此停用该模式：保证 LinkedIn 弹层按原生方式渲染（含正文图片/视频）。
    if (!window.location.hostname.includes('linkedin.com')) return;
    document.documentElement.classList.remove(LINKEDIN_DIALOG_MINIMAL_CLASS);
    // 兜底：移除可能残留的样式节点，避免其它路径再次激活时仍被命中
    const styleEl = document.getElementById(LINKEDIN_DIALOG_MINIMAL_STYLE_ID);
    if (styleEl) styleEl.remove();
}

/**
 * 宽幅 UI 开启时，把 LinkedIn feed 帖子详情/媒体浮层全屏化：
 * 图片吃满可用空间最大化，原生的右侧评论栏保持不变。
 * 纯加法（放大/取消宽度上限），不做 display:none，避免误伤评论区。
 */
function ensureLinkedinDialogFullscreenStyle() {
    if (document.getElementById(LINKEDIN_DIALOG_FULLSCREEN_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = LINKEDIN_DIALOG_FULLSCREEN_STYLE_ID;
    const A = `[${LINKEDIN_DIALOG_FULLSCREEN_MARK_ATTR}="1"]`;
    style.textContent = `
/* 被 JS 标记的浮层（原生 <dialog> 或回退盒子）铺满整屏 */
${A} {
  position: fixed !important;
  inset: 0 !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: 100vw !important;
  max-height: 100vh !important;
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  border-radius: 0 !important;
  transform: none !important;
}

/* 浮层内逐层撑满，让内部两栏（媒体 + 右侧评论）有空间展开 */
${A} > div,
${A} > div > div,
${A} > div > div > div {
  max-height: none !important;
  max-width: none !important;
  width: 100% !important;
  height: 100% !important;
}

/* 取消正文媒体容器的宽度/高度上限，让图片吃满可用空间 */
${A} figure,
${A} picture,
${A} [class*="update-components-image"],
${A} [class*="feed-shared-image"],
${A} [class*="image-viewer"],
${A} [class*="media-viewer"] {
  max-width: none !important;
  max-height: none !important;
}

/* 图片/视频按比例吃满可用高度（仅作用于媒体容器内，避免影响头像/图标） */
${A} figure img,
${A} figure > a img,
${A} picture img,
${A} [class*="update-components-image"] img,
${A} [class*="feed-shared-image"] img,
${A} [class*="image-viewer"] img,
${A} [class*="media-viewer"] img,
${A} video {
  width: 100% !important;
  height: auto !important;
  max-width: none !important;
  max-height: 100vh !important;
  object-fit: contain !important;
}

/* 被标记隐藏的容器在浮层内强制恢复，避免点开帖子后图片被藏起来 */
${A} [data-versevibe-hidden-media="1"] {
  display: revert !important;
  visibility: visible !important;
  max-height: none !important;
  overflow: visible !important;
  opacity: 1 !important;
}

/* 浮层内媒体强制可见（不改 display，避免误伤作者自定义样式的头像/图标） */
${A} figure,
${A} picture,
${A} figure img,
${A} picture img,
${A} video,
${A} [class*="update-components-image"],
${A} [class*="feed-shared-image"],
${A} [class*="update-components-linkedin-video"] {
  visibility: visible !important;
  opacity: 1 !important;
}

/* —— 沿“最大图片→浮层根”链路逐层解除宽高上限（由 JS 标记 data-vv-ld-media）——
   解决深层 grid/flex 轨道把媒体列卡在固定宽度、以及多层 overflow:hidden 裁切的问题。
   注意：评论滚动容器(overflow:scroll/auto)由 JS 跳过，不在此处改 overflow。 */
[${LINKEDIN_MEDIA_MARK_ATTR}] {
  max-width: none !important;
  max-height: none !important;
}
/* 媒体元素本身：完整可见且尽量大（等比 contain，吃满可用高度） */
[${LINKEDIN_MEDIA_MARK_ATTR}="media"] {
  width: auto !important;
  height: auto !important;
  max-width: 100% !important;
  max-height: 95vh !important;
  object-fit: contain !important;
}
`;
    document.head.appendChild(style);
}

function clearLinkedinFullscreenMarks() {
    document
        .querySelectorAll(`[${LINKEDIN_DIALOG_FULLSCREEN_MARK_ATTR}]`)
        .forEach((el) => el.removeAttribute(LINKEDIN_DIALOG_FULLSCREEN_MARK_ATTR));
}

/** 清除媒体链标记，并还原我们临时改写的 inline overflow（恢复类名原值）。 */
function clearLinkedinMediaMarks() {
    document.querySelectorAll<HTMLElement>(`[${LINKEDIN_MEDIA_MARK_ATTR}]`).forEach((el) => {
        el.removeAttribute(LINKEDIN_MEDIA_MARK_ATTR);
        // 仅清空我们写过的 inline overflow，让类名/UA 值重新生效
        if (el.style.overflow) el.style.overflow = '';
    });
}

/**
 * 标记“浮层内最大图片 → 浮层根”这条真实祖先链：
 * - 每一层打上 data-vv-ld-media，让 CSS 解除其 max-width/max-height；
 * - 媒体元素自身标 "media"，由 CSS 做 contain + 95vh 最大化；
 * - 对“非滚动”的 overflow:hidden/clip 祖先临时设为 visible（解除裁切），
 *   但保留 overflow:scroll/auto（评论滚动容器）不动，避免破坏评论滚动。
 */
function markLinkedinMediaChain(box: HTMLElement) {
    clearLinkedinMediaMarks();
    let media: HTMLElement | null = null;
    let bestArea = 0;
    box.querySelectorAll<HTMLElement>('img, video').forEach((m) => {
        const r = m.getBoundingClientRect();
        if (r.width < 120 || r.height < 120) return;
        const area = r.width * r.height;
        if (area > bestArea) {
            bestArea = area;
            media = m;
        }
    });
    if (!media) return;
    (media as HTMLElement).setAttribute(LINKEDIN_MEDIA_MARK_ATTR, 'media');
    let n: HTMLElement | null = (media as HTMLElement).parentElement;
    let depth = 0;
    while (n && depth < 40) {
        n.setAttribute(LINKEDIN_MEDIA_MARK_ATTR, '1');
        const cs = getComputedStyle(n);
        const ox = cs.overflowX;
        const oy = cs.overflowY;
        const clips = ox === 'hidden' || ox === 'clip' || oy === 'hidden' || oy === 'clip';
        const scrolls =
            ox === 'scroll' || ox === 'auto' || oy === 'scroll' || oy === 'auto';
        // 只解开“纯裁切”的层；评论滚动容器(含 scroll/auto)保持原样
        if (clips && !scrolls) n.style.overflow = 'visible';
        if (n === box) break;
        n = n.parentElement;
        depth++;
    }
}

/* —————————————————————————————————————————————
 * 方案 C：弹层内「全屏看图」按钮 + 帖子图片/正文抓取
 * 把图片 src / 正文 / 原帖链接写入 storage.local，新开 imageviewer.html 全屏呈现。
 * 一旦拿到 src，渲染就完全脱离 LinkedIn 多变的 DOM —— 稳定性来自这一层解耦。
 * ————————————————————————————————————————————— */

/** 解析 <img> 的最佳（最大）URL：优先 srcset 里宽度描述最大的候选。 */
function resolveBestImgUrl(img: HTMLImageElement): string {
    const srcset = img.getAttribute('srcset') || '';
    if (srcset) {
        let bestUrl = '';
        let bestW = -1;
        srcset.split(',').forEach((part) => {
            const seg = part.trim();
            if (!seg) return;
            const sp = seg.split(/\s+/);
            const url = sp[0];
            const desc = sp[1] || '';
            const w = desc.endsWith('w') ? parseInt(desc, 10) : 0;
            if (w > bestW) {
                bestW = w;
                bestUrl = url;
            }
        });
        if (bestUrl) return bestUrl;
    }
    return img.currentSrc || img.src || '';
}

/** 抓取浮层内该帖的内容图片（排除头像/图标）、正文与原帖链接。 */
function gatherLinkedinPostMedia(box: HTMLElement): {
    images: string[];
    text: string;
    url: string;
    title: string;
} {
    const seen = new Set<string>();
    const images: string[] = [];
    box.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
        const r = img.getBoundingClientRect();
        const nw = img.naturalWidth || 0;
        const nh = img.naturalHeight || 0;
        // 内容图：渲染足够大，或原图足够大（轮播中未显示的图渲染尺寸可能为 0）
        const bigRendered = r.width >= 200 && r.height >= 150;
        const bigNatural = nw >= 400 && nh >= 300;
        if (!bigRendered && !bigNatural) return;
        const url = resolveBestImgUrl(img);
        if (!url || url.startsWith('data:')) return;
        // 过滤明显的头像（LinkedIn 头像 URL 常含 profile-displayphoto / EntityPhoto）
        if (/displayphoto|EntityPhoto|profile-framedphoto/i.test(url)) return;
        if (seen.has(url)) return;
        seen.add(url);
        images.push(url);
    });

    // 正文：取浮层内 DOM 顺序最靠前的“较长文本块”（帖子正文在评论之前）
    let text = '';
    const textNodes = box.querySelectorAll<HTMLElement>('span, p, div');
    for (const el of Array.from(textNodes)) {
        // 只看直接文本，避免把整棵子树（含评论）卷进来
        const direct = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent || '')
            .join(' ')
            .trim();
        if (direct.length >= 60) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
                text = (el.innerText || direct).trim();
                break;
            }
        }
    }

    // 原帖链接：浮层内指向帖子的 permalink，找不到则用当前地址
    let url = '';
    const a = box.querySelector<HTMLAnchorElement>(
        'a[href*="/feed/update/"], a[href*="/posts/"]',
    );
    if (a && a.href) url = a.href;
    if (!url) url = window.location.href;

    const title = (text.split('\n')[0] || '').slice(0, 80) || 'LinkedIn 帖子';
    return { images, text, url, title };
}

async function openLinkedinImageViewer() {
    const box = document.querySelector<HTMLElement>(
        `[${LINKEDIN_DIALOG_FULLSCREEN_MARK_ATTR}="1"]`,
    );
    if (!box) return;
    const payload = gatherLinkedinPostMedia(box);
    const key = `vv_viewer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
        await browser.storage.local.set({ [key]: payload });
        await browser.runtime.sendMessage({ type: 'openImageViewer', key });
    } catch (e) {
        console.warn('[VerseVibe] 打开全屏看图失败', e);
    }
}

/**
 * 在浮层存在时注入「全屏看图」按钮。
 * 关键：LinkedIn 帖子详情浮层是原生 <dialog>（showModal），处于浏览器“顶层(top layer)”，
 * 会盖在所有普通 DOM 之上（z-index 再大也没用）。因此这里用 Popover API
 * （popover 属性 + showPopover）让按钮同样进入顶层，盖在 <dialog> 之上。
 */
function ensureLinkedinViewerButton() {
    let btn = document.getElementById(LINKEDIN_VIEWER_BTN_ID) as HTMLButtonElement | null;
    if (!btn) {
        btn = document.createElement('button');
        btn.id = LINKEDIN_VIEWER_BTN_ID;
        btn.type = 'button';
        btn.textContent = '⤢ 全屏看图';
        btn.title = 'VerseVibe：在新标签页最大化查看本帖图片';
        // 进入顶层，盖过原生 <dialog>
        btn.setAttribute('popover', 'manual');
        Object.assign(btn.style, {
            // 覆盖 popover UA 默认的居中定位（inset:0; margin:auto）
            position: 'fixed',
            inset: 'auto',
            top: 'auto',
            left: '24px',
            bottom: '24px',
            right: 'auto',
            margin: '0',
            zIndex: '2147483647',
            padding: '9px 16px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#fff',
            background: 'rgba(20,20,22,.88)',
            border: '1px solid rgba(255,255,255,.2)',
            borderRadius: '999px',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,.45)',
            backdropFilter: 'blur(4px)',
            overflow: 'visible',
            width: 'auto',
            height: 'auto',
        } as CSSStyleDeclaration);
        btn.addEventListener('mouseenter', () => {
            btn!.style.background = 'rgba(45,45,50,.96)';
        });
        btn.addEventListener('mouseleave', () => {
            btn!.style.background = 'rgba(20,20,22,.88)';
        });
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            void openLinkedinImageViewer();
        });
        document.body.appendChild(btn);
    }
    // 确保处于“已弹出”状态（顶层）；popover 未显示时 matches(':popover-open') 为 false
    try {
        if (!btn.matches(':popover-open')) btn.showPopover();
    } catch {
        // 浏览器不支持 Popover 时退回普通 fixed（仍可能被 dialog 顶层遮挡，但不报错）
    }
}

function removeLinkedinViewerButton() {
    const btn = document.getElementById(LINKEDIN_VIEWER_BTN_ID) as HTMLButtonElement | null;
    if (!btn) return;
    try {
        if (btn.matches(':popover-open')) btn.hidePopover();
    } catch {}
    btn.remove();
}

/** 元素的“前景层级”评分：取自身到根路径上最大的 z-index，弹层通常 z-index 很高。 */
function linkedinFrontScore(el: HTMLElement): number {
    let n: HTMLElement | null = el;
    let z = 0;
    let depth = 0;
    while (n && depth < 24) {
        const v = parseInt(getComputedStyle(n).zIndex, 10);
        if (!Number.isNaN(v)) z = Math.max(z, v);
        n = n.parentElement;
        depth++;
    }
    return z;
}

/** 在“当前置顶浮层”里定位评论区元素（避开背后 feed 里的评论框）。 */
function findLinkedinDialogCommentAnchor(): HTMLElement | null {
    const vh = window.innerHeight;
    const selectors = [
        '[class*="comments-comment-box"]',
        '[class*="comment-texteditor"]',
        '[class*="comments-comment-list"]',
        '[class*="social-detail"]',
        '[class*="comments-comments-list"]',
        '[aria-label*="omment"]',
        '[placeholder*="omment"]',
    ];
    const found: HTMLElement[] = [];
    selectors.forEach((s) => {
        document.querySelectorAll<HTMLElement>(s).forEach((el) => {
            const r = el.getBoundingClientRect();
            // 必须在视口内且有尺寸（排除被滚走/隐藏的 feed 评论框）
            if (r.width > 60 && r.height > 20 && r.bottom > 0 && r.top < vh) found.push(el);
        });
    });
    if (!found.length) return null;
    // 取前景层级最高的那个（置顶浮层的评论区）
    let best = found[0];
    let bestZ = linkedinFrontScore(best);
    for (let i = 1; i < found.length; i++) {
        const z = linkedinFrontScore(found[i]);
        if (z > bestZ) {
            bestZ = z;
            best = found[i];
        }
    }
    return best;
}

function linkedinElHasLargeMedia(el: HTMLElement): boolean {
    const media = el.querySelectorAll<HTMLElement>('img, video, figure, [class*="update-components-image"], [class*="feed-shared-image"]');
    for (const m of Array.from(media)) {
        const r = m.getBoundingClientRect();
        if (r.width >= 200 && r.height >= 120) return true;
    }
    return false;
}

/** 判断元素当前是否可见（非 display:none / visibility:hidden / opacity:0）。 */
function linkedinElVisible(el: HTMLElement): boolean {
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
}

/**
 * 帖子详情浮层在新版 LinkedIn DOM 里是原生 <dialog> 元素（类名全部哈希化、
 * 每次刷新都变，但语义标签 <dialog> 稳定）。优先直接命中它。
 * 取“可见、尺寸够大、不是全屏遮罩”的最大 <dialog>。
 */
function findLinkedinDialogElement(): HTMLElement | null {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dialogs = document.querySelectorAll<HTMLElement>('dialog');
    let best: HTMLElement | null = null;
    let bestArea = 0;
    dialogs.forEach((el) => {
        // 原生 dialog 关闭时无 open 属性、不渲染
        if (el.tagName.toLowerCase() === 'dialog' && !(el as HTMLDialogElement).open) {
            // 部分实现用 [open] 控制；没有 open 属性的就跳过
            if (!el.hasAttribute('open')) return;
        }
        if (!linkedinElVisible(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width < 320 || r.height < 240) return;
        // 排除铺满整屏的暗色遮罩（一般不是 dialog，但稳妥起见）
        if (r.left <= 2 && r.top <= 2 && r.width >= vw * 0.98 && r.height >= vh * 0.98) return;
        const area = r.width * r.height;
        if (area > bestArea) {
            bestArea = area;
            best = el;
        }
    });
    return best;
}

/**
 * 找到当前打开的“帖子/媒体浮层”最外层白色弹窗盒子。
 * 策略：① 优先命中原生 <dialog>（新版帖子详情浮层即为此）；
 * ② 回退：在置顶浮层内定位评论区并向上回溯到包含大图的白色卡片；
 * ③ 兜底：最大的非遮罩浮层盒子。完全不依赖易变的 id/类名。
 */
function findLinkedinOverlayBox(): HTMLElement | null {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // 全屏暗色遮罩：贴着左上角且几乎铺满视口
    const isBackdrop = (r: DOMRect) =>
        r.left <= 2 && r.top <= 2 && r.width >= vw * 0.98 && r.height >= vh * 0.98;

    // ① 原生 <dialog>：新版帖子详情浮层
    const dialog = findLinkedinDialogElement();
    if (dialog) return dialog;

    const anchor = findLinkedinDialogCommentAnchor();
    if (anchor) {
        let best: HTMLElement | null = null;
        let n: HTMLElement | null = anchor;
        let depth = 0;
        while (n && n !== document.body && n !== document.documentElement && depth < 24) {
            const r = n.getBoundingClientRect();
            if (
                r.width >= 320 &&
                r.height >= 240 &&
                !isBackdrop(r) &&
                linkedinElHasLargeMedia(n)
            ) {
                best = n; // 继续上溯，保留最外层符合条件的卡片
            }
            n = n.parentElement;
            depth++;
        }
        if (best) return best;
    }

    // 兜底：没找到评论区时，退回到“最大的非遮罩浮层盒子”
    const candidates = document.querySelectorAll<HTMLElement>(
        [
            '[role="dialog"]',
            '[aria-modal="true"]',
            '.artdeco-modal',
            '[class*="media-viewer"]',
            '[class*="image-viewer"]',
            '[class*="lightbox"]',
        ].join(','),
    );
    let fallback: HTMLElement | null = null;
    let bestArea = 0;
    candidates.forEach((el) => {
        if (el.classList.contains('artdeco-modal-overlay')) return;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
        const r = el.getBoundingClientRect();
        if (r.width < 320 || r.height < 240) return;
        if (isBackdrop(r)) return;
        const area = r.width * r.height;
        if (area > bestArea) {
            bestArea = area;
            fallback = el;
        }
    });
    return fallback;
}

function syncLinkedinDialogFullscreen() {
    if (window.self !== window.top) return;
    if (!window.location.hostname.includes('linkedin.com')) return;

    const enabled =
        config.linkedinWideUi !== false && isLinkedinWidePath(window.location.pathname);

    if (!enabled) {
        document.documentElement.classList.remove(LINKEDIN_DIALOG_FULLSCREEN_CLASS);
        clearLinkedinFullscreenMarks();
        clearLinkedinMediaMarks();
        removeLinkedinViewerButton();
        return;
    }

    // 粘性：已标记的盒子只要还在 DOM 内且仍可见，就保持不变，
    // 避免它被全屏后命中“背景遮罩”过滤条件而来回切换。
    // 原生 <dialog> 关闭后会被移除/隐藏，粘性自然失效。
    const current = document.querySelector<HTMLElement>(
        `[${LINKEDIN_DIALOG_FULLSCREEN_MARK_ATTR}="1"]`,
    );
    if (
        current &&
        document.documentElement.contains(current) &&
        linkedinElVisible(current) &&
        (current.tagName.toLowerCase() !== 'dialog' ||
            (current as HTMLDialogElement).open ||
            current.hasAttribute('open'))
    ) {
        ensureLinkedinDialogFullscreenStyle();
        document.documentElement.classList.add(LINKEDIN_DIALOG_FULLSCREEN_CLASS);
        // 浮层内容会随评论加载/切图动态变化，每次同步都重标媒体链
        markLinkedinMediaChain(current);
        ensureLinkedinViewerButton();
        return;
    }

    const box = findLinkedinOverlayBox();
    if (box) {
        ensureLinkedinDialogFullscreenStyle();
        document.documentElement.classList.add(LINKEDIN_DIALOG_FULLSCREEN_CLASS);
        // 只保留当前盒子的标记
        document
            .querySelectorAll(`[${LINKEDIN_DIALOG_FULLSCREEN_MARK_ATTR}]`)
            .forEach((el) => {
                if (el !== box) el.removeAttribute(LINKEDIN_DIALOG_FULLSCREEN_MARK_ATTR);
            });
        box.setAttribute(LINKEDIN_DIALOG_FULLSCREEN_MARK_ATTR, '1');
        markLinkedinMediaChain(box);
        ensureLinkedinViewerButton();
    } else {
        document.documentElement.classList.remove(LINKEDIN_DIALOG_FULLSCREEN_CLASS);
        clearLinkedinFullscreenMarks();
        clearLinkedinMediaMarks();
        removeLinkedinViewerButton();
    }
}

function scheduleLinkedinDialogFullscreenSync() {
    if (linkedinDialogFullscreenSyncTimer != null) return;
    linkedinDialogFullscreenSyncTimer = window.setTimeout(() => {
        linkedinDialogFullscreenSyncTimer = null;
        try { syncLinkedinDialogFullscreen(); } catch {}
    }, 80);
}

function setupLinkedinDialogFullscreenWatcher() {
    if (window.self !== window.top) return;
    if (!window.location.hostname.includes('linkedin.com')) return;

    syncLinkedinDialogFullscreen();

    if (!linkedinDialogFullscreenObserver) {
        linkedinDialogFullscreenObserver = new MutationObserver(() => {
            scheduleLinkedinDialogFullscreenSync();
        });
        linkedinDialogFullscreenObserver.observe(document.body, { childList: true, subtree: true });
    }
}

function cleanupLinkedinDialogFullscreenWatcher() {
    if (linkedinDialogFullscreenObserver) {
        linkedinDialogFullscreenObserver.disconnect();
        linkedinDialogFullscreenObserver = null;
    }
    if (linkedinDialogFullscreenSyncTimer != null) {
        window.clearTimeout(linkedinDialogFullscreenSyncTimer);
        linkedinDialogFullscreenSyncTimer = null;
    }
    document.documentElement.classList.remove(LINKEDIN_DIALOG_FULLSCREEN_CLASS);
    clearLinkedinFullscreenMarks();
    clearLinkedinMediaMarks();
    removeLinkedinViewerButton();
}

function setupLinkedinDialogGuard() {
    if (linkedinDialogGuardBound) return;
    if (window.self !== window.top) return;
    if (!window.location.hostname.includes('linkedin.com')) return;

    linkedinDialogGuardHandler = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;

        // 仅在可能触发图片/帖子弹层的点击后快速同步，避免误伤放大图
        const hit = target.closest(
            [
                'img',
                'figure',
                'a[href*="/feed/update/"]',
                'a[href*="/posts/"]',
                '[class*="update-components-image"]',
                '[class*="feed-shared-image"]',
                '[class*="viewer"]',
                '[class*="lightbox"]',
            ].join(','),
        );
        if (!hit) return;

        window.setTimeout(() => {
            syncLinkedinPromotedHideScope();
            revealMarkedMediaInDialog();
            syncLinkedinDialogMinimalMode();
            syncLinkedinDialogFullscreen();
        }, 0);

        window.setTimeout(() => {
            syncLinkedinPromotedHideScope();
            revealMarkedMediaInDialog();
            syncLinkedinDialogMinimalMode();
            syncLinkedinDialogFullscreen();
        }, 120);
    };

    document.addEventListener('click', linkedinDialogGuardHandler, true);
    linkedinDialogGuardBound = true;
}

function clearLegacyHiddenMediaStyles(root: ParentNode = document) {
    const legacyNodes = root.querySelectorAll<HTMLElement>('[data-versevibe-hidden-media="1"]');
    legacyNodes.forEach((node) => {
        node.style.removeProperty('display');
        node.style.removeProperty('visibility');
        node.style.removeProperty('max-height');
        node.style.removeProperty('overflow');
    });
}

/** 取消「整贴隐藏 + 占位标记」效果（用户关闭功能时调用）*/
function clearPromotedHiddenPosts(root: ParentNode = document) {
    root
        .querySelectorAll<HTMLElement>(`[${LINKEDIN_PROMOTED_HIDDEN_POST_ATTR}="1"]`)
        .forEach((node) => node.removeAttribute(LINKEDIN_PROMOTED_HIDDEN_POST_ATTR));
    root
        .querySelectorAll<HTMLElement>(`[${LINKEDIN_PROMOTED_MARKER_ATTR}="1"]`)
        .forEach((node) => node.remove());
    // 同时清掉 “已识别过” 的标记，让下次启用时可以重新识别
    root
        .querySelectorAll<HTMLElement>(`[${LINKEDIN_PROMOTED_PROCESSED_ATTR}="1"]`)
        .forEach((node) => node.removeAttribute(LINKEDIN_PROMOTED_PROCESSED_ATTR));
}

function revealMarkedMediaInDialog() {
    const dialogNodes = document.querySelectorAll<HTMLElement>(
        [
            '[role="dialog"] [data-versevibe-hidden-media="1"]',
            '.artdeco-modal [data-versevibe-hidden-media="1"]',
            '.artdeco-modal-overlay [data-versevibe-hidden-media="1"]',
            '[class*="lightbox"] [data-versevibe-hidden-media="1"]',
            '[class*="viewer"] [data-versevibe-hidden-media="1"]',
        ].join(','),
    );
    if (dialogNodes.length === 0) return;

    dialogNodes.forEach((node) => {
        node.removeAttribute('data-versevibe-hidden-media');
        node.style.removeProperty('display');
        node.style.removeProperty('visibility');
        node.style.removeProperty('max-height');
        node.style.removeProperty('overflow');
    });
}

function ensureLinkedinPostTextZoomStyle() {
    if (document.getElementById(LINKEDIN_POST_TEXT_ZOOM_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = LINKEDIN_POST_TEXT_ZOOM_STYLE_ID;
    style.textContent = `
html.${LINKEDIN_POST_TEXT_ZOOM_CLASS} .scaffold-layout__main article p,
html.${LINKEDIN_POST_TEXT_ZOOM_CLASS} .scaffold-layout__main article li,
html.${LINKEDIN_POST_TEXT_ZOOM_CLASS} .scaffold-layout__main article blockquote,
html.${LINKEDIN_POST_TEXT_ZOOM_CLASS} .scaffold-layout__main article h1,
html.${LINKEDIN_POST_TEXT_ZOOM_CLASS} .scaffold-layout__main article h2,
html.${LINKEDIN_POST_TEXT_ZOOM_CLASS} .scaffold-layout__main article h3,
html.${LINKEDIN_POST_TEXT_ZOOM_CLASS} .scaffold-layout__main article h4,
html.${LINKEDIN_POST_TEXT_ZOOM_CLASS} .scaffold-layout__main article [class*="update-components-text"],
html.${LINKEDIN_POST_TEXT_ZOOM_CLASS} .scaffold-layout__main article [class*="description"],
html.${LINKEDIN_POST_TEXT_ZOOM_CLASS} .scaffold-layout__main article div[dir="ltr"] {
  font-size: calc(1em * 2) !important;
  line-height: 1.6 !important;
}
`;
    document.head.appendChild(style);
}

function isElementVisible(el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function findSecondFeedPostElement(): HTMLElement | null {
    const rawCandidates = Array.from(
        document.querySelectorAll<HTMLElement>(
            [
                'main div[data-id^="urn:li:activity"]',
                'main div[data-urn^="urn:li:activity"]',
                'main article',
                'main [class*="feed-shared-update"]',
            ].join(','),
        ),
    ).filter((el) => isElementVisible(el) && (el.innerText || '').trim().length > 20);

    const normalized: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();
    rawCandidates.forEach((el) => {
        const root = (el.closest('article, div[data-id^="urn:li:activity"], div[data-urn^="urn:li:activity"]') as HTMLElement | null) || el;
        if (seen.has(root)) return;
        seen.add(root);
        normalized.push(root);
    });

    if (normalized.length < 2) return null;
    return normalized[1];
}

function findFirstPromotedFeedPostElement(): HTMLElement | null {
    const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
            [
                'main div[data-id^="urn:li:activity"]',
                'main div[data-urn^="urn:li:activity"]',
                'main article',
                'main [class*="feed-shared-update"]',
            ].join(','),
        ),
    ).filter((el) => isElementVisible(el) && (el.innerText || '').trim().length > 20);

    for (const el of candidates) {
        const root = (el.closest('article, div[data-id^="urn:li:activity"], div[data-urn^="urn:li:activity"]') as HTMLElement | null) || el;
        if (hasSponsoredLabelInTopArea(root)) return root;
    }
    return null;
}

function collectFeedPostRoots(): HTMLElement[] {
    const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
            [
                'main div[data-id^="urn:li:activity"]',
                'main div[data-urn^="urn:li:activity"]',
                'main article',
                'main [class*="feed-shared-update"]',
            ].join(','),
        ),
    ).filter((el) => isElementVisible(el) && (el.innerText || '').trim().length > 20);

    const roots: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();
    candidates.forEach((el) => {
        const root = (el.closest('article, div[data-id^="urn:li:activity"], div[data-urn^="urn:li:activity"]') as HTMLElement | null) || el;
        if (seen.has(root)) return;
        seen.add(root);
        roots.push(root);
    });
    return roots;
}

function hasSponsoredLabelInTopArea(postEl: HTMLElement): boolean {
    const sponsorRe = /(sponsored|sponsor|promoted|赞助|推广)/i;
    const topAreaNodes = Array.from(
        postEl.querySelectorAll<HTMLElement>('header, [aria-label], a, span, div[class*="actor"], div[class*="header"], div[class*="sub-description"], div'),
    ).slice(0, 140);

    for (const node of topAreaNodes) {
        const text = `${node.innerText || ''} ${node.getAttribute('aria-label') || ''}`.trim();
        if (!text || text.length > 120) continue;
        if (sponsorRe.test(text)) {
            return true;
        }
    }

    // 兜底：检查 post 顶部文本片段
    const excerpt = (postEl.innerText || '').slice(0, 1200);
    if (sponsorRe.test(excerpt)) return true;

    return false;
}

/**
 * 把整篇 Promoted/赞助贴隐藏，并在原位插入「此处省略一行」占位标记。
 * （函数名保留 hideMediaInFeedPost 以兼容现有调用点；语义已变更为整贴隐藏。）
 * 返回值：本次操作新隐藏的帖子数（0 或 1）。
 */
function hideMediaInFeedPost(postEl: HTMLElement): number {
    if (!postEl) return 0;
    const isOverlayNode = (node: HTMLElement) =>
        !!node.closest(
            [
                '[role="dialog"]',
                '.artdeco-modal',
                '.artdeco-modal-overlay',
                '[class*="lightbox"]',
                '[class*="viewer"]',
                '[class*="overlay"]',
            ].join(','),
        );
    if (isOverlayNode(postEl)) return 0;

    if (postEl.getAttribute(LINKEDIN_PROMOTED_HIDDEN_POST_ATTR) === '1') return 0;

    // 标记整贴为隐藏
    postEl.setAttribute(LINKEDIN_PROMOTED_HIDDEN_POST_ATTR, '1');

    // 在 feed 流中插入占位标记（紧贴前一个兄弟节点位置，保持列表上下文）
    const parent = postEl.parentElement;
    if (parent) {
        // 防重复：如果上一个兄弟已经是占位标记，则不再插入
        const prev = postEl.previousElementSibling as HTMLElement | null;
        const alreadyMarked =
            prev?.getAttribute?.(LINKEDIN_PROMOTED_MARKER_ATTR) === '1';
        if (!alreadyMarked) {
            const marker = document.createElement('div');
            marker.className = LINKEDIN_PROMOTED_MARKER_CLASS;
            marker.setAttribute(LINKEDIN_PROMOTED_MARKER_ATTR, '1');
            marker.textContent = LINKEDIN_PROMOTED_MARKER_TEXT;
            parent.insertBefore(marker, postEl);
        }
    }

    return 1;
}

function applyLinkedinFeedWideDesponsor(): { ok: boolean; reason?: string; hiddenCount?: number } {
    if (window.self !== window.top) return { ok: false, reason: 'not-top-frame' };
    if (!window.location.hostname.includes('linkedin.com')) return { ok: false, reason: 'not-linkedin' };
    if (!isLinkedinFeedPath(window.location.pathname)) return { ok: false, reason: 'not-feed-page' };

    applyLinkedinWideUi();

    const secondPost = findSecondFeedPostElement();
    const targetPost =
        secondPost && hasSponsoredLabelInTopArea(secondPost)
            ? secondPost
            : findFirstPromotedFeedPostElement();

    if (!targetPost) {
        return { ok: false, reason: 'promoted-post-not-found' };
    }

    const hiddenCount = hideMediaInFeedPost(targetPost);
    return { ok: true, hiddenCount };
}

function shouldAutoHideLinkedinPromotedMedia(): boolean {
    if (window.self !== window.top) return false;
    if (!window.location.hostname.includes('linkedin.com')) return false;
    if (!isLinkedinFeedPath(window.location.pathname)) return false;
    // 推广帖隐藏功能独立于宽幅 UI 开关，由 linkedinAutoHidePromotedMedia 单独控制
    return config.linkedinAutoHidePromotedMedia !== false;
}

function autoHidePromotedMediaInFeedOnce(): number {
    if (!shouldAutoHideLinkedinPromotedMedia()) return 0;
    if (isLinkedinDialogOpen()) return 0;
    clearLegacyHiddenMediaStyles();
    revealMarkedMediaInDialog();
    const posts = collectFeedPostRoots();
    let hiddenTotal = 0;

    posts.forEach((post) => {
        // 已经被隐藏过的帖子不再处理
        if (post.getAttribute(LINKEDIN_PROMOTED_HIDDEN_POST_ATTR) === '1') return;
        // 注意：不要在「未确认是否为推广」时就标记 processed，
        // 因为 LinkedIn 经常在帖子骨架渲染完之后才异步插入 "Promoted" 文案，
        // 提前打 processed 会导致这类帖子被永久跳过、永远隐藏不掉。
        if (!hasSponsoredLabelInTopArea(post)) return;
        post.setAttribute(LINKEDIN_PROMOTED_PROCESSED_ATTR, '1');
        hiddenTotal += hideMediaInFeedPost(post);
    });

    return hiddenTotal;
}

function setupLinkedinPromotedAutoHideWatcher() {
    if (!shouldAutoHideLinkedinPromotedMedia()) {
        cleanupLinkedinPromotedAutoHideWatcher();
        return;
    }

    syncLinkedinPromotedHideScope();
    syncLinkedinDialogMinimalMode();
    clearLegacyHiddenMediaStyles();
    revealMarkedMediaInDialog();
    autoHidePromotedMediaInFeedOnce();

    if (!linkedinPromotedObserver) {
        linkedinPromotedObserver = new MutationObserver(() => {
            syncLinkedinPromotedHideScope();
            revealMarkedMediaInDialog();
            syncLinkedinDialogMinimalMode();
            autoHidePromotedMediaInFeedOnce();
            // feed 自动刷新会替换 DOM 节点，inline 宽度会丢失；这里顺带补回宽幅 UI
            scheduleLinkedinWideReapply();
        });
        linkedinPromotedObserver.observe(document.body, { childList: true, subtree: true });
    }

    if (!linkedinPromotedTimer) {
        linkedinPromotedTimer = window.setInterval(() => {
            syncLinkedinPromotedHideScope();
            revealMarkedMediaInDialog();
            syncLinkedinDialogMinimalMode();
            autoHidePromotedMediaInFeedOnce();
            scheduleLinkedinWideReapply();
        }, 1200);
    }
}

let linkedinWideReapplyTimer: number | null = null;
function scheduleLinkedinWideReapply() {
    if (linkedinWideReapplyTimer != null) return;
    linkedinWideReapplyTimer = window.setTimeout(() => {
        linkedinWideReapplyTimer = null;
        try { applyLinkedinWideUi(); } catch {}
    }, 250);
}

/** 抑制 LinkedIn feed 自动刷新带来的"跳回顶部"。
 *  - 隐藏 "查看新动态 / Show new posts" 浮动提示，避免用户/脚本意外触发刷新；
 *  - 关闭浏览器自动 scroll restoration，让 SPA 切换/重渲染不会强制回顶；
 *  - 在 /feed/ 路径下拦截短时间内多次的 window.scrollTo(0,0)。 */
let linkedinFeedAntiRefreshBound = false;
function setupLinkedinFeedAntiAutoRefresh() {
    if (linkedinFeedAntiRefreshBound) return;
    if (window.self !== window.top) return;
    if (!window.location.hostname.includes('linkedin.com')) return;
    linkedinFeedAntiRefreshBound = true;

    // 关闭 history 自动滚动恢复
    try {
        if ('scrollRestoration' in history) {
            (history as any).scrollRestoration = 'manual';
        }
    } catch {}

    // 注入隐藏 "Show new posts" / 新动态提示 的样式
    const styleId = 'versevibe-linkedin-anti-refresh-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
/* 隐藏 LinkedIn feed 顶部 "查看 N 条新动态" 浮条，避免触发整页刷新跳顶 */
[class*="feed-new-update-pill"],
[class*="feed-new-activity"],
[data-test-feed-new-update-notification],
button[aria-label*="new post" i],
button[aria-label*="new update" i],
button[aria-label*="新动态"],
button[aria-label*="新帖子"] {
  display: none !important;
}
`;
        document.head.appendChild(style);
    }

    // 拦截 feed 页中频繁的 scrollTo(0,0)：仅当用户没在交互时短窗口内连续多次触发才拦
    try {
        const originalScrollTo = window.scrollTo.bind(window);
        const isFeed = () => /^\/feed\/?$/.test(window.location.pathname);
        let lastUserScrollAt = Date.now();
        window.addEventListener('wheel', () => { lastUserScrollAt = Date.now(); }, { passive: true, capture: true });
        window.addEventListener('touchmove', () => { lastUserScrollAt = Date.now(); }, { passive: true, capture: true });
        window.addEventListener('keydown', () => { lastUserScrollAt = Date.now(); }, { capture: true });

        (window as any).scrollTo = function (...args: any[]) {
            try {
                if (isFeed()) {
                    const x = typeof args[0] === 'object' ? args[0]?.left : args[0];
                    const y = typeof args[0] === 'object' ? args[0]?.top : args[1];
                    const isTop = (x === 0 || x == null) && (y === 0 || y == null);
                    const sinceUser = Date.now() - lastUserScrollAt;
                    // 只有当用户最近 3s 内有滚动操作，才拒绝程序化的回顶
                    if (isTop && sinceUser < 3000 && window.scrollY > 200) {
                        return; // 拦掉
                    }
                }
            } catch {}
            return originalScrollTo(...(args as []));
        };
    } catch {}
}

function cleanupLinkedinPromotedAutoHideWatcher() {
    if (linkedinPromotedObserver) {
        linkedinPromotedObserver.disconnect();
        linkedinPromotedObserver = null;
    }
    if (linkedinPromotedTimer) {
        window.clearInterval(linkedinPromotedTimer);
        linkedinPromotedTimer = null;
    }
    setLinkedinPromotedHideScopeEnabled(false);
    document.documentElement.classList.remove(LINKEDIN_DIALOG_MINIMAL_CLASS);
    clearLegacyHiddenMediaStyles();
    clearPromotedHiddenPosts();
    if (linkedinDialogGuardBound && linkedinDialogGuardHandler) {
        document.removeEventListener('click', linkedinDialogGuardHandler, true);
        linkedinDialogGuardBound = false;
        linkedinDialogGuardHandler = null;
    }
}

function applyLinkedinPostTextZoom(): { ok: boolean; reason?: string } {
    if (window.self !== window.top) return { ok: false, reason: 'not-top-frame' };
    if (!window.location.hostname.includes('linkedin.com')) return { ok: false, reason: 'not-linkedin' };
    if (!isLinkedinPostDetailPath(window.location.pathname)) return { ok: false, reason: 'not-post-detail-page' };

    ensureLinkedinPostTextZoomStyle();
    document.documentElement.classList.add(LINKEDIN_POST_TEXT_ZOOM_CLASS);
    return { ok: true };
}

function applyLinkedinWideUi() {
    if (window.self !== window.top) return;
    if (!window.location.hostname.includes('linkedin.com')) return;

    const enabled = config.linkedinWideUi !== false && isLinkedinWidePath(window.location.pathname);
    const scale = typeof config.linkedinWideScale === 'string' ? config.linkedinWideScale : '1.5x';
    if (enabled) {
        if (scale === 'normal') {
            document.documentElement.classList.remove(LINKEDIN_WIDE_CLASS);
            removeLinkedinWideStyle();
            clearLinkedinWideInlineWidth();
        } else {
            ensureLinkedinWideStyle(scale);
            document.documentElement.classList.add(LINKEDIN_WIDE_CLASS);
            applyLinkedinWideInlineWidth(scale);
        }
    } else {
        document.documentElement.classList.remove(LINKEDIN_WIDE_CLASS);
        removeLinkedinWideStyle();
        clearLinkedinWideInlineWidth();
    }

    syncLinkedinPromotedHideScope();
    setupLinkedinPromotedAutoHideWatcher();
    setupLinkedinDialogGuard();
    setupLinkedinFeedAntiAutoRefresh();

    if (enabled) {
        setupLinkedinDialogFullscreenWatcher();
    } else {
        cleanupLinkedinDialogFullscreenWatcher();
    }
}

function setupLinkedinWideUiWatcher() {
    if (window.self !== window.top) return;
    if (!window.location.hostname.includes('linkedin.com')) return;
    if (linkedinWideRouteTimer) return;

    applyLinkedinWideUi();
    let lastPath = window.location.pathname;
    linkedinWideRouteTimer = window.setInterval(() => {
        if (window.location.pathname !== lastPath) {
            lastPath = window.location.pathname;
            applyLinkedinWideUi();
        }
    }, 500);
}

function cleanupLinkedinWideUiWatcher() {
    if (linkedinWideRouteTimer) {
        window.clearInterval(linkedinWideRouteTimer);
        linkedinWideRouteTimer = null;
    }
    document.documentElement.classList.remove(LINKEDIN_WIDE_CLASS);
    document.documentElement.classList.remove(LINKEDIN_POST_TEXT_ZOOM_CLASS);
    removeLinkedinWideStyle();
    clearLinkedinWideInlineWidth();
    cleanupLinkedinPromotedAutoHideWatcher();
    cleanupLinkedinDialogFullscreenWatcher();
}

/* ============================================================
 * GitHub 仓库首页布局优化
 * 在 github.com/{owner}/{repo}（恰好两级路径）的项目首页，
 * 把左栏“文件列表(上) + README(下)”改为“README(左) + 文件列表(右)”横排，
 * 整页由 2 列变 3 列（README | 文件列表 | About 侧栏）。
 *
 * 实现：只对左栏 prc-PageLayout-Content 内、同时包含“文件表格”和“README”
 * 的那个公共父容器（OverviewContent-module__Box_11）做 flex 横排，
 * README 子项用 order:-1 移到左侧。纯 CSS + 标记属性，不挪动 DOM 节点，
 * 避免 GitHub React/Turbo 重渲染把改动冲掉。选择器基于稳定的模块前缀。
 * ============================================================ */

/** 仅匹配仓库首页：恰好 /{owner}/{repo} 两级，且首段不是 GitHub 保留路由。 */
function isGithubRepoOverviewPath(pathname: string): boolean {
    const segs = pathname.split('/').filter(Boolean);
    if (segs.length !== 2) return false;
    const reserved = new Set([
        'settings', 'marketplace', 'explore', 'notifications', 'orgs', 'sponsors',
        'features', 'about', 'pricing', 'team', 'enterprise', 'login', 'join',
        'new', 'codespaces', 'search', 'topics', 'collections', 'trending',
        'apps', 'organizations', 'account', 'dashboard', 'stars', 'watching',
        'issues', 'pulls', 'explore',
    ]);
    if (reserved.has(segs[0].toLowerCase())) return false;
    return true;
}

function ensureGithubReadmeLeftStyle() {
    if (document.getElementById(GITHUB_README_LEFT_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = GITHUB_README_LEFT_STYLE_ID;
    style.textContent = `
/* 整页 100% 自适应：去掉 GitHub 页面布局容器（Primer PageLayout / container-xl）
   的 max-width 限制，让“README | 文件列表 | About”三列铺满整个视口宽度。
   仅去掉 max-width（不强加 width:100%，以免干扰 flex 子项的弹性计算）。
   Primer Content 区另外通过把 data-width 改成 "full" 来原生放开（见 JS）。 */
[${GITHUB_FULLWIDTH_ATTR}] {
  max-width: none !important;
}
/* 公共父容器横排：README 在左、文件列表在右 */
.${GITHUB_README_LEFT_CLASS} {
  display: flex !important;
  flex-direction: row !important;
  align-items: flex-start !important;
  flex-wrap: wrap !important;
  gap: 16px !important;
}
/* README 区：移到左侧，独占剩余宽度 100% 自适应铺满 */
.${GITHUB_README_LEFT_CLASS} > [${GITHUB_README_ATTR}] {
  order: -1 !important;
  flex: 1 1 0 !important;       /* 唯一会增长的列：吃掉文件列表之外的全部宽度 */
  min-width: 320px !important;
  width: auto !important;
  margin-top: 0 !important;
}
/* README 内部 markdown 正文：去掉自身 max-width 限制，撑满整列 */
.${GITHUB_README_LEFT_CLASS} > [${GITHUB_README_ATTR}] .markdown-body,
.${GITHUB_README_LEFT_CLASS} > [${GITHUB_README_ATTR}] [class*="SharedMarkdownContent"],
.${GITHUB_README_LEFT_CLASS} > [${GITHUB_README_ATTR}] article {
  max-width: none !important;
  width: 100% !important;
}
/* 文件列表区：右侧，接近 GitHub 原生宽度（略加大），不增长（把多余空间让给 README） */
.${GITHUB_README_LEFT_CLASS} > [${GITHUB_FILES_ATTR}] {
  flex: 0 1 480px !important;
  min-width: 360px !important;
}
`;
    document.head.appendChild(style);
}

function clearGithubReadmeLeftMarks() {
    document.documentElement
        .querySelectorAll(`[${GITHUB_README_ATTR}], [${GITHUB_FILES_ATTR}], [${GITHUB_FULLWIDTH_ATTR}]`)
        .forEach((el) => {
            el.removeAttribute(GITHUB_README_ATTR);
            el.removeAttribute(GITHUB_FILES_ATTR);
            el.removeAttribute(GITHUB_FULLWIDTH_ATTR);
        });
    // 复原被改过的 Primer Content data-width
    document.documentElement
        .querySelectorAll(`[${GITHUB_ORIG_WIDTH_ATTR}]`)
        .forEach((el) => {
            const orig = el.getAttribute(GITHUB_ORIG_WIDTH_ATTR) || '';
            if (orig) el.setAttribute('data-width', orig);
            el.removeAttribute(GITHUB_ORIG_WIDTH_ATTR);
        });
    document
        .querySelectorAll(`.${GITHUB_README_LEFT_CLASS}`)
        .forEach((el) => el.classList.remove(GITHUB_README_LEFT_CLASS));
}

/**
 * 定位“可横排的一组”：从 README 正文（.markdown-body）向上爬，
 * 找到第一层「其上一个兄弟节点里含 <table>（=文件列表区）」的祖先。
 * 该祖先即 README 直接子框，其 parentElement 是公共父，上一个兄弟是文件表格区。
 * 这样无需依赖会变的模块 hash，且自带正确性校验。
 * 返回 [公共父, README框, 文件表格框] 或 null。
 */
function findGithubReadmeGroup(): [HTMLElement, HTMLElement, HTMLElement] | null {
    const md = document.querySelector<HTMLElement>(
        '[class*="DirectoryRichtextContent-module__SharedMarkdownContent"], #readme, article.markdown-body.entry-content',
    );
    if (!md) return null;
    let a: HTMLElement | null = md;
    let depth = 0;
    while (a && a.parentElement && depth < 14) {
        const prev = a.previousElementSibling as HTMLElement | null;
        if (prev && prev.querySelector('table')) {
            const container = a.parentElement;
            // 限定在左栏主内容里，避免误命中右侧 About 侧栏
            if (container.closest('[class*="prc-PageLayout-Content"]')) {
                return [container, a, prev];
            }
        }
        a = a.parentElement;
        depth++;
    }
    return null;
}

/**
 * 从 README 横排组容器向上，标记所有「限制了页面最大宽度」的布局容器：
 * Primer PageLayout 的 Root/Wrapper（含 max-width 的就是 Wrapper）以及经典
 * .container-xl/lg/md。标记后由 CSS 去掉其 max-width 并撑到 100%，
 * 让三列铺满整个视口。只走 container 的祖先链，不影响页头等其它容器。
 */
function markGithubFullWidthAncestors(fromEl: HTMLElement) {
    let a: HTMLElement | null = fromEl;
    let depth = 0;
    while (a && a !== document.body && depth < 20) {
        const cls = typeof a.className === 'string' ? a.className : '';
        // 同时放开外层 Wrapper/Root 与左侧主内容区 Content/ContentWrapper 的 max-width，
        // 这样左侧主内容（README+文件列表）才能一直撑到右侧 About 侧栏前，整页真正 100%。
        // About 侧栏是 Content 的兄弟节点（Pane），不在此祖先链上，故不受影响。
        if (
            /prc-PageLayout-(PageLayoutWrapper|PageLayoutRoot|Content)/.test(cls) ||
            a.classList.contains('container-xl') ||
            a.classList.contains('container-lg') ||
            a.classList.contains('container-md')
        ) {
            a.setAttribute(GITHUB_FULLWIDTH_ATTR, '1');
        }
        // Primer PageLayout.Content 区用 data-width 控制 max-width：
        //   :where([data-width=large]){max-width:1012px} 等。
        // 直接把它改成 "full"（:where([data-width=full]){max-width:100%}），
        // 用 Primer 原生规则放开，最稳妥（不依赖我们的 CSS 覆盖优先级）。
        // 仅作用于真正带 data-width 的 Content 区（ContentWrapper 没有该属性）。
        if (
            /prc-PageLayout-Content/.test(cls) &&
            a.hasAttribute('data-width') &&
            a.getAttribute('data-width') !== 'full'
        ) {
            if (!a.hasAttribute(GITHUB_ORIG_WIDTH_ATTR)) {
                a.setAttribute(GITHUB_ORIG_WIDTH_ATTR, a.getAttribute('data-width') || '');
            }
            a.setAttribute('data-width', 'full');
        }
        a = a.parentElement;
        depth++;
    }
}

function applyGithubReadmeLeft() {
    if (window.self !== window.top) return;
    if (!/(^|\.)github\.com$/i.test(window.location.hostname)) return;

    const enabled =
        (config as any).githubReadmeLeft !== false &&
        isGithubRepoOverviewPath(window.location.pathname);

    if (!enabled) {
        clearGithubReadmeLeftMarks();
        return;
    }

    const group = findGithubReadmeGroup();
    if (!group) {
        // README/文件区尚未渲染（React 异步），等待 observer 再次触发
        clearGithubReadmeLeftMarks();
        return;
    }
    const [container, readmeBox, filesBox] = group;

    ensureGithubReadmeLeftStyle();
    // 先清旧标记，再标当前一组（应对仓库间 Turbo 切换）
    clearGithubReadmeLeftMarks();
    container.classList.add(GITHUB_README_LEFT_CLASS);
    readmeBox.setAttribute(GITHUB_README_ATTR, '1');
    filesBox.setAttribute(GITHUB_FILES_ATTR, '1');
    // 去掉外层布局容器的 max-width，让整页三列 100% 自适应
    markGithubFullWidthAncestors(container);
}

function scheduleGithubReadmeLeftSync() {
    if (githubSyncTimer != null) return;
    githubSyncTimer = window.setTimeout(() => {
        githubSyncTimer = null;
        try { applyGithubReadmeLeft(); } catch {}
    }, 120);
}

function setupGithubReadmeLeftWatcher() {
    if (window.self !== window.top) return;
    if (!/(^|\.)github\.com$/i.test(window.location.hostname)) return;

    applyGithubReadmeLeft();

    if (!githubObserver) {
        githubObserver = new MutationObserver(() => scheduleGithubReadmeLeftSync());
        githubObserver.observe(document.body, { childList: true, subtree: true });
    }
    // GitHub 是 Turbo SPA：路径变化不重载，轮询 pathname 重新应用
    if (githubRouteTimer == null) {
        let lastPath = window.location.pathname;
        githubRouteTimer = window.setInterval(() => {
            if (window.location.pathname !== lastPath) {
                lastPath = window.location.pathname;
                clearGithubReadmeLeftMarks();
                applyGithubReadmeLeft();
            }
        }, 500);
    }
}

function cleanupGithubReadmeLeftWatcher() {
    if (githubObserver) {
        githubObserver.disconnect();
        githubObserver = null;
    }
    if (githubRouteTimer != null) {
        window.clearInterval(githubRouteTimer);
        githubRouteTimer = null;
    }
    if (githubSyncTimer != null) {
        window.clearTimeout(githubSyncTimer);
        githubSyncTimer = null;
    }
    clearGithubReadmeLeftMarks();
    document.getElementById(GITHUB_README_LEFT_STYLE_ID)?.remove();
}

/* ============================================================
 * Reddit：左侧主内容列阅读优化（评论页 + feed 列表页，同一套配置）
 * 覆盖页面：评论页（/r/{sub}/comments/...）、子版块/首页/用户页 feed 列表。
 * 这些页面都分左右两列：左列是正文贴+评论 或 帖子列表，右列是社区/推荐侧栏。
 * 本功能只优化左侧主内容列，把其中偏小的正文/评论/标题文本放大到用户设置的
 * 「最小字号」，方便阅读。
 *
 * 实现：feed 页用 <shreddit-feed>，评论页用“正文贴向上找到含评论树的祖先”，
 * 仅对其内部的 markdown 正文块 / 帖子标题做“按需放大”：只在当前字号小于下限时
 * 提升，并记录原始字号避免抖动，不动比下限大的文本。
 * Reddit 是 shreddit Web Components + SPA，内容懒加载，用 MutationObserver
 * + 路由轮询持续重应用。纯按需 inline 字号，不挪动 DOM。
 * ============================================================ */

/**
 * 匹配需要优化的页面：
 *  - 首页 feed（/）
 *  - 子版块 feed / 评论页 / 用户页（/r/... 、/user/... 、/u/...）
 * 即贴文列表区或正文贴列所在的页面，统一用同一套最小字号配置。
 */
function isRedditOptimizePath(pathname: string): boolean {
    if (pathname === '/' || pathname === '') return true;
    return /^\/(r|user|u)\//i.test(pathname);
}

/**
 * 定位左侧主内容列（正文/帖子列表所在列，天然排除右侧社区/推荐侧栏）：
 *  1) feed 页（子版块/首页/用户页）：帖子列表在 <shreddit-feed> 内，直接用它。
 *  2) 评论页：从 <shreddit-post> 向上爬，找到第一层同时包含评论树的祖先。
 *  3) 兜底：主内容区 <main> / #main-content。
 */
function findRedditMainColumn(): HTMLElement | null {
    // feed 页：帖子列表容器（本身就只含贴文，不含右侧栏）
    const feed = document.querySelector<HTMLElement>('shreddit-feed');
    if (feed) return feed;

    // 评论页：从正文贴向上找到含评论树的祖先
    const post = document.querySelector<HTMLElement>('shreddit-post');
    if (post) {
        let a: HTMLElement | null = post.parentElement;
        let depth = 0;
        while (a && a !== document.body && depth < 16) {
            if (a.querySelector('shreddit-comment-tree, #comment-tree, shreddit-comment')) {
                return a;
            }
            a = a.parentElement;
            depth++;
        }
        return post;
    }

    // 兜底：主内容区
    return document.querySelector<HTMLElement>('main#main-content, #main-content, main');
}

/** 把左主内容列内偏小的正文/评论/标题文本，按需放大到 minSize（只升不降，记录原始字号防抖动）。 */
function applyRedditMinFont(container: HTMLElement, minSize: number) {
    const blocks = container.querySelectorAll<HTMLElement>(
        '.md, [id$="-post-rtjson-content"], [id$="-comment-rtjson-content"], a[slot="title"], [id^="post-title-"]',
    );
    blocks.forEach((node) => {
        let orig: number;
        const stored = node.getAttribute(REDDIT_ORIG_FS_ATTR);
        if (stored != null) {
            orig = parseFloat(stored);
        } else {
            // 首次遇到：在尚未改动前记录原始字号（必须是 px 才可靠比较）
            const fs = window.getComputedStyle(node).fontSize || '';
            if (!fs.endsWith('px')) return;
            orig = parseFloat(fs);
            if (Number.isNaN(orig) || !orig) return;
            node.setAttribute(REDDIT_ORIG_FS_ATTR, String(orig));
        }
        if (Number.isNaN(orig) || !orig) return;
        if (orig < minSize) {
            node.style.fontSize = `${minSize}px`;
        } else {
            // 原始就比下限大：不改（清掉可能残留的 inline）
            node.style.fontSize = '';
        }
    });
}

function clearRedditMainMarks() {
    document
        .querySelectorAll<HTMLElement>(`[${REDDIT_MAIN_ATTR}]`)
        .forEach((el) => el.removeAttribute(REDDIT_MAIN_ATTR));
    document
        .querySelectorAll<HTMLElement>(`[${REDDIT_ORIG_FS_ATTR}]`)
        .forEach((el) => {
            el.style.fontSize = '';
            el.removeAttribute(REDDIT_ORIG_FS_ATTR);
        });
}

function applyRedditMainColumn() {
    if (window.self !== window.top) return;
    if (!/(^|\.)reddit\.com$/i.test(window.location.hostname)) return;

    const enabled =
        (config as any).redditMainOptimize !== false &&
        isRedditOptimizePath(window.location.pathname);

    if (!enabled) {
        clearRedditMainMarks();
        return;
    }

    const column = findRedditMainColumn();
    if (!column) {
        // 正文尚未渲染（shreddit 异步），等待 observer 再次触发
        return;
    }

    let minSize = Number((config as any).redditMinFontSize);
    if (!Number.isFinite(minSize) || minSize <= 0) minSize = 16;

    column.setAttribute(REDDIT_MAIN_ATTR, '1');
    applyRedditMinFont(column, minSize);
}

function scheduleRedditMainSync() {
    if (redditSyncTimer != null) return;
    redditSyncTimer = window.setTimeout(() => {
        redditSyncTimer = null;
        try { applyRedditMainColumn(); } catch {}
    }, 150);
}

function setupRedditMainWatcher() {
    if (window.self !== window.top) return;
    if (!/(^|\.)reddit\.com$/i.test(window.location.hostname)) return;

    applyRedditMainColumn();

    if (!redditObserver) {
        redditObserver = new MutationObserver(() => scheduleRedditMainSync());
        redditObserver.observe(document.body, { childList: true, subtree: true });
    }
    // Reddit 是 SPA：路径变化不重载，轮询 pathname 重新应用
    if (redditRouteTimer == null) {
        let lastPath = window.location.pathname;
        redditRouteTimer = window.setInterval(() => {
            if (window.location.pathname !== lastPath) {
                lastPath = window.location.pathname;
                clearRedditMainMarks();
                applyRedditMainColumn();
            }
        }, 500);
    }
}

function cleanupRedditMainWatcher() {
    if (redditObserver) {
        redditObserver.disconnect();
        redditObserver = null;
    }
    if (redditRouteTimer != null) {
        window.clearInterval(redditRouteTimer);
        redditRouteTimer = null;
    }
    if (redditSyncTimer != null) {
        window.clearTimeout(redditSyncTimer);
        redditSyncTimer = null;
    }
    clearRedditMainMarks();
}

/**
 * Google Docs / Slides / Sheets 等基于 canvas 渲染的页面无法做 DOM 翻译。
 * 检测到 docs.google.com/document/.../edit 形式的 URL，给出可点击的横幅，
 * 引导用户改用 /preview 视图。
 */
const GOOGLE_DOCS_BANNER_ID = 'versevibe-gdocs-canvas-banner';

function setupGoogleDocsCanvasNotice() {
    if (window.self !== window.top) return;
    if (!/(^|\.)docs\.google\.com$/i.test(window.location.hostname)) return;
    // 只针对编辑视图：/document|spreadsheets|presentation/d/<id>/edit
    const m = window.location.pathname.match(
        /^\/(document|spreadsheets|presentation)\/d\/([^/]+)\/edit/i,
    );
    if (!m) return;

    const kind = m[1];
    const docId = m[2];
    const previewUrl =
        window.location.origin +
        '/' + kind + '/d/' + docId + '/preview' + window.location.search;

    const inject = () => {
        if (document.getElementById(GOOGLE_DOCS_BANNER_ID)) return;
        const banner = document.createElement('div');
        banner.id = GOOGLE_DOCS_BANNER_ID;
        banner.style.cssText = [
            'position:fixed', 'top:12px', 'left:50%',
            'transform:translateX(-50%)', 'z-index:2147483600',
            'background:#fff7e6', 'color:#7a4d00',
            'border:1px solid #f0b860', 'border-radius:8px',
            'padding:8px 12px', 'font-size:13px', 'line-height:1.4',
            'box-shadow:0 4px 14px rgba(0,0,0,.12)',
            'font-family:-apple-system,Segoe UI,Roboto,sans-serif',
            'display:flex', 'align-items:center', 'gap:10px',
            'max-width:560px',
        ].join(';');
        banner.innerHTML =
            '<span>Google Docs 编辑视图为 canvas 渲染，无法翻译正文。</span>' +
            '<a id="' + GOOGLE_DOCS_BANNER_ID + '-go" href="' + previewUrl +
            '" style="background:#ffb84d;color:#000;padding:4px 10px;' +
            'border-radius:6px;text-decoration:none;font-weight:600;">' +
            '切换到预览视图</a>' +
            '<span id="' + GOOGLE_DOCS_BANNER_ID + '-close" ' +
            'style="cursor:pointer;opacity:.6;padding:0 4px;font-size:16px;">×</span>';
        document.body.appendChild(banner);
        document.getElementById(GOOGLE_DOCS_BANNER_ID + '-close')
            ?.addEventListener('click', () => banner.remove());
    };

    if (document.body) inject();
    else document.addEventListener('DOMContentLoaded', inject, { once: true });
}

function setupFlickrDownloadHotkey() {
    if (window.self !== window.top) return;
    if (!window.location.hostname.includes('flickr.com')) return;

    document.addEventListener('keydown', (event: KeyboardEvent) => {
        // Alt + D：Flickr 大图下载兜底快捷键（避免 commands 在部分系统被浏览器占用）
        if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.code !== 'KeyD') return;

        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

        event.preventDefault();
        event.stopPropagation();

        browser.runtime.sendMessage({
            type: 'triggerFlickrDownloadFromPageHotkey',
            url: window.location.href,
        }).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error ?? '');
            console.warn('[VerseVibe] Flickr Alt+D 触发失败:', message);
        });
    }, true);
}

// 设置/更新译文字号缩放的 CSS 变量（译文 font-size 用 calc(base * var(--vv-trans-scale))）
function applyTranslationFontScaleVar(scale: unknown) {
    const s = typeof scale === 'number' && scale > 0 ? scale : 1;
    try {
        document.documentElement.style.setProperty('--vv-trans-scale', String(s));
    } catch {
        // 某些极端环境下 documentElement 不可用，忽略
    }
}

export default defineContentScript({
    matches: ['<all_urls>'],  // 匹配所有页面
    allFrames: true,  // 必须 camelCase；WXT 不识别 all_frames，会被静默丢弃
    runAt: 'document_end',  // 在页面加载完成后运行
    async main() {
        console.log('[VerseVibe] Content script started. URL:', window.location.href);
        try {
            await configReady;
            console.log('[VerseVibe] Config loaded:', config);
        } catch (e) {
            console.error('[VerseVibe] Failed to load config:', e);
            return;
        }
        if (config.on === false) return; // 如果配置关闭，则不执行任何操作

        // 注入特定网站的兼容性样式
        injectSiteSpecificStyles();

        // 译文字号缩放：用 CSS 变量驱动译文 font-size（calc(base * var(--vv-trans-scale))），
        // 设置页放大/缩小时改变此变量即可让整页译文实时生效（所有 frame 都监听）。
        // 用独立的「上次已应用」追踪变量判断字号/样式是否变化，避免依赖共享 config 状态：
        // config.ts 中另有一个全局 storage.watch 会先 Object.assign 更新 config，
        // 若在此处对比 config.style 会因执行顺序而恒为相等，导致永远不触发重排。
        let lastTransFontScale: unknown = (config as any).translationFontScale;
        let lastTransStyle: unknown = (config as any).style;
        applyTranslationFontScaleVar(lastTransFontScale);
        storage.watch('local:config', (newValue: any) => {
            try {
                const parsed = typeof newValue === 'string' && newValue.trim() ? JSON.parse(newValue) : newValue;
                if (!parsed) return;
                // 译文字号缩放：改变 CSS 变量即可让整页译文实时放大/缩小
                if (typeof parsed.translationFontScale !== 'undefined' && parsed.translationFontScale !== lastTransFontScale) {
                    lastTransFontScale = parsed.translationFontScale;
                    (config as any).translationFontScale = parsed.translationFontScale;
                    applyTranslationFontScaleVar(parsed.translationFontScale);
                }
                // 译文样式实时切换：更新共享 config.style（翻译中新节点立即采用新样式），
                // 并对已翻译节点重新套用样式 class，无需重新翻译。
                if (typeof parsed.style !== 'undefined' && parsed.style !== lastTransStyle) {
                    lastTransStyle = parsed.style;
                    (config as any).style = parsed.style;
                    restyleExistingTranslations();
                }
            } catch {
                // 忽略解析失败
            }
        });
        // Google Docs 等基于 canvas 渲染的文档：DOM 中没有正文文本节点，
        // 任何 DOM 翻译扩展都无法工作。检测到后给出可点击的指引横幅。
        setupGoogleDocsCanvasNotice();
        setupFlickrDownloadHotkey();
        setupLinkedinWideUiWatcher();
        applyLinkedinWideUi();
        setupGithubReadmeLeftWatcher();
        setupRedditMainWatcher();

        // 添加手动翻译事件监听器
        setupManualTranslationTriggers();
        // 添加悬浮球快捷键事件监听器
        setupFloatingBallHotkey();
        // 当页面上没有悬浮球时，仍然允许使用快捷键进行全文翻译的独立开关
        // 通过是否存在悬浮球容器判断，而不是依赖配置字段，避免不同环境下状态不同步。
        let isFullPageTranslating = false;
        document.addEventListener('versevibe-toggle-translation', () => {
            const hasFloatingBall = !!document.getElementById('vv-widget-cnt');
            // 仅在当前页面上没有悬浮球实例时，由内容脚本接管快捷键，做全文翻译
            if (!hasFloatingBall) {
                isFullPageTranslating = !isFullPageTranslating;
                if (isFullPageTranslating) {
                    autoTranslateEnglishPage();
                } else {
                    restoreOriginalContent();
                }
            }
        });

        // 跨 iframe 翻译桥接：top 帧的悬浮球只能翻译 top 帧 DOM。
        // 对于 Google Docs /preview、嵌入式预览等场景，正文在 iframe 里，
        // 这里监听 postMessage，由 top 广播命令进入子 iframe 触发翻译。
        window.addEventListener('message', (ev: MessageEvent) => {
            const data = ev.data as any;
            if (!data || typeof data !== 'object' || data.__versevibe !== true) return;
            if (data.action === 'start') {
                autoTranslateEnglishPage();
            } else if (data.action === 'stop') {
                restoreOriginalContent();
            }
        });
        // 添加自动翻译事件监听器
        if (config.autoTranslate) autoTranslationEvent();

        // 挂载悬浮球（如果配置未禁用）
        if (config.disableFloatingBall !== true && window.self === window.top) {
            // 使用配置中的位置
            mountFloatingBall();
        }

        // 挂载划词翻译组件（如果配置未禁用）
        if (config.disableSelectionTranslator !== true && window.self === window.top) {
            mountSelectionTranslator();
        }

        // 挂载翻译状态组件（默认关闭，仅当明确开启时挂载）
        if (config.translationStatus === true && window.self === window.top) {
            mountTranslationStatusComponent();
        }

        // 监听配置变更：翻译进度面板开关变化时挂载/卸载
        if (window.self === window.top) {
            storage.watch('local:config', (newValue: any) => {
                try {
                    const parsed = typeof newValue === 'string' && newValue.trim() ? JSON.parse(newValue) : null;
                    const enabled = !!parsed?.translationStatus;
                    if (enabled && !translationStatusMountedRef) {
                        mountTranslationStatusComponent();
                    } else if (!enabled && translationStatusMountedRef) {
                        unmountTranslationStatusComponent();
                    }
                    applyLinkedinWideUi();
                    applyGithubReadmeLeft();
                    // Reddit 配置变更（开关 / 最小字号）即时重应用；
                    // 关闭时 applyRedditMainColumn 内部会清掉已放大的 inline 字号
                    clearRedditMainMarks();
                    applyRedditMainColumn();
                } catch {
                    if (translationStatusMountedRef) unmountTranslationStatusComponent();
                }
            });
        }

        if (window.self === window.top) {
            mountNewApiComponent();
        }

        cache.cleaner();    // 检测是否清理缓存

        // background.ts
        browser.runtime.onMessage.addListener((message: { message: string; }, sender: any, sendResponse: () => void) => {
            if (message.message === 'clearCache') cache.clean()
            sendResponse();
            return true;
        });

        // 处理悬浮球控制消息
        browser.runtime.onMessage.addListener((message: any, sender: any, sendResponse: () => void) => {
            if (message.type === 'toggleFloatingBall') {
                if (message.isEnabled) {
                    // 同步配置状态，确保键盘快捷键逻辑能准确判断当前是否有悬浮球
                    config.disableFloatingBall = false;
                    mountFloatingBall();
                } else {
                    config.disableFloatingBall = true;
                    unmountFloatingBall();
                }
                sendResponse();
                return true;
            }
            return false;
        });

        // 处理划词翻译控制消息
        browser.runtime.onMessage.addListener((message: any, sender: any, sendResponse: () => void) => {
            if (message.type === 'updateSelectionTranslatorMode') {
                // 更新配置
                config.selectionTranslatorMode = message.mode;

                if (message.mode === 'disabled') {
                    unmountSelectionTranslator();
                } else {
                    // 如果之前没有挂载，现在挂载
                    if (!document.getElementById('versevibe-selection-translator-container')) {
                        mountSelectionTranslator();
                    }
                }
                sendResponse();
                return true;
            }
            return false;
        });

        // 处理右键菜单触发的全文翻译和撤销
        browser.runtime.onMessage.addListener((message: any, sender: any, sendResponse: (response?: any) => void) => {
            if (message.type === 'contextMenuTranslate') {
                // 检查插件是否已启用
                // if (config.on === false) {
                //     sendResponse({ status: 'disabled' });
                //     return true;
                // }

                if (message.action === 'fullPage') {
                    console.log('[VerseVibe] Content: Received contextMenuTranslate fullPage action');
                    // 触发全文翻译
                    autoTranslateEnglishPage();
                    sendResponse({ status: 'success', action: 'translated' });
                    return true;
                } else if (message.action === 'restore') {
                    // 撤销翻译，恢复原文
                    restoreOriginalContent();
                    sendResponse({ status: 'success', action: 'restored' });
                    return true;
                }
            }
            return false;
        });

        browser.runtime.onMessage.addListener((message: any, sender: any, sendResponse: (response?: any) => void) => {
            if (message.type !== 'contextMenuLinkedinAction') return false;

            if (message.action === 'feedWideDesponsor') {
                const result = applyLinkedinFeedWideDesponsor();
                console.log('[VerseVibe] LinkedIn feed 宽幅去赞助执行结果:', result);
                sendResponse(result);
                return true;
            }

            if (message.action === 'postTextZoom') {
                const result = applyLinkedinPostTextZoom();
                console.log('[VerseVibe] LinkedIn 文章加大字号执行结果:', result);
                sendResponse(result);
                return true;
            }

            if (message.action === 'setLinkedinWideScale') {
                const scale = typeof message.scale === 'string' ? message.scale : '1.5x';
                config.linkedinWideUi = true;
                config.linkedinWideScale = scale;
                applyLinkedinWideUi();
                sendResponse({ ok: true, scale });
                return true;
            }

            sendResponse({ ok: false, reason: 'unknown-linkedin-action' });
            return true;
        });

        browser.runtime.onMessage.addListener((message: any, sender: any, sendResponse: (response?: any) => void) => {
            if (message.type === 'triggerFloatingBallHotkeyFromSubframe') {
                if (window.self !== window.top) {
                    sendResponse({ status: 'ignored', frame: 'subframe' });
                    return true;
                }

                document.dispatchEvent(new CustomEvent('versevibe-toggle-translation'));
                sendResponse({ status: 'success', frame: 'top' });
                return true;
            }
            return false;
        });

        // 在页面卸载时清理资源
        window.addEventListener('beforeunload', () => {
            // 取消所有待处理的翻译任务
            cancelAllTranslations();
            // 移除悬浮球
            unmountFloatingBall();
            // 移除划词翻译组件
            unmountSelectionTranslator();
            if (window.self === window.top) unmountTranslationStatusComponent();
            cleanupLinkedinWideUiWatcher();
        });
    }
})

// 注册所有手动翻译触发事件监听器
function setupManualTranslationTriggers() {
    const screen = { mouseX: 0, mouseY: 0, hotkeyPressed: false, otherKeyPressed: false, hasSlideTranslation: false };
    let mouseHotkeysPressed = new Set<string>();

    // 获取当前配置的鼠标悬浮快捷键
    const getConfiguredMouseHotkeyParts = () => {
        // 如果选择了自定义快捷键，使用自定义的
        const hotkeyString = config.hotkey === 'custom'
            ? config.customHotkey
            : config.hotkey;

        if (!hotkeyString || hotkeyString === 'none') {
            return [];
        }

        // 如果是旧的单个按键格式，直接返回
        if (!hotkeyString.includes('+')) {
            const k = hotkeyString.toLowerCase();
            // 标准化修饰键名称
            if (k === 'ctrl') return ['control'];
            if (k === 'option') return ['alt'];
            return [k];
        }

        // 组合键格式
        return hotkeyString.split('+').map(key => {
            const k = key.toLowerCase();
            // 标准化修饰键名称
            if (k === 'ctrl') return 'control';
            if (k === 'option') return 'alt';
            return k;
        });
    };

    // 检查是否匹配鼠标悬浮快捷键
    const checkMouseHotkey = () => {
        const hotkeyParts = getConfiguredMouseHotkeyParts();
        if (hotkeyParts.length === 0) return false;

        const allKeysPressed = hotkeyParts.every(key => mouseHotkeysPressed.has(key));
        const exactMatch = allKeysPressed && hotkeyParts.length === mouseHotkeysPressed.size;

        return exactMatch;
    };

    // 1. 失去焦点时
    window.addEventListener('blur', () => {
        screen.hotkeyPressed = false;
        screen.otherKeyPressed = false;
        screen.hasSlideTranslation = false;
        mouseHotkeysPressed.clear();
    });

    // 2. 按下按键时（改为监听 document，避免被部分页面在 window 上拦截）
    document.addEventListener('keydown', event => {
        // 防止重复事件
        if (event.repeat) return;

        // 在 Mac 上禁止 cmd 键参与快捷键
        const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
        if (isMac && event.metaKey) {
            return;
        }

        // 记录修饰键
        if (event.altKey) mouseHotkeysPressed.add('alt');
        if (event.ctrlKey) mouseHotkeysPressed.add('control');
        if (event.metaKey && !isMac) mouseHotkeysPressed.add('control'); // 非Mac系统上metaKey映射到control
        if (event.shiftKey) mouseHotkeysPressed.add('shift');

        // 处理普通按键
        const key = event.key.toLowerCase();
        const code = event.code?.toLowerCase();

        // 处理字母键
        if (code && code.startsWith('key')) {
            const letter = code.slice(3).toLowerCase();
            mouseHotkeysPressed.add(letter);
        } else if (key.length === 1) {
            // 单个字符的按键
            mouseHotkeysPressed.add(key);
        } else if (/^f\d+$/.test(key)) {
            // 功能键 F1-F12
            mouseHotkeysPressed.add(key);
        } else {
            // 特殊键映射
            const specialKeys: Record<string, string> = {
                'escape': 'escape',
                'enter': 'enter',
                'space': 'space',
                'tab': 'tab',
                'backspace': 'backspace',
                'delete': 'delete',
                'insert': 'insert',
                'home': 'home',
                'end': 'end',
                'pageup': 'pageup',
                'pagedown': 'pagedown',
                'arrowup': 'arrowup',
                'arrowdown': 'arrowdown',
                'arrowleft': 'arrowleft',
                'arrowright': 'arrowright'
            };
            if (specialKeys[key]) {
                mouseHotkeysPressed.add(specialKeys[key]);
            }
        }

        // 检查是否匹配鼠标悬浮快捷键
        if (checkMouseHotkey()) {
            screen.hotkeyPressed = true;
            screen.otherKeyPressed = false;
        } else if (screen.hotkeyPressed) {
            screen.otherKeyPressed = true;
        }
    });

    // 3. 抬起按键时（同样挂在 document 上，保证与悬浮球快捷键一致的事件优先级）
    document.addEventListener('keyup', event => {
        // 清除字母键状态（在检查前先清除）
        const releasedKey = event.key.toLowerCase();
        const releasedCode = event.code?.toLowerCase();
        if (releasedCode && releasedCode.startsWith('key')) {
            const letter = releasedCode.slice(3).toLowerCase();
            mouseHotkeysPressed.delete(letter);
        } else if (releasedKey.length === 1) {
            mouseHotkeysPressed.delete(releasedKey);
        } else if (/^f\d+$/.test(releasedKey)) {
            mouseHotkeysPressed.delete(releasedKey);
        } else {
            // 特殊键
            const specialKeys: Record<string, string> = {
                'escape': 'escape',
                'enter': 'enter',
                'space': 'space',
                'tab': 'tab',
                'backspace': 'backspace',
                'delete': 'delete',
                'insert': 'insert',
                'home': 'home',
                'end': 'end',
                'pageup': 'pageup',
                'pagedown': 'pagedown',
                'arrowup': 'arrowup',
                'arrowdown': 'arrowdown',
                'arrowleft': 'arrowleft',
                'arrowright': 'arrowright'
            };
            if (specialKeys[releasedKey]) {
                mouseHotkeysPressed.delete(specialKeys[releasedKey]);
            }
        }

        // 清除修饰键状态
        if (!event.altKey) mouseHotkeysPressed.delete('alt');
        if (!event.ctrlKey) mouseHotkeysPressed.delete('control');
        if (!event.metaKey) mouseHotkeysPressed.delete('control');
        if (!event.shiftKey) mouseHotkeysPressed.delete('shift');

        // 获取当前配置的快捷键
        const hotkeyParts = getConfiguredMouseHotkeyParts();

        // 如果当前按键集合为空，且之前激活了快捷键，且配置的快捷键不包含当前释放的键，则触发翻译
        if (screen.hotkeyPressed && mouseHotkeysPressed.size === 0 && !screen.otherKeyPressed && !screen.hasSlideTranslation) {
            // 检查插件是否开启
            if (config.on) {
                handleTranslation(screen.mouseX, screen.mouseY);
            }
        }

        // 如果所有按键都释放了，重置状态
        if (mouseHotkeysPressed.size === 0) {
            screen.hotkeyPressed = false;
            screen.otherKeyPressed = false;
            screen.hasSlideTranslation = false;
        }
    });

    // 4. 鼠标移动时更新位置，并根据 hotkeyPressed 决定是否触发翻译
    document.body.addEventListener('mousemove', event => {
        screen.mouseX = event.clientX;
        screen.mouseY = event.clientY;
        if (screen.hotkeyPressed && config.on) {
            screen.hasSlideTranslation = true;
            handleTranslation(screen.mouseX, screen.mouseY, 50)
        }
    });

    // 5、手机端触摸事件，取中心点翻译
    document.body.addEventListener('touchstart', event => {
        let coordinate;
        switch (config.hotkey) {
            case constants.TwoFinger:
                coordinate = getCenterPoint(event.touches, 2);
                break;
            case constants.ThreeFinger:
                coordinate = getCenterPoint(event.touches, 3);
                break;
            case constants.FourFinger:
                coordinate = getCenterPoint(event.touches, 4);
                break;
            default:
                return
        }

        // 检查插件是否开启
        if (config.on) {
            handleTranslation(coordinate!.x, coordinate!.y);
        }
    });

    // 6、双击鼠标翻译事件
    document.body.addEventListener('dblclick', event => {
        if (config.hotkey == constants.DoubleClick && config.on) {
            // 通过双击事件获取鼠标位置
            let mouseX = event.clientX;
            let mouseY = event.clientY;
            // 调用 handleTranslation 函数进行翻译
            handleTranslation(mouseX, mouseY);
        }
    });

    // 7、长按鼠标翻译事件（长按事件时鼠标不能移动）
    let timer: number;
    let startPos = { x: 0, y: 0 }; // startPos 记录鼠标按下时的位置
    document.body.addEventListener('mouseup', () => clearTimeout(timer));
    document.body.addEventListener('mousedown', event => {
        if (config.hotkey === constants.LongPress) {
            clearTimeout(timer); // 清除之前的计时器
            startPos.x = event.clientX; // 记录鼠标按下时的初始位置
            startPos.y = event.clientY;
            timer = setTimeout(() => {
                if (config.on) {
                    let mouseX = event.clientX;
                    let mouseY = event.clientY;
                    handleTranslation(mouseX, mouseY);
                }
            }, 500) as unknown as number;
        }
    });
    document.body.addEventListener('mousemove', event => {
        // 如果鼠标移动超过10像素，取消长按事件
        if (Math.abs(event.clientX - startPos.x) > 10 || Math.abs(event.clientY - startPos.y) > 10) {
            clearTimeout(timer);
        }
    });
    document.body.addEventListener('mousemove', event => {
        // 检测鼠标是否移动，如果鼠标移动超过10像素，取消长按事件
        if (config.hotkey === constants.LongPress
            && Math.abs(event.clientX - startPos.x) > 10 || Math.abs(event.clientY - startPos.y) > 10) {
            clearTimeout(timer);
        }
    });


    // 8、鼠标中键翻译事件
    document.body.addEventListener('mousedown', event => {
        if (config.hotkey === constants.MiddleClick && config.on) {
            if (event.button === 1) {
                let mouseX = event.clientX;
                let mouseY = event.clientY;
                handleTranslation(mouseX, mouseY);
            }
        }
    });


    // 9、触屏设备双击/三击翻译事件
    let touchCount = 0;
    let touchTimer: any;
    document.body.addEventListener('touchstart', event => {
        // 检查是否为有效的热键配置，并且只处理单指触摸事件
        if (![constants.DoubleClickScreen, constants.TripleClickScreen].includes(config.hotkey)
            || event.touches.length !== 1) return;

        // 确定需要的点击次数
        const requiredTouches = config.hotkey === constants.DoubleClickScreen ? 2 : 3;

        touchCount++; // 记录触摸次数

        if (touchCount === 1) {
            // 如果是第一次触摸，设置定时器，500ms内没有达到所需的触摸次数则重置
            touchTimer = setTimeout(() => touchCount = 0, 500);
        } else if (touchCount === requiredTouches) {
            // 如果达到了所需的触摸次数，清除定时器并调用翻译处理函数
            clearTimeout(touchTimer);
            touchCount = 0;
            if (config.on) {
                handleTranslation(event.touches[0].clientX, event.touches[0].clientY);
            }
        }
    });
}

// 设置全文翻译快捷键（与悬浮球解耦）
function setupFloatingBallHotkey() {
    // 如果快捷键设置为 "none"，则禁用快捷键
    if (config.floatingBallHotkey === 'none') return;

    // 添加全局键盘事件监听
    let hotkeysPressed = new Set<string>();
    let lastTriggerTime = 0; // 用于防止快捷键在极短时间内重复触发（如系统按键重复）

    // 开发环境标志
    // @ts-ignore
    const isDev = import.meta.env.DEV;

    // 检测操作系统类型
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);

    // 获取当前配置的快捷键
    const getConfiguredHotkeyParts = () => {
        // 如果选择了自定义快捷键，使用自定义的
        const hotkeyString = config.floatingBallHotkey === 'custom'
            ? config.customFloatingBallHotkey
            : config.floatingBallHotkey;

        if (!hotkeyString || hotkeyString === 'none') {
            return [];
        }

        return hotkeyString.split('+').map(key => {
            const k = key.toLowerCase();
            // 标准化修饰键名称
            if (k === 'ctrl') return 'control';
            if (k === 'option') return 'alt';
            return k;
        });
    };

    if (isDev) {
        console.log(`[VerseVibe] 设置悬浮球快捷键: ${config.floatingBallHotkey}, 系统: ${isMac ? 'macOS' : '其他'}`);
    }

    // 监听按键按下事件
    document.addEventListener('keydown', (event) => {
        // 注意：这里不能对 keydown 做时间防抖式的提前 return，
        // 否则会丢弃「组合键」中后到的那一个按键。
        // 物理按下 Alt+A 时，Alt 与 A 两个 keydown 间隔通常 > 几十毫秒；
        // 但键盘宏 / 录制的快捷方式会以极快速度连续派发 Alt-down、A-down，
        // 若在此处按时间间隔丢弃事件，A 永远不会被记入 hotkeysPressed，导致无法匹配。
        // 重复触发的防抖改为在「命中快捷键、真正派发动作」处进行（见下方 lastTriggerTime）。

        // 在 Mac 上禁止 cmd 键参与快捷键
        if (isMac && event.metaKey) {
            return;
        }

        // 记录修饰键状态
        if (event.altKey) hotkeysPressed.add('alt');
        if (event.ctrlKey) hotkeysPressed.add('control');
        if (event.metaKey && !isMac) hotkeysPressed.add('control'); // 非Mac系统上metaKey映射到control
        if (event.shiftKey) hotkeysPressed.add('shift');

        // 处理普通按键
        const key = event.key.toLowerCase();
        const code = event.code?.toLowerCase();

        // 处理字母键
        if (code && code.startsWith('key')) {
            const letter = code.slice(3).toLowerCase();
            hotkeysPressed.add(letter);
        } else if (key.length === 1) {
            // 单个字符的按键
            hotkeysPressed.add(key);
        } else if (/^f\d+$/.test(key)) {
            // 功能键 F1-F12
            hotkeysPressed.add(key);
        } else {
            // 特殊按键
            const specialKeys: Record<string, string> = {
                'escape': 'escape',
                'enter': 'enter',
                'space': 'space',
                'tab': 'tab',
                'backspace': 'backspace',
                'delete': 'delete',
                'arrowup': 'arrowup',
                'arrowdown': 'arrowdown',
                'arrowleft': 'arrowleft',
                'arrowright': 'arrowright',
                'home': 'home',
                'end': 'end',
                'pageup': 'pageup',
                'pagedown': 'pagedown',
                'insert': 'insert'
            };

            if (specialKeys[key]) {
                hotkeysPressed.add(specialKeys[key]);
            }
        }

        // 获取当前配置的快捷键
        const hotkeyParts = getConfiguredHotkeyParts();

        // 如果没有配置快捷键，不处理
        if (hotkeyParts.length === 0) {
            return;
        }

        // 检查当前按下的键是否完全匹配配置的快捷键
        const allKeysPressed = hotkeyParts.every(key => hotkeysPressed.has(key));
        const exactMatch = allKeysPressed && hotkeyParts.length === hotkeysPressed.size;

        // 如果按键组合完全匹配配置的快捷键
        // 无论悬浮球是否启用，都派发统一事件，由对应处理方接管
        if (exactMatch) {
            // 检查插件是否开启
            if (!config.on) return;

            // 如果当前焦点在输入框/可编辑区域，优先保证输入体验，不拦截按键
            const target = event.target as HTMLElement | null;
            if (target && isInputElement(target)) {
                return;
            }

            // 防止系统按键重复 / 宏多次派发导致的连续触发：
            // 仅在真正命中快捷键时做时间防抖，不影响组合键的按键累积。
            const now = Date.now();
            if (now - lastTriggerTime < 300) return;
            lastTriggerTime = now;

            // 阻止默认行为（避免页面自身的快捷键抢占），但不阻断事件传播，
            // 让挂在 window 上的其他快捷键逻辑（如键盘选项）也能收到事件。
            event.preventDefault();

            // 通过自定义事件来触发翻译
            document.dispatchEvent(new CustomEvent('versevibe-toggle-translation'));

            if (window.self !== window.top) {
                browser.runtime.sendMessage({ type: 'triggerFloatingBallHotkeyFromSubframe' }).catch((error: any) => {
                    if (isDev) {
                        console.warn('[VerseVibe][Hotkey] 子 frame 转发到顶层失败', error);
                    }
                });
            }

            if (isDev) {
                const activeHotkey = config.floatingBallHotkey === 'custom'
                    ? config.customFloatingBallHotkey
                    : config.floatingBallHotkey;
                console.log(`[VerseVibe] 触发悬浮球翻译，快捷键: ${activeHotkey}`);
            }
        }
    });

    // 监听按键释放事件
    document.addEventListener('keyup', (event) => {
        // 清除字母键状态
        const releasedKey = event.key.toLowerCase();
        const releasedCode = event.code?.toLowerCase();
        if (releasedCode && releasedCode.startsWith('key')) {
            const letter = releasedCode.slice(3).toLowerCase();
            hotkeysPressed.delete(letter);
        } else if (releasedKey.length === 1) {
            hotkeysPressed.delete(releasedKey);
        } else if (/^f\d+$/.test(releasedKey)) {
            hotkeysPressed.delete(releasedKey);
        } else {
            // 特殊键
            const specialKeys: Record<string, string> = {
                'escape': 'escape',
                'enter': 'enter',
                'space': 'space',
                'tab': 'tab',
                'backspace': 'backspace',
                'delete': 'delete',
                'arrowup': 'arrowup',
                'arrowdown': 'arrowdown',
                'arrowleft': 'arrowleft',
                'arrowright': 'arrowright',
                'home': 'home',
                'end': 'end',
                'pageup': 'pageup',
                'pagedown': 'pagedown',
                'insert': 'insert'
            };
            if (specialKeys[releasedKey]) {
                hotkeysPressed.delete(specialKeys[releasedKey]);
            }
        }

        // 清除修饰键状态
        if (!event.altKey) hotkeysPressed.delete('alt');
        if (!event.ctrlKey) hotkeysPressed.delete('control');
        if (!event.metaKey) hotkeysPressed.delete('control');
        if (!event.shiftKey) hotkeysPressed.delete('shift');
    });

    // 页面失焦或切换标签页时，清除所有按键状态
    window.addEventListener('blur', () => {
        hotkeysPressed.clear();
    });
}

// 注册自动翻译事件
function autoTranslationEvent() {
    // 自动翻译英文页面。
    // 翻译动作只需等待「网页结构（DOM）解析完毕」即可开始，
    // 无需等待浏览器把图片 / 多媒体等子资源 100% 加载完成（即不等待 window 'load'）。
    if (document.readyState === 'loading') {
        // 理论上内容脚本 runAt: 'document_end' 时 DOM 已解析完毕，
        // 这里仅作兜底：若仍处于解析阶段，等到 DOMContentLoaded 立即翻译。
        document.addEventListener('DOMContentLoaded', () => autoTranslateEnglishPage(), { once: true });
    } else {
        autoTranslateEnglishPage();
    }
}

// 清除所有翻译的函数
function clearAllTranslations() {
    // 1. 移除所有翻译结果元素
    document.querySelectorAll('.verse-vibe-translation').forEach(el => el.remove());

    // 2. 移除所有加载状态
    document.querySelectorAll('.verse-vibe-loading').forEach(el => el.remove());

    // 3. 移除所有错误状态
    document.querySelectorAll('.verse-vibe-failure').forEach(el => el.remove());

    // 4. 移除所有翻译相关的类名
    document.querySelectorAll('.verse-vibe-processed').forEach(el => {
        el.classList.remove('verse-vibe-processed');
    });

    // 5. 清除内存中的缓存
    cache.clean();

    console.log('已清除所有翻译缓存');
}

let translationStatusMountedRef: { app: ReturnType<typeof createApp>; container: HTMLElement } | null = null;

/**
 * 挂载翻译状态组件（仅主框架且未挂载时执行）
 */
function mountTranslationStatusComponent() {
    if (translationStatusMountedRef) return;
    if (window.self !== window.top) return;
    const container = document.createElement('div');
    container.id = 'versevibe-translation-status-container';
    document.body.appendChild(container);
    const app = createApp(TranslationStatus);
    const mounted = mountVueWithTrustedTypesBypass(() => app.mount(container));
    if (!mounted) {
        app.unmount();
        container.remove();
        return;
    }
    translationStatusMountedRef = { app, container };
}

/**
 * 卸载翻译状态组件
 */
function unmountTranslationStatusComponent() {
    if (!translationStatusMountedRef) return;
    try {
        translationStatusMountedRef.app.unmount();
        translationStatusMountedRef.container.remove();
    } finally {
        translationStatusMountedRef = null;
    }
}

/**
 * 输入框翻译功能
 */
function setupInputBoxTranslation() {
    let keyPressCount = 0;
    let keyPressTimer: NodeJS.Timeout | null = null;
    let lastTriggerKey = '';
    const TRIPLE_KEY_TIMEOUT = 1000; // 1秒内连续按三下才生效

    // 监听键盘事件
    document.addEventListener('keydown', async (event) => {
        // 检查功能是否启用
        if (config.inputBoxTranslationTrigger === 'disabled') {
            return;
        }

        // 检查当前焦点元素是否为输入框
        const activeElement = document.activeElement as HTMLElement;
        if (!isInputElement(activeElement)) {
            return;
        }

        // 处理不同的触发方式
        const triggerType = config.inputBoxTranslationTrigger;

        if (triggerType === 'ctrl_enter') {
            // Ctrl+Enter 触发
            if (event.ctrlKey && event.key === 'Enter') {
                event.preventDefault();
                await handleInputBoxTranslation(activeElement);
                return;
            }
        } else if (triggerType === 'triple_space' || triggerType === 'triple_equal' || triggerType === 'triple_dash') {
            // 连按三次触发
            let targetKey = '';
            switch (triggerType) {
                case 'triple_space':
                    targetKey = ' ';
                    break;
                case 'triple_equal':
                    targetKey = '=';
                    break;
                case 'triple_dash':
                    targetKey = '-';
                    break;
            }

            // 只响应目标按键
            if (event.key !== targetKey) {
                // 如果按的不是目标键，重置计数器
                keyPressCount = 0;
                lastTriggerKey = '';
                if (keyPressTimer) {
                    clearTimeout(keyPressTimer);
                    keyPressTimer = null;
                }
                return;
            }

            // 检查是否是同一个按键的连续按下
            if (lastTriggerKey !== targetKey) {
                keyPressCount = 1;
                lastTriggerKey = targetKey;
            } else {
                keyPressCount++;
            }

            // 如果是第三次按下目标键
            if (keyPressCount === 3) {
                event.preventDefault(); // 阻止默认输入
                await handleInputBoxTranslation(activeElement);
                keyPressCount = 0; // 重置计数器
                lastTriggerKey = '';
            }

            // 设置超时，如果在指定时间内没有连续按满三次，就重置计数器
            if (keyPressTimer) {
                clearTimeout(keyPressTimer);
            }
            keyPressTimer = setTimeout(() => {
                keyPressCount = 0;
                lastTriggerKey = '';
            }, TRIPLE_KEY_TIMEOUT);
        }
    });
}

/**
 * 检查元素是否为输入元素
 */
function isInputElement(element: HTMLElement): boolean {
    if (!element) return false;

    const tagName = element.tagName.toLowerCase();
    const isInput = tagName === 'input';
    const isTextarea = tagName === 'textarea';
    const isContentEditable = element.contentEditable === 'true';

    // 对于input元素，还需要检查type属性
    if (isInput) {
        const inputType = (element as HTMLInputElement).type.toLowerCase();
        const textInputTypes = ['text', 'search', 'url', 'email', 'password'];
        return textInputTypes.includes(inputType);
    }

    return isTextarea || isContentEditable;
}

/**
 * 获取输入框中的文本
 */
function getInputBoxText(element: HTMLElement): string {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'input' || tagName === 'textarea') {
        return (element as HTMLInputElement | HTMLTextAreaElement).value.trim();
    } else if (element.contentEditable === 'true') {
        return element.innerText.trim();
    }

    return '';
}

/**
 * 注入特定网站的样式补丁
 */
function injectSiteSpecificStyles() {
    const hostname = window.location.hostname;

    // Reddit 侧边栏布局修复
    if (hostname.includes('reddit.com')) {
        const style = document.createElement('style');
        style.textContent = `
            /* Allow wrapping in sidebar to prevent layout breakage */
            aside .subreddit-name,
            aside .author-name,
            aside faceplate-timeago,
            aside .whitespace-nowrap,
            [slot="sidebar"] .whitespace-nowrap,
            shreddit-async-loader[name="sidebar"] .whitespace-nowrap,
            .prose .whitespace-nowrap {
                white-space: normal !important;
                word-break: break-word !important;
                overflow: visible !important;
            }
            
            /* Fix specific button text overflow */
            aside button {
                white-space: normal !important;
                height: auto !important;
                min-height: 32px;
            }

            /* Fix Recent Posts layout in sidebar: Force vertical stacking */
            .i18n-list-item-post-content,
            aside [class*="i18n-list-item-post-content"] {
                flex-direction: column !important;
                align-items: flex-start !important;
            }
            
            /* Ensure title takes full width and wraps */
            .i18n-list-item-post-title,
            aside [class*="i18n-list-item-post-title"] {
                white-space: normal !important;
                width: 100% !important;
                display: block !important;
            }

            /* 确保 Reddit 上双语译文块总是换行显示在原文下方，而不是挤到右侧 */
            .verse-vibe-bilingual .verse-vibe-bilingual-content {
                display: block !important;
                width: 100% !important;
                margin-top: 4px;
            }
        `;
        document.head.appendChild(style);
        console.log('[VerseVibe] Injected Reddit sidebar compatibility styles');
    }
}

/**
 * 根据触发方式去除末尾的触发符号
 */
function removeTriggerSymbols(text: string, triggerType: string): string {
    if (!text || triggerType === 'disabled' || triggerType === 'ctrl_enter') {
        return text;
    }

    let triggerSymbol = '';
    switch (triggerType) {
        case 'triple_space':
            triggerSymbol = ' ';
            break;
        case 'triple_equal':
            triggerSymbol = '=';
            break;
        case 'triple_dash':
            triggerSymbol = '-';
            break;
        default:
            return text;
    }

    // 去除末尾所有的触发符号
    let cleanedText = text;
    while (cleanedText.endsWith(triggerSymbol)) {
        cleanedText = cleanedText.slice(0, -1);
    }

    return cleanedText.trim();
}

/**
 * 设置输入框中的文本
 */
function setInputBoxText(element: HTMLElement, text: string): void {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'input' || tagName === 'textarea') {
        const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
        inputElement.value = text;

        // 触发input事件，以便网页能感知到值的变化
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element.contentEditable === 'true') {
        element.innerText = text;

        // 触发input事件
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

/**
 * 创建并显示翻译提示弹窗
 */
function createTranslationTooltip(element: HTMLElement, message: string, type: 'translating' | 'success' | 'error'): HTMLElement {
    // 移除已存在的提示
    removeExistingTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = `verse-vibe-input-tooltip ${type}`;
    tooltip.id = 'verse-vibe-input-translation-tooltip';

    // 添加图标和文字
    const icon = getTooltipIcon(type);
    tooltip.innerHTML = `${icon} ${message}`;

    // 计算位置
    const rect = element.getBoundingClientRect();
    const tooltipTop = rect.bottom + window.scrollY + 12;
    const tooltipLeft = rect.left + window.scrollX + (rect.width / 2);

    tooltip.style.top = `${tooltipTop}px`;
    tooltip.style.left = `${tooltipLeft}px`;
    tooltip.style.transform = 'translateX(-50%)';

    // 如果禁用动画，直接显示，否则使用淡入效果
    if (!config.animations) {
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateX(-50%) translateY(0)';
    } else {
        tooltip.style.opacity = '0';
        setTimeout(() => {
            tooltip.classList.add('show');
        }, 10);
    }

    document.body.appendChild(tooltip);
    return tooltip;
}

/**
 * 获取提示图标
 */
function getTooltipIcon(type: 'translating' | 'success' | 'error'): string {
    const icons = {
        translating: '•',
        success: '✓',
        error: '!'
    };
    return icons[type];
}

/**
 * 移除现有的提示弹窗
 */
function removeExistingTooltip(): void {
    const existing = document.getElementById('verse-vibe-input-translation-tooltip');
    if (existing) {
        if (!config.animations) {
            // 如果禁用动画，直接移除
            existing.remove();
        } else {
            // 使用淡出动画
            existing.classList.add('hide');
            setTimeout(() => existing.remove(), 300);
        }
    }
}

/**
 * 添加输入框动画效果
 */
function addInputBoxAnimation(element: HTMLElement, animationType: 'translating' | 'success' | 'error'): void {
    // 如果禁用了动画，则不添加动画效果
    if (!config.animations) {
        return;
    }

    // 移除已存在的动画类
    element.classList.remove('verse-vibe-input-translating', 'verse-vibe-input-success', 'verse-vibe-input-error');

    // 添加新的动画类
    element.classList.add(`verse-vibe-input-${animationType}`);

    // 如果不是翻译中的动画，在动画完成后移除类
    if (animationType !== 'translating') {
        setTimeout(() => {
            element.classList.remove(`verse-vibe-input-${animationType}`);
        }, animationType === 'success' ? 1000 : 600);
    }
}

/**
 * 专门用于输入框翻译的微软翻译函数（不使用缓存）
 * 通过background脚本调用，避免Firefox的CORS问题
 */
async function translateWithMicrosoft(text: string, targetLang: string): Promise<string> {
    try {
        // 发送消息给background脚本进行翻译
        const result = await browser.runtime.sendMessage({
            type: 'inputBoxTranslation',
            text: text,
            targetLang: targetLang
        });

        if (result && result.success) {
            return result.translatedText;
        } else {
            throw new Error(result?.error || '微软翻译失败');
        }
    } catch (error) {
        console.error('微软翻译请求失败:', error);
        throw error;
    }
}

/**
 * 处理输入框翻译
 */
async function handleInputBoxTranslation(element: HTMLElement): Promise<void> {
    let tooltip: HTMLElement | null = null;

    try {
        const originalText = getInputBoxText(element);

        if (!originalText) {
            return;
        }

        // 根据触发方式去除末尾的触发符号
        const cleanedText = removeTriggerSymbols(originalText, config.inputBoxTranslationTrigger);

        if (!cleanedText) {
            return;
        }

        // 显示翻译中的动画和提示
        addInputBoxAnimation(element, 'translating');
        tooltip = createTranslationTooltip(element, '微软翻译中', 'translating');

        try {
            // 直接调用微软翻译API，不使用缓存
            const translatedText = await translateWithMicrosoft(cleanedText, config.inputBoxTranslationTarget);

            if (translatedText && translatedText !== cleanedText) {
                // 移除翻译中的动画
                element.classList.remove('verse-vibe-input-translating');

                // 设置翻译结果
                setInputBoxText(element, translatedText);

                // 显示成功动画和提示
                addInputBoxAnimation(element, 'success');
                removeExistingTooltip();
                tooltip = createTranslationTooltip(element, '翻译成功', 'success');
            } else {
                // 翻译结果与原文相同或为空
                element.classList.remove('verse-vibe-input-translating');
                addInputBoxAnimation(element, 'error');
                removeExistingTooltip();
                tooltip = createTranslationTooltip(element, '内容无需翻译', 'error');
            }
        } catch (translationError) {
            // 翻译失败
            element.classList.remove('verse-vibe-input-translating');
            addInputBoxAnimation(element, 'error');
            removeExistingTooltip();
            tooltip = createTranslationTooltip(element, '微软翻译失败', 'error');
            console.error('微软翻译失败:', translationError);
        }

        // 自动隐藏提示
        setTimeout(() => removeExistingTooltip(), 2500);

    } catch (error) {
        console.error('输入框翻译失败:', error);

        // 移除翻译中的动画
        element.classList.remove('verse-vibe-input-translating');

        // 显示错误动画和提示
        addInputBoxAnimation(element, 'error');
        removeExistingTooltip();
        tooltip = createTranslationTooltip(element, '翻译服务暂时不可用', 'error');

        // 自动隐藏错误提示
        setTimeout(() => removeExistingTooltip(), 3000);
    }
}

// 初始化输入框翻译功能
setupInputBoxTranslation();
