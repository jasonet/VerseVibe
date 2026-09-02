# VerseVibe PDF 沉浸式翻译 · 本地服务

Chrome 插件只做“胶水层”：取 PDF 字节 → POST 到本服务 → 下载返回的双语 PDF。
真正的 PDF 解析、翻译、重建都在这里用 Python 完成（PyMuPDF + ReportLab），
质量远好于浏览器端，并能复用你现有的 Gemma pipeline / 规则引擎。

## 效果

生成「左原文截图 / 右中文译文」对照 PDF，**严格 1 页对 1 页，绝不跨页**：

- 左侧 = 原页面截图（公式 / 表格 / 图片 100% 保真）
- 右侧译文的 **字号、颜色跟随原文对应段落**
- 译文过长时按三级策略压缩，保证单页放得下：
  1. 先压行距（1.4x → 1.3 → 1.2 → 1.1 → 1.05x）
  2. 行距到下限后整体缩字号（每次 -5%，下限 50%）
  3. 任何段落字号都不会低于插件配置的 `min_cjk_font_size`
  4. 极端超长情况下接受贴底排版，但**不截断、不转页**

## 安装与启动

```bash
cd server
pip install -r requirements.txt
python server.py
# 默认监听 http://127.0.0.1:8765
```

## 接口

### `POST /translate_pdf`  `multipart/form-data`

| 字段 | 必填 | 说明 |
|---|---|---|
| `file` | 是 | PDF 文件 |
| `backend` | 否 | 翻译后端：`openai`（默认，兼容 LM Studio / vLLM / Ollama 的 OpenAI 接口）或 `ollama` |
| `model` | 否 | 模型名。openai 后端默认 `translategemma-4b-it_immersive-translate` |
| `target_lang` | 否 | 目标语言代码（默认 `zh-Hans`，对应插件 `config.to`） |
| `min_cjk_font_size` | 否 | 最小中文字号（pt），默认 8.0，对应插件设置项 |

成功返回 `application/pdf` 二进制；失败返回 JSON `{"error": "..."}`。

> **TranslateGemma 自动识别**：`model` 含 `translategemma` 时，自动改用官方标记格式
> `<<<source>>>auto<<<target>>>{目标}<<<text>>>{原文}`（与插件 `template.ts` 一致），
> 而非通用指令提示词——否则该纯翻译模型会把指令也翻成中文。

### `GET /health`

返回 `{"status":"ok","backend":"openai"}`，供插件「测试连接」按钮调用。

## 环境变量（可选）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `VV_PDF_PORT` | `8765` | 服务端口 |
| `VV_LLM_BACKEND` | `openai` | 翻译后端：`openai` / `ollama` |
| `VV_LLM_HOST_OPENAI` | `http://127.0.0.1:1234` | OpenAI 兼容后端地址（LM Studio 默认端口） |
| `VV_LLM_HOST_OLLAMA` | `http://127.0.0.1:11434` | Ollama 地址 |
| `VV_LLM_MODEL_OPENAI` | `translategemma-4b-it_immersive-translate` | OpenAI 后端默认模型 |
| `VV_LLM_MODEL_OLLAMA` | `gemma2` | Ollama 后端默认模型 |
| `VV_LLM_API_KEY` | `local` | OpenAI 后端的 Authorization 令牌 |
| `VV_TARGET_LANG` | `zh-Hans` | 默认目标语言 |

## 替换翻译后端（接你自己的 pipeline）

内置两个后端：
- `translate_via_openai`（默认）—— 兼容 LM Studio / vLLM / Ollama 的 OpenAI 接口，自动识别 TranslateGemma 用标记格式
- `translate_via_ollama`—— 调本地 Ollama 的 `/api/generate`

换成你自己的 Gemma pipeline + 规则引擎（古籍纪年 / 干支 / NER 一致性等）时，
**只改 `server.py` 里传给 `build_bilingual_pdf` 的 `translate_fn`**，签名保持 `(text: str) -> str`：

```python
# server.py 里
from my_pipeline import translate_with_gemma_and_rules  # 你自己的实现

build_bilingual_pdf(
    src_path,
    out_path,
    translate_fn=translate_with_gemma_and_rules,   # 只改这一行
    min_cjk_font_size=min_cjk_font_size,
)
```

`pdf_bilingual.py` 其余代码（提取 / 截图 / 排版压缩）无需改动。

## CORS 安全

只放行 `chrome-extension://*`，避免任意网页调用你的本地算力。

## 命令行调试

```bash
# 直接对一个 PDF 文件跑（用 mock 译文，不依赖 Ollama，便于验证排版）
python pdf_bilingual.py input.pdf out.pdf 8.0
```

## 文件说明

| 文件 | 作用 |
|---|---|
| `pdf_bilingual.py` | 核心：提取段落+bbox+字号/颜色、原页截图、翻译、ReportLab 重建左右双语 PDF |
| `server.py` | Flask 胶水服务：收 PDF 字节 → 处理 → 返回双语 PDF |
| `requirements.txt` | Python 依赖 |

## 已知取舍

- **段落间距**：当前段间距与行内间距同步压缩（`_GAP_RATIO = 0.6`），作为最佳显示体验默认值。
  若要让段间距与行内间距解耦（例如段间距优先压、保行内可读性），可在 `pdf_bilingual.py`
  的 `_fit_page_layout` 里把 gap 拆成独立压缩梯度。
- **对齐粒度**：段落级比例对齐（译文纵向起始位置按原文段落 y0 映射），非逐行像素对齐。
- **极端超长译文**：会接受贴底排版，内容完整不截断。
