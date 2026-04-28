#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-full}"
SRC_DIR="dist/chrome-mv3"
KEY_FILE="$ROOT_DIR/key.pem"
VERSION="$(node -p "require('./package.json').version")"
ZIP_FILE="$ROOT_DIR/dist/versevibe-${VERSION}-chrome.zip"
CRX_FILE="$ROOT_DIR/dist/versevibe-${VERSION}.crx"

find_chrome_bin() {
  local candidates=(
    "${CHROME_BIN:-}"
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta"
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
    "/usr/bin/google-chrome"
    "/usr/bin/google-chrome-stable"
    "/usr/bin/chromium"
    "/usr/bin/chromium-browser"
  )

  local bin
  for bin in "${candidates[@]}"; do
    if [ -n "$bin" ] && [ -x "$bin" ]; then
      echo "$bin"
      return 0
    fi
  done

  return 1
}

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "==> 安装依赖（首次执行需要）"
  pnpm install
fi

if [ "$MODE" != "--crx-only" ]; then
  echo "==> 构建 Chrome MV3 扩展"
  pnpm build

  echo "==> 生成未签名分发包（ZIP）"
  pnpm zip
fi

if [ ! -d "$SRC_DIR" ]; then
  echo "ERROR: 未找到构建目录 $SRC_DIR，请先执行 pnpm build" >&2
  exit 1
fi

if [ ! -f "$KEY_FILE" ]; then
  echo "ERROR: 未找到签名私钥 $KEY_FILE，无法生成 .crx" >&2
  exit 1
fi

CHROME_BIN="$(find_chrome_bin || true)"
if [ -z "$CHROME_BIN" ]; then
  echo "ERROR: 未找到可用的 Chrome/Chromium 可执行文件。" >&2
  echo "可以通过环境变量 CHROME_BIN 指定，例如：" >&2
  echo "  CHROME_BIN=/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome pnpm package:chrome" >&2
  exit 1
fi

echo "==> 使用 Chrome 打包 .crx"
echo "    Chrome: $CHROME_BIN"
"$CHROME_BIN" --pack-extension="$SRC_DIR" --pack-extension-key="$KEY_FILE"

DEFAULT_CRX="$ROOT_DIR/dist/chrome-mv3.crx"
if [ ! -f "$DEFAULT_CRX" ]; then
  echo "ERROR: Chrome 未生成预期的 $DEFAULT_CRX" >&2
  exit 1
fi

mv -f "$DEFAULT_CRX" "$CRX_FILE"

echo
echo "构建完成："
if [ -f "$ZIP_FILE" ]; then
  echo "  ZIP: $ZIP_FILE"
fi
echo "  CRX: $CRX_FILE"
echo
echo "说明："
echo "  - ZIP 用于“加载已解压的扩展程序”或上传到商店。"
echo "  - CRX 是签名安装包，但 Chrome 正版通常仍限制本地下载后直接安装。"
echo "  - 若需要普通用户一键安装，推荐发布到 Chrome Web Store。"
