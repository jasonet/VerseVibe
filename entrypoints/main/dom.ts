import { getMainDomain, selectCompatFn } from "@/entrypoints/main/compat";
import { html } from 'js-beautify';
import { handleBtnTranslation } from "@/entrypoints/main/trans";
import { config } from "@/entrypoints/utils/config";

function isBenignExtensionMessageError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const lower = message.toLowerCase();
    return (
        lower.includes('extension context invalidated') ||
        lower.includes('receiving end does not exist') ||
        lower.includes('message port closed')
    );
}

// 直接翻译的标签集合（块级元素）
const directSet = new Set([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',  // 标题
    'p', 'li', 'dd', 'blockquote',       // 段落和列表
    'figcaption'                         // 图片说明
]);

// 需要跳过的标签
const skipSet = new Set([
    'html', 'body', 'script', 'style', 'noscript', 'iframe',
    'input', 'textarea', 'select', 'button', 'code', 'pre',
]);

// 内联元素集合（可以包含在其他元素内的元素）
export const inlineSet = new Set([
    'a', 'b', 'strong', 'span', 'em', 'i', 'u', 'small', 'sub', 'sup',
    'font', 'mark', 'cite', 'q', 'abbr', 'time', 'ruby', 'bdi', 'bdo',
    'img', 'br', 'wbr', 'svg'
]);

// 仅媒体容器：<picture> 或 <figure> 内主要为图片/媒体，避免整块 HTML 被当正文翻译导致图片标签露出
function isPictureOrFigureMediaOnly(el: Element): boolean {
    try {
        const tag = el.tagName?.toLowerCase();
        if (tag === 'picture') return true;
        if (tag !== 'figure') return false;
        const hasMedia = !!el.querySelector?.('picture, img');
        const textLen = (el.textContent || '').trim().length;
        return hasMedia && textLen < 40;
    } catch {
        return false;
    }
}

// 纯图标容器检测：只包含 img/svg 等图标元素且无实质文本
function isIconOnlyContainer(el: Element): boolean {
    try {
        const hasIcon =
            el.matches('img,svg,canvas,picture,[role="img"]') ||
            !!el.querySelector?.('img,svg,canvas,picture,[role="img"]');

        if (!hasIcon) return false;

        const text = (el.textContent || '').replace(/\s+/g, '');
        // 没有任何可见字符，或只有极少（例如 1 个符号），视为纯图标
        if (!text || text.length <= 1) return true;

        return false;
    } catch {
        return false;
    }
}

// 判断节点是否处于页头区域（<header> 或 [role="banner"]）
function isInHeaderRegion(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    if (tag === 'header') return true;
    return !!el.closest?.('header') || !!el.closest?.('[role="banner"]');
}

// 判断节点是否处于页尾区域（<footer> 或 [role="contentinfo"]）
function isInFooterRegion(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    if (tag === 'footer') return true;
    if (!!el.closest?.('footer') || !!el.closest?.('[role="contentinfo"]')) return true;

    // 启发式：某些站点（如 Immich）页尾不是 <footer>，而是页面底部的一组导航/链接区
    // 规则：在页面底部(最后 30%)、且容器内链接数量较多时，判定为页尾区域
    try {
        const container = (el.closest?.('nav,footer,section,div') as HTMLElement | null) || (el as HTMLElement);
        if (!container || !(container instanceof HTMLElement)) return false;

        // 链接数量（过滤空链接/无文本链接）
        const links = Array.from(container.querySelectorAll('a'))
            .filter(a => (a.textContent || '').trim().length > 0);
        const linkCount = links.length;
        if (linkCount < 6) return false;

        // 位置：容器在文档中的 top（而非 viewport）
        const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
        const rect = container.getBoundingClientRect();
        const topInDoc = rect.top + window.scrollY;

        // 页面底部区：top 在最后 30% 之后
        if (docHeight > 0 && topInDoc > docHeight * 0.7) {
            return true;
        }
    } catch {
        // ignore
    }

    return false;
}

// 传入父节点，返回所有需要翻译的 DOM 元素数组
export function grabAllNode(rootNode: Node): Element[] {
    if (!rootNode) return [];

    const result: Element[] = [];
    let logCount = 0; // limit logs

    const walker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node: Node): number => {
                if (node instanceof Text) return NodeFilter.FILTER_ACCEPT;

                if (!(node instanceof Element)) return NodeFilter.FILTER_SKIP;

                const tag = node.tagName.toLowerCase();
                const log = (msg: string) => {
                    if (logCount < 50) {
                        console.log(`[VerseVibe] DOM: <${tag}> ${msg}`);
                        logCount++;
                    }
                };

                // 跳过黑名单标签
                if (skipSet.has(tag) ||
                    node.classList?.contains('sr-only') ||
                    node.classList?.contains('notranslate')) {
                    log(`Rejected by skipSet/class`);
                    return NodeFilter.FILTER_REJECT;
                }

                // 纯图标容器（仅含 img/svg 等），不做翻译
                if (isIconOnlyContainer(node)) {
                    log(`Rejected icon-only container`);
                    return NodeFilter.FILTER_REJECT;
                }
                // 仅媒体 figure/picture，避免图片相关 HTML 被当正文翻译
                if (isPictureOrFigureMediaOnly(node)) {
                    log(`Rejected picture/figure media-only`);
                    return NodeFilter.FILTER_REJECT;
                }

                // 用户选项：不翻译页头/页尾时，智能跳过 header/footer 及 role=banner/contentinfo 区域
                if (config.skipTranslateHeader && isInHeaderRegion(node)) {
                    log(`Rejected header region (skipTranslateHeader)`);
                    return NodeFilter.FILTER_REJECT;
                }
                if (config.skipTranslateFooter && isInFooterRegion(node)) {
                    log(`Rejected footer region (skipTranslateFooter)`);
                    return NodeFilter.FILTER_REJECT;
                }

                // 检查是否只包含有效文本内容
                let hasText = false;
                let hasElement = false;
                let hasNonEmptyElement = false;

                for (const child of node.childNodes) {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        hasElement = true;
                        // 检查子元素是否包含文本
                        if (child.textContent?.trim()) {
                            hasNonEmptyElement = true;
                        }
                    }
                    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
                        hasText = true;
                    }
                }

                // 如果有Shadow Root，即便Light DOM为空，也需要Accept以便在循环中递归处理Shadow DOM
                if (node instanceof Element && node.shadowRoot) {
                    console.log(`[VerseVibe] DOM: Accepted Shadow Host <${tag}>`);
                    return NodeFilter.FILTER_ACCEPT;
                }

                // 如果有非空子元素，跳过当前节点
                if (hasNonEmptyElement) {
                    // log(`Skipped (has non-empty children)`);
                    return NodeFilter.FILTER_SKIP;
                }

                if (hasText && !hasElement) {
                    // log(`Accepted (Leaf Text Node)`);
                    return NodeFilter.FILTER_ACCEPT;
                }

                // 如果有子元素，继续遍历
                if (node.childNodes.length > 0) {
                    return NodeFilter.FILTER_SKIP;
                }

                // log(`Rejected (Empty/No matched criteria)`);
                return NodeFilter.FILTER_REJECT;
            }
        }
    );

    // 遍历出所有可翻译的节点
    let currentNode: Node | null;
    while (currentNode = walker.nextNode()) {
        // 先检查是否需要进入 Shadow DOM
        if (currentNode instanceof Element && currentNode.shadowRoot) {
            console.log(`[VerseVibe] DOM: Entering Shadow Root of <${currentNode.tagName.toLowerCase()}>`);
            // 递归获取 Shadow DOM 中的节点
            const shadowNodes = grabAllNode(currentNode.shadowRoot);
            console.log(`[VerseVibe] DOM: Shadow Root of <${currentNode.tagName.toLowerCase()}> returned ${shadowNodes.length} nodes`);
            result.push(...shadowNodes);
        }

        const translateNode = grabNode(currentNode as Element | Text);
        if (translateNode) {
            result.push(translateNode);
            // 跳过子节点：如果当前节点是元素且有子节点，则尝试移动到下一个兄弟节点
            // 如果没有兄弟节点，nextNode 会自动跳回到父节点层级，这是合理的
            let nextSibling = currentNode.nextSibling;
            while (nextSibling === null && currentNode.parentNode) {
                currentNode = currentNode.parentNode;
                nextSibling = currentNode.nextSibling;
            }
            if (nextSibling) {
                // 将 walker 停在兄弟节点的前一个位置，或者直接设置为兄弟节点
                // TreeWalker 的 currentNode 指向的是即将访问的节点的前一个起点
                walker.currentNode = nextSibling;
                // 注意：因为 while 循环开头会执行 nextNode()，我们需要抵消一次前进
                // 或者直接利用 currentNode 的移动。
                // 最简单的方法是：如果找到了翻译节点，就通过 nextNode() 跳过。
                // 但 TreeWalker 没有直接 skipChildren。

                // 修正方案：直接寻找当前节点的最后一个后代，将其设为 currentNode
                // 这样 nextNode() 就会走向下一个兄弟。
            }

            // 简单且有效的方案：
            let lastDescendant = translateNode;
            while (lastDescendant.lastChild) {
                lastDescendant = lastDescendant.lastChild;
            }
            walker.currentNode = lastDescendant;
        }
    }
    return Array.from(new Set(result));;
}

// 返回最终应该翻译的父节点或 false
export function grabNode(node: any): any {
    // 空节点检查
    if (!node) return false;

    // 对于 Text 节点，尝试找到其可翻译的父节点
    if (node instanceof Text) {
        const parentOrSelf = findTranslatableParent(node);
        if (parentOrSelf && parentOrSelf !== node) {
            if (parentOrSelf instanceof Element && shouldSkipNode(parentOrSelf, parentOrSelf.tagName.toLowerCase()))
                return false;
            return parentOrSelf;
        }
        return false;
    }

    if (!node.tagName) return false;

    const curTag = node.tagName.toLowerCase();

    // 1. 快速过滤：跳过不需要翻译的节点
    if (shouldSkipNode(node, curTag)) {
        // console.log(`[VerseVibe] grabNode: Skipped <${curTag}> class=${node.className} reason=shouldSkipNode`);
        return false;
    }

    // 2. 特殊适配：根据域名进行特殊处理
    const domainHandler = selectCompatFn[getMainDomain(location.href.split('?')[0])];
    if (domainHandler) {
        const result = domainHandler(node);
        if (result && typeof result === 'object' && 'skip' in result && result.skip === true) {
            return false;
        }
        if (result) return result;
    }

    // 3. 直接翻译：块级元素
    if (directSet.has(curTag)) return node;

    // 4. 按钮处理：特殊处理按钮内的文本
    if (isButton(node, curTag)) {
        handleButtonTranslation(node);
        return false;
    }

    // 5. 内联元素处理：向上查找合适的父节点
    if (isInlineElement(node, curTag)) {
        return findTranslatableParent(node);
    }

    // 6. 首行文本处理：处理 div 和 label 的首行文本
    if (curTag === 'div' || curTag === 'label') {
        return handleFirstLineText(node);
    }

    // console.log(`[VerseVibe] grabNode: No rule matched for <${curTag}>`);
    return false;
}

// 检查是否应该跳过节点
function shouldSkipNode(node: any, tag: string): boolean {
    // 1. 判断标签是否在 skipSet 内
    // 2. 检查是否具有 notranslate 类
    // 3. 判断节点是否可编辑
    // 4. 判断文本是否过长
    // 5. 判断文本是否为纯数字或标准数字格式（仅当节点内容几乎全是数字时才跳过）

    // HostHatch 侧边栏布局保护：跳过该区域翻译以防止 Flex/Grid 布局错位
    if (node.id === 'eyrie-sidebar' || node.id === 'eyrie-sidebar-sticky') {
        return true;
    }

    // Skip extension's own UI elements
    if (node.id && typeof node.id === 'string' && (node.id.startsWith('versevibe-') || node.id === 'vv-widget-cnt')) {
        return true;
    }
    if (node.classList && (node.classList.contains('vv-widget-main') || node.classList.contains('versevibe-selection-translator'))) {
        return true;
    }

    // 纯图标容器（仅含 img/svg 等），不做翻译
    if (node instanceof Element && isIconOnlyContainer(node)) {
        return true;
    }
    // 仅媒体 figure/picture，避免图片 HTML 被当正文翻译
    if (node instanceof Element && isPictureOrFigureMediaOnly(node)) {
        return true;
    }

    // 先根据标签 / 类名 / 文本特征做快速过滤
    if (
        skipSet.has(tag) ||
        node.classList?.contains('notranslate') ||
        node.isContentEditable ||
        checkTextSize(node) ||
        isMainlyNumericContent(node)
    ) {
        return true;
    }

    // 再根据字体特征过滤：如果该节点使用的是图标字体，就不要翻译
    // 否则会把图标字体中的英文占位字符替换成中文，导致显示成黑块 / 方框
    if (node instanceof Element) {
        try {
            const style = window.getComputedStyle(node);
            const fontFamily = style.fontFamily || '';

            // 常见图标字体关键字：icon, icons, awesome, material, glyph 等
            if (fontFamily && /icon|awesome|material|glyph/i.test(fontFamily)) {
                return true;
            }
        } catch (e) {
            // 忽略计算样式失败的情况，继续后续逻辑
        }
    }

    // 用户选项：不翻译页头/页尾时，跳过处于页头或页尾区域内的节点
    if (node instanceof Element) {
        if (config.skipTranslateHeader && isInHeaderRegion(node)) return true;
        if (config.skipTranslateFooter && isInFooterRegion(node)) return true;
    }

    return false;
}

// 检查文本长度
function checkTextSize(node: any): boolean {
    // 1. 若文本内容长度超过 3072
    // 2. 或者 outerHTML 长度超过 4096，都视为过长
    // 3. 少于3个字符
    return node.textContent.length > 3072 ||
        (node.outerHTML && node.outerHTML.length > 4096) ||
        node.textContent.length < 3;
}

// 检查节点内容是否主要为数字
function isMainlyNumericContent(node: any): boolean {
    if (!node || !node.textContent) return false;

    const text = node.textContent.trim();
    if (!text) return false;

    // 1. 如果是纯网址或邮箱，无论长度，直接跳过 (原文是网址/邮箱，无需翻译)
    if (isUrl(text) || isEmail(text)) return true;

    // 2. 如果内容很短，且是纯数字格式，则跳过
    // 对于短文本，直接判断整体是否为数字格式
    if (text.length < 30 && isNumericContent(text)) return true;

    // 检查是否为用户名或用户ID格式
    if (isUserIdentifier(text)) return true;

    // 对于较长的内容，检查是否主要为数字格式
    // 处理节点可能含有多个文本子节点的情况
    // 这有助于更精确地识别混合内容中的数字部分
    const textNodes = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    let textNode;
    while (textNode = walker.nextNode()) {
        const nodeText = textNode.textContent?.trim() || '';
        if (nodeText) {
            textNodes.push(nodeText);
        }
    }

    // 如果没有实质性文本内容（可能全是图片或空白），也跳过
    if (textNodes.length === 0) {
        // 检查是否含有图片或 SVG，如果有图片但没有文本，跳过翻译（从源头解决重复显示问题）
        const hasGraphics = node.querySelector('img, svg, picture, canvas');
        if (hasGraphics) return true;

        // 检查常见的图标类或导航容器
        const hasIcon = node.querySelector('[class*="icon"], [class*="fa-"], [class*="zlibicon-"], [class*="nav-"], [class*="menu-"]');
        if (hasIcon && textNodes.length < 2) return true;

        return false;
    }

    // 如果只有一个文本节点且为数字，则跳过翻译
    if (textNodes.length === 1 && isNumericContent(textNodes[0])) return true;

    // 如果所有文本节点都是数字，则跳过翻译
    // 这可能是表格中的数字列或者纯数字列表等
    if (textNodes.length > 0 && textNodes.every(t => isNumericContent(t))) return true;

    // 否则不跳过，允许翻译
    return false;
}

/**
 * 检查文本是否为 URL
 */
function isUrl(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const trimmedText = text.trim();

    // 基础 URL 正则: 匹配 http/https 或者以 common TLDs 结尾的域名格式
    // 同时也识别简单的 localhost 或 IP 格式
    // 移除路径部分的空格支持，确保只有纯网址被匹配
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w.-]*)*\/?$|^https?:\/\/localhost(:\d+)?\/?$|^\d{1,3}(\.\d{1,3}){3}(:\d+)?\/?$/i;

    return urlPattern.test(trimmedText);
}

/**
 * 检查文本是否为 Email
 */
function isEmail(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const trimmedText = text.trim();
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailPattern.test(trimmedText);
}

/**
 * 检查文本是否为用户标识符（用户名、ID等）
 */
function isUserIdentifier(text: string): boolean {
    if (!text || typeof text !== 'string') return false;

    const trimmedText = text.trim();

    // 检查是否为社交媒体用户名格式
    if (/^@\w+/.test(trimmedText)) return true;  // Twitter格式：@username
    if (/^u\/\w+/.test(trimmedText)) return true; // Reddit格式：u/username

    // 检查是否为x.com或twitter.com的ID格式
    if (/^id@https?:\/\/(x\.com|twitter\.com)\/[\w-]+\/status\/\d+/.test(trimmedText)) return true;

    // 检查是否包含"关注"相关内容
    if (/关注.*\w+/.test(trimmedText) || /Follow.*\w+/.test(trimmedText)) return true;

    // 检查是否为纯粹的用户名格式（字母、数字、下划线组合）
    if (/^[A-Za-z0-9_]{1,15}$/.test(trimmedText)) return true;

    // 特殊格式：带点击动作的用户名
    if (/点击.*\w+/.test(trimmedText) && trimmedText.length < 50) return true;

    return false;
}

/**
 * 检查文本是否为纯数字或标准数字格式
 * 
 * 识别以下数字格式：
 * 1. 整数 (例如: 12345, -123)
 * 2. 带千位分隔符的数字 (例如: 1,234,567)
 * 3. 数字范围 (例如: 1-100, 5~10)
 * 4. 小数 (例如: 3.14159)
 * 5. 百分比 (例如: 85%, -2.5%)
 * 6. 科学计数法 (例如: 1.23e+4)
 * 7. 货币金额 (例如: $123.45, €100)
 * 8. 常见日期格式 (例如: 2023-01-01, 01/01/2023)
 * 9. 时间格式 (例如: 13:45:30, 9:30)
 * 10. 版本号 (例如: 1.0.0, 2.3.5-beta)
 * 11. ID格式 (例如: id@x.com/user/status/123456789)
 * 12. 用户名格式 (例如: @username, gunsnrosesgirl3)
 * 13. #数字 格式的
 * 
 * 这些格式的数字和用户标识符通常不需要翻译，保持原样更有利于页面理解。
 */
function isNumericContent(text: string): boolean {
    if (!text || typeof text !== 'string') return false;

    // 去除空白字符
    const trimmedText = text.trim();
    if (!trimmedText) return false;

    // 首先检查是否为用户标识符、URL 或 Email
    if (isUserIdentifier(trimmedText) || isUrl(trimmedText) || isEmail(trimmedText)) return true;

    // 如果包含多个单词，则不视为纯数字内容
    if (/\s+/.test(trimmedText.replace(/[\d,.\-%+]/g, ''))) return false;

    // 检查是否为纯数字
    if (/^-?\d+$/.test(trimmedText)) return true;

    // 检查是否为标准数字格式：带逗号的数字 (例如: 1,234,567)
    if (/^-?(\d{1,3}(,\d{3})+)$/.test(trimmedText)) return true;

    // 检查是否为范围数字 (例如: 1-123)
    if (/^\d+\s*[-~]\s*\d+$/.test(trimmedText)) return true;

    // 检查是否为小数
    if (/^-?\d+\.\d+$/.test(trimmedText)) return true;

    // 检查是否为百分比
    if (/^-?\d+(\.\d+)?%$/.test(trimmedText)) return true;

    // 检查是否为科学计数法 (例如: 1.23e+4)
    if (/^-?\d+(\.\d+)?(e[-+]\d+)?$/i.test(trimmedText)) return true;

    // 检查是否为带货币符号的金额 (例如: $123.45, €123, ¥123)
    if (/^[$€¥£₹₽₩]?\s*-?\d+(,\d{3})*(\.\d+)?$/.test(trimmedText)) return true;

    // 检查是否为日期时间格式 (仅考虑常见的数字日期格式)
    // 匹配 YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY, DD/MM/YYYY, MM-DD-YYYY, MM/DD/YYYY
    if (/^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{1,2}[-/]\d{1,2}[-/]\d{1,2})$/.test(trimmedText)) return true;

    // 匹配时间格式 HH:MM:SS, HH:MM
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmedText)) return true;

    // 匹配版本号 (例如: 1.0.0, 2.3.5-beta)
    if (/^\d+(\.\d+){1,3}(-[a-zA-Z0-9]+)?$/.test(trimmedText)) return true;

    // 匹配社交媒体的ID格式
    if (/^id@https?:\/\/(x\.com|twitter\.com)\/[\w-]+\/status\/\d+/.test(trimmedText)) return true;

    // 匹配常见的数字ID格式
    if (/^ID[:：]?\s*\d+$/.test(trimmedText)) return true;
    if (/^No[\.:]?\s*\d+$/i.test(trimmedText)) return true;

    // #数字 格式的
    if (/^#[\d]+$/.test(trimmedText)) return true;

    return false;
}

// 检查是否为按钮
function isButton(node: any, tag: string): boolean {
    // 1. 若当前标签就是 button
    // 2. 或者当前标签为 span 并且其父节点为 button，则视为按钮
    return tag === 'button' ||
        (tag === 'span' && node.parentNode?.tagName.toLowerCase() === 'button');
}

// 处理按钮翻译
function handleButtonTranslation(node: any): void {
    // 1. 若文本非空，则调用 handleBtnTranslation 进行按钮文本翻译处理
    if (node.textContent.trim()) {
        handleBtnTranslation(node);
    }
}

// 检查是否为内联元素
function isInlineElement(node: any, tag: string): boolean {
    // 1. 判断是否在 inlineSet 中
    // 2. 判断是否文本节点
    // 3. 检查子元素中是否包含非内联元素
    return inlineSet.has(tag) ||
        node.nodeType === Node.TEXT_NODE ||
        detectChildMeta(node);
}

// 查找可翻译的父节点
function findTranslatableParent(node: any): any {
    // 1. 递归调用 grabNode 查找父节点是否可翻译
    // 2. 若父节点不可翻译，则返回当前节点
    const parentResult = grabNode(node.parentNode);
    return parentResult || node;
}

// 处理首行文本
function handleFirstLineText(node: any): boolean {
    // 1. 遍历子节点，找到首个文本节点
    // 2. 若存在可翻译文本，则通过 browser.runtime.sendMessage 进行翻译
    // 3. 翻译成功后，替换该文本；出现错误时，打印错误日志
    let child = node.firstChild;
    while (child) {
        if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
            browser.runtime.sendMessage({
                context: document.title,
                origin: child.textContent
            })
                .then((text: string) => {
                    let output = typeof text === 'string' ? text : String(text ?? '');

                    // 1) 若结果被误编码为 URL 编码（如 %3Cspan%20...），尝试解码一次
                    if (output.includes('%') && /%3C|%3E|%20|%22/.test(output)) {
                        try {
                            const decoded = decodeURIComponent(output);
                            // 解码后若像 HTML，则继续按 HTML 处理
                            output = decoded;
                        } catch {
                            // ignore
                        }
                    }

                    // 2) 对“首行文本”场景：只写入纯文本，避免把 HTML/注释片段写进页面
                    if (output.includes('<') && output.includes('>')) {
                        const temp = document.createElement('div');
                        temp.innerHTML = output;
                        output = temp.textContent || '';
                    }

                    child.textContent = output;
                })
                .catch((error: any) => {
                    if (isBenignExtensionMessageError(error)) {
                        console.warn('[VerseVibe] 首行翻译中断：扩展上下文已失效');
                        return;
                    }
                    console.error('翻译失败:', error);
                });
            return false;
        }
        child = child.nextSibling;
    }
    return false;
}

// 检测子元素中是否包含指定标签以外的元素
function detectChildMeta(parent: any): boolean {
    // 1. 逐个检查子节点
    // 2. 若发现非内联元素则返回 false；否则全部检查通过则返回 true
    let child = parent.firstChild;
    while (child) {
        if (child.nodeType === Node.ELEMENT_NODE && !inlineSet.has(child.nodeName.toLowerCase())) {
            return false;
        }
        child = child.nextSibling;
    }
    return true;
}

// 仅译文模式下获取 LLM 应当翻译的标准 HTML
export function LLMStandardHTML(node: any) {
    // 1. 初始化空字符串 text
    // 2. 遍历子节点
    // 3. 若为文本节点，拼接其文本内容
    // 4. 若为元素节点且在 inlineSet 中，拼接其 outerHTML
    // 5. 否则继续递归处理子节点
    let text = "";
    node.childNodes.forEach((child: any) => {
        if (child.nodeType === Node.TEXT_NODE) {
            text += child.nodeValue;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tagName = child.tagName.toLowerCase();
            // 过滤掉多媒体标签，防止在译文中重复显示
            if (['img', 'svg', 'video', 'canvas', 'picture', 'iframe'].includes(tagName)) {
                return;
            }

            if (inlineSet.has(tagName)) {
                text += child.outerHTML;
            } else {
                text += LLMStandardHTML(child);
            }
        }
    });
    return text;
}

/** 若翻译结果被误编码为 URL 编码（如 %3Cspan%20...），尝试解码一次，避免页面上显示乱码 */
function tryDecodeUriInTranslationResult(text: string): string {
    if (typeof text !== 'string' || !text.includes('%')) return text;
    // 仅当明显包含 URL 编码的 HTML 特征时才解码（%3C=< %3E=> %20=空格 %22="）
    if (!/%3C|%3E|%20|%22/.test(text)) return text;
    try {
        const decoded = decodeURIComponent(text);
        if (decoded.includes('<') && decoded.includes('>')) return decoded;
    } catch {
        // 解码失败则返回原文
    }
    return text;
}

export function beautyHTML(text: string): string {
    text = tryDecodeUriInTranslationResult(text);
    // 1. 先替换 SVG 中的大小写敏感词
    // 2. 再使用 js-beautify 格式化 HTML
    text = replaceSensitiveWords(text);
    return html(text);
}

// 替换 svg 标签中的一些大小写敏感的词（html 不区分大小写，但 svg 标签区分大小写）
function replaceSensitiveWords(text: string): string {
    // 1. 使用正则匹配大小写敏感词
    // 2. 逐个替换为正确大小写形式
    return text.replace(/viewbox|preserveaspectratio|clippathunits|gradienttransform|patterncontentunits|lineargradient|clippath/gi, (match) => {
        switch (match.toLowerCase()) {
            case 'viewbox':
                return 'viewBox';
            case 'preserveaspectratio':
                return 'preserveAspectRatio';
            case 'clippathunits':
                return 'clipPathUnits';
            case 'gradienttransform':
                return 'gradientTransform';
            case 'patterncontentunits':
                return 'patternContentUnits';
            case 'lineargradient':
                return 'linearGradient';
            case 'clippath':
                return 'clipPath';
            default:
                return match;
        }
    });
}

// 移除特定样式
export function checkAndRemoveStyle(node: any, styleProperty: any) {
    // 1. 若节点存在样式且对应属性不为 undefined，则清空该属性
    if (node.style && node.style[styleProperty] !== undefined) {
        node.style[styleProperty] = '';
    }
}

// 移除截断样式
export function smashTruncationStyle(node: any) {
    // 1. 先调用 checkAndRemoveStyle 移除 webkitLineClamp 属性
    // 2. 将节点的相关样式设为 'unset'
    checkAndRemoveStyle(node, 'webkitLineClamp');
    node.style.webkitLineClamp = 'unset';
    node.style.maxHeight = 'unset';
}
