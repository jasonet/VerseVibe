import { checkConfig, searchClassName, skipNode } from "../utils/check";
import { cache } from "../utils/cache";
import { options, servicesType } from "../utils/option";
import { insertFailedTip, insertLoadingSpinner } from "../utils/icon";
import { styles } from "@/entrypoints/utils/constant";
import { beautyHTML, grabNode, grabAllNode, LLMStandardHTML, smashTruncationStyle, assignLayoutPriorities, getNodeLayoutPriority } from "@/entrypoints/main/dom";
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

// 从 getComputedStyle 返回的 transform 中提取「安全的正向缩放」。
// getComputedStyle 会把 transform 归一化成 matrix(a,b,c,d,e,f)：
//   - 纯缩放：b≈0、c≈0（无旋转/斜切），a>0、d>0（无镜像翻转）
// 只有满足上述条件时才返回原 transform 字符串用于放大译文；
// 任何镜像（负缩放）、旋转、斜切或 3D 变换(matrix3d) 都返回空字符串以跳过，
// 避免把站点的翻转效果照抄到译文上造成「倒影」。
function getSafeScaleTransform(transform: string | undefined): string {
    if (!transform || transform === 'none') return '';
    // 3D 变换无法用简单判定保证不翻转，保守跳过
    if (transform.startsWith('matrix3d')) return '';
    const match = transform.match(/^matrix\(([^)]+)\)$/);
    if (!match) return '';
    const parts = match[1].split(',').map(s => parseFloat(s.trim()));
    if (parts.length < 6 || parts.some(n => Number.isNaN(n))) return '';
    const [a, b, c, d] = parts;
    const EPS = 0.001;
    const hasRotationOrSkew = Math.abs(b) > EPS || Math.abs(c) > EPS;
    const hasMirror = a <= 0 || d <= 0; // 负缩放=镜像翻转
    if (hasRotationOrSkew || hasMirror) return '';
    return transform;
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
        // 这里额外同步 transform，但只允许「纯正向缩放」：
        // 站点若用 scaleX(-1)/scaleY(-1)/rotate(180deg) 等做镜像或翻转，
        // 直接照抄会让译文出现「倒影」（如 Windows Chrome 悬浮翻译时观察到），
        // 因此对包含镜像/旋转/斜切的变换一律跳过，仅保留放大效果。
        const safeTransform = getSafeScaleTransform(style.transform);
        if (safeTransform) {
            toEl.style.transform = safeTransform;
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

// 多行译文的可读行间距：
// 译文是一个 inline 容器，换行后装饰类样式（下划线 / 双实线 / 背景渐变等）会逐行渲染。
// 当原文行距偏紧（如等宽正文 line-height≈1.2）时，上一行的下划线会压到下一行文字上，
// 出现“横线穿字”的遮挡（多行裸文本翻译尤其明显）。
// 策略：保留原文行距，但设一个可读下限；原文行距已经更大时完全不动，以保持与原文一致。
const MIN_TRANSLATION_LINE_HEIGHT = 1.5;
function ensureReadableLineHeight(node: HTMLElement, sourceComputed: CSSStyleDeclaration) {
    try {
        const lineHeightStr = sourceComputed.lineHeight || '';
        const fontSizeStr = sourceComputed.fontSize || '';
        const fontSize = parseFloat(fontSizeStr);
        // 已解析为像素的行距才能算比例；"normal" 等非像素值按需要提升处理
        let ratio = NaN;
        if (lineHeightStr.endsWith('px') && fontSize) {
            ratio = parseFloat(lineHeightStr) / fontSize;
        }
        if (Number.isNaN(ratio) || ratio < MIN_TRANSLATION_LINE_HEIGHT) {
            node.style.lineHeight = String(MIN_TRANSLATION_LINE_HEIGHT);
        }
    } catch (e) {
        console.warn('[VerseVibe] Trans: ensureReadableLineHeight failed', e);
    }
}

// 译文字号缩放：把已确定的「自然字号」改写为 calc(自然字号 * var(--vv-trans-scale))。
// 这样设置页改变 --vv-trans-scale 变量时，整页译文会实时放大/缩小，
// 且不影响原文字号（用户放大译文时无需与原文保持一致）。
function applyTranslationFontScale(node: HTMLElement) {
    try {
        // 优先读已写入的内联字号：bilingual 路径里 content 此时尚未挂载到 DOM，
        // getComputedStyle 对游离节点返回空值，会导致 calc 永远写不进去（字号无法实时缩放）。
        // copyTextStyle 已把字号写成内联样式（font 简写也会落到 fontSize），可直接取用。
        let fontSizeStr = node.style.fontSize || '';
        if (!fontSizeStr.endsWith('px')) {
            fontSizeStr = window.getComputedStyle(node).fontSize || '';
        }
        if (!fontSizeStr.endsWith('px')) return;
        const base = parseFloat(fontSizeStr);
        if (Number.isNaN(base) || !base) return;
        node.style.fontSize = `calc(${base}px * var(--vv-trans-scale, 1))`;
    } catch (e) {
        console.warn('[VerseVibe] Trans: applyTranslationFontScale failed', e);
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
    // 先做布局分析，按「页中主干 → 页中右侧 → 页中左侧 → 页头 → 页尾」的优先级排序，
    // 让用户最关注的正文中央部分优先进入翻译队列（FIFO），而不是单纯按 DOM 顺序翻译。
    let nodes: Element[] = [];
    try {
        nodes = assignLayoutPriorities(grabAllNode(document.body));
    } catch (err) {
        // 抓取/布局分析阶段抛异常时，绝不能让整页翻译静默失败（尤其是从悬浮球点击调用，
        // 异常会被 Vue 事件处理吞掉，表现为「点了没反应」）。这里兜底并打印明显错误。
        console.error('[VerseVibe] Trans: grabAllNode/assignLayoutPriorities threw. Aborting grab but keeping observers.', err);
        nodes = [];
    }
    console.log(`[VerseVibe] Trans: grabAllNode found ${nodes.length} nodes.`);

    // 注意：即使初始抓取为 0 也不能中止——很多站点（如 GitHub 仓库页）的正文 README、
    // 右侧 About 都是脚本执行之后由 React 客户端渲染插入的。若此处直接 return，
    // 下方的 MutationObserver 就不会建立，后续渲染出来的正文将永远不会被翻译。
    // 因此继续往下走，至少把 MutationObserver 挂上，等待正文渲染后再翻译。

    isAutoTranslating = true;

    const translateObservedNode = (node: Element, observer: IntersectionObserver) => {
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
    };

    // 创建观察器
    observer = new IntersectionObserver((entries, observer) => {
        // 同一批次内仍按布局优先级排序后再依次入队，确保主干内容先翻译
        const visible = entries
            .filter(entry => entry.isIntersecting && isAutoTranslating)
            .map(entry => entry.target as Element)
            .sort((a, b) => getNodeLayoutPriority(a) - getNodeLayoutPriority(b));

        for (const node of visible) {
            translateObservedNode(node, observer);
        }
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
                    // 只处理未翻译的新节点，并为其分配布局优先级（供观察回调排序使用）
                    const newNodes = assignLayoutPriorities(
                        grabAllNode(node as Element).filter(
                            n => !n.hasAttribute(TRANSLATED_ATTR)
                        )
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

    // 是否逐行翻译，必须依据「渲染后的可见文本(innerText)」里真实的换行，
    // 而不是 HTML 源码里的换行/缩进。否则像作者署名这种：源码里每个
    // <span class="author"> 各占一行、但渲染为一整行的内容，会被误判成多行，
    // 被拆成一个名字一行逐个翻译，导致译文多次换行且失去上下文（如 "5 THU" 被译成 "周四5点"）。
    const visibleText = (node.innerText || node.textContent || '').trim();
    const visualLines = visibleText.split(/\n/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    const doPerLine = !richMarkup
        && visibleText.length > 0
        && visibleText.length < 4096
        && visualLines.length >= 2
        && visualLines.length <= 15;

    // 整块翻译时的原文：机器翻译用 innerHTML、富标记用纯文本、其余用标准化 HTML。
    // 关键：清除 HTML 源码中的装饰性换行/缩进（始终是不可见空白），
    // 避免翻译引擎或后续清洗把这些换行当成真实多行而拆行展示。
    let origin = (servicesType.isMachine(config.service) && !richMarkup)
        ? node.innerHTML
        : (richMarkup ? (node.textContent || '') : LLMStandardHTML(node));
    origin = origin.replace(/\s*\n\s*/g, ' ').trim();

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
        Promise.all(visualLines.map((line: string) => translateText(line, document.title)))
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
    // 清除 HTML 源码中的装饰性换行/缩进，避免被翻译引擎当作多行
    origin = origin.replace(/\s*\n\s*/g, ' ').trim();
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
            applyTranslationFontScale(node as HTMLElement);

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

    // 取内部 <a> 的样式（颜色等）的条件：
    //  - 非 <p>/<div> 容器（如页脚 li/span 里只有一个 a）：直接取链接样式；
    //  - <p>/<div> 容器：默认不取（避免正文段落整体变成链接色，如 selfh.st 正文），
    //    但若该块的可见文本几乎全部由链接构成（链接列表，如作者署名行），则取链接样式，
    //    以保持译文与原文一致的颜色（如 LongLive 作者行的绿色）。
    if (!headingAncestor && node instanceof HTMLElement) {
        const tag = (node.tagName || '').toLowerCase();
        const linkChild = node.querySelector('a');
        if (linkChild && linkChild.textContent && linkChild.textContent.trim()) {
            if (tag !== 'p' && tag !== 'div') {
                styleSource = linkChild as HTMLElement;
            } else {
                const totalLen = (node.textContent || '').replace(/\s+/g, '').length;
                const linkLen = Array.from(node.querySelectorAll('a'))
                    .reduce((sum, a) => sum + (a.textContent || '').replace(/\s+/g, '').length, 0);
                // 链接文本占比 >= 80% 视为「链接列表」，采用链接颜色
                if (totalLen > 0 && linkLen / totalLen >= 0.8) {
                    styleSource = linkChild as HTMLElement;
                }
            }
        }
    }

    const isHeadingTag = /^h[1-6]$/.test(tagName) || !!headingAncestor;

    // 稳定标记 class：用于设置页实时切换样式时定位已翻译节点（无需重新翻译）
    content.classList.add('verse-vibe-translation-text');
    if (isHeadingTag) {
        content.classList.add('verse-vibe-translation-heading');
    }

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
        ensureReadableLineHeight(content, computedStyle);
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
    applyTranslationFontScale(content);
    content.innerHTML = cleanText;
    wrapper.appendChild(content);
    smashTruncationStyle(node);
    node.appendChild(wrapper);
}

/**
 * 设置页实时切换译文样式：对页面上「已翻译」的节点重新套用当前 config.style 对应的样式 class，
 * 无需重新翻译。也兼容翻译进行中切换（新渲染节点会读取已更新的 config.style）。
 * 标题类节点（verse-vibe-translation-heading）保持不叠加样式，与原文标题外观一致。
 */
export function restyleExistingTranslations() {
    try {
        const style = options.styles.find(s => s.value === config.style && !s.disabled);
        const allStyleClasses = options.styles
            .map(s => s.class)
            .filter((c): c is string => !!c);
        const isBlockStyle = style?.group === 'card' || style?.group === 'special' || style?.group === 'pro';

        const nodes = document.querySelectorAll<HTMLElement>('.verse-vibe-translation-text');
        nodes.forEach((content) => {
            // 移除所有已知的样式 class，避免不同样式叠加冲突
            allStyleClasses.forEach(c => content.classList.remove(c));

            const isHeading = content.classList.contains('verse-vibe-translation-heading');
            if (style?.class && !isHeading) {
                content.classList.add(style.class);
            }

            // 重新套用布局：卡片/引用类为 block，下划线/高亮类为 inline + decoration-break
            if (isBlockStyle) {
                content.style.display = 'block';
                content.style.maxWidth = '100%';
                // @ts-ignore
                content.style.webkitBoxDecorationBreak = '';
                // @ts-ignore
                content.style.boxDecorationBreak = '';
            } else {
                content.style.display = 'inline';
                content.style.maxWidth = '';
                // @ts-ignore
                content.style.webkitBoxDecorationBreak = 'clone';
                // @ts-ignore
                content.style.boxDecorationBreak = 'clone';
            }
        });
    } catch (e) {
        console.warn('[VerseVibe] Trans: restyleExistingTranslations failed', e);
    }
}
