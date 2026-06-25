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
 * TranslateGemma（immersive-translate 微调版）专用模板。
 *
 * 关键认知（来自用户多版截图实测）：该模型是「纯翻译模型」，会把 user 轮里的
 * 一切自然语言文本都当作待翻译原文——包括你写给它的指令本身。
 *   · 用 system+user 通用提示词 → 模型把提示词翻成中文输出（最初的 bug）
 *   · 用「Translate the following… Do not add…」自然语言指令 → 指令同样被翻成中文输出
 * 因此唯一正确的方式是官方标记格式：
 *   <<<source>>>{源}<<<target>>>{目标}<<<text>>>{原文}
 * 这些 <<<...>>> 是该微调版「训练时就学会识别并剥离」的特殊标记（不是会被翻译的普通词），
 * 模型只翻译 <<<text>>> 之后的正文，并据 source/target 决定方向。不带 system。
 *
 * 注意：若 LM Studio/Ollama 加载的不是真正的 immersive 微调版（或量化损坏了标记识别），
 * 标记可能不被识别。那属于本地模型/模板配置问题，需在 LM Studio 侧用正确模型与
 * chat 模板解决——扩展侧已用模型本身的标准格式，无法替代本地模板配置。
 */
export function translateGemmaMsgTemplate(origin: string): string {
    const model = resolveModelName();
    const target = gemmaLangName(config.to) || config.to;
    // 显式标注源语言（官方最佳实践：不要在准确性敏感时依赖纯 auto）；
    // 检测不到时回退 'auto'，模型自身也能处理。
    const source = gemmaLangName(detectlang(origin)) || 'auto';

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
        // 兜底停止序列：即便本地未配置正确的 eos token（[106,1]），
        // 也尽量让生成在一轮结束处停下，减少「翻完又继续输出选项/解释」的跑飞。
        'stop': ['<end_of_turn>', '<eos>', '<start_of_turn>'],
        'messages': [
            { 'role': 'user', 'content': `<<<source>>>${source}<<<target>>>${target}<<<text>>>${origin}` },
        ],
    });
}

/**
 * 清洗 TranslateGemma 输出：作为安全网，剥除模型偶发的开场白与包裹引号。
 * （主要靠上面的严格指令预防啰嗦输出，这里只做保守的二次兜底。）
 */
// 含声调拼音字母（ā á ǎ à 等）——用于高精度识别拼音行/括注，避免误删合法的 (API)/(AGPL-3.0)。
function hasPinyinTone(s: string): boolean {
    return /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹ]/i.test(s);
}

export function sanitizeGemmaOutput(text: string): string {
    if (!text) return text;
    const original = text.trim();
    let s = original;

    // A) 去掉被模型回显的标记残片：<<<source>>> / <<<target>>> / <<<text>>> / <<>> 等
    s = s.replace(/<<<\s*(?:source|target|text)\s*>>>/gi, ' ');
    s = s.replace(/<<+\s*>>+/g, ' ');

    // B0) 只保留「第一种译法」：4bit 量化常输出 **Option 1 ...** / **Option 2 ...**，
    //     从第二个 Option（及 Alternative/其他译法标题）处整体截断，仅留首个译文块。
    {
        const secondOption = s.search(/\n\s*\**\s*(?:option|alternative|或译|其他译法|另一种)\s*[2-9２-９]/i);
        if (secondOption > 0) s = s.slice(0, secondOption).trim();
    }

    // B) 逐行清洗：丢掉开场白、纯标签行、Option 标题、拼音行、解释括注、分隔线
    const dropLine = (line: string): boolean => {
        const t = line.trim();
        if (!t) return false; // 空行后面统一处理
        // 开场白：Okay/Sure/Here's a translation... / 以下是…… / 翻译如下……
        if (/^(?:okay|ok|sure|certainly|here(?:'s| is| are)\b)[^\n]*$/i.test(t)) return true;
        if (/^(?:以下是|翻译如下)[^\n]*$/.test(t)) return true;
        // 纯标签行：**Translation:** / **译文：** / **《翻译》** / **Simplified Chinese:** 等
        if (/^\**\s*(?:《?\s*(?:translation|译文|翻译)\s*》?|simplified\s+chinese|traditional\s+chinese)\s*[:：]?\s*\**$/i.test(t)) return true;
        // Option 标题行：**Option 1 (Most Precise ...):** / **Option（最精确）：**
        if (/^\**\s*option\b.*$/i.test(t)) return true;
        // 整行拼音注释：(AGPL-3.0 xiéyù) / （📌 Yuányīn: ...）——仅当含声调拼音时丢
        if (/^[（(].*[)）]$/.test(t) && hasPinyinTone(t)) return true;
        // 分隔线：--- / *** / ___
        if (/^[-—*_]{3,}$/.test(t)) return true;
        // 整行解释性括注：(This indicates ...) /（表示……）—— 仅在含解释关键词时丢
        if (/^[（(].*[)）]$/.test(t) && /indicate|comparison|means?|note|表示|说明|意为|即/i.test(t)) return true;
        return false;
    };
    s = s.split('\n').filter(l => !dropLine(l)).join('\n').trim();

    // C) 行首残留标签前缀（标签与正文同一行）：**《翻译》** 正文 / **Simplified Chinese:** 正文
    s = s.replace(
        /^\**\s*(?:《?\s*(?:translation|译文|翻译)\s*》?|simplified\s+chinese|traditional\s+chinese)\s*[:：]?\s*\**\s*/i,
        ''
    );

    // D) 截断「选项/解释/拼音/逐词注释」啰嗦尾巴：从最早出现的小节标记处切掉其后内容。
    const tailMarkers = [
        /\n\s*\*\*\s*Option\b/i,
        /\n\s*\*\*\s*Explanation\b/i,
        /\n\s*\*\*\s*Pronunciation\b/i,
        /\n\s*\*\*\s*Why\b/i,
        /\n\s*\*\s/,                  // markdown 列表项（多为逐词解释）
        /\n\s*[（(]\s*Pinyin\b/i,
        /\n\s*Here are a few options/i,
    ];
    let cut = s.length;
    for (const re of tailMarkers) {
        const m = s.match(re);
        if (m && m.index !== undefined && m.index < cut) cut = m.index;
    }
    if (cut > 0 && cut < s.length) s = s.slice(0, cut).trim();

    // E) 剥掉行尾拼音括注（与正文同一行）：技术名词 (xiéyù) / 原因 （Yuányīn）
    s = s.split('\n').map(line => {
        const m = line.match(/[（(][^（()）]*[)）]\s*$/);
        if (m && hasPinyinTone(m[0])) return line.slice(0, m.index).trimEnd();
        return line;
    }).join('\n');

    // F) 去掉残留的粗体标记 **，以及整体包裹的引号（保留中文书名号《》「」）
    s = s.replace(/\*\*/g, '');
    s = s.replace(/^["'“”]+/, '').replace(/["'“”]+$/, '').trim();

    // 兜底：若清洗后为空（如模型整段都是选项/解释），退回原始文本，至少不留空。
    return s || original;
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

