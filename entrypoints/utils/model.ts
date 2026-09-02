import { defaultOption, services } from "./option";

/**
 * 根据当前浏览器返回首装时的默认翻译服务：
 *  - Edge → 微软翻译
 *  - 其他（Chrome / Brave / Chromium 等） → Google 翻译
 * 仅在用户尚未保存过 config 时生效；用户主动切换后，
 * 选择会被持久化到 storage（local:config），下次按用户的选择加载。
 */
function detectDefaultTranslationService(): string {
    try {
        if (typeof navigator === 'undefined') return services.google;
        // userAgentData 优先（更可靠，未来 UA string 可能被冻结）
        const uaData = (navigator as any).userAgentData;
        if (uaData?.brands?.length) {
            const isEdge = uaData.brands.some((b: { brand: string }) =>
                /Microsoft Edge/i.test(b.brand)
            );
            if (isEdge) return services.microsoft;
        }
        // 回退到 UA string：Edge 的 UA 同时含 "Chrome/" 与 "Edg/"
        const ua = navigator.userAgent || '';
        if (/Edg\//.test(ua) || /Edge\//.test(ua) || /EdgA\//.test(ua)) {
            return services.microsoft;
        }
        return services.google;
    } catch {
        return services.google;
    }
}

interface IMapping {
    [key: string]: string;
}

// 内包，存储额外信息
interface IExtra {
    [key: string]: any
}

export class Config {
    on: boolean; // 是否开启
    autoTranslate: boolean; // 是否即时翻译
    from: string;
    to: string;
    hotkey: string;
    style: number | string;
    display: number = 1;
    service: string;
    token: IMapping;
    ak: string;
    sk: string;
    appid: string;
    key: string;
    model: IMapping;
    customModel: IMapping;  // 自定义模型名称
    proxy: IMapping;  // 代理地址
    custom: string; // 本地服务地址
    extra: IExtra;  // 额外信息（内包信息）
    robot_id: IMapping;  // 机器人 ID（兼容 coze）
    system_role: IMapping;
    user_role: IMapping;
    count: number;  // 翻译总词条数（向后兼容：= 三模块之和）
    countMachine: number; // 机器在线API翻译 词条数
    countAI: number;      // AI翻译 词条数
    countChrome: number;  // Chrome 本地翻译 词条数
    theme: string;  // 主题模式：'auto' | 'light' | 'dark'
    useCache: boolean; // 是否使用缓存
    disableFloatingBall: boolean; // 是否禁用悬浮球
    floatingBallPosition: 'left' | 'right'; // 悬浮球位置
    floatingBallHotkey: string; // 悬浮球快捷键
    customFloatingBallHotkey: string; // 自定义悬浮球快捷键
    customHotkey: string; // 自定义鼠标悬浮快捷键
    disableSelectionTranslator: boolean; // 是否禁用划词翻译
    deeplx: string; // DeepLX 服务地址
    selectionTranslatorMode: string; // 划词翻译显示模式: 'disabled' | 'bilingual' | 'translation-only'
    newApiUrl: string; // NewAPI地址
    maxConcurrentTranslations: number; // 最大并发翻译数量
    youdaoAppKey: string; // 有道翻译 App Key
    youdaoAppSecret: string; // 有道翻译 App Secret
    tencentSecretId: string; // 腾讯云 Secret ID
    tencentSecretKey: string; // 腾讯云 Secret Key
    azureOpenaiEndpoint: string; // Azure OpenAI 端点地址
    animations: boolean; // 是否启用动画效果
    translationStatus: boolean; // 是否启用全文翻译进度面板
    inputBoxTranslationTrigger: string; // 输入框翻译触发方式
    inputBoxTranslationTarget: string; // 输入框翻译目标语言
    minFontSize: number; // 最小中文字号
    forceChineseHeiFont: boolean; // 中文字体强制黑体
    flickrDownloadMenu: boolean; // Flickr 大图下载菜单
    linkedinWideUi: boolean; // LinkedIn 宽幅 UI
    linkedinWideScale: string; // LinkedIn 宽幅尺寸档位: normal | 1.5x | 2x | 3x | full
    linkedinAutoHidePromotedMedia: boolean; // LinkedIn feed 自动隐藏推广帖媒体
    githubReadmeLeft: boolean; // GitHub 仓库首页 README 横排到文件列表左侧
    redditMainOptimize: boolean; // Reddit 评论页左侧正文贴列阅读优化
    redditMinFontSize: number; // Reddit 正文贴列最小字号
    skipTranslateHeader: boolean; // 不翻译页头（默认开启，全文翻译时跳过）
    skipTranslateFooter: boolean; // 不翻译页尾（默认开启，全文翻译时跳过）
    translationFontScale: number; // 译文字号缩放倍数（1 = 原始大小）
    pdfTakeover: boolean; // 打开在线 PDF 时自动进入沉浸式翻译阅读器
    pdfServerUrl: string; // PDF 沉浸式翻译本地服务地址（混合架构：插件发字节给此服务生成双语 PDF）

    constructor() {
        this.on = true;
        this.autoTranslate = false;
        this.from = defaultOption.from;
        this.to = defaultOption.to;
        this.style = defaultOption.style;
        this.display = defaultOption.display;
        this.hotkey = defaultOption.hotkey;
        // 根据浏览器自动选默认翻译服务（Chrome→Google / Edge→Microsoft）；
        // 用户切换后由 storage 中的 local:config 覆盖此默认值。
        this.service = detectDefaultTranslationService();
        // 自定义接口默认走本地 LM Studio（端口 1234），令牌占位为 local，
        // 默认模型直接选中下拉项 translategemma-4b-it_immersive-translate（翻译专用），
        // 自定义模型框留空，无需手填。
        this.token = { [services.custom]: 'local' };
        this.ak = '';
        this.sk = '';
        this.appid = '';
        this.key = '';
        this.model = { [services.custom]: 'translategemma-4b-it_immersive-translate' };
        this.customModel = { [services.custom]: '' };
        this.proxy = {};
        this.custom = defaultOption.custom;
        this.extra = {};
        this.robot_id = {};
        this.system_role = systemRoleFactory();
        this.user_role = userRoleFactory();
        this.count = 0;
        this.countMachine = 0;
        this.countAI = 0;
        this.countChrome = 0;
        this.theme = 'auto';  // 默认跟随系统
        this.useCache = true; // 默认开启缓存
        this.disableFloatingBall = false; // 默认启用悬浮球
        this.floatingBallPosition = 'right'; // 默认在右侧
        this.floatingBallHotkey = 'Alt+A'; // 默认快捷键为 Alt+A
        this.customFloatingBallHotkey = ''; // 自定义快捷键为空
        this.customHotkey = ''; // 自定义鼠标悬浮快捷键为空
        this.disableSelectionTranslator = false; // 默认不禁用划词翻译
        this.deeplx = ''; // DeepLX 默认服务地址
        this.selectionTranslatorMode = 'bilingual'; // 默认双语显示模式
        this.newApiUrl = 'http://localhost:3000'; // NewAPI 默认地址
        this.maxConcurrentTranslations = 6; // 默认最大并发数为6
        this.youdaoAppKey = ''; // 有道翻译 App Key
        this.youdaoAppSecret = ''; // 有道翻译 App Secret
        this.tencentSecretId = ''; // 腾讯云 Secret ID
        this.tencentSecretKey = ''; // 腾讯云 Secret Key
        this.azureOpenaiEndpoint = ''; // Azure OpenAI 端点地址
        this.animations = false; // 默认关闭动画效果
        this.translationStatus = false; // 默认关闭翻译进度面板
        this.inputBoxTranslationTrigger = 'disabled'; // 默认关闭输入框翻译
        this.inputBoxTranslationTarget = 'en'; // 默认翻译成英文
        this.minFontSize = defaultOption.minFontSize; // 默认最小字号
        this.forceChineseHeiFont = defaultOption.forceChineseHeiFont; // 默认中文强制黑体
        this.flickrDownloadMenu = defaultOption.flickrDownloadMenu; // 默认启用 Flickr 大图下载菜单
        this.linkedinWideUi = defaultOption.linkedinWideUi; // 默认启用 LinkedIn 宽幅 UI
        this.linkedinWideScale = defaultOption.linkedinWideScale; // LinkedIn 宽幅尺寸默认 1.5x
        this.linkedinAutoHidePromotedMedia = defaultOption.linkedinAutoHidePromotedMedia; // 默认关闭：推广识别不可靠
        this.githubReadmeLeft = defaultOption.githubReadmeLeft; // 默认启用：GitHub README 左移横排
        this.redditMainOptimize = defaultOption.redditMainOptimize; // 默认启用：Reddit 正文贴列阅读优化
        this.redditMinFontSize = defaultOption.redditMinFontSize; // Reddit 正文贴列最小字号
        this.skipTranslateHeader = true; // 默认不翻译页头
        this.skipTranslateFooter = true; // 默认不翻译页尾
        this.translationFontScale = 1; // 译文字号缩放倍数（1 = 原始大小，可在设置页放大/缩小）
        this.pdfTakeover = true; // 默认开启：打开在线 PDF 自动进入沉浸式翻译阅读器
        this.pdfServerUrl = 'http://127.0.0.1:8765'; // 本地 PDF 翻译服务默认地址（对应 server/server.py）
    }
}

// 构建所有服务的 system_role
function systemRoleFactory(): IMapping {
    let systems_role: IMapping = {};
    Object.keys(services).forEach(key => systems_role[key] = defaultOption.system_role);
    return systems_role;
}

// 构建所有服务的 user_role
function userRoleFactory(): IMapping {
    let users_role: IMapping = {};
    Object.keys(services).forEach(key => users_role[key] = defaultOption.user_role);
    return users_role;
}
