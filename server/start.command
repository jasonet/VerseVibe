#!/bin/bash
# VerseVibe PDF 沉浸式翻译本地服务 —— 一键启动（macOS 双击即可）
#
# 自动探测可用的 Python 3（优先 ServBay 自带，因其 libexpat 正常），
# 装依赖（首次），然后在 http://127.0.0.1:8765 启动 Flask 服务。
#
# 启动后会一直驻留；关闭这个终端窗口或按 Ctrl+C 即停止。

set -e
cd "$(dirname "$0")"

echo "════════════════════════════════════════════"
echo "  VerseVibe PDF 翻译服务启动器"
echo "════════════════════════════════════════════"

# 1) 探测可用的 python3（需 expat 正常，否则 reportlab/flask 装不上）
pick_python() {
    # 优先 ServBay 自带（libexpat 与 Python 匹配，不踩系统库冲突）
    for cand in \
        "/Applications/ServBay/package/python/3.13/current/bin/python3" \
        "/Applications/ServBay/package/python/3.13/3.13.11/bin/python3.13" \
        /Applications/ServBay/package/python/*/3.*/bin/python3.* ; do
        if [ -x "$cand" ] && "$cand" -c "from xml.parsers import expat" 2>/dev/null; then
            echo "$cand"
            return 0
        fi
    done
    # 退回系统 python3（多数环境可用；ServBay 环境下可能 expat 冲突）
    if command -v python3 >/dev/null 2>&1 && python3 -c "from xml.parsers import expat" 2>/dev/null; then
        echo python3
        return 0
    fi
    return 1
}

PY="$(pick_python || true)"
if [ -z "$PY" ]; then
    echo "✗ 未找到可用的 Python 3（需 expat 正常）。"
    echo "  若用 ServBay：确认已安装其 Python 包；否则装一个 Homebrew python@3.12。"
    read -p "按回车关闭…" _
    exit 1
fi
echo "✓ 使用 Python: $PY"
"$PY" --version

# 2) 装依赖（只在缺失时装）
echo "── 检查依赖 ──"
if ! "$PY" -c "import fitz, reportlab, flask, flask_cors, requests" 2>/dev/null; then
    echo "首次运行，安装依赖（requirements.txt）…"
    "$PY" -m pip install -r requirements.txt
else
    echo "✓ 依赖已就绪"
fi

# 3) 启动
PORT="${VV_PDF_PORT:-8765}"
echo "── 启动服务 ──"
echo "地址: http://127.0.0.1:$PORT  （插件默认连这个地址）"
echo "关闭此窗口或 Ctrl+C 停止。"
echo
exec "$PY" server.py
