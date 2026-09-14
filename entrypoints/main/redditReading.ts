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

export function applyRedditWide(column: HTMLElement | null, enabled: boolean) {
    if (!enabled || !column || window.innerWidth < 960) {
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

        // Release centered wrapper caps before measuring the available space;
        // otherwise the old 1120px cap makes the 150% column look clipped even
        // when the viewport has room for the sidebar beside it.
        for (let wrapper = layout.parentElement; wrapper && wrapper !== document.body; wrapper = wrapper.parentElement) {
            if (wrapper.querySelector('nav, #left-sidebar-container')) break;
            if (getComputedStyle(wrapper).maxWidth !== 'none') setStyle(wrapper, 'max-width', '100%');
        }

        const mainRect = mainBranch.getBoundingClientRect();
        const sideRect = sideBranch.getBoundingClientRect();
        const gap = parseFloat(layoutStyle.columnGap || layoutStyle.gap || '0') || 0;
        if (mainRect.width > 0 && sideRect.width > 0 && (isGrid || isFlex)) {
            const desiredMain = mainRect.width * 1.5;
            // Apply the desired width first. Centered Reddit wrappers move left
            // when their width grows, so measuring available space from the old
            // left edge would incorrectly cap the column before it reaches 150%.
            let widenedMain = desiredMain;
            const totalWidth = widenedMain + sideRect.width + gap;

            setStyle(layout, 'box-sizing', 'border-box');
            setStyle(layout, 'width', `${totalWidth}px`);
            setStyle(layout, 'max-width', '100%');
            if (isGrid) {
                setStyle(layout, 'grid-template-columns', `${widenedMain}px ${sideRect.width}px`);
            } else {
                setStyle(mainBranch, 'flex', `0 0 ${widenedMain}px`);
                setStyle(sideBranch, 'flex', `0 0 ${sideRect.width}px`);
            }
            setStyle(mainBranch, 'width', `${widenedMain}px`);
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

            // On genuinely narrow desktop widths, trim only the excess that
            // would escape the viewport, while keeping the sidebar separated.
            const sideOverflow = sideBranch.getBoundingClientRect().right - (window.innerWidth - 16);
            if (sideOverflow > 0) {
                widenedMain = Math.max(0, widenedMain - sideOverflow);
                setStyle(layout, 'width', `${widenedMain + sideRect.width + gap}px`);
                if (isGrid) setStyle(layout, 'grid-template-columns', `${widenedMain}px ${sideRect.width}px`);
                else setStyle(mainBranch, 'flex', `0 0 ${widenedMain}px`);
                setStyle(mainBranch, 'width', `${widenedMain}px`);
            }
            activeColumn = column;
            return;
        }
    }

    // If Reddit has a visible sidebar but exposes no separable layout host,
    // leave the feed at its normal width rather than letting it cover the side
    // column. A bare 150% child is only safe when no sidebar is present.
    if (sidebar) return;
    setStyle(column, 'width', '150%');
    setStyle(column, 'max-width', 'none');
    setStyle(column, 'box-sizing', 'border-box');
    column.setAttribute(WIDE_ATTR, '1');
    activeColumn = column;
}

export const redditReadingCss = `
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
