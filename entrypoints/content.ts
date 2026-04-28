import { handleTranslation, autoTranslateEnglishPage, restoreOriginalContent } from "./main/trans";
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
let linkedinWideRouteTimer: number | null = null;
let linkedinPromotedObserver: MutationObserver | null = null;
let linkedinPromotedTimer: number | null = null;
let linkedinDialogGuardBound = false;
let linkedinDialogGuardHandler: ((event: MouseEvent) => void) | null = null;

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
        }, 0);

        window.setTimeout(() => {
            syncLinkedinPromotedHideScope();
            revealMarkedMediaInDialog();
            syncLinkedinDialogMinimalMode();
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

export default defineContentScript({
    matches: ['<all_urls>'],  // 匹配所有页面
    all_frames: true,
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
        setupFlickrDownloadHotkey();
        setupLinkedinWideUiWatcher();
        applyLinkedinWideUi();

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
    let lastKeyDownTime = 0; // 用于防止按键事件重复触发

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
        // 防止事件重复触发（某些浏览器可能会重复触发keydown事件）
        const now = Date.now();
        if (now - lastKeyDownTime < 50) return;
        lastKeyDownTime = now;

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
    // 自动翻译英文页面
    autoTranslateEnglishPage();
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
