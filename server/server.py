"""
server.py
---------
给 Chrome 插件用的本地胶水服务。插件把本地 PDF 文件 POST 过来，
这里调用 pdf_bilingual.py 处理，返回生成好的双语 PDF 二进制。

启动：python3 server.py
默认监听 http://127.0.0.1:8765

环境变量（可选）：
  VV_PDF_PORT        服务端口，默认 8765
  VV_LLM_BACKEND     翻译后端：openai（默认，兼容 LM Studio / vLLM / Ollama 的 OpenAI 接口）或 ollama
  VV_LLM_HOST        LLM 地址。openai 后端默认 http://127.0.0.1:1234（LM Studio）；
                     ollama 后端默认 http://127.0.0.1:11434
  VV_LLM_MODEL       默认模型名，openai 后端默认 translategemma-4b-it_immersive-translate
  VV_LLM_API_KEY     OpenAI 后端的 Authorization 令牌，默认 local
  VV_TARGET_LANG     默认目标语言，默认 zh-Hans

接口：
  POST /translate_pdf   multipart/form-data
       - file:               PDF 文件
       - model:              模型名（可选，默认取环境变量）
       - target_lang:        目标语言代码（可选，默认 zh-Hans，对应插件 config.to）
       - min_cjk_font_size:  最小中文字号（可选，默认 8.0，对应插件设置项）
       返回 application/pdf 二进制
  GET  /health           健康检查，返回 {"status":"ok"}

替换 translate_fn 换成你自己的 pipeline（比如先过 Trie/正则规则引擎做实体识别，
再把带标注的文本喂给 Gemma 做翻译，这样译名/纪年可以保持一致）。
"""

import base64
import os
from flask import Flask, request, send_file
from flask_cors import CORS
import tempfile
import traceback

from pdf_bilingual import (
    build_bilingual_pdf,
    translate_via_ollama,
    translate_via_openai,
)

app = Flask(__name__)
# 只放行插件自己的 origin，别写 "*"（本地服务，避免被任意网页调用）
CORS(app, resources={r"/*": {"origins": "chrome-extension://*"}})

LLM_BACKEND = os.environ.get("VV_LLM_BACKEND", "openai").lower()
LLM_HOST_OPENAI = os.environ.get("VV_LLM_HOST_OPENAI", "http://100.84.207.88:8080/v1")
LLM_HOST_OLLAMA = os.environ.get("VV_LLM_HOST_OLLAMA", "http://127.0.0.1:11434")
DEFAULT_MODEL_OPENAI = os.environ.get(
    "VV_LLM_MODEL_OPENAI", "gemma-4-26B-A4B-it-ultra-uncensored-heretic-Q4_K_S.gguf"
)
DEFAULT_MODEL_OLLAMA = os.environ.get("VV_LLM_MODEL_OLLAMA", "gemma2")
DEFAULT_API_KEY = os.environ.get("VV_LLM_API_KEY", "local")
DEFAULT_TARGET_LANG = os.environ.get("VV_TARGET_LANG", "zh-Hans")


@app.route("/translate_pdf", methods=["POST"])
def translate_pdf():
    if "file" not in request.files:
        return {"error": "missing file field 'file'"}, 400

    f = request.files["file"]
    # backend 优先级：表单 > 环境变量；默认 openai（兼容 LM Studio）
    backend = (request.form.get("backend") or LLM_BACKEND).lower()
    target_lang = request.form.get("target_lang") or DEFAULT_TARGET_LANG
    if backend == "ollama":
        model = request.form.get("model") or DEFAULT_MODEL_OLLAMA
        host = LLM_HOST_OLLAMA
        translate_fn = lambda text: translate_via_ollama(text, model=model, host=host)
    else:
        model = request.form.get("model") or DEFAULT_MODEL_OPENAI
        host = LLM_HOST_OPENAI
        translate_fn = lambda text: translate_via_openai(
            text, model=model, host=host, target_lang=target_lang, api_key=DEFAULT_API_KEY
        )

    # 对应插件设置里用户配的“最小中文字号”，没传就给个保守默认值
    try:
        min_cjk_font_size = float(request.form.get("min_cjk_font_size", 8.0))
    except ValueError:
        min_cjk_font_size = 8.0

    with tempfile.TemporaryDirectory() as tmp:
        src_path = os.path.join(tmp, "input.pdf")
        out_path = os.path.join(tmp, "output.pdf")
        f.save(src_path)

        try:
            build_bilingual_pdf(
                src_path,
                out_path,
                translate_fn=translate_fn,
                min_cjk_font_size=min_cjk_font_size,
            )
        except Exception as e:
            traceback.print_exc()
            return {"error": str(e)}, 500

        return send_file(
            out_path,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{os.path.splitext(f.filename)[0]}_bilingual.pdf",
        )


@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok", "backend": LLM_BACKEND}


@app.route("/translate", methods=["POST"])
def translate_json():
    """翻译并返回结构化结果（供前端右侧实时展示）+ base64 PDF（供二次下载）。

    与 /translate_pdf 同样的处理，但返回 JSON：
      { pages: [{page_index, paragraphs:[{orig, translated, ok}]}],
        pdf_base64, filename, failed }
    """
    if "file" not in request.files:
        return {"error": "missing file field 'file'"}, 400

    f = request.files["file"]
    backend = (request.form.get("backend") or LLM_BACKEND).lower()
    target_lang = request.form.get("target_lang") or DEFAULT_TARGET_LANG
    if backend == "ollama":
        model = request.form.get("model") or DEFAULT_MODEL_OLLAMA
        translate_fn = lambda text: translate_via_ollama(text, model=model, host=LLM_HOST_OLLAMA)
    else:
        model = request.form.get("model") or DEFAULT_MODEL_OPENAI
        translate_fn = lambda text: translate_via_openai(
            text, model=model, host=LLM_HOST_OPENAI, target_lang=target_lang, api_key=DEFAULT_API_KEY
        )
    try:
        min_cjk_font_size = float(request.form.get("min_cjk_font_size", 8.0))
    except ValueError:
        min_cjk_font_size = 8.0

    with tempfile.TemporaryDirectory() as tmp:
        src_path = os.path.join(tmp, "input.pdf")
        out_path = os.path.join(tmp, "output.pdf")
        f.save(src_path)
        try:
            pages = build_bilingual_pdf(
                src_path, out_path, translate_fn=translate_fn, min_cjk_font_size=min_cjk_font_size,
            )
        except Exception as e:
            traceback.print_exc()
            return {"error": str(e)}, 500

        with open(out_path, "rb") as fp:
            pdf_base64 = base64.b64encode(fp.read()).decode("ascii")

    failed = sum(1 for p in pages for para in p["paragraphs"] if not para["ok"])
    return {
        "pages": pages,
        "pdf_base64": pdf_base64,
        "filename": f"{os.path.splitext(f.filename)[0]}_bilingual.pdf",
        "total_paragraphs": sum(len(p["paragraphs"]) for p in pages),
        "failed": failed,
    }


if __name__ == "__main__":
    port = int(os.environ.get("VV_PDF_PORT", "8765"))
    app.run(host="127.0.0.1", port=port)
