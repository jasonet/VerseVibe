// Keep layout changes reversible without replacing Reddit's DOM or event handlers.
const WIDE_ATTR = 'data-vv-reddit-wide';
const savedStyles = new Map<HTMLElement, Map<string, [string, string]>>();
let activeColumn: HTMLElement | null = null;

function setStyle(element: HTMLElement, property: string, value: string) {
    let properties = savedStyles.get(element);
    if (!properties) savedStyles.set(element, properties = new Map());
    if (!properties.has(property)) {
        properties.set(property, [element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
    }
    element.style.setProperty(property, value, 'important');
}

export function clearRedditWide() {
    for (const [element, properties] of savedStyles) {
        for (const [property, [value, priority]] of properties) {
            if (value) element.style.setProperty(property, value, priority);
            else element.style.removeProperty(property);
        }
        element.removeAttribute(WIDE_ATTR);
    }
    savedStyles.clear();
    activeColumn = null;
}

export function applyRedditWide(column: HTMLElement | null, enabled: boolean, scale = 1.5) {
    if (!enabled || !column || window.innerWidth < 960) {
        clearRedditWide();
        return;
    }
    if (!Number.isFinite(scale) || scale < 1) scale = 1.5;

    // 1x 档位即为原始宽度，清除加宽并恢复原生布局
    if (scale <= 1) {
        clearRedditWide();
        return;
    }

    if (activeColumn === column && column.isConnected) return;
    clearRedditWide();

    const sidebarSelector = [
        'aside', '#right-sidebar-container', '[data-testid="right-sidebar"]',
        '[data-testid="subreddit-sidebar"]', 'shreddit-async-loader[name="sidebar"]',
        '[slot="sidebar"]',
    ].join(', ');

    const visible = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
    };

    // 获取左侧导航栏占用的宽度，用于计算主体可用的居中空间
    const leftNav = document.querySelector<HTMLElement>('reddit-sidebar-nav, #left-sidebar-container, [data-testid="left-sidebar"]');
    const leftNavWidth = (leftNav && visible(leftNav)) ? Math.round(leftNav.getBoundingClientRect().width) : 0;
    const availTotal = Math.max(640, window.innerWidth - leftNavWidth - 32);

    // Reddit's current layout often nests the sidebar several levels below the
    // actual two-column host. Find the nearest ancestor whose direct children
    // contain the feed and sidebar in separate branches.
    const sidebar = Array.from(document.querySelectorAll<HTMLElement>(sidebarSelector))
        .find((element) => element !== column && !column.contains(element) && visible(element));
    let layout: HTMLElement | null = null;
    let mainBranch: HTMLElement | null = null;
    let sideBranch: HTMLElement | null = null;
    if (sidebar) {
        for (let ancestor = column.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
            const directChildren = Array.from(ancestor.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
            const feedChild = directChildren.find((child) => child === column || child.contains(column));
            const sidebarChild = directChildren.find((child) => child === sidebar || child.contains(sidebar));
            if (feedChild && sidebarChild && feedChild !== sidebarChild) {
                layout = ancestor;
                mainBranch = feedChild;
                sideBranch = sidebarChild;
                break;
            }
        }
    }

    // Keep the feed itself full width inside its resized main branch. Applying
    // 150% directly to a child while leaving a sidebar on the same line is what
    // caused the overlap reported on Reddit's current feed layout.
    if (layout && mainBranch && sideBranch) {
        const layoutStyle = getComputedStyle(layout);
        const isGrid = layoutStyle.display === 'grid';
        const isFlex = layoutStyle.display === 'flex' && layoutStyle.flexDirection === 'row';

        // 逐层放开祖先容器的 max-width 约束，并确保各层水平居中（避免偏右或靠左）
        for (let wrapper: HTMLElement | null = layout.parentElement; wrapper && wrapper !== document.body; wrapper = wrapper.parentElement) {
            if (wrapper.querySelector('reddit-sidebar-nav, #left-sidebar-container')) {
                setStyle(wrapper, 'max-width', '100%');
                setStyle(wrapper, 'box-sizing', 'border-box');
                break;
            }
            setStyle(wrapper, 'max-width', '100%');
            setStyle(wrapper, 'width', '100%');
            setStyle(wrapper, 'box-sizing', 'border-box');
            setStyle(wrapper, 'margin-left', 'auto');
            setStyle(wrapper, 'margin-right', 'auto');
            if (getComputedStyle(wrapper).display === 'flex') {
                setStyle(wrapper, 'justify-content', 'center');
            }
        }

        const mainRect = mainBranch.getBoundingClientRect();
        const sideRect = sideBranch.getBoundingClientRect();
        const gap = parseFloat(layoutStyle.columnGap || layoutStyle.gap || '0') || 0;
        if (mainRect.width > 0 && sideRect.width > 0 && (isGrid || isFlex)) {
            let desiredMain = Math.round(mainRect.width * scale);
            let totalWidth = desiredMain + sideRect.width + gap;

            // 如果总宽超出可用空间，自适应收窄主列至能完整容纳右侧栏为止
            if (totalWidth > availTotal) {
                desiredMain = Math.max(Math.round(mainRect.width), Math.round(availTotal - sideRect.width - gap));
                totalWidth = desiredMain + sideRect.width + gap;
            }

            setStyle(layout, 'box-sizing', 'border-box');
            setStyle(layout, 'width', `${totalWidth}px`);
            setStyle(layout, 'max-width', '100%');
            // 核心：强制两端外边距为 auto，并在父级对齐中置中，消除内容整体偏居右的问题
            setStyle(layout, 'margin-left', 'auto');
            setStyle(layout, 'margin-right', 'auto');
            setStyle(layout, 'justify-self', 'center');
            if (isGrid) {
                setStyle(layout, 'grid-template-columns', `${desiredMain}px ${sideRect.width}px`);
                setStyle(layout, 'justify-content', 'center');
            } else {
                setStyle(layout, 'justify-content', 'center');
                setStyle(mainBranch, 'flex', `0 0 ${desiredMain}px`);
                setStyle(sideBranch, 'flex', `0 0 ${sideRect.width}px`);
            }
            setStyle(mainBranch, 'width', `${desiredMain}px`);
            setStyle(mainBranch, 'box-sizing', 'border-box');
            setStyle(mainBranch, 'max-width', 'none');
            setStyle(mainBranch, 'min-width', '0');
            for (let inner: HTMLElement | null = column; inner && inner !== mainBranch; inner = inner.parentElement) {
                setStyle(inner, 'width', '100%');
                setStyle(inner, 'max-width', 'none');
                setStyle(inner, 'min-width', '0');
                setStyle(inner, 'box-sizing', 'border-box');
            }
            layout.setAttribute(WIDE_ATTR, '1');
            column.setAttribute(WIDE_ATTR, '1');

            activeColumn = column;
            return;
        }
    }

    // 若无右侧栏（单列浏览或侧栏隐藏页面）：平滑扩展至指定倍数并居中
    if (sidebar) return;
    const baseWidth = column.getBoundingClientRect().width || 640;
    const targetWidth = Math.min(Math.round(baseWidth * scale), availTotal);
    setStyle(column, 'width', `${targetWidth}px`);
    setStyle(column, 'max-width', '100%');
    setStyle(column, 'box-sizing', 'border-box');
    setStyle(column, 'margin-left', 'auto');
    setStyle(column, 'margin-right', 'auto');
    for (let wrapper: HTMLElement | null = column.parentElement; wrapper && wrapper !== document.body; wrapper = wrapper.parentElement) {
        if (wrapper.querySelector('reddit-sidebar-nav, #left-sidebar-container')) break;
        setStyle(wrapper, 'max-width', '100%');
        setStyle(wrapper, 'margin-left', 'auto');
        setStyle(wrapper, 'margin-right', 'auto');
        if (getComputedStyle(wrapper).display === 'flex') {
            setStyle(wrapper, 'justify-content', 'center');
        }
    }
    column.setAttribute(WIDE_ATTR, '1');
    activeColumn = column;
}

export const redditReadingCss = `
  /* 确保加宽容器与主体整体居中，消除偏居右现象 */
  [data-vv-reddit-wide] {
    margin-left: auto !important;
    margin-right: auto !important;
  }
  shreddit-app main,
  shreddit-app #main-content {
    margin-left: auto !important;
    margin-right: auto !important;
  }
  shreddit-app .subgrid-container,
  shreddit-app .main-container {
    margin-left: auto !important;
    margin-right: auto !important;
    justify-content: center !important;
  }
  [data-vv-reddit-wide] shreddit-post,
  [data-vv-reddit-wide] shreddit-comment-tree,
  [data-vv-reddit-wide] #comment-tree {
    max-width: 100% !important;
    width: 100% !important;
  }
  [data-vv-reddit-main] :is(.md, [id$="-post-rtjson-content"], [id$="-comment-rtjson-content"]) {
    line-height: 1.65 !important;
    overflow-wrap: anywhere;
    word-break: normal;
  }
  [data-vv-reddit-main] :is(a[slot="title"], [id^="post-title-"]) {
    line-height: 1.4 !important;
    overflow-wrap: anywhere;
  }
  [data-vv-reddit-main] .verse-vibe-bilingual-content {
    box-sizing: border-box;
    max-width: 100%;
    line-height: 1.65;
    overflow-wrap: anywhere;
  }
  [data-vv-reddit-main] pre {
    max-width: 100%;
    overflow-x: auto;
    white-space: pre;
    overflow-wrap: normal;
  }
`;
