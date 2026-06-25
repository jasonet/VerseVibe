import {commonMsgTemplate, translateGemmaMsgTemplate, isTranslateGemmaModel, sanitizeGemmaOutput} from "../utils/template";
import {method, normalizeOpenAiUrl} from "../utils/constant";
import {services} from "@/entrypoints/utils/option";
import {config} from "@/entrypoints/utils/config";
import {contentPostHandler} from "@/entrypoints/utils/check";

async function custom(message: any) {

    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Authorization', `Bearer ${config.token[services.custom]}`);

    // TranslateGemma（immersive-translate 微调版）是「翻译专用模型」，不遵循 system/指令文本，
    // 会把任何 prompt 内容当作待翻译原文。必须改用标记格式模板，否则翻译严重错误。
    const body = isTranslateGemmaModel()
        ? translateGemmaMsgTemplate(message.origin)
        : commonMsgTemplate(message.origin);

    const resp = await fetch(normalizeOpenAiUrl(config.custom), {
        method: method.POST,
        headers: headers,
        body: body
    });

    if (resp.ok) {
        let result = await resp.json();
        let content = result.choices[0].message.content;
        // TranslateGemma：兜底清洗偶发的开场白/引号，确保只保留译文。
        if (isTranslateGemmaModel()) content = sanitizeGemmaOutput(content);
        return contentPostHandler(content);
    } else {
        console.log("翻译失败：", resp);
        throw new Error(`翻译失败: ${resp.status} ${resp.statusText} body: ${await resp.text()}`);
    }
}

export default custom;