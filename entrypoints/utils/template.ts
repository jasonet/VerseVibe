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
function gemmaLangName(code: string): string {
    const map: Record<string, string> = {
        'zh-Hans': 'Chinese', 'zh-Hant': 'Traditional Chinese', 'zh': 'Chinese', 'cmn': 'Chinese',
        'en': 'English', 'eng': 'English',
        'ja': 'Japanese', 'jpn': 'Japanese',
        'ko': 'Korean', 'kor': 'Korean',
        'fr': 'French', 'fra': 'French',
        'ru': 'Russian', 'rus': 'Russian',
        'es': 'Spanish', 'spa': 'Spanish',
        'de': 'German', 'deu': 'German',
        'pt': 'Portuguese', 'por': 'Portuguese',
        'it': 'Italian', 'ita': 'Italian',
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
 * TranslateGemma（immersive-translate 微调版）专用模板。
 * 正确用法（来自模型卡）：不使用 system；user 内容用标记格式：
 *   <<<source>>>{源语言}<<<target>>>{目标语言}<<<text>>>{原文}
 * 模型内置 chat 模板会解析这些标记并生成正确的翻译指令。
 */
export function translateGemmaMsgTemplate(origin: string): string {
    const model = resolveModelName();
    const target = gemmaLangName(config.to) || config.to;
    const source = gemmaLangName(detectlang(origin)) || 'auto';

    return JSON.stringify({
        'model': model,
        'temperature': 0,
        'messages': [
            { 'role': 'user', 'content': `<<<source>>>${source}<<<target>>>${target}<<<text>>>${origin}` },
        ],
    });
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

