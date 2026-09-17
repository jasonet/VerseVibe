import { t } from './i18n';

/** 「X（默认）」标签：复用 opt.defaultSuffix，避免每种语言各写一份括号与空格。 */
const withDefault = (text: string): string => t('opt.defaultSuffix', { value: text });

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

// 既是「自定义模型」的显示文案，也是跨模块比对用的持久化哨兵值（template.ts / cache.ts /
// newApi.ts 等多处用 === 比较），因此值本身不能随语言变化，只在渲染时用 modelLabel() 映射。
export const customModelString = "自定义模型";

/** 模型名 → 显示名。仅 customModelString 需要翻译，其余模型名是服务商的真实标识。 */
export function modelLabel(model: string): string {
    return model === customModelString ? t('model.custom') : model;
}

export const models = new Map<string, Array<string>>([
    [services.openai, ["gpt-5-nano", "gpt-5-mini", "gpt5", "gpt-5-chat-latest", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o-mini", "gpt-4o", "o3", "o3-mini", customModelString]],
    [services.azureOpenai, ["gpt-5-nano", "gpt-5-mini", "gpt5", "gpt-5-chat-latest", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o-mini", "gpt-4o", "o3", "o3-mini", customModelString]],
    [services.gemini, ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro", customModelString]],
    [services.tongyi, ["qwen-long", "qwen-turbo", "qwen-plus", "qwen3-8b", "qwen-mt-plus", "qwen-mt-turbo", customModelString]],
    [services.zhipu, ["glm-4.5", "GLM-4-Flash", "glm-4-plus", "glm-4", "glm-4v", customModelString]],
    [services.moonshot, ["kimi-k2-0711-preview", "kimi-k2-turbo-preview", "moonshot-v1-auto", "moonshot-v1-8k", "moonshot-v1-32k", customModelString]],
    [services.claude, ["claude-sonnet-4-0", "claude-opus-4-1", "claude-3-5-haiku-latest"]],
    // 自定义接口（本地优先）：仅列翻译优化型模型，默认 translategemma-4b-it_immersive-translate。
    // TranslateGemma（Google，2026）为翻译专用，含 4B/12B/27B 及 immersive-translate 微调版；
    // 另列入主流开源翻译专用模型（腾讯混元MT、字节 Seed-X、Unbabel Tower）。
    [services.custom, [
        "translategemma-4b-it_immersive-translate",
        "translategemma-4b-it",
        "translategemma-12b-it",
        "translategemma-27b-it",
        "hunyuan-mt-7b",
        "seed-x-ppo-7b",
        "towerinstruct-7b-v0.2",
        customModelString,
    ]],
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

// 所有 label 均写成 getter：读取时求值 t()，语言切换会自动反映到模板，
// 而 value / 对象形状保持不变，调用方无需改动。
export const options = {
    on: [
        { value: true, get label() { return t('common.on'); } },
        { value: false, get label() { return t('common.off'); } },
    ],
    // 是否即时翻译
    autoTranslate: [
        { value: true, get label() { return t('common.on'); } },
        { value: false, get label() { return t('common.off'); } },
    ],
    // 是否使用缓存
    useCache: [
        { value: true, get label() { return t('common.on'); } },
        { value: false, get label() { return t('common.off'); } },
    ],
    form: [{ value: "auto", get label() { return t('opt.autoDetect'); } }],
    to: [
        { value: "zh-Hans", get label() { return t('langName.zh-Hans'); } },
        { value: "zh-Hant", get label() { return t('langName.zh-Hant'); } },
        { value: "en", get label() { return t('langName.en'); } },
        { value: "ja", get label() { return t('langName.ja'); } },
        { value: "ko", get label() { return t('langName.ko'); } },
        { value: "fr", get label() { return t('langName.fr'); } },
        { value: "ru", get label() { return t('langName.ru'); } },
        { value: "es", get label() { return t('langName.es'); } },
        { value: "de", get label() { return t('langName.de'); } },
        { value: "pt", get label() { return t('langName.pt'); } },
        { value: "it", get label() { return t('langName.it'); } },
    ],
    // 界面语言：四种选项一律用各自的母语书写（Apple/Google 惯例），auto 走 i18n
    languages: [
        { value: "auto", get label() { return t('locale.auto'); } },
        { value: "zh-Hans", label: "简体中文" },
        { value: "zh-Hant", label: "繁體中文" },
        { value: "en", label: "English" },
        { value: "ja", label: "日本語" },
    ],
    keys: [
        { value: "none", get label() { return t('key.none'); } },

        { value: "Computer", get label() { return t('key.groupKeyboard'); }, disabled: true },
        { value: "Control", label: "Ctrl" },
        { value: "Alt", label: "Alt" },
        { value: "Shift", label: "Shift" },
        { value: "Escape", label: "ESC" },
        { value: "`", get label() { return t('key.tilde'); } },

        { value: "mouse", get label() { return t('key.groupMouse'); }, disabled: true },
        { value: "DoubleClick", get label() { return t('key.doubleClick'); } },
        { value: "LongPress", get label() { return t('key.longPress'); } },
        { value: "MiddleClick", get label() { return t('key.middleClick'); } },

        { value: "touchscreen", get label() { return t('key.groupTouch'); }, disabled: true },
        { value: "TwoFinger", get label() { return t('key.twoFinger'); } },
        { value: "ThreeFinger", get label() { return t('key.threeFinger'); } },
        { value: "FourFinger", get label() { return t('key.fourFinger'); } },
        { value: "DoubleClickScree", get label() { return t('key.doubleTap'); } },
        { value: "TripleClickScree", get label() { return t('key.tripleTap'); } },

        { value: "custom", get label() { return t('key.custom'); } },
    ],
    services: [
        // 免费在线API翻译（浏览器默认）
        { value: "machine", get label() { return t('svc.group.machine'); }, disabled: true },
        { value: services.microsoft, get label() { return t('svc.microsoft'); }, icon: MICROSOFT_ICON },
        { value: services.google, get label() { return t('svc.google'); }, icon: GOOGLE_ICON },
        { value: services.deepL, label: "DeepL" },
        // 隐藏 DeepLX（以后可恢复，勿删）
        // { value: services.deeplx, get label() { return t('svc.deeplx'); } },
        { value: services.xiaoniu, get label() { return t('svc.xiaoniu'); } },
        { value: services.youdao, get label() { return t('svc.youdao'); } },
        { value: services.tencent, get label() { return t('svc.tencent'); } },
        // AI 私密翻译（本地运行，数据不出本机）
        { value: "ai", get label() { return t('svc.group.ai'); }, disabled: true },
        { value: services.custom, get label() { return t('svc.custom'); } },
        { value: services.chromeTranslator, get label() { return t('svc.chromeTranslator'); } },
        // AI 远程翻译（需自备 Key）
        { value: "ai_remote", get label() { return t('svc.group.aiRemote'); }, disabled: true },
        { value: services.deepseek, get label() { return t('svc.deepseek'); } },
        { value: services.siliconCloud, get label() { return t('svc.siliconCloud'); } },
        { value: services.huanYuan, get label() { return t('svc.huanYuan'); } },
        { value: services.newapi, get label() { return t('svc.newapi'); } },
        { value: services.openai, label: "OpenAI" },
        { value: services.azureOpenai, label: "Azure OpenAI" },
        { value: services.huanYuanTranslation, get label() { return t('svc.huanYuanTranslation'); } },
        { value: services.tongyi, get label() { return t('svc.tongyi'); } },
        { value: services.doubao, get label() { return t('svc.doubao'); } },
        { value: services.claude, label: "Claude" },
        { value: services.gemini, label: "Gemini" },
        { value: services.moonshot, get label() { return t('svc.moonshot'); } },
        { value: services.zhipu, get label() { return t('svc.zhipu'); } },
        // 更多 / 小众模型（均可改用「自定义接口 / New API / OpenRouter」接入）
        { value: "ai_more", get label() { return t('svc.group.more'); }, disabled: true },
        { value: services.openrouter, label: "OpenRouter" },
        { value: services.grok, get label() { return t('svc.grok'); } },
        { value: services.groq, label: "Groq" },
        { value: services.baichuan, get label() { return t('svc.baichuan'); } },
        // 隐藏 零一万物 / 阶跃星辰 / 无向芯穹（以后可恢复，勿删）
        // { value: services.lingyi, get label() { return t('svc.lingyi'); } },
        { value: services.minimax, label: "MiniMax" },
        // { value: services.jieyue, get label() { return t('svc.jieyue'); } },
        // { value: services.infini, get label() { return t('svc.infini'); } },
    ],
    display: [
        { value: 0, get label() { return t('opt.displaySingle'); } },
        { value: 1, get label() { return t('opt.displayBilingual'); } },
    ],
    // 双语翻译样式
    styles: [
        // 下划线系列
        { value: "underline", get label() { return t('style.group.underline'); }, disabled: true },
        { value: 33, get label() { return t('style.33'); }, class: "verse-vibe-display-glow-underline", group: "underline" },
        { value: 41, get label() { return t('style.41'); }, class: "verse-vibe-display-glow-underline-yellow", group: "underline" },
        { value: 42, get label() { return t('style.42'); }, class: "verse-vibe-display-glow-underline-red", group: "underline" },
        { value: 43, get label() { return t('style.43'); }, class: "verse-vibe-display-glow-underline-green", group: "underline" },
        { value: 44, get label() { return t('style.44'); }, class: "verse-vibe-display-glow-underline-brown", group: "underline" },
        { value: 5, get label() { return t('style.5'); }, class: "verse-vibe-display-dot-underline", group: "underline" },
        { value: 51, get label() { return t('style.51'); }, class: "verse-vibe-display-dot-underline-red", group: "underline" },
        { value: 52, get label() { return t('style.52'); }, class: "verse-vibe-display-dot-underline-yellow", group: "underline" },
        { value: 53, get label() { return t('style.53'); }, class: "verse-vibe-display-dot-underline-green", group: "underline" },
        { value: 54, get label() { return t('style.54'); }, class: "verse-vibe-display-dot-underline-purple", group: "underline" },
        { value: 4, get label() { return t('style.4'); }, class: "verse-vibe-display-solid-underline", group: "underline" },
        { value: 55, get label() { return t('style.55'); }, class: "verse-vibe-display-solid-underline-red", group: "underline" },
        { value: 56, get label() { return t('style.56'); }, class: "verse-vibe-display-solid-underline-orange", group: "underline" },
        { value: 57, get label() { return t('style.57'); }, class: "verse-vibe-display-solid-underline-lightblue", group: "underline" },
        { value: 58, get label() { return t('style.58'); }, class: "verse-vibe-display-double-underline-lightblue", group: "underline" },
        { value: 59, get label() { return t('style.59'); }, class: "verse-vibe-display-double-underline-orange", group: "underline" },
        { value: 60, get label() { return t('style.60'); }, class: "verse-vibe-display-double-underline-lightred", group: "underline" },
        { value: 6, get label() { return t('style.6'); }, class: "verse-vibe-display-wavy", group: "underline" },
        { value: 61, get label() { return t('style.61'); }, class: "verse-vibe-display-wavy-lively-red", group: "underline" },
        { value: 26, get label() { return t('style.26'); }, class: "verse-vibe-display-wavy-red", group: "underline" },
        { value: 27, get label() { return t('style.27'); }, class: "verse-vibe-display-wavy-yellow", group: "underline" },
        { value: 28, get label() { return t('style.28'); }, class: "verse-vibe-display-wavy-green", group: "underline" },
        { value: 29, get label() { return t('style.29'); }, class: "verse-vibe-display-wavy-blue", group: "underline" },
        { value: 30, get label() { return t('style.30'); }, class: "verse-vibe-display-wavy-black", group: "underline" },
        { value: 31, get label() { return t('style.31'); }, class: "verse-vibe-display-wavy-purple", group: "underline" },
        { value: 32, get label() { return t('style.32'); }, class: "verse-vibe-display-wavy-orange", group: "underline" },

        // 卡片系列
        { value: "card", get label() { return t('style.group.card'); }, disabled: true },
        { value: 7, get label() { return t('style.7'); }, class: "verse-vibe-display-card-mode", group: "card" },
        { value: 8, get label() { return t('style.8'); }, class: "verse-vibe-display-modern-card", group: "card" },
        { value: 9, get label() { return t('style.9'); }, class: "verse-vibe-display-paper", group: "card" },

        // 高亮系列
        { value: "highlight", get label() { return t('style.group.highlight'); }, disabled: true },
        { value: 10, get label() { return t('style.10'); }, class: "verse-vibe-display-learning-mode", group: "highlight" },
        { value: 62, get label() { return t('style.62'); }, class: "verse-vibe-display-learning-mode-lightblue", group: "highlight" },
        { value: 63, get label() { return t('style.63'); }, class: "verse-vibe-display-learning-mode-lightpink", group: "highlight" },
        { value: 64, get label() { return t('style.64'); }, class: "verse-vibe-display-learning-mode-lightgreen", group: "highlight" },
        { value: 65, get label() { return t('style.65'); }, class: "verse-vibe-display-learning-mode-lightpurple", group: "highlight" },
        { value: 11, get label() { return t('style.11'); }, class: "verse-vibe-display-marker", group: "highlight" },
        { value: 66, get label() { return t('style.66'); }, class: "verse-vibe-display-marker-lightblue", group: "highlight" },
        { value: 67, get label() { return t('style.67'); }, class: "verse-vibe-display-marker-lightpink", group: "highlight" },
        { value: 68, get label() { return t('style.68'); }, class: "verse-vibe-display-marker-lightgreen", group: "highlight" },
        { value: 69, get label() { return t('style.69'); }, class: "verse-vibe-display-marker-lightpurple", group: "highlight" },
        { value: 12, get label() { return t('style.12'); }, class: "verse-vibe-display-highlight-fade", group: "highlight" },
        { value: 70, get label() { return t('style.70'); }, class: "verse-vibe-display-highlight-fade-lightblue", group: "highlight" },
        { value: 71, get label() { return t('style.71'); }, class: "verse-vibe-display-highlight-fade-lightpink", group: "highlight" },
        { value: 72, get label() { return t('style.72'); }, class: "verse-vibe-display-highlight-fade-lightgreen", group: "highlight" },
        { value: 73, get label() { return t('style.73'); }, class: "verse-vibe-display-highlight-fade-lightpurple", group: "highlight" },

        // 背景色系列
        { value: "background", get label() { return t('style.group.background'); }, disabled: true },
        { value: 13, get label() { return t('style.13'); }, class: "verse-vibe-display-lightyellow", group: "background" },
        { value: 14, get label() { return t('style.14'); }, class: "verse-vibe-display-lightblue", group: "background" },
        { value: 15, get label() { return t('style.15'); }, class: "verse-vibe-display-lightgray", group: "background" },
        { value: 35, get label() { return t('style.35'); }, class: "verse-vibe-display-bg-purple", group: "background" },
        { value: 36, get label() { return t('style.36'); }, class: "verse-vibe-display-bg-yellow", group: "background" },
        { value: 37, get label() { return t('style.37'); }, class: "verse-vibe-display-bg-red", group: "background" },
        { value: 38, get label() { return t('style.38'); }, class: "verse-vibe-display-bg-blue", group: "background" },
        { value: 39, get label() { return t('style.39'); }, class: "verse-vibe-display-bg-green", group: "background" },
        { value: 40, get label() { return t('style.40'); }, class: "verse-vibe-display-bg-brown", group: "background" },

        // 特殊效果
        { value: "special", get label() { return t('style.group.special'); }, disabled: true },
        { value: 34, get label() { return t('style.34'); }, class: "verse-vibe-display-glow-divider", group: "special" },
        { value: 48, get label() { return t('style.48'); }, class: "verse-vibe-display-glow-divider-dark", group: "special" },
        { value: 49, get label() { return t('style.49'); }, class: "verse-vibe-display-glow-divider-orange", group: "special" },
        { value: 50, get label() { return t('style.50'); }, class: "verse-vibe-display-glow-divider-green", group: "special" },
        { value: 16, get label() { return t('style.16'); }, class: "verse-vibe-display-quote", group: "special" },
        { value: 45, get label() { return t('style.45'); }, class: "verse-vibe-display-quote-yellow", group: "special" },
        { value: 46, get label() { return t('style.46'); }, class: "verse-vibe-display-quote-red", group: "special" },
        { value: 47, get label() { return t('style.47'); }, class: "verse-vibe-display-quote-purple", group: "special" },
        { value: 17, get label() { return t('style.17'); }, class: "verse-vibe-display-border", group: "special" },
        { value: 74, get label() { return t('style.74'); }, class: "verse-vibe-display-border-lightblue", group: "special" },
        { value: 75, get label() { return t('style.75'); }, class: "verse-vibe-display-border-lightpink", group: "special" },
        { value: 76, get label() { return t('style.76'); }, class: "verse-vibe-display-border-lightgreen", group: "special" },
        { value: 77, get label() { return t('style.77'); }, class: "verse-vibe-display-border-lightpurple", group: "special" },
        { value: 18, get label() { return t('style.18'); }, class: "verse-vibe-display-focus", group: "special" },
        { value: 19, get label() { return t('style.19'); }, class: "verse-vibe-display-clean", group: "special" },

        // 专业样式
        { value: "pro", get label() { return t('style.group.pro'); }, disabled: true },
        { value: 20, get label() { return t('style.20'); }, class: "verse-vibe-display-tech", group: "pro" },
        { value: 78, get label() { return t('style.78'); }, class: "verse-vibe-display-tech-dark", group: "pro" },
        { value: 79, get label() { return t('style.79'); }, class: "verse-vibe-display-tech-mars", group: "pro" },
        { value: 21, get label() { return t('style.21'); }, class: "verse-vibe-display-elegant", group: "pro" },
        { value: 80, get label() { return t('style.80'); }, class: "verse-vibe-display-vertical", group: "pro" },
        { value: 81, get label() { return t('style.81'); }, class: "verse-vibe-display-vertical-paper", group: "pro" },

        // 透明度
        { value: "transparent", get label() { return t('style.group.transparent'); }, disabled: true },
        { value: 22, get label() { return t('style.22'); }, class: "verse-vibe-display-dimmed", group: "transparent" },
        { value: 23, get label() { return t('style.23'); }, class: "verse-vibe-display-transparent-mode", group: "transparent" },

        // 用户自定义扩展 (New)
        { value: "custom_ext", get label() { return t('style.group.custom_ext'); }, disabled: true },
        { value: 24, get label() { return t('style.24'); }, class: "verse-vibe-display-linkedin-spec", group: "custom_ext" },
        { value: 25, get label() { return t('style.25'); }, class: "verse-vibe-display-glass", group: "custom_ext" },
    ],
    // 悬浮球快捷键选项
    floatingBallHotkeys: [
        { value: "none", get label() { return t('key.none'); } },
        { value: "Alt+T", label: "Alt+T / Option+T" },
        { value: "Alt+A", get label() { return withDefault("Alt+A / Option+A"); } },
        { value: "Alt+S", label: "Alt+S / Option+S" },
        { value: "Alt+D", label: "Alt+D / Option+D" },
        { value: "Alt+Q", label: "Alt+Q / Option+Q" },
        { value: "Ctrl+Shift+T", label: "Ctrl+Shift+T / Control+Shift+T" },
        { value: "Ctrl+Shift+A", label: "Ctrl+Shift+A / Control+Shift+A" },
        { value: "F9", label: "F9" },
        { value: "F10", label: "F10" },
        { value: "F11", label: "F11" },
        { value: "F12", label: "F12" },
        { value: "custom", get label() { return t('key.custom'); } },
    ].filter((item) => {
        if (!isMacPlatform) return true;
        return !/^Alt\+[A-Z]$/i.test(item.value);
    }),
    theme: [
        { value: "auto", get label() { return t('opt.themeAuto'); } },
        { value: "light", get label() { return t('opt.themeLight'); } },
        { value: "dark", get label() { return t('opt.themeDark'); } },
    ],
    // 最小中文字号选项
    minFontSizes: [
        { value: 12, label: "12px" },
        { value: 13, label: "13px" },
        { value: 14, get label() { return withDefault("14px"); } },
        { value: 15, label: "15px" },
        { value: 16, label: "16px" },
        { value: 17, label: "17px" },
        { value: 18, label: "18px" },
        { value: 19, label: "19px" },
        { value: 20, label: "20px" },
    ],
    // 输入框翻译目标语言选项
    inputBoxTranslationTarget: [
        { value: "zh-Hans", get label() { return t('langName.zh-Hans'); } },
        { value: "en", get label() { return t('langName.en'); } },
        { value: "ja", get label() { return t('langName.ja'); } },
        { value: "ko", get label() { return t('langName.ko'); } },
        { value: "fr", get label() { return t('langName.fr'); } },
        { value: "ru", get label() { return t('langName.ru'); } },
        { value: "es", get label() { return t('langName.es'); } },
        { value: "de", get label() { return t('langName.de'); } },
        { value: "pt", get label() { return t('langName.pt'); } },
        { value: "it", get label() { return t('langName.it'); } },
    ],
    // 输入框翻译触发方式选项
    inputBoxTranslationTrigger: [
        { value: "disabled", get label() { return t('opt.triggerDisabled'); } },
        { value: "triple_space", get label() { return t('opt.triggerTripleSpace'); } },
        { value: "triple_equal", get label() { return t('opt.triggerTripleEqual'); } },
        { value: "triple_dash", get label() { return t('opt.triggerTripleDash'); } },
    ],
    // Reddit 正文贴列最小字号选项
    redditMinFontSizes: [
        { value: 14, label: "14px" },
        { value: 15, label: "15px" },
        { value: 16, get label() { return withDefault("16px"); } },
        { value: 17, label: "17px" },
        { value: 18, label: "18px" },
        { value: 19, label: "19px" },
        { value: 20, label: "20px" },
        { value: 22, label: "22px" },
        { value: 24, label: "24px" },
    ],
    // LinkedIn 宽幅尺寸档位
    linkedinWideScale: [
        { value: "normal", get label() { return t('opt.scaleNormal'); } },
        { value: "1.5x", get label() { return t('opt.scale15x'); } },
        { value: "2x", get label() { return t('opt.scale2x'); } },
        { value: "3x", get label() { return t('opt.scale3x'); } },
        { value: "full", get label() { return t('opt.scaleFull'); } },
    ],
    // Reddit 正文/Feed 宽度档位
    redditWideScale: [
        { value: "1x", get label() { return t('opt.scaleNormal'); } },
        { value: "1.5x", get label() { return withDefault(t('opt.scale15x')); } },
        { value: "2x", get label() { return t('opt.scale2x'); } },
        { value: "2.5x", get label() { return t('opt.scale25x'); } },
    ],
    // X.com（Twitter）时间线宽度档位
    xWideScale: [
        { value: "1x", get label() { return t('opt.scaleNormal'); } },
        { value: "1.5x", get label() { return t('opt.scale15x'); } },
        { value: "2x", get label() { return withDefault(t('opt.scale2x')); } },
        { value: "2.5x", get label() { return t('opt.scale25x'); } },
    ],
};

// 翻译风格预设：一键写入当前服务的 system_role（仅 AI 类服务可用）
// value 为空字符串表示“自定义”占位项，不会覆盖现有 system_role。
// label 走 i18n；system_role 是发给大模型的提示词，保持英文不翻译。
export const promptPresets: { value: string; label: string; system_role: string }[] = [
    {
        value: "default",
        get label() { return t('preset.default'); },
        system_role:
            "You are a professional translation engine. Strictly preserve all HTML tags and attributes. ONLY translate text content. DO NOT add any explanations, notes, or meta-comments.",
    },
    {
        value: "fluent",
        get label() { return t("preset.fluent"); },
        system_role:
            "You are a professional translation engine. Translate into natural, fluent, idiomatic language as a native speaker would write it, prioritizing readability over literal word-for-word rendering. Strictly preserve all HTML tags and attributes. ONLY translate text content. DO NOT add any explanations, notes, or meta-comments.",
    },
    {
        value: "classical",
        get label() { return t("preset.classical"); },
        system_role:
            "You are a master translator of Classical Chinese (文言文). When the target language is Chinese, render the translation in elegant, concise Classical Chinese prose (文言文) with literary refinement, while keeping the original meaning faithful. For other target languages, use an elevated, literary register. Strictly preserve all HTML tags and attributes. ONLY translate text content. DO NOT add any explanations, notes, or meta-comments.",
    },
    {
        value: "academic",
        get label() { return t("preset.academic"); },
        system_role:
            "You are an academic translation engine. Translate with rigorous accuracy and formal, scholarly tone. Keep technical terms precise and consistent; preserve domain-specific terminology. Strictly preserve all HTML tags and attributes. ONLY translate text content. DO NOT add any explanations, notes, or meta-comments.",
    },
    {
        value: "colloquial",
        get label() { return t("preset.colloquial"); },
        system_role:
            "You are a translation engine specialized in casual, spoken-style language. Translate into relaxed, conversational, everyday speech as people actually talk, using natural contractions and colloquialisms where appropriate. Strictly preserve all HTML tags and attributes. ONLY translate text content. DO NOT add any explanations, notes, or meta-comments.",
    },
    {
        value: "literary",
        get label() { return t("preset.literary"); },
        system_role:
            "You are a literary translation engine. Translate with attention to rhythm, imagery, and aesthetic flow, producing graceful and expressive prose while staying faithful to the original meaning. Strictly preserve all HTML tags and attributes. ONLY translate text content. DO NOT add any explanations, notes, or meta-comments.",
    },
];

export const defaultOption = {
    // 界面语言：'auto' 跟随浏览器，或 'zh-Hans' | 'zh-Hant' | 'en' | 'ja'
    lang: "auto",
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
    redditFeedWide: true, // 默认勾选：Reddit 主阅读列加宽，窄窗口自动适配
    redditWideScale: "1.5x", // 默认 1.5 倍宽 (150%)
    redditMinFontSize: 16, // Reddit 正文贴列最小字号（小于此值的正文文本会被放大到此值）
    xWide: true, // 默认勾选：X.com（Twitter）主时间线列加宽，窄窗口自动适配
    xWideScale: "2x", // 默认 2 倍宽 (200%)
};
