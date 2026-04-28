## Safari 版 FluentRead 打包说明

> 逻辑完全复用现有 Chrome / Edge 扩展，仅增加 Safari 的外层打包与工程，不改动核心业务代码。

本说明基于 **Safari Web Extension** 机制：先用 WXT 构建出标准 WebExtension（MV3），再用 Xcode 的 `safari-web-extension-converter` 生成 Safari App + 扩展工程。

---

## 一、环境要求

- **操作系统**：macOS 12+（建议 14+）
- **浏览器**：Safari 16+（建议 17+）
- **工具链**：
  - Xcode 14+（建议 15+），已安装命令行工具
  - `xcrun safari-web-extension-converter` 可用
  - Node.js / pnpm（项目本身已经在使用）

---

## 二、构建原始 WebExtension 包（Chrome MV3）

在项目根目录执行：

```bash
pnpm install
pnpm build
```

构建完成后，WXT 会在 `outDir` 中生成浏览器扩展：

- 默认配置下（当前 `wxt.config.ts`）：  
  - **主输出目录**：`dist/`
  - **Chrome MV3 扩展目录**：`dist/chrome-mv3`
- 如果你曾使用过默认配置，也可能存在历史目录：`.output/chrome-mv3`

> 后续 Safari 转换命令会以 `dist/chrome-mv3` 为主，如果不存在则回退到 `.output/chrome-mv3`。

---

## 三、使用 Xcode 转换为 Safari 扩展

仍然在项目根目录（`FluentRead`）下执行：

```bash
mkdir -p safari

xcrun safari-web-extension-converter dist/chrome-mv3 \
  --app-name "FluentRead" \
  --bundle-identifier "com.fluentread.extension" \
  --macos-only \
  --project-location safari \
  --no-open
```

说明：

- `dist/chrome-mv3`：WXT 构建出的 Chrome MV3 扩展目录
- `--app-name "FluentRead"`：生成的 macOS App 名称（也是 Xcode 工程名）
- `--bundle-identifier "com.fluentread.extension"`：应用的 Bundle ID，可根据你自己的团队 ID 调整
- `--project-location safari`：Xcode 工程会生成在仓库内的 `safari/` 目录下
- `--macos-only`：仅生成 macOS 版本（不生成 iOS/iPadOS）
- `--no-open`：命令执行完后不自动打开 Xcode

执行成功后，将得到：

- **Xcode 工程路径**：`safari/FluentRead/FluentRead.xcodeproj`
- **工程目录根**：`safari/FluentRead/`

---

## 四、在 Xcode 中构建并安装 Safari 扩展

1. 双击打开工程：`safari/FluentRead/FluentRead.xcodeproj`
2. 在 Xcode 顶部选择 Scheme：`FluentRead`
3. 目标设备选择：`My Mac`（或类似的本机目标）
4. 构建并运行：`Product > Run`（或快捷键 ⌘R）
5. 首次运行时，macOS 会启动一个带图标的 `FluentRead` 应用，并提示你在 Safari 中启用扩展：
   - 打开 Safari → `偏好设置` / `设置` → `扩展`
   - 找到 `FluentRead`，勾选启用

> 这一流程只是在你的开发机上“安装调试版”，逻辑仍然完全来自原来的 WebExtension 代码。

---

## 五、安装包与发布包所在位置

### 1. 开发/本地安装使用的应用包

在 Xcode 中使用 **Release** 配置构建后（`Product > Build`，Scheme 仍为 `FluentRead`，Build Configuration 选 `Release`）：

- **macOS 应用（包含 Safari 扩展）路径**：

```text
FluentRead/misc/../safari/FluentRead/build/Release/FluentRead.app
```

以仓库根目录为参考，更直观地看是：

- `safari/FluentRead/build/Release/FluentRead.app`

这个 `.app` 就是可以在本机安装、调试的 **安装包**（本质是一个承载 Safari 扩展的容器应用）。

### 2. 用于上架 App Store 的发布包

1. 在 Xcode 中选择 `Product > Archive`
2. 构建完成后会打开 Organizer 窗口，里面可以：
   - 上传到 App Store Connect
   - 或导出 `.pkg` / `.ipa` 等发布用安装包

**归档文件（`.xcarchive`）的默认存放路径** 为：

```text
~/Library/Developer/Xcode/Archives/<日期>/FluentRead <时间>.xcarchive
```

> 真正用于提交审核 / 分发的安装包，是通过 Xcode Organizer 从该 `.xcarchive` 内导出的；这一步需要你在本机进行签名和账号操作，仓库中不会直接包含。

---

## 六、快速脚本（可选）

仓库中提供了一个简化命令流程的脚本：

```bash
bash scripts/build-safari.sh
```

它会自动完成：

1. 安装依赖并构建 WebExtension（`pnpm install && pnpm build`）
2. 选择 `dist/chrome-mv3`（若不存在则回退 `.output/chrome-mv3`）
3. 运行 `safari-web-extension-converter`，在 `safari/` 目录下生成 Xcode 工程

> 你只需要在脚本执行完成后，用 Xcode 打开 `safari/FluentRead/FluentRead.xcodeproj`，按上文说明构建即可。

