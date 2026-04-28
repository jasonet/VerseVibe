/**
 * Chrome Translation API Offscreen 文档
 * 在 offscreen 环境中处理 Chrome Translation API 调用
 */

// 语言代码映射
const languageMap: { [key: string]: string } = {
    'zh-Hans': 'zh',
    'zh-Hant': 'zh-TW',
    'en': 'en',
    'ja': 'ja',
    'ko': 'ko',
    'fr': 'fr',
    'de': 'de',
    'es': 'es',
    'ru': 'ru',
    'it': 'it',
    'pt': 'pt',
    'ar': 'ar',
    'hi': 'hi',
    'th': 'th',
    'vi': 'vi',
    'nl': 'nl',
    'pl': 'pl',
    'tr': 'tr'
};

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error ?? '未知错误');
}

function isExpectedTranslationError(error: unknown): boolean {
    const message = getErrorMessage(error).toLowerCase();
    return [
        '不支持的语言',
        '不支持的语言组合',
        'not supported',
        'unsupported language',
        'language',
    ].some(keyword => message.includes(keyword.toLowerCase()));
}

// 检查是否支持 Chrome Translation API
function isChromeTranslationSupported(): boolean {
    console.log('检查 Translation API 支持:', {
        hasTranslation: 'translation' in self,
        hasTranslator: 'Translator' in self,
        hasLanguageDetector: 'LanguageDetector' in self,
        windowType: typeof window,
        selfType: typeof self
    });

    // 检查新的 API
    if ('translation' in self && 'createTranslator' in (self as any).translation) {
        return true;
    }

    // 检查旧的 API
    if ('Translator' in self && 'LanguageDetector' in self) {
        return true;
    }

    return false;
}

// 检测文本语言
async function detectLanguage(text: string): Promise<string> {
    try {
        // 尝试使用新的 API
        if ('translation' in self && 'createDetector' in (self as any).translation) {
            const detector = await (self as any).translation.createDetector();
            const results = await detector.detect(text);
            const detected = results.length > 0 ? results[0].detectedLanguage : 'en';
            console.log('新 API 检测结果:', detected);
            return detected;
        }

        // 尝试使用旧的 API
        if ('LanguageDetector' in self) {
            const detector = await (self as any).LanguageDetector.create();
            const results = await detector.detect(text);
            const detected = results.length > 0 ? results[0].detectedLanguage : 'en';
            console.log('旧 API 检测结果:', detected);
            return detected;
        }
    } catch (error) {
        console.warn('Language detection failed:', error);
    }

    // 回退到简单检测
    const chineseRegex = /[\u4e00-\u9fff]/;
    const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/;
    const koreanRegex = /[\uac00-\ud7af]/;

    if (chineseRegex.test(text)) {
        return 'zh';
    } else if (japaneseRegex.test(text)) {
        return 'ja';
    } else if (koreanRegex.test(text)) {
        return 'ko';
    } else {
        return 'en';
    }
}

// 执行翻译
async function performTranslation(text: string, fromLang: string, toLang: string): Promise<string> {
    console.log('开始翻译:', { text: text.substring(0, 50) + '...', fromLang, toLang });

    try {
        let translator;
        const options = {
            sourceLanguage: fromLang,
            targetLanguage: toLang
        };

        // 尝试使用新的 API
        if ('translation' in self && 'createTranslator' in (self as any).translation) {
            console.log('使用新的 translation API');
            const translation = (self as any).translation;

            // 检查可用性
            if ('canTranslate' in translation) {
                const availability = await translation.canTranslate(options);
                console.log('翻译模型可用性:', availability);

                if (availability === 'no') {
                    throw new Error(`无法翻译 (${fromLang} -> ${toLang}): 模型不可用`);
                }

                if (availability === 'readily') {
                    // 模型已就绪，可以直接创建
                } else if (availability === 'after-download') {
                    console.warn('模型需要下载，Offscreen 环境可能无法触发下载 (需要用户手势)');
                    // 我们仍然尝试创建，但预计可能会失败并抛出 "Requires a user gesture"
                    // 最好在这里直接抛出更友好的错误，或者让后续的 createTranslator 抛出并捕获
                }
            }

            translator = await translation.createTranslator(options);
        }
        // 尝试使用旧的 API
        else if ('Translator' in self) {
            console.log('使用旧的 Translator API');
            translator = await (self as any).Translator.create(options);
        } else {
            throw new Error('没有可用的翻译 API');
        }

        let translatedText = '';

        // 检查是否支持流式翻译
        if (translator.translateStreaming) {
            console.log('使用流式翻译');
            const stream = translator.translateStreaming(text);
            for await (const chunk of stream) {
                translatedText += chunk;
            }
        } else if (translator.translate) {
            console.log('使用普通翻译');
            translatedText = await translator.translate(text);
        } else {
            throw new Error('翻译器不支持翻译方法');
        }

        console.log('翻译完成:', translatedText.substring(0, 50) + '...');
        return translatedText;

    } catch (error) {
        if (isExpectedTranslationError(error)) {
            console.warn('翻译未执行（预期内）:', getErrorMessage(error));
        } else {
            console.error('翻译执行失败:', error);
        }
        if (error instanceof Error && error.message.includes('user gesture')) {
            throw new Error('Chrome AI 模型需要下载。请在浏览器任意页面打开控制台运行 `await translation.createTranslator({sourceLanguage: "en", targetLanguage: "zh"})` 来触发下载，或者使用插件弹出页面的功能触发。');
        }
        throw error;
    }
}

// 处理翻译请求
async function handleTranslationRequest(data: any): Promise<string> {
    const { text, from, to } = data;

    if (!text || typeof text !== 'string' || text.trim() === '') {
        return ""
    }

    // 检查是否支持 Chrome Translation API
    if (!isChromeTranslationSupported()) {
        throw new Error('当前浏览器不支持 Chrome Translation API，请确保使用 Google Chrome 浏览器 v138 stable 或更高版本。');
    }

    // 声明变量以便在 catch 块中使用
    let detectedLang = from;
    let fromLang = from;
    let toLang = to;

    try {
        // 检测源语言
        if (from === 'auto') {
            detectedLang = await detectLanguage(text);
            console.log('自动检测到的语言:', detectedLang);
        }

        // 映射语言代码 - 确保使用 Chrome API 支持的格式
        fromLang = languageMap[detectedLang] || detectedLang;
        toLang = languageMap[to] || to;

        console.log('语言映射:', {
            original: { from, to },
            detected: detectedLang,
            mapped: { fromLang, toLang }
        });

        // 如果源语言和目标语言相同，不需要翻译
        if (fromLang === toLang) {
            console.log('源语言和目标语言相同，返回原文');
            return text;
        }

        // 执行翻译
        return await performTranslation(text, fromLang, toLang);

    } catch (error) {
        const errorMessage = getErrorMessage(error);
        const logPayload = {
            error: error,
            message: errorMessage,
            from: from,
            to: to,
            detectedLang: detectedLang,
            fromLang: fromLang,
            toLang: toLang
        };

        if (isExpectedTranslationError(error)) {
            console.warn('Chrome Translation API 不支持当前语言组合:', logPayload);
        } else {
            console.error('Chrome Translation API error:', error);
            console.error('错误详情:', logPayload);
        }

        // 提供更友好的错误信息
        if (error instanceof Error) {
            if (error.message.includes('not available') || error.message.includes('not ready')) {
                throw new Error('Chrome Translation API 暂时不可用。可能需要下载语言模型，请稍后重试。');
            } else if (error.message.includes('language') || error.message.includes('not supported')) {
                throw new Error(`不支持的语言组合：${fromLang} -> ${toLang}。请尝试其他语言对或检查浏览器版本。`);
            } else if (error.message.includes('model')) {
                throw new Error('翻译模型未就绪，请稍后重试或检查网络连接。');
            }
        }

        throw new Error(`翻译失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
}

// 监听来自 background script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // console.log('Offscreen 收到消息:', message);

    if (message.type === 'CHROME_TRANSLATE_OFFSCREEN') {
        handleTranslationRequest(message.data)
            .then(result => {
                // console.log('Offscreen 翻译成功:', result.substring(0, 50) + '...');
                sendResponse({ success: true, result });
            })
            .catch(error => {
                if (isExpectedTranslationError(error)) {
                    console.warn('Offscreen 翻译未执行（预期内）:', getErrorMessage(error));
                } else {
                    console.error('Offscreen 翻译失败:', error);
                }
                sendResponse({ success: false, error: getErrorMessage(error) });
            });

        return true; // 保持消息通道开放以支持异步响应
    }

    return false;
});

// 初始化检查
console.log('Chrome Translation Offscreen 初始化');
console.log('Translation API 支持状态:', isChromeTranslationSupported());
