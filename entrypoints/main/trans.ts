import { checkConfig, searchClassName, skipNode } from "../utils/check";
import { cache } from "../utils/cache";
import { options, servicesType } from "../utils/option";
import { insertFailedTip, insertLoadingSpinner } from "../utils/icon";
import { styles } from "@/entrypoints/utils/constant";
import { beautyHTML, grabNode, grabAllNode, LLMStandardHTML, smashTruncationStyle } from "@/entrypoints/main/dom";
import { detectlang, throttle } from "@/entrypoints/utils/common";
import { getMainDomain, replaceCompatFn } from "@/entrypoints/main/compat";
import { config } from "@/entrypoints/utils/config";
import {
    translateText,
    cancelAllTranslations,
    getTranslationErrorMessage,
    isExpectedTranslationError,
    isExtensionContextInvalidatedError,
} from '@/entrypoints/utils/translateApi';

let hoverTimer: any; // 鼠标悬停计时器
let htmlSet = new Set(); // 防抖
export let originalContents = new Map(); // 保存原始内容
let isAutoTranslating = false; // 控制是否继续翻译新内容
let observer: IntersectionObserver | null = null; // 保存观察器实例
let mutationObserver: MutationObserver | null = null; // 保存 DOM 变化观察器实例
const isDev = import.meta.env.DEV;

// 使用自定义属性标记已翻译的节点
const TRANSLATED_ATTR = 'data-fr-translated';
const TRANSLATED_ID_ATTR = 'data-fr-node-id'; // 添加节点ID属性

let nodeIdCounter = 0; // 节点ID计数器

function logTranslationFailure(scope: string, node: any, error: unknown) {
    const message = getTranslationErrorMessage(error);
    if (isExpectedTranslationError(error)) {
        console.warn(`[VerseVibe] ${scope}：${message}`, node);
        return;
    }
    console.error(`[VerseVibe] ${scope}`, node, error);
}

// 复制原文节点的主要文本样式到译文节点，确保原文/译文样式一致
function copyTextStyle(fromEl: HTMLElement, toEl: HTMLElement) {
    try {
        const style = window.getComputedStyle(fromEl);
        // 使用 font 简写可以一次性带上 font-style / font-weight / font-size / line-height / font-family
        if (style.font) {
            toEl.style.font = style.font;
        } else {
            toEl.style.fontFamily = style.fontFamily;
            toEl.style.fontSize = style.fontSize;
            toEl.style.fontWeight = style.fontWeight;
            toEl.style.fontStyle = style.fontStyle;
            toEl.style.lineHeight = style.lineHeight;
        }
        toEl.style.letterSpacing = style.letterSpacing;
        toEl.style.textTransform = style.textTransform;
        toEl.style.textDecoration = style.textDecoration;
        // 颜色单独复制，便于后续根据主题/站点控制
        toEl.style.color = style.color;

        // 某些站点（如自定义落地页/海报式标题）通过 transform 放大标题，
        // 如果只复制 font-size 而不复制 transform，译文会显得比原文小。
        // 这里额外同步 transform 相关属性，保证视觉大小一致。
        if (style.transform && style.transform !== 'none') {
            toEl.style.transform = style.transform;
            toEl.style.transformOrigin = style.transformOrigin;
        }
    } catch (e) {
        console.warn('[VerseVibe] Trans: copyTextStyle failed', e);
    }
}

// 应用最小中文字号（仅在目标语言为简体中文时生效）
// 语义：只在「当前字号明显小于 minFontSize」时才提升到下限，
//       对本来就比 minFontSize 大的字号完全不做处理，保持与原文一致。
function applyMinChineseFontSize(node: HTMLElement) {
    try {
        if (config.to !== 'zh-Hans' || !config.minFontSize) return;

        const computed = window.getComputedStyle(node);
        const fontSizeStr = computed.fontSize || '';
        const minSize = config.minFontSize;

        // 只在浏览器已经把字号解析成像素值时才做比较（例如 "14px"、"24px"）
        // 如果是 rem/em/% 等相对单位或空字符串，就不要动它，避免误把 1.5rem 这种放大标题当成“1.5px”
        if (!fontSizeStr.endsWith('px')) {
            return;
        }

        const currentSize = parseFloat(fontSizeStr);
        // 如果无法解析出当前字号，说明样式异常，此时避免强行覆盖，直接跳过
        if (Number.isNaN(currentSize) || !currentSize) {
            return;
        }

        // 当前字号已经大于等于最小字号，无需任何修改
        if (currentSize >= minSize) {
            return;
        }

        const targetSize = minSize;

        node.style.fontSize = `${targetSize}px`;
    } catch (e) {
        console.warn('[VerseVibe] Trans: applyMinChineseFontSize failed', e);
    }
}

function applyChineseHeiFont(node: HTMLElement) {
    try {
        if (config.to !== 'zh-Hans' || config.forceChineseHeiFont === false) return;

        node.style.fontFamily = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", SimHei, sans-serif';
        node.style.fontWeight = '500';
    } catch (e) {
        console.warn('[VerseVibe] Trans: applyChineseHeiFont failed', e);
    }
}

// 恢复原文内容
export function restoreOriginalContent() {
    // 取消所有等待中的翻译任务
    cancelAllTranslations();

    // 1. 遍历所有已翻译的节点
    document.querySelectorAll(`[${TRANSLATED_ATTR}="true"]`).forEach(node => {
        const nodeId = node.getAttribute(TRANSLATED_ID_ATTR);
        if (nodeId && originalContents.has(nodeId)) {
            const originalContent = originalContents.get(nodeId);
            node.innerHTML = originalContent;
            node.removeAttribute(TRANSLATED_ATTR);
            node.removeAttribute(TRANSLATED_ID_ATTR);

            // 移除可能添加的翻译相关类
            node.classList.remove('verse-vibe-bilingual');
        }
    });

    // 2. 移除所有翻译内容元素
    document.querySelectorAll('.verse-vibe-bilingual-content').forEach(element => {
        element.remove();
    });

    // 3. 移除所有翻译过程中添加的加载动画和错误提示
    document.querySelectorAll('.verse-vibe-loading, .verse-vibe-retry-wrapper').forEach(element => {
        element.remove();
    });

    // 4. 清空存储的原始内容
    originalContents.clear();

    // 5. 停止所有观察器
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
    }

    // 6. 重置所有翻译相关的状态
    isAutoTranslating = false;
    htmlSet.clear(); // 清空防抖集合
    nodeIdCounter = 0; // 重置节点ID计数器

    // 7. 消除可能存在的全局样式污染
    const tempStyleElements = document.querySelectorAll('style[data-fr-temp-style]');
    tempStyleElements.forEach(el => el.remove());
}

// 自动翻译整个页面的功能
export function autoTranslateEnglishPage() {
    console.log('[VerseVibe] Trans: autoTranslateEnglishPage called. isAutoTranslating:', isAutoTranslating);

    // 如果已经在翻译中，则返回
    if (isAutoTranslating) {
        if (isDev) {
            console.debug('[VerseVibe] Trans: Already translating, skip.');
        }
        return;
    }

    // 获取当前页面的语言（暂时注释，存在识别问题）
    // const text = document.documentElement.innerText || '';
    // const cleanText = text.replace(/[\s\u3000]+/g, ' ').trim().slice(0, 500);
    // const language = detectlang(cleanText);
    // console.log('当前页面语言：', language);
    // const to = config.to;
    // if (to.includes(language)) {
    //     console.log('目标语言与当前页面语言相同，不进行翻译');
    //     return;
    // }
    // console.log('当前页面非目标语言，开始翻译');

    // 获取所有需要翻译的节点
    console.log('[VerseVibe] Trans: Starting grabAllNode(document.body)...');
    const nodes = grabAllNode(document.body);
    console.log(`[VerseVibe] Trans: grabAllNode found ${nodes.length} nodes.`);

    if (!nodes.length) {
        console.warn('[VerseVibe] Trans: No translatable nodes found. Aborting.');
        return;
    }

    isAutoTranslating = true;

    // 创建观察器
    observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && isAutoTranslating) {
                const node = entry.target as Element;

                // 去重
                if (node.hasAttribute(TRANSLATED_ATTR)) return;

                // 为节点分配唯一ID
                const nodeId = `fr-node-${nodeIdCounter++}`;
                node.setAttribute(TRANSLATED_ID_ATTR, nodeId);

                // 保存原始内容
                originalContents.set(nodeId, node.innerHTML);

                // 标记为已翻译
                node.setAttribute(TRANSLATED_ATTR, 'true');

                if (config.display === styles.bilingualTranslation) {
                    handleBilingualTranslation(node, false);
                } else {
                    handleSingleTranslation(node, false);
                }

                // 停止观察该节点
                observer.unobserve(node);
            }
        });
    }, {
        root: null,
        rootMargin: '50px',
        threshold: 0.1 // 只要出现10%就开始翻译
    });

    // 开始观察所有节点
    nodes.forEach(node => {
        observer?.observe(node);
    });

    // 创建 MutationObserver 监听 DOM 变化
    mutationObserver = new MutationObserver((mutations) => {
        if (!isAutoTranslating) return;

        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // 元素节点
                    // 只处理未翻译的新节点
                    const newNodes = grabAllNode(node as Element).filter(
                        n => !n.hasAttribute(TRANSLATED_ATTR)
                    );
                    newNodes.forEach(n => observer?.observe(n));
                }
            });
        });
    });

    // 监听整个 body 的变化
    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// 处理鼠标悬停翻译的主函数
export function handleTranslation(mouseX: number, mouseY: number, delayTime: number = 0) {
    // 检查配置
    if (!checkConfig()) return;

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {

        let node = grabNode(document.elementFromPoint(mouseX, mouseY));

        // 判断是否跳过节点
        if (skipNode(node)) return;

        // 防抖
        let nodeOuterHTML = node.outerHTML;
        if (htmlSet.has(nodeOuterHTML)) return;
        htmlSet.add(nodeOuterHTML);

        // 根据翻译模式进行翻译
        if (config.display === styles.bilingualTranslation) {
            handleBilingualTranslation(node, delayTime > 0);  // 根据 delayTime 可判断是否为滑动翻译
        } else {
            handleSingleTranslation(node, delayTime > 0);
        }
    }, delayTime);
}

// 双语翻译
export function handleBilingualTranslation(node: any, slide: boolean) {
    let nodeOuterHTML = node.outerHTML;
    // 如果已经翻译过，250ms 后删除翻译结果
    let bilingualNode = searchClassName(node, 'verse-vibe-bilingual');
    if (bilingualNode) {
        if (slide) {
            htmlSet.delete(nodeOuterHTML);
            return;
        }
        let spinner = insertLoadingSpinner(bilingualNode as HTMLElement, true);
        setTimeout(() => {
            spinner.remove();
            const content = searchClassName(bilingualNode as HTMLElement, 'verse-vibe-bilingual-content');
            if (content && content instanceof HTMLElement) content.remove();
            (bilingualNode as HTMLElement).classList.remove('verse-vibe-bilingual');
            htmlSet.delete(nodeOuterHTML);
        }, 250);
        return;
    }

    // 检查是否有缓存
    let cached = cache.localGet(node.textContent);
    if (cached) {
        let spinner = insertLoadingSpinner(node, true);
        setTimeout(() => {
            spinner.remove();
            htmlSet.delete(nodeOuterHTML);
            bilingualAppendChild(node, cached);
        }, 250);
        return;
    }

    // 翻译
    bilingualTranslate(node, nodeOuterHTML);
}

// 单语翻译
export function handleSingleTranslation(node: any, slide: boolean) {
    let nodeOuterHTML = node.outerHTML;
    let outerHTMLCache = cache.localGet(node.outerHTML);


    if (outerHTMLCache) {
        // handleTranslation 已处理防抖 故删除判断 原bug 在保存完成后 刷新页面 可以取得缓存 直接return并没有翻译
        let spinner = insertLoadingSpinner(node, true);
        setTimeout(() => {
            spinner.remove();
            htmlSet.delete(nodeOuterHTML);

            // 兼容部分网站独特的 DOM 结构
            let fn = replaceCompatFn[getMainDomain(document.location.hostname)];
            // 缓存结果兜底净化：若缓存里含 URL 编码/框架注释/SVG 等碎片，避免 outerHTML 回填污染页面
            const safeOuterHTMLCache = normalizeTranslatedOutput(outerHTMLCache).html;
            const cacheLooksBroken =
                /%3C|%3E|%20|%22/.test(outerHTMLCache) ||
                /<!---->|<svg\b|<path\b/.test(outerHTMLCache);
            if (cacheLooksBroken) {
                const pure = normalizeTranslatedOutput(outerHTMLCache).text;
                if (pure) node.textContent = pure;
            } else {
                if (fn) fn(node, safeOuterHTMLCache);
                else node.outerHTML = safeOuterHTMLCache;
            }

        }, 250);
        return;
    }

    singleTranslate(node);
}


function bilingualTranslate(node: any, nodeOuterHTML: any) {
    // 保留原始的文本处理逻辑用于检测语言
    const text = node.textContent || '';
    if (detectlang(text.replace(/[\s\u3000]/g, '')) === config.to) return;

    // Immich 等站点：按钮/链接里常混入框架注释与 SVG 图标，翻译整段 HTML 容易生成大段乱码
    // 对“富标记”节点，优先只翻译纯文本，避免把结构交给翻译引擎
    const richMarkup = /<!---->|<svg\b|<path\b/.test(node.innerHTML || '');
    let origin = (servicesType.isMachine(config.service) && !richMarkup) ? node.innerHTML : (richMarkup ? (node.textContent || '') : LLMStandardHTML(node));
    // 原文含多行時改用 innerText，並按行拆分、逐行翻譯，再組回（卡片標題/描述/日期分三行對齊）
    const originLinesStr = (node.innerText || node.textContent || '').trim();
    if (!richMarkup && originLinesStr.includes('\n') && originLinesStr.length > 0 && originLinesStr.length < 4096) {
        origin = originLinesStr;
    }
    const lines = origin.split(/\n/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    const doPerLine = lines.length >= 2 && lines.length <= 15;

    let spinner = insertLoadingSpinner(node);

    const doAppend = (resultText: string) => {
        spinner.remove();
        htmlSet.delete(nodeOuterHTML);
        // 在 beautyHTML 解析前先移除图片标签，避免格式错误的 srcset 等属性导致浏览器解析警告
        const cleanedBeforeParse = resultText
            .replace(/<(img|svg|canvas|picture|video|iframe|source)\b[^>]*\/?>/gi, "")
            .replace(/<(img|svg|canvas|picture|video|iframe|source)\b[^>]*>([\s\S]*?<\/\1>)?/gi, "");
        const normalized = normalizeTranslatedOutput(beautyHTML(cleanedBeforeParse));
        bilingualAppendChild(node, normalized.html);
    };

    if (doPerLine) {
        // 分三行等：逐行翻譯，再以換行拼成譯文塊
        Promise.all(lines.map((line: string) => translateText(line, document.title)))
            .then((translatedLines: string[]) => {
                const combined = translatedLines
                    .map((t: string) => normalizeTranslatedOutput(beautyHTML(t)).text.trim())
                    .join('\n');
                doAppend(combined);
            })
            .catch((error: Error) => {
                spinner.remove();
                logTranslationFailure('双语翻译失败', node, error);
                insertFailedTip(node, getTranslationErrorMessage(error) || "翻译失败", spinner);
            });
    } else {
        translateText(origin, document.title)
            .then((text: string) => doAppend(text))
            .catch((error: Error) => {
                spinner.remove();
                logTranslationFailure('双语翻译失败', node, error);
                insertFailedTip(node, getTranslationErrorMessage(error) || "翻译失败", spinner);
            });
    }
}


export function singleTranslate(node: any) {
    const text = node.textContent || '';
    if (detectlang(text.replace(/[\s\u3000]/g, '')) === config.to) return;

    // 对富标记节点（含 SVG/框架注释）优先翻译纯文本，避免整段 HTML 译坏导致乱码
    const inner = node.innerHTML || '';
    const richMarkup = /<!---->|<svg\b|<path\b/.test(inner);
    let origin = (servicesType.isMachine(config.service) && !richMarkup) ? inner : (richMarkup ? (node.textContent || '') : LLMStandardHTML(node));
    let spinner = insertLoadingSpinner(node);

    // 使用队列管理的翻译API
    translateText(origin, document.title)
        .then((text: string) => {
            spinner.remove();

            // 在 beautyHTML 解析前先移除图片标签，避免格式错误的 srcset 等属性导致浏览器解析警告
            const cleanedBeforeParse = text
                .replace(/<(img|svg|canvas|picture|video|iframe|source)\b[^>]*\/?>/gi, "")
                .replace(/<(img|svg|canvas|picture|video|iframe|source)\b[^>]*>([\s\S]*?<\/\1>)?/gi, "");
            const normalized = normalizeTranslatedOutput(beautyHTML(cleanedBeforeParse));
            text = normalized.html;

            if (!text || origin === text) return;

            let oldOuterHtml = node.outerHTML;
            // Immich 等站点的按钮/链接常包含 SVG 与框架注释（如 Svelte 的 <!---->）。
            // 若翻译结果包含大量 HTML/SVG/注释碎片，直接 innerHTML 回填会导致“大段乱码”。
            // 兜底：此类场景只回填纯文本，保留原结构/图标，仅替换可见文案。
            const looksLikeBrokenMarkup =
                /<!---->|<svg\b|<path\b|aria-/.test(text) ||
                (text.includes('<') && text.includes('>') && text.length > 400) ||
                /%3C|%3E|%20|%22/.test(text);
            const originHasRichMarkup = /<!---->|<svg\b|<path\b/.test(inner) || /%3C|%3E|%20|%22/.test(origin);

            if (originHasRichMarkup && looksLikeBrokenMarkup) {
                const pure = normalizeTranslatedOutput(text).text.trim();
                if (pure) node.textContent = pure;
                else node.textContent = (node.textContent || '').trim();
            } else {
                node.innerHTML = text;
            }

            // 在仅译文模式下，也让最终内容继承并保留原节点的文本样式
            copyTextStyle(node as HTMLElement, node as HTMLElement);
            applyMinChineseFontSize(node as HTMLElement);
            applyChineseHeiFont(node as HTMLElement);

            let newOuterHtml = node.outerHTML;

            // 缓存翻译结果
            cache.localSetDual(oldOuterHtml, newOuterHtml);
            cache.set(htmlSet, newOuterHtml, 250);
            htmlSet.delete(oldOuterHtml);
        })
        .catch((error: Error) => {
            spinner.remove();
            logTranslationFailure('单语翻译失败', node, error);
            insertFailedTip(node, getTranslationErrorMessage(error) || "翻译失败", spinner);
        });
}

export const handleBtnTranslation = throttle((node: any) => {
    let origin = node.innerText;
    let rs = cache.localGet(origin);
    if (rs) {
        node.innerText = rs;
        return;
    }

    if (config.count++) {
        storage.setItem('local:config', JSON.stringify(config)).catch((error: unknown) => {
            if (isExtensionContextInvalidatedError(error)) return;
            console.warn('[VerseVibe] 按钮翻译计数保存失败:', getTranslationErrorMessage(error));
        });
    }

    browser.runtime.sendMessage({ context: document.title, origin: origin })
        .then((text: string) => {
            const normalized = normalizeTranslatedOutput(text);
            const output = normalized.text || normalized.html;
            cache.localSetDual(origin, output);
            node.innerText = output;
        }).catch((error: any) => {
            if (isExtensionContextInvalidatedError(error)) {
                console.warn('[VerseVibe] 按钮翻译中断：扩展上下文已失效');
                return;
            }
            console.error('调用失败:', error);
        })
}, 250)

function findFlexAncestor(el: HTMLElement | null): HTMLElement | null {
    let cur: HTMLElement | null = el;
    while (cur && cur !== document.body) {
        try {
            const style = window.getComputedStyle(cur);
            if ((style.display || '').includes('flex')) return cur;
        } catch {
            // ignore
        }
        cur = cur.parentElement;
    }
    return null;
}

function normalizeTranslatedOutput(raw: any): { html: string; text: string } {
    let s = typeof raw === 'string' ? raw : String(raw ?? '');

    // 1) URL 编码 HTML 解码
    if (s.includes('%') && /%3C|%3E|%20|%22/.test(s)) {
        try { s = decodeURIComponent(s); } catch { /* ignore */ }
    }

    // 2) 去掉框架注释（Svelte/等）
    s = s.replace(/<!---->/g, '');

    // 3) 若看起来像 HTML，生成纯文本版本
    let text = s;
    if (s.includes('<') && s.includes('>')) {
        const temp = document.createElement('div');
        temp.innerHTML = s;
        text = temp.textContent || '';
    }

    return { html: s, text };
}


function bilingualAppendChild(node: any, text: string) {
    node.classList.add("verse-vibe-bilingual");

    // 在 flex/grid 下，当前节点及到 flex 祖先的整条链默认 min-width:auto 会随内容撑开，导致译文溢出卡片（如 selfh.st）
    // 仅对「从节点到 flex 祖先之间的子项」设 min-width:0，不修改 flex 容器本身，使卡片内宽度受限、译文在其内换行
    if (node instanceof HTMLElement) {
        let cur: HTMLElement | null = node;
        const flexAncestor = findFlexAncestor(node);
        while (cur && cur !== document.body && cur !== flexAncestor) {
            cur.style.minWidth = '0';
            if (cur === node) cur.style.maxWidth = '100%';
            cur = cur.parentElement;
        }
    }

    // 1. 创建外层包装器 (负责布局、对齐和边距)
    let wrapper = document.createElement("span");
    wrapper.classList.add("verse-vibe-bilingual-content");

    // 2. 创建内层文本容器 (负责具体样式，如背景、下划线)
    let content = document.createElement("span");

    // 查找样式配置
    const style = options.styles.find(s => s.value === config.style && !s.disabled);

    // 标题节点的识别：当前节点是 h1-h6，或其最近的块级祖先是 h1-h6
    const tagName = (node.tagName || '').toLowerCase();
    const headingAncestor = (node as HTMLElement).closest?.('h1,h2,h3,h4,h5,h6') as HTMLElement | null;
    let styleSource = (headingAncestor || node) as HTMLElement;

    // 仅在“链接独占”的容器（如页脚 li/span 里只有一个 a）才用内部 <a> 的样式；
    // 对 <p>/<div> 等正文块不取链接样式，否则整段会变成链接色（如 selfh.st 正文）。
    if (!headingAncestor && node instanceof HTMLElement) {
        const tag = (node.tagName || '').toLowerCase();
        if (tag !== 'p' && tag !== 'div') {
            const linkChild = node.querySelector('a');
            if (linkChild && linkChild.textContent && linkChild.textContent.trim()) {
                styleSource = linkChild as HTMLElement;
            }
        }
    }

    const isHeadingTag = /^h[1-6]$/.test(tagName) || !!headingAncestor;

    // 对标题类节点（h1-h6 及其内部 span）不再叠加额外的译文样式 class，
    // 保持译文外观与原文标题完全一致，只做必要的字号下限保护。
    if (style?.class && !isHeadingTag) {
        content.classList.add(style.class);
    }

    // 继承原文标题（或当前节点）的文本样式，保证原文/译文视觉风格一致
    const computedStyle = window.getComputedStyle(styleSource);
    const textAlign = computedStyle.textAlign;
    copyTextStyle(styleSource, content);

    // 标题类节点：wrapper 也继承标题样式，确保块级整体字号一致
    if (isHeadingTag) {
        copyTextStyle(styleSource, wrapper as HTMLElement);
    }

    // 在原样式基础上，确保「非标题类」中文具有可阅读的最小字号；
    // 标题本身通常已经足够大，不再强制调整，以避免把大号标题“压扁”。
    if (!isHeadingTag) {
        applyMinChineseFontSize(content);
    }

    // 布局控制
    if (textAlign === 'center') {
        wrapper.style.display = 'block';
        wrapper.style.textAlign = 'center';
        wrapper.style.margin = '4px auto';
    } else if (textAlign === 'right') {
        wrapper.style.display = 'block';
        wrapper.style.textAlign = 'right';
        wrapper.style.marginLeft = 'auto';
        wrapper.style.marginRight = '0';
        wrapper.style.marginBottom = '4px';
        wrapper.style.marginTop = '4px';
    } else {
        // 默认也设为 block，以便 margin 生效
        wrapper.style.display = 'block';
        wrapper.style.textAlign = textAlign || 'left';
    }

    // 确保在各种布局环境下译文块占据一整行，避免出现在原文右侧
    wrapper.style.width = '100%';
    // 在 flex/grid 下必须设 min-width:0，否则子项不会收缩，长译文会撑破容器溢出（如 selfh.st）
    wrapper.style.minWidth = '0';
    wrapper.style.overflowWrap = 'break-word';
    wrapper.style.wordBreak = 'break-word';
    wrapper.style.maxWidth = '100%';

    const parent = findFlexAncestor(node as HTMLElement) || node.parentElement;
    if (parent) {
        const parentStyle = window.getComputedStyle(parent);
        const parentDisplay = parentStyle.display || '';

        if (parentDisplay.includes('flex')) {
            // 在任意 flex 祖先下，强制允许换行，并让译文这一块单独占一整行
            // 典型场景：coder.com 的「 + Bullet 列表」，否则译文会出现在右侧
            try {
                if (parentStyle.flexWrap === 'nowrap') {
                    (parent as HTMLElement).style.flexWrap = 'wrap';
                }
            } catch {
                // ignore
            }
            wrapper.style.flexBasis = '100%';
            wrapper.style.alignSelf = 'stretch';
        }

        if (parentDisplay.includes('grid')) {
            // @ts-ignore
            wrapper.style.gridColumn = '1 / -1';
        }
    }

    // 判断样式类型：下划线/高亮类需要 inline + decoration-break，卡片/引用类保持 block
    const isBlockStyle = style?.group === 'card' || style?.group === 'special' || style?.group === 'pro';
    if (isBlockStyle) {
        content.style.display = 'block';
        content.style.maxWidth = '100%';
    } else {
        content.style.display = 'inline';
        // 关键：box-decoration-break: clone 确保多行时边距和背景色正确应用到每一行
        // @ts-ignore
        content.style.webkitBoxDecorationBreak = 'clone';
        // @ts-ignore
        content.style.boxDecorationBreak = 'clone';
    }

    // 1. 彻底移除多媒体标签及其内容 (img, svg, canvas, video, iframe, picture)
    // 防止图标重复或大图占位，同时避免格式错误的 srcset 等属性导致浏览器解析警告
    // 先移除自闭合标签（如 <img ... />），再移除成对标签（如 <picture>...</picture>）
    let cleanText = text
        .replace(/<(img|svg|canvas|picture|video|iframe|source)\b[^>]*\/?>/gi, "")  // 移除自闭合和单标签
        .replace(/<(img|svg|canvas|picture|video|iframe|source)\b[^>]*>([\s\S]*?<\/\1>)?/gi, "");  // 移除成对标签

    // 2. 将交互式标签 (a, button) 转换为 span
    // 目的：保留 class/style 带来的视觉样式（如颜色、字体），但移除链接/按钮交互，避免“双按钮”
    cleanText = cleanText.replace(/<(a|button)\b([^>]*)>/gi, '<span$2>')
        .replace(/<\/(a|button)>/gi, '</span>');

    // 3. 剥离块级标签，但保留换行：先让结束标签变成换行再删开始标签，避免不同行被混成一行（閱讀習慣一致）
    const blockTagRe = /<\/(div|p|li|ul|ol|h[1-6])\b[^>]*>/gi;
    cleanText = cleanText.replace(blockTagRe, '\n');
    cleanText = cleanText.replace(/<(div|p|li|ul|ol|h[1-6])\b[^>]*>/gi, '');

    // 标题场景下，防止译文中夹带 font-size 等内联样式把大号标题“压缩”。
    // 这里直接移除所有 style 属性，让外层 span 的字体样式完全接管。
    if (isHeadingTag) {
        cleanText = cleanText.replace(/\sstyle="[^"]*"/gi, '');
    }

    // 移除可能的提示词残留标志
    cleanText = cleanText.replace(/### CONTENT (START|END) ###/g, "").trim();

    // 紧凑化：删除空行，避免译文出现大块留白
    cleanText = cleanText
        .replace(/\r/g, '')
        .split('\n')
        .map(line => line.trimEnd())
        .filter(line => line.trim().length > 0)
        .join('\n');

    // 检查剥离所有标签后的纯文本，如果没有任何实质内容，则不添加对照块
    const pureText = cleanText.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "").trim();
    if (!pureText || pureText === "") {
        node.classList.remove("verse-vibe-bilingual");
        return;
    }

    // Reddit 右侧推荐列表的标题特殊处理：
    // 如果当前节点在 aside 内部，强制标题节点本身为块级并占满一行，
    // 避免「原文 + 译文」被挤在同一行里
    try {
        if (location.hostname.includes('reddit.com')) {
            const inAside = node.closest('aside');
            if (inAside) {
                (node as HTMLElement).style.display = 'block';
                (node as HTMLElement).style.width = '100%';
                (node as HTMLElement).style.whiteSpace = 'normal';
            }
        }
    } catch (e) {
        // 忽略环境中可能不存在 location / closest 的情况
    }

    // 譯文含換行時保留行結構，不把多行壓成一行（與原文卡片行對齊、閱讀一致）
    const hasNewlines = /\n/.test(cleanText);
    if (hasNewlines) {
        content.style.whiteSpace = 'pre-line';
    }
    applyChineseHeiFont(content);
    applyMinChineseFontSize(content);
    content.innerHTML = cleanText;
    wrapper.appendChild(content);
    smashTruncationStyle(node);
    node.appendChild(wrapper);
}
