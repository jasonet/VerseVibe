import { _service } from "@/entrypoints/service/_service";
import { config } from "@/entrypoints/utils/config";
import { CONTEXT_MENU_IDS } from "@/entrypoints/utils/constant";
import { contentPostHandler } from "@/entrypoints/utils/check";
import { storage } from '@wxt-dev/storage';

// 翻译状态管理
let translationStateMap = new Map<number, boolean>(); // tabId -> isTranslated
let contextMenusReadyPromise: Promise<void> | null = null;
let lastFlickrMenuEnabled = true;
let lastLinkedinMenuEnabled = true;
let lastLinkedinWideScale = '1.5x';
const FLICKR_DOWNLOAD_COMMAND_ID = 'versevibe-flickr-download-max';

function isMenuNotFoundError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('Cannot find menu item');
}

/**
 * 在background脚本中调用微软翻译API（避免Firefox CORS问题）
 */
async function translateWithMicrosoftInBackground(text: string, targetLang: string): Promise<string> {
    try {
        // 获取微软翻译的JWT令牌
        const jwtToken = await refreshMicrosoftTokenInBackground();

        // 调用微软翻译API
        const response = await fetch(`https://api-edge.cognitive.microsofttranslator.com/translate?from=&to=${targetLang}&api-version=3.0&includeSentenceLength=true&textType=html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + jwtToken
            },
            body: JSON.stringify([{ Text: text }])
        });

        if (response.ok) {
            const result = await response.json();
            return result[0].translations[0].text;
        } else {
            throw new Error(`微软翻译失败: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('微软翻译请求失败:', error);
        throw error;
    }
}

/**
 * 在background脚本中刷新微软翻译令牌
 */
async function refreshMicrosoftTokenInBackground(): Promise<string> {
    try {
        const response = await fetch("https://edge.microsoft.com/translate/auth");
        if (response.ok) {
            return await response.text();
        } else {
            throw new Error(`获取微软翻译令牌失败: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('获取微软翻译令牌失败:', error);
        throw error;
    }
}

function parseFlickrUrl(url: string): { userId: string | null; photoId: string | null } {
    const photoPathMatch = url.match(/flickr\.com\/photos\/([^/]+)\/(\d+)/i);
    if (photoPathMatch) {
        return { userId: photoPathMatch[1], photoId: photoPathMatch[2] };
    }

    const staticMatch = url.match(/\/(\d+)_[a-z0-9]+_[a-z]\./i);
    if (staticMatch) {
        return { userId: null, photoId: staticMatch[1] };
    }

    return { userId: null, photoId: null };
}

async function probeFlickrSizePage(pageUrl: string): Promise<string | null> {
    try {
        const response = await fetch(pageUrl);
        if (!response.ok) return null;

        const text = await response.text();
        if (text.includes("Page not found") || text.includes("You don't have permission")) {
            return null;
        }

        const imgRegex = /<div\s+id="allsizes-photo">[\s\S]*?<img\s+src="([^"]+)"/i;
        const match = text.match(imgRegex);
        return match?.[1] || null;
    } catch {
        return null;
    }
}

async function fetchFlickrTitle(photoPageUrl: string): Promise<string | null> {
    try {
        const response = await fetch(photoPageUrl);
        if (!response.ok) return null;

        const text = await response.text();
        const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
        if (!titleMatch?.[1]) return null;

        let title = titleMatch[1].replace("| Flickr", "").trim();
        if (title.toLowerCase().includes("flickr")) title = "flickr_photo";
        return title || null;
    } catch {
        return null;
    }
}

function sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, "").trim().substring(0, 80);
}

async function handleFlickrDownload(rawUrl: string): Promise<void> {
    const { userId, photoId } = parseFlickrUrl(rawUrl);
    if (!photoId) {
        console.warn('[VerseVibe] Flickr download skipped: URL 不是可解析的 Flickr 图片页', rawUrl);
        return;
    }

    const sizeCodes = ['o', '6k', '5k', '4k', '3k', 'k', 'h', 'l'];
    let bestImageUrl: string | null = null;
    let foundSize = '';

    for (const code of sizeCodes) {
        const sizesPageUrl = `https://www.flickr.com/photos/${userId || 'anyone'}/${photoId}/sizes/${code}/`;
        const imageUrl = await probeFlickrSizePage(sizesPageUrl);
        if (imageUrl) {
            bestImageUrl = imageUrl;
            foundSize = code;
            break;
        }
    }

    if (!bestImageUrl) {
        console.warn('[VerseVibe] Flickr download failed: 未找到可下载的大图', { photoId, rawUrl });
        return;
    }

    const title = await fetchFlickrTitle(rawUrl) || `flickr_${photoId}`;
    const filename = `${sanitizeFilename(title)}_${photoId}_${foundSize || 'max'}.jpg`;

    await browser.downloads.download({
        url: bestImageUrl,
        filename: `VerseVibe/Flickr/${filename}`,
        conflictAction: 'uniquify',
    });
}

export default defineBackground({
    persistent: {
        safari: false,
    },
    main() {
        console.log('[VerseVibe] Background script started. URL:', location.href);
        console.log('[VerseVibe] Loading configuration...');

        // 让点击工具栏图标 / Alt+Q 直接打开浏览器右侧 Side Panel
        try {
            (chrome as any)?.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true })
                .catch((err: unknown) => console.warn('[VerseVibe] setPanelBehavior 失败:', err));
        } catch (err) {
            console.warn('[VerseVibe] sidePanel API 不可用:', err);
        }
        lastFlickrMenuEnabled = config.flickrDownloadMenu !== false;
        lastLinkedinMenuEnabled = config.linkedinWideUi !== false;
        lastLinkedinWideScale = typeof config.linkedinWideScale === 'string' ? config.linkedinWideScale : '1.5x';

        /**
         * 为了避免“Cannot create item with duplicate id …”报错，
         * 在开发模式或 service worker 热重载时，可能会多次执行 main()。
         * 这里通过异步函数，先清空 / 删除旧菜单，再重新创建一遍，
         * 保证不会因为重复 id 导致 runtime.lastError。
         */
        const setupContextMenus = async () => {
            try {
                await browser.contextMenus.removeAll();
            } catch (error) {
                // removeAll 失败通常是因为还没有任何菜单，可以安全忽略
                console.warn('[VerseVibe] Failed to clear context menus (can be ignored on first run):', error);
            }

            // 兜底：逐个删除可能残留的菜单项（即便 removeAll 失败，也尽量清理）
            const candidates = [
                CONTEXT_MENU_IDS.TRANSLATE_FULL_PAGE,
                CONTEXT_MENU_IDS.RESTORE_ORIGINAL,
                CONTEXT_MENU_IDS.FLICKR_DOWNLOAD_MAX,
                CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_NORMAL,
                CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_15X,
                CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_2X,
                CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_3X,
                CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_FULL,
                CONTEXT_MENU_IDS.LINKEDIN_FEED_WIDE_DESPONSOR,
                CONTEXT_MENU_IDS.LINKEDIN_POST_TEXT_ZOOM,
            ];
            await Promise.all(
                candidates.map((id) =>
                    browser.contextMenus.remove(id as string).catch(() => {
                        // 不存在时会报错，忽略即可
                    }),
                ),
            );

            try {
                // 创建全文翻译菜单（一级菜单）
                browser.contextMenus.create({
                    id: CONTEXT_MENU_IDS.TRANSLATE_FULL_PAGE,
                    title: '全文翻译',
                    contexts: ['page', 'selection'],
                });

                // 创建撤销翻译菜单（一级菜单）
                browser.contextMenus.create({
                    id: CONTEXT_MENU_IDS.RESTORE_ORIGINAL,
                    title: '撤销翻译',
                    contexts: ['page', 'selection'],
                    enabled: false, // 初始状态为禁用
                });

                if (config.flickrDownloadMenu !== false) {
                    browser.contextMenus.create({
                        id: CONTEXT_MENU_IDS.FLICKR_DOWNLOAD_MAX,
                        title: '下载 Flickr 最大尺寸图片 (Alt+D)',
                        contexts: ['page', 'link', 'image'],
                        documentUrlPatterns: ['*://*.flickr.com/*'],
                    } as any);
                }

                if (config.linkedinWideUi !== false) {
                    const scale = typeof config.linkedinWideScale === 'string' ? config.linkedinWideScale : '1.5x';
                    const linkedinScaleUrlPatterns = [
                        '*://*.linkedin.com/feed*',
                        '*://*.linkedin.com/posts/*',
                        '*://*.linkedin.com/pulse/*',
                    ];

                    browser.contextMenus.create({
                        id: CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_NORMAL,
                        title: 'Linkedin宽幅尺寸：原始宽',
                        type: 'radio',
                        checked: scale === 'normal',
                        contexts: ['page'],
                        documentUrlPatterns: linkedinScaleUrlPatterns,
                    } as any);

                    browser.contextMenus.create({
                        id: CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_15X,
                        title: 'Linkedin宽幅尺寸：1.5倍宽',
                        type: 'radio',
                        checked: scale === '1.5x',
                        contexts: ['page'],
                        documentUrlPatterns: linkedinScaleUrlPatterns,
                    } as any);

                    browser.contextMenus.create({
                        id: CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_2X,
                        title: 'Linkedin宽幅尺寸：2倍宽',
                        type: 'radio',
                        checked: scale === '2x',
                        contexts: ['page'],
                        documentUrlPatterns: linkedinScaleUrlPatterns,
                    } as any);

                    browser.contextMenus.create({
                        id: CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_3X,
                        title: 'Linkedin宽幅尺寸：3倍宽',
                        type: 'radio',
                        checked: scale === '3x',
                        contexts: ['page'],
                        documentUrlPatterns: linkedinScaleUrlPatterns,
                    } as any);

                    browser.contextMenus.create({
                        id: CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_FULL,
                        title: 'Linkedin宽幅尺寸：全宽',
                        type: 'radio',
                        checked: scale === 'full',
                        contexts: ['page'],
                        documentUrlPatterns: linkedinScaleUrlPatterns,
                    } as any);

                    browser.contextMenus.create({
                        id: CONTEXT_MENU_IDS.LINKEDIN_FEED_WIDE_DESPONSOR,
                        title: '宽幅去赞助',
                        contexts: ['page'],
                        documentUrlPatterns: [
                            '*://*.linkedin.com/feed*',
                        ],
                    } as any);

                    browser.contextMenus.create({
                        id: CONTEXT_MENU_IDS.LINKEDIN_POST_TEXT_ZOOM,
                        title: '文章加大字号',
                        contexts: ['page'],
                        documentUrlPatterns: [
                            '*://*.linkedin.com/posts/*',
                            '*://*.linkedin.com/pulse/*',
                        ],
                    } as any);
                }
            } catch (error) {
                console.error('Error setting up context menu:', error);
            }
        };

        contextMenusReadyPromise = setupContextMenus();

        const ensureContextMenusReady = async () => {
            if (!contextMenusReadyPromise) {
                contextMenusReadyPromise = setupContextMenus();
            }

            try {
                await contextMenusReadyPromise;
            } catch (error) {
                console.error('Failed to initialize context menus:', error);
            }
        };

        // 监听右键菜单点击事件
        browser.contextMenus.onClicked.addListener((info: any, tab: any) => {
            if (!tab?.id) return;

            const applyLinkedinScale = (scale: 'normal' | '1.5x' | '2x' | '3x' | 'full') => {
                // 选择宽幅尺寸时，自动确保 LinkedIn 宽幅功能开启
                config.linkedinWideUi = true;
                config.linkedinWideScale = scale;
                lastLinkedinWideScale = scale;
                storage.setItem('local:config', JSON.stringify(config)).catch((error: unknown) => {
                    console.warn('[VerseVibe] 保存 LinkedIn 宽幅尺寸失败:', error);
                });
                browser.tabs.sendMessage(tab.id, {
                    type: 'contextMenuLinkedinAction',
                    action: 'setLinkedinWideScale',
                    scale,
                }).catch((error: any) => {
                    console.warn('Failed to send LinkedIn scale action to content script:', error);
                });
            };

            if (info.menuItemId === CONTEXT_MENU_IDS.TRANSLATE_FULL_PAGE) {
                console.log('[VerseVibe] Background: Context menu clicked (Full Page)', tab?.id);
                // 发送消息到内容脚本触发全文翻译
                browser.tabs.sendMessage(tab.id, {
                    type: 'contextMenuTranslate',
                    action: 'fullPage'
                }).then(() => {
                    console.log('[VerseVibe] Background: Message sent to content script successfully');
                    // 更新翻译状态
                    translationStateMap.set(tab.id!, true);
                    updateContextMenus(tab.id!);
                }).catch((error: any) => {
                    console.error('Failed to send message to content script:', error);
                });
            } else if (info.menuItemId === CONTEXT_MENU_IDS.RESTORE_ORIGINAL) {
                // 发送消息到内容脚本撤销翻译
                browser.tabs.sendMessage(tab.id, {
                    type: 'contextMenuTranslate',
                    action: 'restore'
                }).then(() => {
                    // 更新翻译状态
                    translationStateMap.set(tab.id!, false);
                    updateContextMenus(tab.id!);
                }).catch((error: any) => {
                    console.error('Failed to send message to content script:', error);
                });
            } else if (info.menuItemId === CONTEXT_MENU_IDS.FLICKR_DOWNLOAD_MAX) {
                if (config.flickrDownloadMenu === false) return;
                const targetUrl = info.linkUrl || info.srcUrl || info.pageUrl || tab.url;
                if (!targetUrl) return;

                handleFlickrDownload(targetUrl).catch((error) => {
                    console.error('[VerseVibe] Flickr 下载失败:', error);
                });
            } else if (info.menuItemId === CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_NORMAL) {
                if (config.linkedinWideUi === false) return;
                applyLinkedinScale('normal');
            } else if (info.menuItemId === CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_15X) {
                if (config.linkedinWideUi === false) return;
                applyLinkedinScale('1.5x');
            } else if (info.menuItemId === CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_2X) {
                if (config.linkedinWideUi === false) return;
                applyLinkedinScale('2x');
            } else if (info.menuItemId === CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_3X) {
                if (config.linkedinWideUi === false) return;
                applyLinkedinScale('3x');
            } else if (info.menuItemId === CONTEXT_MENU_IDS.LINKEDIN_WIDE_SCALE_FULL) {
                if (config.linkedinWideUi === false) return;
                applyLinkedinScale('full');
            } else if (info.menuItemId === CONTEXT_MENU_IDS.LINKEDIN_FEED_WIDE_DESPONSOR) {
                if (config.linkedinWideUi === false) return;
                browser.tabs.sendMessage(tab.id, {
                    type: 'contextMenuLinkedinAction',
                    action: 'feedWideDesponsor',
                }).catch((error: any) => {
                    console.error('Failed to send LinkedIn feed action to content script:', error);
                });
            } else if (info.menuItemId === CONTEXT_MENU_IDS.LINKEDIN_POST_TEXT_ZOOM) {
                if (config.linkedinWideUi === false) return;
                browser.tabs.sendMessage(tab.id, {
                    type: 'contextMenuLinkedinAction',
                    action: 'postTextZoom',
                }).catch((error: any) => {
                    console.error('Failed to send LinkedIn post action to content script:', error);
                });
            }
        });

        browser.commands.onCommand.addListener(async (command: string) => {
            if (command !== FLICKR_DOWNLOAD_COMMAND_ID) return;
            if (config.flickrDownloadMenu === false) return;

            try {
                const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
                const activeTab = tabs?.[0];
                const targetUrl = activeTab?.url;
                if (!targetUrl) return;

                await handleFlickrDownload(targetUrl);
            } catch (error) {
                console.error('[VerseVibe] Flickr 快捷键下载失败:', error);
            }
        });

        // 更新右键菜单状态
        const updateContextMenus = async (tabId: number) => {
            const isTranslated = translationStateMap.get(tabId) || false;

            try {
                await ensureContextMenusReady();

                // 更新全文翻译菜单项
                try {
                    await browser.contextMenus.update(CONTEXT_MENU_IDS.TRANSLATE_FULL_PAGE, {
                        enabled: !isTranslated,
                        title: isTranslated ? '全文翻译 (已翻译)' : '全文翻译'
                    });
                } catch (error) {
                    if (!isMenuNotFoundError(error)) throw error;
                    contextMenusReadyPromise = setupContextMenus();
                    await ensureContextMenusReady();
                }

                // 更新撤销翻译菜单项
                await browser.contextMenus.update(CONTEXT_MENU_IDS.RESTORE_ORIGINAL, {
                    enabled: isTranslated,
                    title: isTranslated ? '撤销翻译' : '撤销翻译 (无翻译)'
                });
            } catch (error) {
                console.error('Failed to update context menus:', error);
            }
        };

        // 监听标签页切换事件，更新菜单状态
        browser.tabs.onActivated.addListener((activeInfo: any) => {
            void updateContextMenus(activeInfo.tabId);
        });

        // 监听标签页更新事件（页面刷新等）
        browser.tabs.onUpdated.addListener((tabId: any, changeInfo: any) => {
            if (changeInfo.status === 'complete') {
                // 页面加载完成，重置翻译状态
                translationStateMap.set(tabId, false);
                void updateContextMenus(tabId);
            }
        });

        // 监听标签页关闭事件，清理状态
        browser.tabs.onRemoved.addListener((tabId: any) => {
            translationStateMap.delete(tabId);
        });

        storage.watch('local:config', (newValue: any) => {
            if (typeof newValue !== 'string' || !newValue.trim()) return;
            try {
                const parsed = JSON.parse(newValue);
                if (typeof parsed === 'object' && parsed) {
                    Object.assign(config, parsed);
                    const nextFlickrMenuEnabled = config.flickrDownloadMenu !== false;
                    const nextLinkedinMenuEnabled = config.linkedinWideUi !== false;
                    const nextLinkedinWideScale = typeof config.linkedinWideScale === 'string' ? config.linkedinWideScale : '1.5x';
                    if (
                        nextFlickrMenuEnabled !== lastFlickrMenuEnabled ||
                        nextLinkedinMenuEnabled !== lastLinkedinMenuEnabled ||
                        nextLinkedinWideScale !== lastLinkedinWideScale
                    ) {
                        lastFlickrMenuEnabled = nextFlickrMenuEnabled;
                        lastLinkedinMenuEnabled = nextLinkedinMenuEnabled;
                        lastLinkedinWideScale = nextLinkedinWideScale;
                        contextMenusReadyPromise = setupContextMenus();
                    }
                }
            } catch (error) {
                console.warn('[VerseVibe] Background: 解析 local:config 失败，跳过菜单重建', error);
            }
        });

        // 处理翻译请求
        browser.runtime.onMessage.addListener((message: any) => {
            return new Promise(async (resolve, reject) => {
                try {
                    if (message.type === 'triggerFlickrDownloadFromPageHotkey') {
                        if (config.flickrDownloadMenu === false) {
                            resolve({ success: false, reason: 'flickr-menu-disabled' });
                            return;
                        }

                        const targetUrl = typeof message.url === 'string' ? message.url : '';
                        if (!targetUrl) {
                            resolve({ success: false, reason: 'invalid-url' });
                            return;
                        }

                        await handleFlickrDownload(targetUrl);
                        resolve({ success: true });
                        return;
                    }

                    // 点击悬浮球「设置」时在新标签页打开设置页（使用未列入 manifest 的 settings 页，避免 options_ui 导致加载失败）
                    if (message.type === 'openOptionsPage') {
                        const url = browser.runtime.getURL('settings.html');
                        await browser.tabs.create({ url });
                        resolve({ success: true });
                        return;
                    }

                    // 处理输入框翻译请求
                    if (message.type === 'inputBoxTranslation') {
                        const translatedText = await translateWithMicrosoftInBackground(message.text, message.targetLang);
                        resolve({ success: true, translatedText });
                        return;
                    }

                    // 处理普通翻译请求
                    _service[config.service](message)
                        .then(resp => resolve(contentPostHandler(resp)))    // 成功
                        .catch(error => reject(error)); // 失败
                } catch (error) {
                    resolve({ success: false, error: error instanceof Error ? error.message : String(error) });
                }
            });
        });
    }
});
