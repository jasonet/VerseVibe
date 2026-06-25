export const services = {
    // 传统机器翻译
    microsoft: "microsoft",
    deepL: "deepL",
    deeplx: "deeplx",
    google: "google",
    xiaoniu: "xiaoniu",
    youdao: "youdao",
    tencent: "tencent", // 腾讯云机器翻译
    // 大模型翻译
    openai: "openai",
    azureOpenai: "azureOpenai", // Azure OpenAI
    gemini: "gemini",
    tongyi: "tongyi",
    zhipu: "zhipu",
    moonshot: "moonshot",
    claude: "claude",
    custom: "custom",
    infini: "infini",
    // baidu: 'baidu',
    baichuan: "baichuan",
    lingyi: "lingyi",
    deepseek: "deepseek",
    minimax: "minimax",
    jieyue: "jieyue", // 阶跃星辰
    groq: "groq",
    huanYuan: "huanYuan", // 腾讯混元
    huanYuanTranslation: "huanYuanTranslation", // 腾讯混元翻译大模型
    doubao: "doubao", // 字节豆包
    siliconCloud: "siliconCloud", // 硅流
    openrouter: "openrouter", // openrouter
    grok: "grok", // X.AI 的 Grok
    newapi: "newapi", // New API 接口
    chromeTranslator: "chromeTranslator", // Chrome 内置翻译 API
};

const isMacPlatform = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export const servicesType = {
    // 阵营划分
    machine: new Set([services.microsoft, services.deepL, services.deeplx, services.google, services.xiaoniu, services.youdao, services.tencent, services.chromeTranslator,]),
    AI: new Set([
        services.openai,
        services.azureOpenai,
        services.gemini,
        services.tongyi,
        services.zhipu,
        services.moonshot,
        services.claude, services.custom,
        services.infini,
        services.baichuan,
        services.deepseek,
        services.lingyi,
        services.minimax,
        services.jieyue,
        services.groq,
        services.huanYuan,
        services.huanYuanTranslation,
        services.doubao,
        services.siliconCloud,
        services.openrouter,
        services.grok,
        services.newapi,
    ]),
    // 需要 token
    useToken: new Set([
        services.openai,
        services.azureOpenai,
        services.gemini,
        services.tongyi,
        services.zhipu,
        services.moonshot,
        services.claude,
        services.deepL,
        services.deeplx,
        services.xiaoniu,
        services.infini,
        services.baichuan,
        services.deepseek,
        services.lingyi,
        services.minimax,
        services.jieyue,
        services.groq,
        services.custom,
        services.huanYuan,
        services.doubao,
        services.siliconCloud,
        services.openrouter,
        services.grok,
        services.newapi,
    ]),
    // 需要 model
    useModel: new Set([
        services.openai,
        services.azureOpenai,
        services.gemini,
        services.tongyi,
        services.zhipu,
        services.moonshot,
        services.claude,
        services.custom,
        services.infini,
        services.baichuan,
        services.deepseek,
        services.lingyi,
        services.minimax,
        services.jieyue,
        services.groq,
        services.huanYuan,
        services.huanYuanTranslation,
        services.doubao,
        services.siliconCloud,
        services.openrouter,
        services.grok,
        services.newapi,
    ]),
    // 支持代理
    useProxy: new Set([
        services.openai,
        services.azureOpenai,
        services.gemini,
        services.claude,
        services.google,
        services.deepL,
        services.deeplx,
        services.moonshot,
        services.tongyi,
        services.xiaoniu,
        services.youdao,
        services.tencent,
        services.baichuan,
        services.deepseek,
        services.lingyi,
        services.jieyue,
        services.groq,
        services.huanYuan,
        services.huanYuanTranslation,
        services.doubao,
        services.siliconCloud,
        services.openrouter,
        services.grok,
    ]),
    // 支持自定义 URL 的服务
    useCustomUrl: new Set([
        services.custom,
        services.deeplx,
        services.newapi,
        services.azureOpenai,
    ]),

    isMachine: (service: string) => servicesType.machine.has(service),
    isAI: (service: string) => servicesType.AI.has(service),
    isUseToken: (service: string) => servicesType.useToken.has(service),
    isUseProxy: (service: string) => servicesType.useProxy.has(service),
    isUseModel: (service: string) => servicesType.useModel.has(service),
    isCustom: (service: string) => service === services.custom,
    isNewApi: (service: string) => service === services.newapi,
    isYoudao: (service: string) => service === services.youdao,
    isTencent: (service: string) => service === services.tencent || service === services.huanYuanTranslation,
    isAzureOpenai: (service: string) => service === services.azureOpenai,
    isUseCustomUrl: (service: string) => servicesType.useCustomUrl.has(service),
};

/**
 * 翻译统计分组：把当前服务归入三大模块之一。
 *  - 'chrome'  → Chrome 本地（内置 Translator API，设备端离线）
 *  - 'ai'      → AI 翻译（大模型 / 自定义接口）
 *  - 'machine' → 机器在线API翻译（微软、谷歌、DeepL、有道、腾讯云等）
 * 注意：chromeTranslator 虽在 machine 阵营里，但统计上单列为本地模块。
 */
export function translationModule(service: string): 'chrome' | 'ai' | 'machine' {
    if (service === services.chromeTranslator) return 'chrome';
    if (servicesType.AI.has(service)) return 'ai';
    return 'machine';
}

/**
 * 记一次翻译（一个词条 = 一段被翻译的文本）。
 * 同步累加总数 count 与对应模块的分项计数，便于在页脚分三档展示。
 */
export function bumpTranslationCount(cfg: {
    service: string;
    count: number;
    countMachine: number;
    countAI: number;
    countChrome: number;
}): void {
    cfg.count = (cfg.count || 0) + 1;
    switch (translationModule(cfg.service)) {
        case 'chrome': cfg.countChrome = (cfg.countChrome || 0) + 1; break;
        case 'ai': cfg.countAI = (cfg.countAI || 0) + 1; break;
        default: cfg.countMachine = (cfg.countMachine || 0) + 1; break;
    }
}

export const customModelString = "自定义模型";
export const models = new Map<string, Array<string>>([
    [services.openai, ["gpt-5-nano", "gpt-5-mini", "gpt5", "gpt-5-chat-latest", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o-mini", "gpt-4o", "o3", "o3-mini", customModelString]],
    [services.azureOpenai, ["gpt-5-nano", "gpt-5-mini", "gpt5", "gpt-5-chat-latest", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o-mini", "gpt-4o", "o3", "o3-mini", customModelString]],
    [services.gemini, ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro", customModelString]],
    [services.tongyi, ["qwen-long", "qwen-turbo", "qwen-plus", "qwen3-8b", "qwen-mt-plus", "qwen-mt-turbo", customModelString]],
    [services.zhipu, ["glm-4.5", "GLM-4-Flash", "glm-4-plus", "glm-4", "glm-4v", customModelString]],
    [services.moonshot, ["kimi-k2-0711-preview", "kimi-k2-turbo-preview", "moonshot-v1-auto", "moonshot-v1-8k", "moonshot-v1-32k", customModelString]],
    [services.claude, ["claude-sonnet-4-0", "claude-opus-4-1", "claude-3-5-haiku-latest"]],
    [services.custom, ["gpt-5-nano", "gpt-5-mini", "gpt5", "gpt-4o", "gemma:7b", "llama2:7b", "mistral:7b", customModelString]],
    [services.infini, ["llama-2-13b-chat", "llama-3.3-70b-instruct", "qwen2.5-14b-instruct", "gemma-2-27b-it", "glm-4-9b-chat", customModelString]],
    [services.baichuan, ["Baichuan4-Air", "Baichuan4-Turbo", "Baichuan4", customModelString]],
    [services.lingyi, ["yi-lightning", customModelString]],
    [services.deepseek, ["deepseek-v4-pro", "deepseek-v4-flash", customModelString]],
    [services.minimax, ["chatcompletion_v2"]],
    [services.jieyue, ["step-1-8k", customModelString]],
    [services.huanYuan, ["hunyuan-turbos-latest", "hunyuan-t1-latest", "hunyuan-a13b", "hunyuan-lite", "hunyuan-standard", customModelString]],
    [services.huanYuanTranslation, ["hunyuan-translation", "hunyuan-translation-lite", customModelString]],
    [services.newapi, ["gemini-2.5-flash-lite", "gemini-2.0-flash", "gpt-5-nano", "gpt-5-mini", "gpt5", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o-mini", customModelString]],
    [services.grok, ["grok-4-0709", "grok-3-mini", customModelString]],
    [services.doubao, [customModelString]],

    // mix model
    [services.siliconCloud, ["Qwen/Qwen3-Coder-30B-A3B-Instruct", "Qwen/Qwen3-8B", "THUDM/GLM-Z1-9B-0414", "THUDM/GLM-4-9B-0414",
        "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B", "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
        "Qwen/Qwen2.5-7B-Instruct", "internlm/internlm2_5-7b-chat", "THUDM/glm-4-9b-chat", customModelString]],

    [services.groq, ["llama-3.1-8b-instant", "llama3-8b-8192", "llama-3.3-70b-versatile", "gemma2-9b-it", "mixtral-8x7b-32768", "whisper-large-v3", customModelString]],
    [services.openrouter, ["meta-llama/llama-3.1-8b-instruct", "google/gemini-2.0-flash-exp", "qwen/qwen-2-7b-instruct", "huggingfaceh4/zephyr-7b-beta", customModelString]]
]);

// 品牌图标（内联 SVG data URI，无需额外网络请求）
const MICROSOFT_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='1' y='1' width='10' height='10' fill='%23F25022'/%3E%3Crect x='13' y='1' width='10' height='10' fill='%237FBA00'/%3E%3Crect x='1' y='13' width='10' height='10' fill='%2300A4EF'/%3E%3Crect x='13' y='13' width='10' height='10' fill='%23FFB900'/%3E%3C/svg%3E";
const GOOGLE_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cpath fill='%23FFC107' d='M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z'/%3E%3Cpath fill='%23FF3D00' d='M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z'/%3E%3Cpath fill='%234CAF50' d='M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39.6 16.2 44 24 44z'/%3E%3Cpath fill='%231976D2' d='M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C39.9 36 44 30.6 44 24c0-1.3-.1-2.3-.4-3.5z'/%3E%3C/svg%3E";

export const options = {
    on: [
        { value: true, label: "开启" },
        { value: false, label: "关闭" },
    ],
    // 是否即时翻译
    autoTranslate: [
        { value: true, label: "开启" },
        { value: false, label: "关闭" },
    ],
    // 是否使用缓存
    useCache: [
        { value: true, label: "开启" },
        { value: false, label: "关闭" },
    ],
    form: [{ value: "auto", label: "自动检测" }],
    to: [
        { value: "zh-Hans", label: "中文" },
        { value: "zh-Hant", label: "繁体中文" },
        { value: "en", label: "英语" },
        { value: "ja", label: "日语" },
        { value: "ko", label: "韩语" },
        { value: "fr", label: "法语" },
        { value: "ru", label: "俄语" },
        { value: "es", label: "西班牙语" },
        { value: "de", label: "德语" },
        { value: "pt", label: "葡萄牙语" },
        { value: "it", label: "意大利语" },
    ],
    keys: [
        { value: "none", label: "禁用快捷键" },

        { value: "Computer", label: "键盘选项", disabled: true },
        { value: "Control", label: "Ctrl" },
        { value: "Alt", label: "Alt" },
        { value: "Shift", label: "Shift" },
        { value: "Escape", label: "ESC" },
        { value: "`", label: "波浪号键" },

        { value: "mouse", label: "鼠标选项", disabled: true },
        { value: "DoubleClick", label: "鼠标双击" },
        { value: "LongPress", label: "鼠标长按" },
        { value: "MiddleClick", label: "鼠标滚轮单击" },

        { value: "touchscreen", label: "触屏设备选项", disabled: true },
        { value: "TwoFinger", label: "双指翻译" },
        { value: "ThreeFinger", label: "三指翻译" },
        { value: "FourFinger", label: "四指翻译" },
        { value: "DoubleClickScree", label: "双击翻译" },
        { value: "TripleClickScree", label: "三击翻译" },

        { value: "custom", label: "自定义快捷键（测试版）" },
    ],
    services: [
        // 免费在线API翻译（浏览器默认）
        { value: "machine", label: "免费在线API翻译（浏览器默认）", disabled: true },
        { value: services.microsoft, label: "微软翻译", icon: MICROSOFT_ICON },
        { value: services.google, label: "谷歌翻译", icon: GOOGLE_ICON },
        { value: services.deepL, label: "DeepL" },
        // 隐藏 DeepLX（以后可恢复，勿删）
        // { value: services.deeplx, label: "DeepLX" },
        { value: services.xiaoniu, label: "小牛翻译" },
        { value: services.youdao, label: "有道翻译" },
        { value: services.tencent, label: "腾讯云翻译" },
        // AI 私密翻译（本地运行，数据不出本机）
        { value: "ai", label: "AI私密翻译（建议 自定义translategemma-4b-it_immersive-translate 2.2GB 2026本地运行）", disabled: true },
        { value: services.custom, label: "自定义接口⭐️⭐️⭐️" },
        { value: services.chromeTranslator, label: "Chrome内置AI翻译⭐⭐" },
        // AI 远程翻译（需自备 Key）
        { value: "ai_remote", label: "AI远程翻译（Key）", disabled: true },
        { value: services.deepseek, label: "DeepSeek️" },
        { value: services.siliconCloud, label: "硅基流动⭐️" },
        { value: services.huanYuan, label: "腾讯混元⭐" },
        { value: services.newapi, label: "New API" },
        { value: services.openai, label: "OpenAI" },
        { value: services.azureOpenai, label: "Azure OpenAI" },
        { value: services.huanYuanTranslation, label: "腾讯混元翻译" },
        { value: services.tongyi, label: "阿里通义" },
        { value: services.doubao, label: "字节豆包" },
        { value: services.claude, label: "Claude" },
        { value: services.gemini, label: "Gemini" },
        { value: services.moonshot, label: "Kimi" },
        { value: services.zhipu, label: "Z.ai" },
        // 更多 / 小众模型（均可改用「自定义接口 / New API / OpenRouter」接入）
        { value: "ai_more", label: "更多 / 小众模型", disabled: true },
        { value: services.openrouter, label: "OpenRouter" },
        { value: services.grok, label: "Grok (X.AI)" },
        { value: services.groq, label: "Groq" },
        { value: services.baichuan, label: "百川智能" },
        // 隐藏 零一万物 / 阶跃星辰 / 无向芯穹（以后可恢复，勿删）
        // { value: services.lingyi, label: "零一万物" },
        { value: services.minimax, label: "MiniMax" },
        // { value: services.jieyue, label: "阶跃星辰" },
        // { value: services.infini, label: "无向芯穹" },
    ],
    display: [
        { value: 0, label: "仅译文模式" },
        { value: 1, label: "双语对照模式" },
    ],
    // 双语翻译样式
    styles: [
        // 下划线系列
        { value: "underline", label: "下划线系列", disabled: true },
        { value: 33, label: "炫光底线·紫", class: "verse-vibe-display-glow-underline", group: "underline" },
        { value: 41, label: "炫光底线·黄", class: "verse-vibe-display-glow-underline-yellow", group: "underline" },
        { value: 42, label: "炫光底线·红", class: "verse-vibe-display-glow-underline-red", group: "underline" },
        { value: 43, label: "炫光底线·绿", class: "verse-vibe-display-glow-underline-green", group: "underline" },
        { value: 44, label: "炫光底线·褐", class: "verse-vibe-display-glow-underline-brown", group: "underline" },
        { value: 5, label: "优雅虚线", class: "verse-vibe-display-dot-underline", group: "underline" },
        { value: 51, label: "优雅虚线·红", class: "verse-vibe-display-dot-underline-red", group: "underline" },
        { value: 52, label: "优雅虚线·黄", class: "verse-vibe-display-dot-underline-yellow", group: "underline" },
        { value: 53, label: "优雅虚线·绿", class: "verse-vibe-display-dot-underline-green", group: "underline" },
        { value: 54, label: "优雅虚线·紫", class: "verse-vibe-display-dot-underline-purple", group: "underline" },
        { value: 4, label: "蓝色实线", class: "verse-vibe-display-solid-underline", group: "underline" },
        { value: 55, label: "实线·红", class: "verse-vibe-display-solid-underline-red", group: "underline" },
        { value: 56, label: "实线·橘黄", class: "verse-vibe-display-solid-underline-orange", group: "underline" },
        { value: 57, label: "实线·浅蓝", class: "verse-vibe-display-solid-underline-lightblue", group: "underline" },
        { value: 58, label: "双实线·浅蓝", class: "verse-vibe-display-double-underline-lightblue", group: "underline" },
        { value: 59, label: "双实线·橘黄", class: "verse-vibe-display-double-underline-orange", group: "underline" },
        { value: 60, label: "双实线·浅红", class: "verse-vibe-display-double-underline-lightred", group: "underline" },
        { value: 6, label: "活泼波浪", class: "verse-vibe-display-wavy", group: "underline" },
        { value: 61, label: "活泼波浪·红", class: "verse-vibe-display-wavy-lively-red", group: "underline" },
        { value: 26, label: "闷骚浪·红", class: "verse-vibe-display-wavy-red", group: "underline" },
        { value: 27, label: "闷骚浪·黄", class: "verse-vibe-display-wavy-yellow", group: "underline" },
        { value: 28, label: "闷骚浪·绿", class: "verse-vibe-display-wavy-green", group: "underline" },
        { value: 29, label: "闷骚浪·蓝", class: "verse-vibe-display-wavy-blue", group: "underline" },
        { value: 30, label: "闷骚浪·黑", class: "verse-vibe-display-wavy-black", group: "underline" },
        { value: 31, label: "闷骚浪·紫", class: "verse-vibe-display-wavy-purple", group: "underline" },
        { value: 32, label: "闷骚浪·橘", class: "verse-vibe-display-wavy-orange", group: "underline" },

        // 卡片系列
        { value: "card", label: "卡片系列", disabled: true },
        { value: 7, label: "简约卡片", class: "verse-vibe-display-card-mode", group: "card" },
        { value: 8, label: "渐变卡片", class: "verse-vibe-display-modern-card", group: "card" },
        { value: 9, label: "纸张卡片", class: "verse-vibe-display-paper", group: "card" },

        // 高亮系列
        { value: "highlight", label: "高亮系列", disabled: true },
        { value: 10, label: "学习标记", class: "verse-vibe-display-learning-mode", group: "highlight" },
        { value: 62, label: "学习标记·浅蓝", class: "verse-vibe-display-learning-mode-lightblue", group: "highlight" },
        { value: 63, label: "学习标记·浅粉", class: "verse-vibe-display-learning-mode-lightpink", group: "highlight" },
        { value: 64, label: "学习标记·浅绿", class: "verse-vibe-display-learning-mode-lightgreen", group: "highlight" },
        { value: 65, label: "学习标记·浅紫", class: "verse-vibe-display-learning-mode-lightpurple", group: "highlight" },
        { value: 11, label: "荧光标记", class: "verse-vibe-display-marker", group: "highlight" },
        { value: 66, label: "荧光标记·浅蓝", class: "verse-vibe-display-marker-lightblue", group: "highlight" },
        { value: 67, label: "荧光标记·浅粉", class: "verse-vibe-display-marker-lightpink", group: "highlight" },
        { value: 68, label: "荧光标记·浅绿", class: "verse-vibe-display-marker-lightgreen", group: "highlight" },
        { value: 69, label: "荧光标记·浅紫", class: "verse-vibe-display-marker-lightpurple", group: "highlight" },
        { value: 12, label: "柔和渐变", class: "verse-vibe-display-highlight-fade", group: "highlight" },
        { value: 70, label: "柔和渐变·浅蓝", class: "verse-vibe-display-highlight-fade-lightblue", group: "highlight" },
        { value: 71, label: "柔和渐变·浅粉", class: "verse-vibe-display-highlight-fade-lightpink", group: "highlight" },
        { value: 72, label: "柔和渐变·浅绿", class: "verse-vibe-display-highlight-fade-lightgreen", group: "highlight" },
        { value: 73, label: "柔和渐变·浅紫", class: "verse-vibe-display-highlight-fade-lightpurple", group: "highlight" },

        // 背景色系列
        { value: "background", label: "背景色系列", disabled: true },
        { value: 13, label: "温暖黄底", class: "verse-vibe-display-lightyellow", group: "background" },
        { value: 14, label: "清新蓝底", class: "verse-vibe-display-lightblue", group: "background" },
        { value: 15, label: "素雅灰底", class: "verse-vibe-display-lightgray", group: "background" },
        { value: 35, label: "紫色底", class: "verse-vibe-display-bg-purple", group: "background" },
        { value: 36, label: "黄色底", class: "verse-vibe-display-bg-yellow", group: "background" },
        { value: 37, label: "红色底", class: "verse-vibe-display-bg-red", group: "background" },
        { value: 38, label: "蓝色底", class: "verse-vibe-display-bg-blue", group: "background" },
        { value: 39, label: "绿色底", class: "verse-vibe-display-bg-green", group: "background" },
        { value: 40, label: "褐色底", class: "verse-vibe-display-bg-brown", group: "background" },

        // 特殊效果
        { value: "special", label: "特殊效果", disabled: true },
        { value: 34, label: "炫光分割线", class: "verse-vibe-display-glow-divider", group: "special" },
        { value: 48, label: "炫光分割线·灰黑", class: "verse-vibe-display-glow-divider-dark", group: "special" },
        { value: 49, label: "炫光分割线·橘黄", class: "verse-vibe-display-glow-divider-orange", group: "special" },
        { value: 50, label: "炫光分割线·绿", class: "verse-vibe-display-glow-divider-green", group: "special" },
        { value: 16, label: "典雅引用", class: "verse-vibe-display-quote", group: "special" },
        { value: 45, label: "典雅引用·黄", class: "verse-vibe-display-quote-yellow", group: "special" },
        { value: 46, label: "典雅引用·红", class: "verse-vibe-display-quote-red", group: "special" },
        { value: 47, label: "典雅引用·紫", class: "verse-vibe-display-quote-purple", group: "special" },
        { value: 17, label: "轻巧边框", class: "verse-vibe-display-border", group: "special" },
        { value: 74, label: "轻巧边框·浅蓝", class: "verse-vibe-display-border-lightblue", group: "special" },
        { value: 75, label: "轻巧边框·浅粉", class: "verse-vibe-display-border-lightpink", group: "special" },
        { value: 76, label: "轻巧边框·浅绿", class: "verse-vibe-display-border-lightgreen", group: "special" },
        { value: 77, label: "轻巧边框·浅紫", class: "verse-vibe-display-border-lightpurple", group: "special" },
        { value: 18, label: "阅读焦点", class: "verse-vibe-display-focus", group: "special" },
        { value: 19, label: "简约底线", class: "verse-vibe-display-clean", group: "special" },

        // 专业样式
        { value: "pro", label: "专业样式", disabled: true },
        { value: 20, label: "代码风格", class: "verse-vibe-display-tech", group: "pro" },
        { value: 78, label: "代码风格·黑底", class: "verse-vibe-display-tech-dark", group: "pro" },
        { value: 79, label: "代码风格·火星黄土", class: "verse-vibe-display-tech-mars", group: "pro" },
        { value: 21, label: "书籍风格", class: "verse-vibe-display-elegant", group: "pro" },
        { value: 80, label: "竖版直书（日文/文言）", class: "verse-vibe-display-vertical", group: "pro" },
        { value: 81, label: "竖版宣纸（古籍）", class: "verse-vibe-display-vertical-paper", group: "pro" },

        // 透明度
        { value: "transparent", label: "透明效果", disabled: true },
        { value: 22, label: "半透明弱化", class: "verse-vibe-display-dimmed", group: "transparent" },
        { value: 23, label: "轻透明感", class: "verse-vibe-display-transparent-mode", group: "transparent" },

        // 用户自定义扩展 (New)
        { value: "custom_ext", label: "高级扩展", disabled: true },
        { value: 24, label: "LinkedIn 优化", class: "verse-vibe-display-linkedin-spec", group: "custom_ext" },
        { value: 25, label: "玻璃拟态", class: "verse-vibe-display-glass", group: "custom_ext" },
    ],
    // 悬浮球快捷键选项
    floatingBallHotkeys: [
        { value: "none", label: "禁用快捷键" },
        { value: "Alt+T", label: "Alt+T / Option+T" },
        { value: "Alt+A", label: "Alt+A / Option+A (默认)" },
        { value: "Alt+S", label: "Alt+S / Option+S" },
        { value: "Alt+D", label: "Alt+D / Option+D" },
        { value: "Alt+Q", label: "Alt+Q / Option+Q" },
        { value: "Ctrl+Shift+T", label: "Ctrl+Shift+T / Control+Shift+T" },
        { value: "Ctrl+Shift+A", label: "Ctrl+Shift+A / Control+Shift+A" },
        { value: "F9", label: "F9" },
        { value: "F10", label: "F10" },
        { value: "F11", label: "F11" },
        { value: "F12", label: "F12" },
        { value: "custom", label: "自定义快捷键（测试版）" },
    ].filter((item) => {
        if (!isMacPlatform) return true;
        return !/^Alt\+[A-Z]$/i.test(item.value);
    }),
    theme: [
        { value: "auto", label: "跟随操作系统" },
        { value: "light", label: "亮色主题" },
        { value: "dark", label: "暗色主题" },
    ],
    // 最小中文字号选项
    minFontSizes: [
        { value: 12, label: "12px" },
        { value: 13, label: "13px" },
        { value: 14, label: "14px (默认)" },
        { value: 15, label: "15px" },
        { value: 16, label: "16px" },
        { value: 17, label: "17px" },
        { value: 18, label: "18px" },
        { value: 19, label: "19px" },
        { value: 20, label: "20px" },
    ],
    // 输入框翻译目标语言选项
    inputBoxTranslationTarget: [
        { value: "zh-Hans", label: "中文" },
        { value: "en", label: "英语" },
        { value: "ja", label: "日语" },
        { value: "ko", label: "韩语" },
        { value: "fr", label: "法语" },
        { value: "ru", label: "俄语" },
        { value: "es", label: "西班牙语" },
        { value: "de", label: "德语" },
        { value: "pt", label: "葡萄牙语" },
        { value: "it", label: "意大利语" },
    ],
    // 输入框翻译触发方式选项
    inputBoxTranslationTrigger: [
        { value: "disabled", label: "关闭" },
        { value: "triple_space", label: "连按三下空格" },
        { value: "triple_equal", label: "连按三下等号(=)" },
        { value: "triple_dash", label: "连按三下短横线(-)" },
    ],
    // Reddit 正文贴列最小字号选项
    redditMinFontSizes: [
        { value: 14, label: "14px" },
        { value: 15, label: "15px" },
        { value: 16, label: "16px (默认)" },
        { value: 17, label: "17px" },
        { value: 18, label: "18px" },
        { value: 19, label: "19px" },
        { value: 20, label: "20px" },
        { value: 22, label: "22px" },
        { value: 24, label: "24px" },
    ],
    // LinkedIn 宽幅尺寸档位
    linkedinWideScale: [
        { value: "normal", label: "原始宽" },
        { value: "1.5x", label: "1.5倍宽" },
        { value: "2x", label: "2倍宽" },
        { value: "3x", label: "3倍宽" },
        { value: "full", label: "全宽" },
    ],
};

// 翻译风格预设：一键写入当前服务的 system_role（仅 AI 类服务可用）
// value 为空字符串表示“自定义”占位项，不会覆盖现有 system_role。
export const promptPresets: { value: string; label: string; system_role: string }[] = [
    {
        value: "default",
        label: "专业直译（默认）",
        system_role:
            "You are a professional translation engine. Strictly preserve all HTML tags and attributes. ONLY translate text content. DO NOT add any explanations, notes, or meta-comments.",
    },
    {
        value: "fluent",
        label: "白话流畅",
        system_role:
            "You are a professional translation engine. Translate into natural, fluent, idiomatic language as a native speaker would write it, prioritizing readability over literal word-for-word rendering. Strictly preserve all HTML tags and attributes. ONLY translate text content. DO NOT add any explanations, notes, or meta-comments.",
    },
    {
        value: "classical",
        label: "典雅文言",
        system_role:
            "You are a master translator of Classical Chinese (文言文). When the target language is Chinese, render the translation in elegant, concise Classical Chinese prose (文言文) with literary refinement, while keeping the original meaning faithful. For other target languages, use an elevated, literary register. Strictly preserve all HTML tags and attributes. ONLY translate text content. DO NOT add any explanations, notes, or meta-comments.",
    },
    {
        value: "academic",
        label: "学术严谨",
        system_role:
            "You are an academic translation engine. Translate with rigorous accuracy and formal, scholarly tone. Keep technical terms precise and consistent; preserve domain-specific terminology. Strictly preserve all HTML tags and attributes. ONLY translate text content. DO NOT add any explanations, notes, or meta-comments.",
    },
    {
        value: "colloquial",
        label: "口语自然",
        system_role:
            "You are a translation engine specialized in casual, spoken-style language. Translate into relaxed, conversational, everyday speech as people actually talk, using natural contractions and colloquialisms where appropriate. Strictly preserve all HTML tags and attributes. ONLY translate text content. DO NOT add any explanations, notes, or meta-comments.",
    },
    {
        value: "literary",
        label: "文学优美",
        system_role:
            "You are a literary translation engine. Translate with attention to rhythm, imagery, and aesthetic flow, producing graceful and expressive prose while staying faithful to the original meaning. Strictly preserve all HTML tags and attributes. ONLY translate text content. DO NOT add any explanations, notes, or meta-comments.",
    },
];

export const defaultOption = {
    on: true,
    from: "auto",
    to: "zh-Hans",
    style: 5,
    display: 1,
    hotkey: "Control",
    service: services.microsoft,
    custom: "http://127.0.0.1:1234",
    deeplx: "http://localhost:1188/translate",
    system_role:
        "You are a professional translation engine. Strictly preserve all HTML tags and attributes. ONLY translate text content. DO NOT add any explanations, notes, or meta-comments.",
    user_role: `Translate the content between the markers into {{to}}:
### CONTENT START ###
{{origin}}
### CONTENT END ###
- Strictly data-only output. 
- NO explanations, tags, or prompt text in result.
- If translation is unnecessary, return original between the markers.`,
    count: 0,
    useCache: true,
    floatingBallHotkey: "Alt+A", // 默认悬浮球快捷键
    inputBoxTranslationTrigger: "disabled", // 默认关闭输入框翻译
    inputBoxTranslationTarget: "en", // 默认翻译成英文
    minFontSize: 14, // 默认最小字号
    forceChineseHeiFont: true, // 默认中文强制黑体
    flickrDownloadMenu: true, // 默认启用 Flickr 大图下载菜单
    linkedinWideUi: true, // 默认启用 LinkedIn 宽幅 UI
    linkedinWideScale: "1.5x", // 默认 LinkedIn 1.5倍宽
    linkedinAutoHidePromotedMedia: false, // 默认关闭：LinkedIn 对 Promoted 标签做了混淆/本地化，文本识别不可靠，无法稳定隐藏
    githubReadmeLeft: true, // 默认启用：GitHub 仓库首页 README 横排到文件列表左侧（左栏由 2 行变 2 列）
    redditMainOptimize: true, // 默认启用：Reddit 评论页左侧正文贴列阅读优化（放大正文字号）
    redditMinFontSize: 16, // Reddit 正文贴列最小字号（小于此值的正文文本会被放大到此值）
};
