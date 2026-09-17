#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> [1/4] 使用 WXT 构建 Safari (MV3) WebExtension"
./node_modules/.bin/wxt build -b safari --mv3

# 版本号统一从 package.json 读取，保证与 Chrome / Firefox 包完全同步
VERSION="$(node -p "require('./package.json').version")"
export VERSION

SRC_DIR="$ROOT_DIR/dist/safari-mv3"
OUT_DIR="$ROOT_DIR/dist/VerseVibe-Safari"
APP_DIR="$OUT_DIR/VerseVibe.app"
ZIP_PATH="$ROOT_DIR/dist/versevibe-${VERSION}-safari.zip"

echo "==> [2/4] 构建 macOS Safari App 容器与 Extension 扩展包"
python3 - << 'EOF'
import os, sys, shutil, subprocess
from PIL import Image

ROOT = os.getcwd()
DIST = os.path.join(ROOT, "dist")
SRC_DIR = os.path.join(DIST, "safari-mv3")
OUT_DIR = os.path.join(DIST, "VerseVibe-Safari")
APP_DIR = os.path.join(OUT_DIR, "VerseVibe.app")
PLUGINS_DIR = os.path.join(APP_DIR, "Contents", "PlugIns")
APPEX_DIR = os.path.join(PLUGINS_DIR, "VerseVibe Extension.appex")

VERSION = os.environ["VERSION"]

# Bundle ID 必须与 safari/VerseVibe/VerseVibe.xcodeproj 中的 PRODUCT_BUNDLE_IDENTIFIER
# 完全一致，否则 Safari / PlugInKit 会把两条构建路径当成两个独立的扩展入口。
APP_BUNDLE_ID = "com.versevibe.VerseVibe"
APPEX_BUNDLE_ID = "com.versevibe.VerseVibe.Extension"  # 必须以父 App 的 Bundle ID 为前缀

if os.path.exists(OUT_DIR):
    shutil.rmtree(OUT_DIR)

os.makedirs(os.path.join(APP_DIR, "Contents", "MacOS"), exist_ok=True)
os.makedirs(os.path.join(APP_DIR, "Contents", "Resources"), exist_ok=True)
os.makedirs(os.path.join(APPEX_DIR, "Contents", "MacOS"), exist_ok=True)
os.makedirs(os.path.join(APPEX_DIR, "Contents", "Resources"), exist_ok=True)

# 1. 图标生成
icon_src = os.path.join(ROOT, "public", "icon", "tree-512.png")
icon_dst = os.path.join(APP_DIR, "Contents", "Resources", "AppIcon.icns")
img = Image.open(icon_src)
img.save(icon_dst, format="ICNS")

# 2. 编译主 App 宿主
main_m = """#import <Cocoa/Cocoa.h>
#import <SafariServices/SafariServices.h>

@interface AppDelegate : NSObject <NSApplicationDelegate>
@property (strong) NSWindow *window;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
    NSRect frame = NSMakeRect(0, 0, 480, 320);
    self.window = [[NSWindow alloc] initWithContentRect:frame
                                              styleMask:(NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable)
                                                backing:NSBackingStoreBuffered
                                                  defer:NO];
    [self.window setTitle:@"VerseVibe for Safari"];
    [self.window center];

    NSVisualEffectView *effectView = [[NSVisualEffectView alloc] initWithFrame:frame];
    effectView.material = NSVisualEffectMaterialUnderWindowBackground;
    effectView.blendingMode = NSVisualEffectBlendingModeBehindWindow;
    effectView.state = NSVisualEffectStateActive;
    [self.window setContentView:effectView];

    NSImageView *iconView = [[NSImageView alloc] initWithFrame:NSMakeRect(208, 210, 64, 64)];
    iconView.image = [NSApp applicationIconImage];
    [effectView addSubview:iconView];

    NSTextField *titleLabel = [[NSTextField alloc] initWithFrame:NSMakeRect(20, 165, 440, 32)];
    titleLabel.stringValue = @"VerseVibe · Safari 扩展";
    titleLabel.alignment = NSTextAlignmentCenter;
    titleLabel.font = [NSFont boldSystemFontOfSize:18];
    titleLabel.editable = NO;
    titleLabel.selectable = NO;
    titleLabel.bordered = NO;
    titleLabel.backgroundColor = [NSColor clearColor];
    [effectView addSubview:titleLabel];

    NSTextField *descLabel = [[NSTextField alloc] initWithFrame:NSMakeRect(30, 95, 420, 60)];
    descLabel.stringValue = @"网页内容自然共振，创造力来自生命树的灵性。\\n\\n扩展已包含网页沉浸式双语翻译与动态新标签页。\\n请在 Safari 菜单中打开「设置」→「扩展」，勾选启用 VerseVibe。";
    descLabel.alignment = NSTextAlignmentCenter;
    descLabel.font = [NSFont systemFontOfSize:13];
    descLabel.textColor = [NSColor secondaryLabelColor];
    descLabel.editable = NO;
    descLabel.selectable = NO;
    descLabel.bordered = NO;
    descLabel.backgroundColor = [NSColor clearColor];
    [effectView addSubview:descLabel];

    NSButton *openPrefsBtn = [[NSButton alloc] initWithFrame:NSMakeRect(140, 40, 200, 36)];
    openPrefsBtn.title = @"打开 Safari 扩展设置";
    openPrefsBtn.bezelStyle = NSBezelStyleRounded;
    openPrefsBtn.target = self;
    openPrefsBtn.action = @selector(openSafariExtensionPreferences:);
    openPrefsBtn.keyEquivalent = @"\\r";
    [effectView addSubview:openPrefsBtn];

    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
}

- (void)openSafariExtensionPreferences:(id)sender {
    [SFSafariApplication showPreferencesForExtensionWithIdentifier:@"__APPEX_BUNDLE_ID__" completionHandler:^(NSError * _Nullable error) {
        if (error) {
            NSLog(@"Failed to open Safari extension preferences: %@", error);
        }
    }];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        app.delegate = delegate;
        [app run];
    }
    return 0;
}
"""
main_m = main_m.replace("__APPEX_BUNDLE_ID__", APPEX_BUNDLE_ID)

main_src = os.path.join(OUT_DIR, "main.m")
with open(main_src, "w") as f:
    f.write(main_m)

app_bin = os.path.join(APP_DIR, "Contents", "MacOS", "VerseVibe")
subprocess.run(["clang", "-framework", "Cocoa", "-framework", "SafariServices", main_src, "-o", app_bin], check=True)
os.remove(main_src)

# 3. 编译 Extension Handler
handler_m = """#import <Foundation/Foundation.h>
#import <SafariServices/SafariServices.h>

@interface SafariWebExtensionHandler : NSObject <NSExtensionRequestHandling>
@end

@implementation SafariWebExtensionHandler

- (void)beginRequestWithExtensionContext:(NSExtensionContext *)context {
    NSExtensionItem *response = [[NSExtensionItem alloc] init];
    response.userInfo = @{ SFExtensionMessageKey: @{ @"status": @"ok" } };
    [context completeRequestReturningItems:@[response] completionHandler:nil];
}

@end
"""
handler_src = os.path.join(OUT_DIR, "handler.m")
with open(handler_src, "w") as f:
    f.write(handler_m)

appex_bin = os.path.join(APPEX_DIR, "Contents", "MacOS", "VerseVibe Extension")
subprocess.run(["clang", "-bundle", "-framework", "Foundation", "-framework", "SafariServices", handler_src, "-o", appex_bin], check=True)
os.remove(handler_src)

# 4. Plist 元数据
app_plist = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>zh_CN</string>
    <key>CFBundleExecutable</key>
    <string>VerseVibe</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>__APP_BUNDLE_ID__</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>VerseVibe</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>__VERSION__</string>
    <key>CFBundleVersion</key>
    <string>__VERSION__</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
"""
app_plist = app_plist.replace("__APP_BUNDLE_ID__", APP_BUNDLE_ID).replace("__VERSION__", VERSION)

with open(os.path.join(APP_DIR, "Contents", "Info.plist"), "w") as f:
    f.write(app_plist)
with open(os.path.join(APP_DIR, "Contents", "PkgInfo"), "w") as f:
    f.write("APPL????")

appex_plist = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>zh_CN</string>
    <key>CFBundleDisplayName</key>
    <string>VerseVibe Extension</string>
    <key>CFBundleExecutable</key>
    <string>VerseVibe Extension</string>
    <key>CFBundleIdentifier</key>
    <string>__APPEX_BUNDLE_ID__</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>VerseVibe Extension</string>
    <key>CFBundlePackageType</key>
    <string>XPC!</string>
    <key>CFBundleShortVersionString</key>
    <string>__VERSION__</string>
    <key>CFBundleVersion</key>
    <string>__VERSION__</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.Safari.web-extension</string>
        <key>NSExtensionPrincipalClass</key>
        <string>SafariWebExtensionHandler</string>
    </dict>
</dict>
</plist>
"""
appex_plist = appex_plist.replace("__APPEX_BUNDLE_ID__", APPEX_BUNDLE_ID).replace("__VERSION__", VERSION)

with open(os.path.join(APPEX_DIR, "Contents", "Info.plist"), "w") as f:
    f.write(appex_plist)
with open(os.path.join(APPEX_DIR, "Contents", "PkgInfo"), "w") as f:
    f.write("XPC!????")

# 5. 复制扩展静态资源
appex_res = os.path.join(APPEX_DIR, "Contents", "Resources")
for item in os.listdir(SRC_DIR):
    s = os.path.join(SRC_DIR, item)
    d = os.path.join(appex_res, item)
    if os.path.isdir(s):
        shutil.copytree(s, d)
    else:
        shutil.copy2(s, d)

# 6. 本地自签名
subprocess.run(["codesign", "-s", "-", "--force", "--deep", APP_DIR], check=True)

# 7. 打包独立 zip
zip_path = os.path.join(DIST, f"versevibe-{VERSION}-safari.zip")
if os.path.exists(zip_path):
    os.remove(zip_path)
subprocess.run(["ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", APP_DIR, zip_path], check=True)
EOF

echo "==> [3/4] 验证代码签名..."
codesign -vvv --deep "$APP_DIR"

echo
echo "=================================================="
echo "==> [4/4] Safari 应用与扩展包打包完成！"
echo "  macOS App 产物: $APP_DIR"
echo "  Zip 发布包:     $ZIP_PATH"
echo "=================================================="
