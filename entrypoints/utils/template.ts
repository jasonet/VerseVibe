// 消息模板工具
import { customModelString, defaultOption, services } from "./option";
import { config } from "@/entrypoints/utils/config";
import { detectlang } from "./common";

// 解析当前服务实际使用的模型名（处理「自定义模型」占位与中文括号备注）
function resolveModelName(): string {
    let model = config.model[config.service] === customModelString
        ? config.customModel[config.service]
        : config.model[config.service];
    return (model || "").replace(/（.*）/g, "");
}

// TranslateGemma 语言名映射（兼容 config.to 的自有代码与 franc 检测代码）
// 关键：中文必须区分「Simplified / Traditional」——否则模型默认输出繁体，
// 这正是此前「目标=中文却出现繁体乱码」的根因。
function gemmaLangName(code: string): string {
    const map: Record<string, string> = {
        // 简体中文（务必显式 Simplified，避免模型回退到繁体）
        'zh-Hans': 'Simplified Chinese', 'zh-CN': 'Simplified Chinese',
        'zh': 'Simplified Chinese', 'cmn': 'Simplified Chinese',
        // 繁体中文
        'zh-Hant': 'Traditional Chinese', 'zh-TW': 'Traditional Chinese', 'zh-HK': 'Traditional Chinese',
        'en': 'English', 'eng': 'English',
        'ja': 'Japanese', 'jpn': 'Japanese',
        'ko': 'Korean', 'kor': 'Korean',
        'fr': 'French', 'fra': 'French',
        'ru': 'Russian', 'rus': 'Russian',
        'es': 'Spanish', 'spa': 'Spanish',
        'de': 'German', 'deu': 'German',
        'pt': 'Portuguese', 'por': 'Portuguese',
        'it': 'Italian', 'ita': 'Italian',
        // 常见 franc 检测码补充，提升源语言显式标注的命中率
        'ar': 'Arabic', 'arb': 'Arabic',
        'hi': 'Hindi', 'hin': 'Hindi',
        'vi': 'Vietnamese', 'vie': 'Vietnamese',
        'th': 'Thai', 'tha': 'Thai',
        'id': 'Indonesian', 'ind': 'Indonesian',
        'nl': 'Dutch', 'nld': 'Dutch',
        'pl': 'Polish', 'pol': 'Polish',
        'tr': 'Turkish', 'tur': 'Turkish',
        'uk': 'Ukrainian', 'ukr': 'Ukrainian',
    };
    return map[code] || '';
}

/**
 * 是否为 TranslateGemma 翻译专用模型（含 immersive-translate 微调版）。
 * 这类模型不遵循 system / 指令文本，会把任何 prompt 内容当作「待翻译原文」翻译，
 * 因此必须改用专用的标记格式，而不能套用通用 system+user 提示词模板。
 */
export function isTranslateGemmaModel(): boolean {
    return /translategemma/i.test(resolveModelName());
}

/**
 * TranslateGemma 专用模板。
 *
 * 背景：immersive-translate 微调版「本应」用标记格式
 *   <<<source>>>{源}<<<target>>>{目标}<<<text>>>{原文}
 * 由模型内置的 chat_template.jinja 解析后展开成「专业译者」指令。
 * 但该解析依赖 LM Studio / Ollama 实际加载了那份自定义 Jinja 模板；
 * 多数用户加载的 GGUF/量化版并未携带该模板，于是标记被原样塞进通用
 * Gemma-3 模板，模型把 <<<source>>> 等标记词当普通内容，输出一堆
 * 「选项/拼音/解释」的啰嗦结果（即用户截图的现象）。
 *
 * 稳健做法：不再依赖模型解析标记，直接下发「展开后的专业译者指令」。
 * 无论是否加载了自定义模板，这段明确指令都能让模型只输出译文：
 *  - 自定义模板已加载：内容不含 <<<source>>>，走 else 分支按普通 user 轮渲染；
 *  - 仅通用模板：模型直接遵循该指令。
 * 仍不使用 system（官方要求 system 留空）。
 */
export function translateGemmaMsgTemplate(origin: string): string {
    const model = resolveModelName();
    const target = gemmaLangName(config.to) || config.to;
    // 显式标注源语言（官方最佳实践：不要在准确性敏感时依赖纯 auto）；
    // 检测不到时回退 'auto'，模型自身也能处理。
    const source = gemmaLangName(detectlang(origin)) || 'auto';
    const fromClause = (source && source !== 'auto') ? `from ${source} ` : '';

    // 严格指令：强制「只输出译文」，杜绝选项/解释/拼音/注释/引号。
    const instruction =
        `Translate the following text ${fromClause}into ${target}. ` +
        `Output ONLY the final ${target} translation as plain text. ` +
        `Do NOT add any explanations, comments, notes, alternatives, options, ` +
        `pinyin, romanization, labels, headings or quotation marks. ` +
        `Do NOT repeat or include the original text.\n\n` +
        origin;

    // 译文长度约等于原文；按原文长度动态封顶 max_tokens，
    // 避免本地小模型在长段落时超额生成而拖慢速度（同时防止复读跑飞）。
    const maxTokens = Math.min(2048, Math.max(96, Math.ceil(origin.length * 2) + 96));

    return JSON.stringify({
        'model': model,
        // 翻译任务用贪心解码：确定性最高、速度最快、最不易跑偏。
        'temperature': 0,
        'top_p': 1,
        'top_k': 1,
        // 轻微重复惩罚，抑制 4B 小模型偶发的复读/循环（LM Studio / Ollama 支持）。
        'repetition_penalty': 1.05,
        'max_tokens': maxTokens,
        'stream': false,
        'messages': [
            { 'role': 'user', 'content': instruction },
        ],
    });
}

/**
 * 清洗 TranslateGemma 输出：作为安全网，剥除模型偶发的开场白与包裹引号。
 * （主要靠上面的严格指令预防啰嗦输出，这里只做保守的二次兜底。）
 */
export function sanitizeGemmaOutput(text: string): string {
    if (!text) return text;
    let s = text.trim();
    // 去掉单行开场白：Okay/Sure/Here's the translation: / 以下是…… / 翻译如下…… / 译文：
    s = s.replace(
        /^(?:okay|ok|sure|certainly|here(?:'s| is| are)[^\n]*|以下是[^\n]*|翻译如下[^\n]*|译文\s*[:：][^\n]*)\n+/i,
        ''
    );
    // 去掉整体包裹的引号
    s = s.replace(/^["'“”『「]+/, '').replace(/["'“”』」]+$/, '').trim();
    return s;
}

// openai 格式的消息模板（通用模板）
export function commonMsgTemplate(origin: string) {
    // 检测是否使用自定义模型
    let model = config.model[config.service] === customModelString ? config.customModel[config.service] : config.model[config.service]

    // 删除模型名称中的中文括号及其内容，如"gpt-4（推荐）" -> "gpt-4"
    model = model.replace(/（.*）/g, "");

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = (config.user_role[config.service] || defaultOption.user_role)
        .replace('{{to}}', config.to).replace('{{origin}}', origin);

    return JSON.stringify({
        'model': model,
        "temperature": 1.0,
        'messages': [
            { 'role': 'system', 'content': system },
            { 'role': 'user', 'content': user },
        ]
    })
}

// deepseek
export function deepseekMsgTemplate(origin: string) {
    // 检测是否使用自定义模型
    let model = config.model[config.service] === customModelString ? config.customModel[config.service] : config.model[config.service]

    // 删除模型名称中的中文括号及其内容，如"gpt-4（推荐）" -> "gpt-4"
    model = model.replace(/（.*）/g, "");

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = (config.user_role[config.service] || defaultOption.user_role)
        .replace('{{to}}', config.to).replace('{{origin}}', origin);

    const payload: any = {
        'model': model,
        'messages': [
            { 'role': 'system', 'content': system },
            { 'role': 'user', 'content': user },
        ]
    };

    // 如果不是 deepseek-reasoner 模型,则添加 temperature
    if (model !== 'deepseek-reasoner') {
        payload.temperature = 0.7;
    }

    return JSON.stringify(payload);
}

// gemini
export function geminiMsgTemplate(origin: string) {
    let user = (config.user_role[config.service] || defaultOption.user_role)
        .replace('{{to}}', config.to).replace('{{origin}}', origin);

    return JSON.stringify({
        "contents": [
            { "role": "user", "parts": [{ "text": user }] },
        ]
    })
}

// claude
export function claudeMsgTemplate(origin: string) {
    let model = config.model[services.claude];
    if (model === "claude-3-5-haiku") model = "claude-3-5-haiku-20241022";
    else if (model === "claude-3-5-sonnet") model = "claude-3-5-sonnet-20241022";
    else if (model === "claude-3-opus") model = "claude-3-opus-20240229";

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = (config.user_role[config.service] || defaultOption.user_role)
        .replace('{{to}}', config.to).replace('{{origin}}', origin);

    return JSON.stringify({
        model: model,
        max_tokens: 4096,
        stream: false,
        system: system,
        messages: [
            { role: "user", content: user },
        ]
    })
}

// 通义千问
export function tongyiMsgTemplate(origin: string) {
    let model = config.model[config.service] === customModelString ? config.customModel[config.service] : config.model[config.service]
    const normalTemplate = () => {
        let system = config.system_role[config.service] || defaultOption.system_role;
        let user = (config.user_role[config.service] || defaultOption.user_role)
            .replace('{{to}}', config.to).replace('{{origin}}', origin);

        return JSON.stringify({
            "model": model,
            "enable_thinking": false,
            "messages": [
                { "role": "system", "content": system },
                { "role": "user", "content": user },
            ]
        })
    }
    // 翻译模型qwen-mt-plus和qwen-mt-turbo的格式和通用的不同
    const mtModelTemplate = () => {
        const langMap = [
            { value: "zh-Hans", target: "zh" },
            { value: "en" },
            { value: "ja" },
            { value: "ko" },
            { value: "fr" },
            { value: "ru" },
        ]
        let targetItem = langMap.find(i => i.value === config.to) || langMap[0]
        let targetLang = targetItem.target || targetItem.value
        return JSON.stringify({
            "model": model,
            "messages": [
                { "role": "user", "content": origin },
            ],
            "translation_options": {
                "source_lang": "auto",
                "target_lang": targetLang
            }
        })
    }
    return model.startsWith("qwen-mt") ? mtModelTemplate() : normalTemplate()

}

export function minimaxTemplate(origin: string) {

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = (config.user_role[config.service] || defaultOption.user_role)
        .replace('{{to}}', config.to).replace('{{origin}}', origin);

    return JSON.stringify({
        model: "MiniMax-Text-01",
        stream: false,
        temperature: 0.7,
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
        ]
    })
}

