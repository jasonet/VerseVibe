#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> 安装依赖（如果已安装会跳过）"
pnpm install

echo "==> 使用 WXT 构建 Chrome MV3 扩展"
pnpm build

SRC_DIR="dist/chrome-mv3"
if [ ! -d "$SRC_DIR" ]; then
  if [ -d ".output/chrome-mv3" ]; then
    SRC_DIR=".output/chrome-mv3"
  else
    echo "ERROR: 未找到 chrome-mv3 构建目录（dist/chrome-mv3 或 .output/chrome-mv3）" >&2
    exit 1
  fi
fi

APP_NAME="FluentRead"
PROJECT_DIR="$ROOT_DIR/safari"

mkdir -p "$PROJECT_DIR"

echo "==> 运行 Safari Web Extension Converter"
echo "    源目录: $SRC_DIR"
echo "    工程目录: $PROJECT_DIR"

xcrun safari-web-extension-converter "$SRC_DIR" \
  --app-name "$APP_NAME" \
  --bundle-identifier "com.fluentread.extension" \
  --macos-only \
  --project-location "$PROJECT_DIR" \
  --no-open

echo
echo "转换完成。核心结果："
echo "  Xcode 工程: $PROJECT_DIR/$APP_NAME/$APP_NAME.xcodeproj"
echo "  构建后 macOS 应用 (Release): $PROJECT_DIR/$APP_NAME/build/Release/$APP_NAME.app"
echo
echo "下一步："
echo "  1. 打开上述 Xcode 工程"
echo "  2. 在 Xcode 中选择 Scheme = $APP_NAME，目标 = My Mac"
echo "  3. 使用 Release 配置构建并运行，即可在本机安装 Safari 扩展"

