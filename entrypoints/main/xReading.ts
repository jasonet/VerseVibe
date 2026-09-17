// X.com 时间线的 600px 上限挂在 [data-testid="primaryColumn"] 自身，
// 外层还有一层约 990px 的内容壳体；两层都不放开的话主列拿不到空间，
// 只会看到外框变宽而图文主体仍是 600px。
const WIDE_ATTR = 'data-vv-x-wide';
const STYLE_ID = 'vv-x-wide-style';
const X_FONT_STYLE_ID = 'vv-x-min-font-style';
const BASE_X_WIDTH = 600; // X 原生主时间线宽度
const savedStyles = new Map<HTMLElement, Map<string, [string, string]>>();
let activeColumn: HTMLElement | null = null;
let activeWidth = 0;
let activeScale = 0;
let activeHasSidebar = false;
let currentXMinSize = 0;

function setStyle(element: HTMLElement, property: string, value: string) {
    let properties = savedStyles.get(element);
    if (!properties) savedStyles.set(element, properties = new Map());
    if (!properties.has(property)) {
        properties.set(property, [element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
    }
    element.style.setProperty(property, value, 'important');
}

function ensureStyleEl(): HTMLStyleElement {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            main[role="main"],
            main[role="main"] > div,
            main[role="main"] > div > div {
                max-width: 100% !important;
                box-sizing: border-box !important;
            }
            [data-testid="primaryColumn"] > div,
            [data-testid="primaryColumn"] > div > div,
            [data-testid="primaryColumn"] section,
            [data-testid="primaryColumn"] section > div,
            [data-testid="primaryColumn"] [data-testid="cellInnerDiv"],
            [data-testid="primaryColumn"] [data-testid="cellInnerDiv"] > div,
            [data-testid="primaryColumn"] div[role="feed"],
            [data-testid="primaryColumn"] div[aria-label*="Timeline"],
            [data-testid="primaryColumn"] div[aria-label*="时间线"],
            [data-testid="primaryColumn"] article[data-testid="tweet"] {
                max-width: 100% !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    } else if (style.parentNode !== document.head) {
        (document.head || document.documentElement).appendChild(style);
    }
    return style;
}

function setColumnWidth(column: HTMLElement | null, widthPx: number | null) {
    ensureStyleEl();
    if (!column || widthPx == null) {
        activeWidth = 0;
        return;
    }
    // 行内样式带 !important 一定优先于 X 的原子化 class，避免样式表先后顺序影响。
    setStyle(column, 'max-width', `${widthPx}px`);
    setStyle(column, 'width', `${widthPx}px`);
    setStyle(column, 'min-width', '0');
    setStyle(column, 'box-sizing', 'border-box');
    setStyle(column, 'flex-grow', '1');
    activeWidth = widthPx;
}

export function clearXWide() {
    for (const [element, properties] of savedStyles) {
        for (const [property, [value, priority]] of properties) {
            if (value) element.style.setProperty(property, value, priority);
            else element.style.removeProperty(property);
        }
        element.removeAttribute(WIDE_ATTR);
    }
    savedStyles.clear();
    const style = document.getElementById(STYLE_ID);
    if (style) {
        style.remove();
    }
    setColumnWidth(null, null);
    activeColumn = null;
    activeWidth = 0;
    activeScale = 0;
    activeHasSidebar = false;
}

export function applyXWide(column: HTMLElement | null, enabled: boolean, scale = 2.0) {
    if (!enabled || !column || window.innerWidth < 1000) {
        clearXWide();
        return;
    }
    if (!Number.isFinite(scale) || scale < 1) scale = 2.0;

    // 原生宽度（1x）：清除所有加宽覆盖，恢复 X 原生 600px 宽度
    if (scale <= 1) {
        clearXWide();
        return;
    }

    const visible = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
    };

    const sidebar = document.querySelector<HTMLElement>('[data-testid="sidebarColumn"]');
    const hasSidebar = Boolean(sidebar && visible(sidebar));
    const targetWidth = Math.round(BASE_X_WIDTH * scale);

    // 主列与侧栏不一定同级，如果存在侧栏则找把两者分到不同子分支的公共祖先；
    // 如果无侧栏（如 /i/history、设置页、单列页面），则从 column 的直接父节点开始
    let layout: HTMLElement | null = null;
    if (sidebar) {
        for (let ancestor = column.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
            const directChildren = Array.from(ancestor.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
            const feedChild = directChildren.find((child) => child === column || child.contains(column));
            const sidebarChild = directChildren.find((child) => child === sidebar || child.contains(sidebar));
            if (feedChild && sidebarChild && feedChild !== sidebarChild) {
                layout = ancestor;
                break;
            }
        }
    }
    if (!layout) {
        layout = column.parentElement;
    }

    // 获取左侧导航栏占用的实际宽度
    const nav = document.querySelector<HTMLElement>('header[role="banner"]');
    const navWidth = nav ? Math.round(nav.getBoundingClientRect().width) : (window.innerWidth < 1280 ? 88 : 275);
    const availTotal = Math.max(BASE_X_WIDTH, window.innerWidth - navWidth - 32);

    let effectiveTarget = targetWidth;

    if (hasSidebar && sidebar) {
        // 右侧栏存在时：根据 scale 梯度分配宽度，确保 1.5x / 2x / 2.5x 在各分辨率下都呈明显递增档位
        setStyle(sidebar, 'flex-shrink', '0');
        if (scale >= 2.5) {
            // 2.5x 档位：主列大幅扩展，侧栏自适应预留紧凑宽度
            const maxForFeed = availTotal - 260;
            effectiveTarget = Math.min(targetWidth, Math.max(Math.round(BASE_X_WIDTH * 1.8), maxForFeed));
        } else if (scale >= 2.0) {
            // 2x 档位：中高档位扩展，侧栏预留 290px 标准紧凑宽度
            const maxForFeed = availTotal - 290;
            effectiveTarget = Math.min(targetWidth, Math.max(Math.round(BASE_X_WIDTH * 1.5), maxForFeed));
        } else {
            // 1.5x 档位（默认）：标准加宽，侧栏保持 350px 完整宽度
            const maxForFeed = availTotal - 350;
            effectiveTarget = Math.min(targetWidth, Math.max(BASE_X_WIDTH, maxForFeed));
        }
    } else {
        // 无侧边栏页面（如 /i/history、设置页、详情页或单列浏览）：直接扩展到设定宽度
        effectiveTarget = Math.min(targetWidth, availTotal);
    }
    effectiveTarget = Math.round(effectiveTarget);

    // 状态完全一致且 DOM 节点仍然连接时短路跳过，彻底避免在滚动过程中反复触发布局重算
    if (activeColumn === column && column.isConnected && activeWidth === effectiveTarget && activeScale === scale && activeHasSidebar === hasSidebar) {
        return;
    }

    if (layout) {
        // 放开 ~990px/1050px 内容壳体的定宽与最大宽度限制，使其能够容纳加宽后的主列
        setStyle(layout, 'width', '100%');
        setStyle(layout, 'max-width', '100%');
        setStyle(layout, 'box-sizing', 'border-box');
        for (let wrapper: HTMLElement | null = layout.parentElement; wrapper && wrapper !== document.body; wrapper = wrapper.parentElement) {
            setStyle(wrapper, 'max-width', '100%');
            setStyle(wrapper, 'width', '100%');
            setStyle(wrapper, 'box-sizing', 'border-box');
            if (wrapper.querySelector('header[role="banner"]') || wrapper.tagName === 'MAIN' || wrapper.getAttribute('role') === 'main') break;
        }
    }

    setColumnWidth(column, effectiveTarget);
    column.setAttribute(WIDE_ATTR, '1');
    activeColumn = column;
    activeWidth = effectiveTarget;
    activeScale = scale;
    activeHasSidebar = hasSidebar;
}

/**
 * 将 Reddit 正文最小字号同时作用于 X.com（Twitter）主时间线推文正文文本
 */
export function applyXMinFont(minSize: number) {
    if (typeof document === 'undefined') return;
    const size = Number.isFinite(minSize) && minSize > 0 ? minSize : 16;
    let style = document.getElementById(X_FONT_STYLE_ID) as HTMLStyleElement | null;
    if (style && currentXMinSize === size) {
        return; // 样式未变时不重复重写样式表内容，防止滚动时全局样式失效闪烁
    }
    currentXMinSize = size;
    if (!style) {
        style = document.createElement('style');
        style.id = X_FONT_STYLE_ID;
        (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = `
      [data-testid="tweetText"] {
        font-size: max(1em, ${size}px) !important;
        line-height: 1.5 !important;
      }
      [data-testid="tweetText"] * {
        font-size: inherit !important;
        line-height: inherit !important;
      }
      [data-testid="primaryColumn"] .verse-vibe-bilingual-content {
        font-size: max(1em, ${size}px) !important;
        line-height: 1.5 !important;
      }
    `;
}

export function clearXMinFont() {
    const style = document.getElementById(X_FONT_STYLE_ID);
    if (style) {
        style.textContent = '';
    }
}

export const xReadingCss = `
  [data-testid="primaryColumn"] .verse-vibe-bilingual-content {
    display: block !important;
    width: 100% !important;
    box-sizing: border-box;
    line-height: 1.6;
    overflow-wrap: anywhere;
    word-break: normal;
  }
  [data-testid="primaryColumn"] [data-testid="tweetText"] {
    overflow-wrap: anywhere;
    word-break: normal;
  }
`;
