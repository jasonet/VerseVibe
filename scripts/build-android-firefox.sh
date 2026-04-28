#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> 安装依赖（如果已安装会跳过）"
pnpm install

echo "==> 构建 Firefox 版本扩展（桌面 + Android 通用）"
pnpm build:firefox

echo "==> 生成 Firefox 安装包（ZIP/XPI）"
pnpm zip:firefox

echo
echo "构建完成，安装包位于 dist/ 目录。"
echo "请在终端上方 wxt 输出中查看具体 ZIP/XPI 文件名（通常包含 firefox 标记和版本号）。"
echo "该安装包可上传到 Firefox 附加组件商店，也可用于 Android 设备上的临时加载调试。"

