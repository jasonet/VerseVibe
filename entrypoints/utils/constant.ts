import { services } from "./option";

// 常量工具类
export const urls: any = {
    [services.deepL]: "https://api-free.deepl.com/v2/translate",
    [services.deeplx]: "http://localhost:1188/translate",
    [services.openai]: "https://api.openai.com/v1/chat/completions",
    [services.azureOpenai]: "https://your-resource-name.openai.azure.com/openai/deployments/your-deployment-name/chat/completions?api-version=2024-02-15-preview",
    [services.moonshot]: "https://api.moonshot.cn/v1/chat/completions",
    [services.custom]: "https://localhost:11434/v1/chat/completions",
    [services.tongyi]: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    [services.zhipu]: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    [services.xiaoniu]: "https://api.niutrans.com/NiuTransServer/translationXML",
    [services.youdao]: "https://openapi.youdao.com/api",
    [services.tencent]: "https://tmt.tencentcloudapi.com/",
    [services.claude]: "https://api.anthropic.com/v1/messages",
    [services.baichuan]: "https://api.baichuan-ai.com/v1/chat/completions",
    [services.lingyi]: "https://api.lingyiwanwu.com/v1/chat/completions",
    [services.deepseek]: "https://api.deepseek.com/chat/completions",
    [services.jieyue]: "https://api.stepfun.com/v1/chat/completions",
    [services.groq]: "https://api.groq.com/openai/v1/chat/completions",
    [services.huanYuan]: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
    [services.huanYuanTranslation]: "https://hunyuan.tencentcloudapi.com/",
    [services.doubao]: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    [services.siliconCloud]: "https://api.siliconflow.cn/v1/chat/completions",
    [services.openrouter]: "https://openrouter.ai/api/v1/chat/completions",
    [services.grok]: "https://api.x.ai/v1/chat/completions",

    // [services.baidufree]:"https://fanyi.baidu.com/transapi"
    // [services.baidu]: "https://fanyi-api.baidu.com/api/trans/vip/translate",
}

export const method = { POST: "POST", GET: "GET", };

// 规整 OpenAI 兼容接口地址：允许用户只填基础地址（如 http://127.0.0.1:1234），
// 自动补全到 /v1/chat/completions；若已是完整 chat/completions 路径则原样返回。
export function normalizeOpenAiUrl(url: string): string {
    let u = (url || "").trim();
    if (!u) return u;
    u = u.replace(/\/+$/, "");
    if (/\/chat\/completions$/.test(u)) return u;
    if (/\/v1$/.test(u)) return u + "/chat/completions";
    try {
        const parsed = new URL(u);
        if (parsed.pathname === "" || parsed.pathname === "/") {
            return parsed.origin + "/v1/chat/completions";
        }
    } catch { /* 非法 URL，原样返回 */ }
    return u;
}

export const constants = {
    // 键鼠事件
    DoubleClick: "DoubleClick",
    LongPress: "LongPress",
    MiddleClick: "MiddleClick",
    // 触屏设备事件
    TwoFinger: "TwoFinger",
    ThreeFinger: "ThreeFinger",
    FourFinger: "FourFinger",
    DoubleClickScreen: "DoubleClickScree",
    TripleClickScreen: "TripleClickScreen",
}

export const styles = {
    // 仅译文模式
    singleTranslation: 0,
    // 双语对照模式
    bilingualTranslation: 1,
}

// 右键菜单ID常量
export const CONTEXT_MENU_IDS = {
    TRANSLATE_FULL_PAGE: 'versevibe-translate-full-page',
    RESTORE_ORIGINAL: 'versevibe-restore-original',
    FLICKR_DOWNLOAD_MAX: 'versevibe-flickr-download-max',
    LINKEDIN_WIDE_SCALE_NORMAL: 'versevibe-linkedin-wide-scale-normal',
    LINKEDIN_WIDE_SCALE_15X: 'versevibe-linkedin-wide-scale-15x',
    LINKEDIN_WIDE_SCALE_2X: 'versevibe-linkedin-wide-scale-2x',
    LINKEDIN_WIDE_SCALE_3X: 'versevibe-linkedin-wide-scale-3x',
    LINKEDIN_WIDE_SCALE_FULL: 'versevibe-linkedin-wide-scale-full',
    LINKEDIN_FEED_WIDE_DESPONSOR: 'versevibe-linkedin-feed-wide-desponsor',
    LINKEDIN_POST_TEXT_ZOOM: 'versevibe-linkedin-post-text-zoom',
}
