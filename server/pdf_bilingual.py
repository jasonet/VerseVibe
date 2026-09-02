"""
pdf_bilingual.py
----------------
左右双语 PDF 生成核心模块（v2：样式跟随原文 + 溢出压缩）。

流程：
  1. extract_page_blocks()  用 PyMuPDF 提取每页段落级文本块，同时记录该段的字号/颜色
  2. translate_blocks()     可插拔翻译函数（默认走本地 Ollama）
  3. build_bilingual_pdf()  重建 PDF：左边 = 原页截图，右边 = 译文
                            译文字号/颜色默认跟随原文对应段落；
                            如果按“舒适行距”排不下，先压缩行距，
                            行距压到下限后仍放不下，再逐步缩小字号，
                            但绝不低于插件配置的最小中文字号 min_cjk_font_size。
                            全程严格保持 1 页对 1 页，不做跨页续排。

translate_fn 可插拔：默认 translate_via_ollama 接本地 Ollama。
要换成自己的 Gemma pipeline / 规则引擎 / NER 时，只需传入一个新的 callable，
签名保持 (text: str) -> str，其余代码不动。详见 README.md。
"""

import fitz  # PyMuPDF
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from dataclasses import dataclass
from typing import Callable, List, Tuple
import io
import re


# ---------- 1. 提取（文本 + 样式） ----------

@dataclass
class TextBlock:
    page_index: int
    bbox: tuple                 # (x0, y0, x1, y1)，原页坐标，y0 起点在页面顶部
    text: str
    font_size: float = 10.0     # 该段在原文中的字号（取块内出现次数最多的 span 字号）
    color: Tuple[float, float, float] = (0.0, 0.0, 0.0)  # 原文颜色，0-1 RGB
    translated: str = ""


def _int_to_rgb(color_int: int) -> Tuple[float, float, float]:
    r = ((color_int >> 16) & 255) / 255.0
    g = ((color_int >> 8) & 255) / 255.0
    b = (color_int & 255) / 255.0
    return (r, g, b)


def extract_page_blocks(pdf_path: str) -> List[TextBlock]:
    """按段落粒度提取文本，同时记录该段主导字号与颜色，供右侧译文“跟随原文样式”用。"""
    doc = fitz.open(pdf_path)
    blocks: List[TextBlock] = []
    for page_index, page in enumerate(doc):
        raw_blocks = page.get_text("dict")["blocks"]
        for b in raw_blocks:
            if b.get("type") != 0:
                continue  # 跳过图片块
            line_texts = []
            sizes, colors = [], []
            for line in b.get("lines", []):
                seg = "".join(span["text"] for span in line["spans"])
                if seg.strip():
                    line_texts.append(seg.strip())
                for span in line["spans"]:
                    sizes.append(round(span["size"], 1))
                    colors.append(span["color"])
            text = " ".join(line_texts).strip()
            if not text:
                continue
            # 段内可能混排（如加粗小标题 + 正文），取出现次数最多的字号/颜色作为该段代表值
            font_size = max(set(sizes), key=sizes.count) if sizes else 10.0
            color_int = max(set(colors), key=colors.count) if colors else 0
            blocks.append(
                TextBlock(
                    page_index=page_index,
                    bbox=tuple(b["bbox"]),
                    text=text,
                    font_size=font_size,
                    color=_int_to_rgb(color_int),
                )
            )
    doc.close()
    return blocks


def render_page_images(pdf_path: str, zoom: float = 2.0) -> Tuple[List[bytes], List[Tuple[float, float]]]:
    """把每页渲染成 PNG 字节流，用于左侧原文展示。zoom=2.0 约等于 144dpi。

    返回 (images, page_sizes)：images 是每页 PNG bytes，page_sizes 是每页原始宽高 (w, h)。
    """
    doc = fitz.open(pdf_path)
    images: List[bytes] = []
    page_sizes: List[Tuple[float, float]] = []
    for page in doc:
        page_sizes.append((page.rect.width, page.rect.height))
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
        images.append(pix.tobytes("png"))
    doc.close()
    return images, page_sizes


# ---------- 2. 翻译（可插拔） ----------

def translate_via_ollama(text: str, model: str = "gemma2",
                         host: str = "http://127.0.0.1:11434") -> str:
    """默认翻译后端：调用本地 Ollama。

    可换成你自己 pipeline 里的规则引擎 + LLM 组合（古籍纪年 / 干支 / NER 一致性等）。
    替换方式：在 server.py 里给 build_bilingual_pdf 传一个新的 translate_fn 即可。
    """
    import requests
    prompt = f"将下面的英文段落翻译成中文，只输出译文，不要解释：\n\n{text}"
    resp = requests.post(
        f"{host}/api/generate",
        json={"model": model, "prompt": prompt, "stream": False},
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()["response"].strip()


# TranslateGemma 语言名映射（与插件 template.ts 的 gemmaLangName 保持一致）。
# 关键：中文必须区分 Simplified / Traditional，否则模型默认输出繁体。
_GEMMA_LANG = {
    'zh-Hans': 'Simplified Chinese', 'zh-CN': 'Simplified Chinese',
    'zh': 'Simplified Chinese', 'cmn': 'Simplified Chinese',
    'zh-Hant': 'Traditional Chinese', 'zh-TW': 'Traditional Chinese', 'zh-HK': 'Traditional Chinese',
    'en': 'English', 'eng': 'English', 'ja': 'Japanese', 'jpn': 'Japanese',
    'ko': 'Korean', 'kor': 'Korean', 'fr': 'French', 'fra': 'French',
    'ru': 'Russian', 'rus': 'Russian', 'es': 'Spanish', 'spa': 'Spanish',
    'de': 'German', 'deu': 'German', 'pt': 'Portuguese', 'por': 'Portuguese',
    'it': 'Italian', 'ita': 'Italian', 'ar': 'Arabic', 'arb': 'Arabic',
    'hi': 'Hindi', 'hin': 'Hindi', 'vi': 'Vietnamese', 'vie': 'Vietnamese',
    'th': 'Thai', 'tha': 'Thai', 'id': 'Indonesian', 'ind': 'Indonesian',
    'nl': 'Dutch', 'nld': 'Dutch', 'pl': 'Polish', 'pol': 'Polish',
    'tr': 'Turkish', 'tur': 'Turkish', 'uk': 'Ukrainian', 'ukr': 'Ukrainian',
}


def _normalize_chat_url(url: str) -> str:
    """规整 OpenAI 兼容接口地址（与插件 normalizeOpenAiUrl 对齐）。
    允许只填基础地址（如 http://100.84.207.88:8080 或 ...:8080/v1），
    自动补全到 /v1/chat/completions；已是完整路径则原样返回，避免 /v1/v1 重复。
    """
    u = (url or "").strip().rstrip("/")
    if not u:
        return u
    if u.endswith("/chat/completions"):
        return u
    if u.endswith("/v1"):
        return u + "/chat/completions"
    if u.endswith("/v1/"):
        return u[:-1] + "/chat/completions"
    # 可能是纯 origin（如 http://host:8080）→ 补 /v1/chat/completions
    try:
        from urllib.parse import urlparse
        parsed = urlparse(u)
        if parsed.path in ("", "/"):
            return u + "/v1/chat/completions"
    except Exception:
        pass
    return u + "/chat/completions"


def translate_via_openai(text: str, model: str = "translategemma-4b-it_immersive-translate",
                         host: str = "http://127.0.0.1:1234",
                         target_lang: str = "zh-Hans",
                         api_key: str = "local") -> str:
    """OpenAI 兼容后端（LM Studio / Ollama OpenAI 接口 / vLLM 等都适用）。

    对 TranslateGemma 系列模型（含 immersive-translate 微调版），使用官方标记格式
        <<<source>>>{源}<<<target>>>{目标}<<<text>>>{原文}
    —— 该模型会把 user 轮里的一切自然语言当作待翻译原文，必须用标记而非指令。
    与插件 template.ts 的 translateGemmaMsgTemplate 严格一致，保证译文风格统一。

    对非 TranslateGemma 模型，退回普通指令式 system+user 提示词。
    """
    import requests

    is_gemma = "translategemma" in model.lower()
    # 注意：某些 heretic / 推理型模型在输出最终译文前会先消耗大量内部 token（实测
    # gemma-4-26B-...-heretic 每段要先花 ~420 token 才开始输出可见中文）。
    # 因此 max_tokens 下限必须足够大，否则会因 finish_reason=length 而译文为空。
    max_tokens = min(8192, max(2048, len(text) * 3 + 512))

    if is_gemma:
        target = _GEMMA_LANG.get(target_lang, target_lang) or target_lang
        # 默认源 = auto（PDF 多为英文，但避免短句误判；模型自身能判方向）
        payload = {
            "model": model,
            "temperature": 0,
            "top_p": 1,
            "top_k": 1,
            "repetition_penalty": 1.05,
            "max_tokens": max_tokens,
            "stream": False,
            "stop": ["<end_of_turn>", "<eos>", "<start_of_turn>"],
            "messages": [
                {"role": "user",
                 "content": f"<<<source>>>auto<<<target>>>{target}<<<text>>>{text}"},
            ],
        }
    else:
        target = _GEMMA_LANG.get(target_lang, target_lang) or "Simplified Chinese"
        payload = {
            "model": model,
            "temperature": 0,
            "max_tokens": max_tokens,
            "stream": False,
            "messages": [
                {"role": "system",
                 "content": f"You are a professional translator. Translate the user's text into {target}. "
                            "Output ONLY the translation, no explanations, no quotes."},
                {"role": "user", "content": text},
            ],
        }

    endpoint = _normalize_chat_url(host)
    # 关键：本机常设了 http_proxy/https_proxy/all_proxy(socks5)（如 Clash 127.0.0.1:7890），
    # 会让对 localhost / Tailscale(100.x) / 内网模型服务的请求被代理拦截，返回 502。
    # 这里把所有代理 scheme 都置空，强制直连模型服务。
    # 模型服务偶发 500（推理型大模型负载/显存压力），加重试避免单段失败拖垮整篇 PDF。
    import time as _time
    last_err = None
    for attempt in range(4):  # 最多 4 次：0s, 2s, 5s, 12s
        if attempt > 0:
            _time.sleep([2, 5, 12][attempt - 1])
        try:
            resp = requests.post(
                endpoint,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
                json=payload,
                timeout=180,
                proxies={"http": None, "https": None, "socks5": None, "socks5h": None, "all": None},
            )
            if resp.status_code >= 500:
                last_err = f"模型服务 {resp.status_code}: {resp.text[:200]}"
                continue  # 5xx 重试
            resp.raise_for_status()
            data = resp.json()
            msg = data["choices"][0]["message"]
            content = msg.get("content") or ""
            # 偶发：content 为空但模型把结果放到了 reasoning_content（少数模板/采样下）
            if not content and msg.get("reasoning_content"):
                content = msg["reasoning_content"]
            if is_gemma:
                content = _sanitize_gemma_output(content)
            content = content.strip()
            if content:
                return content
            last_err = "模型返回空内容"
        except requests.RequestException as e:
            last_err = str(e)
            continue
    raise RuntimeError(f"翻译失败（已重试 {attempt + 1} 次）: {last_err}")


def _has_pinyin_tone(s: str) -> bool:
    """含声调拼音字母（ā á ǎ à 等）——与插件 hasPinyinTone 一致。"""
    return re.search(r"[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹ]", s, re.IGNORECASE) is not None


def _sanitize_gemma_output(text: str) -> str:
    """与插件 sanitizeGemmaOutput 严格对齐：TranslateGemma（尤其 4bit 量化）常输出
    开场白 / 多个 Option 译法 / 拼音括注 / 粗体标记，这里全部剥除，只留第一种译法。

    对应 entrypoints/utils/template.ts 的 sanitizeGemmaOutput，逻辑一致，保证
    PDF 译文与网页译文风格统一。
    """
    if not text:
        return text
    original = text.strip()
    s = original

    # A) 去掉被模型回显的标记残片：<<<source>>> / <<<target>>> / <<<text>>> / <<>> 等
    s = re.sub(r"<<<\s*(?:source|target|text)\s*>>>", " ", s, flags=re.IGNORECASE)
    s = re.sub(r"<<+\s*>>+", " ", s)

    # B0) 只保留「第一种译法」：从第二个 Option（及 Alternative/其他译法标题）处整体截断
    m = re.search(r"\n\s*\**\s*(?:option|alternative|或译|其他译法|另一种)\s*[2-9２-９]", s, re.IGNORECASE)
    if m:
        s = s[:m.start()].strip()

    # B) 逐行清洗
    def _drop_line(line: str) -> bool:
        t = line.strip()
        if not t:
            return False
        # 开场白
        if re.match(r"^(?:okay|ok|sure|certainly|here(?:'s| is| are)\b)", t, re.IGNORECASE):
            return True
        if re.match(r"^(?:以下是|翻译如下)", t):
            return True
        # 纯标签行
        if re.match(r"^\**\s*(?:《?\s*(?:translation|译文|翻译)\s*》?|simplified\s+chinese|traditional\s+chinese)\s*[:：]?\s*\**$", t, re.IGNORECASE):
            return True
        # Option 标题行
        if re.match(r"^\**\s*option\b", t, re.IGNORECASE):
            return True
        # 整行拼音注释
        if re.match(r"^[（(].*[)）]$", t) and _has_pinyin_tone(t):
            return True
        # 分隔线
        if re.match(r"^[-—*_]{3,}$", t):
            return True
        # 整行解释性括注
        if re.match(r"^[（(].*[)）]$", t) and re.search(r"indicate|comparison|means?|note|表示|说明|意为|即", t, re.IGNORECASE):
            return True
        return False

    s = "\n".join(l for l in s.split("\n") if not _drop_line(l)).strip()

    # C) 行首残留标签前缀
    s = re.sub(
        r"^\**\s*(?:《?\s*(?:translation|译文|翻译)\s*》?|simplified\s+chinese|traditional\s+chinese)\s*[:：]?\s*\**\s*",
        "", s, flags=re.IGNORECASE,
    )

    # D) 截断「选项/解释/拼音/逐词注释」啰嗦尾巴
    tail_markers = [
        r"\n\s*\*\*\s*Option\b",
        r"\n\s*\*\*\s*Explanation\b",
        r"\n\s*\*\*\s*Pronunciation\b",
        r"\n\s*\*\*\s*Why\b",
        r"\n\s*\*\s",
        r"\n\s*[（(]\s*Pinyin\b",
        r"\n\s*Here are a few options",
    ]
    cut = len(s)
    for pat in tail_markers:
        m = re.search(pat, s, re.IGNORECASE)
        if m and m.start() < cut:
            cut = m.start()
    if 0 < cut < len(s):
        s = s[:cut].strip()

    # E) 剥掉行尾拼音括注
    out_lines = []
    for line in s.split("\n"):
        m = re.search(r"[（(][^（()）]*[)）]\s*$", line)
        if m and _has_pinyin_tone(m.group(0)):
            out_lines.append(line[:m.start()].rstrip())
        else:
            out_lines.append(line)
    s = "\n".join(out_lines)

    # F) 去残留粗体标记 **，以及整体包裹引号（保留书名号《》「」）
    s = s.replace("**", "")
    s = re.sub(r'^["\'“”]+', "", s)
    s = re.sub(r'["\'“”]+$', "", s).strip()

    # 兜底：清洗后为空则退回原文
    return s or original


def translate_blocks(blocks: List[TextBlock], translate_fn: Callable[[str], str]) -> None:
    """原地翻译每个 block.text -> block.translated。

    容错：单段翻译失败（模型偶发 500 / 超时 / 空返回）不中断整篇，
    该段回退为原文（英文），其余段落照常翻译生成双语 PDF。
    """
    failed = 0
    for i, b in enumerate(blocks):
        try:
            b.translated = translate_fn(b.text)
            if not b.translated:
                b.translated = b.text
                failed += 1
        except Exception as e:
            print(f"[pdf_bilingual] 第 {i + 1} 段翻译失败，回退原文：{e}")
            b.translated = b.text
            failed += 1
    if failed:
        print(f"[pdf_bilingual] 共 {failed}/{len(blocks)} 段翻译失败（已回退原文）")


# ---------- 3. 排版：字号/颜色跟随原文 + 溢出压缩 ----------

def _wrap_text(text: str, font_name: str, font_size: float, max_width: float,
               c: canvas.Canvas) -> List[str]:
    """按字符宽度换行（中文按字切，不依赖分词库）。"""
    lines: List[str] = []
    current = ""
    for ch in text:
        trial = current + ch
        if c.stringWidth(trial, font_name, font_size) > max_width and current:
            lines.append(current)
            current = ch
        else:
            current = trial
    if current:
        lines.append(current)
    return lines or [""]


# 行距压缩范围：舒适 1.4 倍字号 -> 最紧 1.05 倍字号（低于此中文行会粘连，不再压）
_COMFORTABLE_LINE_RATIO = 1.4
_MIN_LINE_RATIO = 1.05
# 段落间距系数：段间距 = 平均字号 * 行距系数 * _GAP_RATIO。
# 当前段间距与行内间距同步压缩，作为“最佳显示体验”默认值；
# 若后续想让段间距与行内间距解耦（例如段间距优先压、保行内可读性），
# 可在 _fit_page_layout 里把 gap 拆成独立梯度。
_GAP_RATIO = 0.6
_FONT_SCALE_STEP = 0.05  # 字号整体压缩的步进
_FONT_SCALE_FLOOR = 0.5  # 字号最多压缩到原字号的 50%，再往下交给 min_cjk_font_size 兜底


def _measure_layout(c, page_blocks, font_name, right_width, font_scale, line_ratio, min_cjk_font_size):
    """按给定的 font_scale / line_ratio 试排一次，返回总高度和每段的排版结果。"""
    layout = []
    sizes_used = []
    for b in page_blocks:
        fsize = max(min_cjk_font_size, round(b.font_size * font_scale, 1))
        c.setFont(font_name, fsize)
        lines = _wrap_text(b.translated, font_name, fsize, right_width, c)
        line_height = fsize * line_ratio
        layout.append({"block": b, "font_size": fsize, "lines": lines, "line_height": line_height})
        sizes_used.append(fsize)

    total = sum(item["line_height"] * len(item["lines"]) for item in layout)
    if len(layout) > 1 and sizes_used:
        avg_size = sum(sizes_used) / len(sizes_used)
        total += (len(layout) - 1) * avg_size * _GAP_RATIO * line_ratio
    return total, layout


def _fit_page_layout(c, page_blocks, font_name, right_width, available_height, min_cjk_font_size):
    """
    核心策略（严格 1 页对 1 页，不跨页）：
      1) 先用舒适行距（1.4x）试排
      2) 放不下就逐档压缩行距，压到 1.05x 下限
      3) 行距压到下限仍放不下，再整体缩小字号（每次 -5%），
         但任何段落的字号都不会低于 min_cjk_font_size
      4) 字号也压缩到极限（原字号 50%）仍放不下，就接受在 min_line_ratio + 字号下限下
         排版（极少数超长译文才会出现，此时右侧可能贴底，但不会转下一页、不会截断内容）
    """
    if not page_blocks:
        return 1.0, _COMFORTABLE_LINE_RATIO, []

    # 第一步：只压行距
    for line_ratio in [_COMFORTABLE_LINE_RATIO, 1.3, 1.2, 1.1, _MIN_LINE_RATIO]:
        total, layout = _measure_layout(c, page_blocks, font_name, right_width, 1.0, line_ratio, min_cjk_font_size)
        if total <= available_height:
            return 1.0, line_ratio, layout

    # 第二步：行距已是下限，开始整体缩字号
    font_scale = 1.0
    best = (font_scale, _MIN_LINE_RATIO, layout)  # 兜底用最后一次结果
    while font_scale > _FONT_SCALE_FLOOR:
        font_scale = round(font_scale - _FONT_SCALE_STEP, 2)
        total, layout = _measure_layout(
            c, page_blocks, font_name, right_width, font_scale, _MIN_LINE_RATIO, min_cjk_font_size
        )
        best = (font_scale, _MIN_LINE_RATIO, layout)
        if total <= available_height:
            return best
        # 所有段落都已压到字号下限，再缩也没用，提前退出
        if all(abs(item["font_size"] - min_cjk_font_size) < 0.01 for item in layout):
            break

    return best  # 极端情况下的兜底排版，允许贴近/略超页面底部，但内容完整、不转页


def build_bilingual_pdf(
    pdf_path: str,
    output_path: str,
    translate_fn: Callable[[str], str] = translate_via_ollama,
    cjk_font_path: str = None,
    min_cjk_font_size: float = 8.0,   # <- 对应插件里“最小中文字号”配置项，从用户设置传入
) -> List[dict]:
    """生成左右对照双语 PDF：左半页 = 原页面截图，右半页 = 译文（字号/颜色跟随原文，溢出压缩不跨页）。

    :param pdf_path:          输入 PDF 路径
    :param output_path:       输出 PDF 路径
    :param translate_fn:      翻译函数 (text: str) -> str，默认走 Ollama
    :param cjk_font_path:     可选的中文字体 ttf/otf 路径；不传用 ReportLab 内置 CID STSong-Light
    :param min_cjk_font_size: 最小中文字号下限（pt），低于此值不再压缩字号
    :return: 结构化翻译结果 [{page_index, paragraphs:[{orig, translated, ok}]}]，供前端实时展示
    """
    blocks = extract_page_blocks(pdf_path)
    translate_blocks(blocks, translate_fn)
    images, page_sizes = render_page_images(pdf_path)

    if cjk_font_path:
        pdfmetrics.registerFont(TTFont("CJK", cjk_font_path))
        font_name = "CJK"
    else:
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
        font_name = "STSong-Light"

    doc = fitz.open(pdf_path)
    page_w, page_h = landscape(A4)
    top_margin, bottom_margin = 24, 24

    c = canvas.Canvas(output_path, pagesize=(page_w, page_h))

    for page_index in range(len(doc)):
        orig_w, orig_h = page_sizes[page_index]
        img = ImageReader(io.BytesIO(images[page_index]))

        # 左半：原文截图，等比缩放贴到左半页
        half_w = page_w / 2
        scale = min(half_w / orig_w, page_h / orig_h)
        img_w, img_h = orig_w * scale, orig_h * scale
        c.drawImage(img, 0, page_h - img_h, width=img_w, height=img_h)

        # 右半：译文，字号/颜色跟随原文，放不下先压行距、再压字号（不跨页）
        right_x = half_w + 20
        right_width = half_w - 40
        available_height = page_h - top_margin - bottom_margin

        page_blocks = [b for b in blocks if b.page_index == page_index]
        # 按原文纵向顺序排（阅读顺序），避免 PDF 内部分栏导致顺序错乱
        page_blocks.sort(key=lambda b: b.bbox[1])

        font_scale, line_ratio, layout = _fit_page_layout(
            c, page_blocks, font_name, right_width, available_height, min_cjk_font_size
        )

        y_cursor = page_h - top_margin
        sizes_used = [item["font_size"] for item in layout] or [min_cjk_font_size]
        avg_size = sum(sizes_used) / len(sizes_used)
        gap = avg_size * _GAP_RATIO * line_ratio

        for item in layout:
            b = item["block"]
            c.setFont(font_name, item["font_size"])
            c.setFillColorRGB(*b.color)  # 颜色跟随原文
            for line in item["lines"]:
                y_cursor -= item["line_height"]
                c.drawString(right_x, y_cursor, line)
            y_cursor -= gap

        c.setFillColorRGB(0, 0, 0)
        c.showPage()

    c.save()
    doc.close()

    # 结构化结果：每页的原文/译文对照，供前端右侧实时展示（不依赖下载的 PDF）
    total_pages = len(page_sizes)
    result: List[dict] = []
    for pi in range(total_pages):
        page_blocks = sorted([b for b in blocks if b.page_index == pi], key=lambda b: b.bbox[1])
        result.append({
            "page_index": pi + 1,
            "paragraphs": [
                {"orig": b.text, "translated": b.translated, "ok": bool(b.translated) and b.translated != b.text}
                for b in page_blocks
            ],
        })
    return result


if __name__ == "__main__":
    import sys

    def mock_translate(text: str) -> str:
        # 离线演示用：真实场景替换成 translate_via_ollama 或你自己的 pipeline
        return "这是一段用于演示排版压缩效果的中文译文，" * max(1, len(text) // 80)

    src = sys.argv[1] if len(sys.argv) > 1 else "sample_en.pdf"
    out = sys.argv[2] if len(sys.argv) > 2 else "sample_bilingual.pdf"
    min_size = float(sys.argv[3]) if len(sys.argv) > 3 else 8.0
    result = build_bilingual_pdf(src, out, translate_fn=mock_translate, min_cjk_font_size=min_size)
    print(f"生成完成: {out}（{len(result)} 页）")
