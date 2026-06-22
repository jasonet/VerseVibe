#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: 未找到 pnpm，请先安装 pnpm。" >&2
  exit 1
fi

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "==> 检测到未安装依赖，先执行 pnpm install"
  pnpm install
fi

echo "==> 启动 VerseVibe Chrome 调试模式"
echo "==> WXT 会监听变更并输出调试构建"
echo "==> 如需在 Chrome 中调试，请加载 .output/chrome-mv3 或 WXT 当前提示的开发目录"

exec pnpm run dev
