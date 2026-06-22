<template>
  <div class="settings-app" :class="{ 'full-layout': fullLayout }">
    <div v-if="updateInfo && updateInfo.updateAvailable" class="update-banner">
      <span class="update-banner-icon">🎉</span>
      <span class="update-banner-text">
        发现新版本 <b>V{{ updateInfo.latestVersion }}</b>（当前 V{{ updateInfo.currentVersion }}）
        <template v-if="updateInfo.notes">— {{ updateInfo.notes }}</template>
      </span>
      <a class="update-banner-btn" :href="updateInfo.zip" download="VerseVibe.zip" target="_blank" rel="noopener">下载升级包</a>
      <el-tooltip content="解压后到 chrome://extensions 重新加载已解压的扩展即可" placement="bottom">
        <span class="update-banner-help">如何升级？</span>
      </el-tooltip>
    </div>
    <template v-if="!fullLayout">
      <el-container class="compact-container">
        <el-header class="custom-padding">
          <Header>
            <template #right>
              <div class="header-actions">
                <el-tooltip content="重载插件" placement="left">
                  <el-button link type="primary" class="reload-btn" @click="reloadExtension" aria-label="重载插件">
                    <el-icon :size="20"><Refresh /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-tooltip content="展开为左右版式全页设置" placement="left">
                  <el-button link type="primary" class="expand-btn" @click="fullLayout = true" aria-label="展开设置">
                    <el-icon :size="22"><Setting /></el-icon>
                  </el-button>
                </el-tooltip>
              </div>
            </template>
          </Header>
        </el-header>
        <el-main class="custom-padding settings-main" style="min-height: 320px">
          <Main />
        </el-main>
        <el-footer class="custom-padding">
          <Footer />
        </el-footer>
      </el-container>
    </template>

    <template v-else>
      <div class="full-page">
        <header class="full-header">
          <h1 class="full-title">VerseVibe <span class="version">V{{ version }}</span></h1>
          <div class="header-actions">
            <el-tooltip content="重载插件" placement="left">
              <el-button link type="primary" class="reload-btn" @click="reloadExtension" aria-label="重载插件">
                <el-icon :size="20"><Refresh /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="收起为紧凑版" placement="left">
              <el-button link type="primary" class="collapse-btn" @click="fullLayout = false" aria-label="收起设置">
                <el-icon :size="22"><Setting /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </header>
        <main class="main-content settings-main">
          <Main section="all" />
          <div class="full-footer-wrap">
            <Footer />
          </div>
        </main>
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import Header from '../../components/Header.vue';
import Main from '../../components/Main.vue';
import Footer from '../../components/Footer.vue';
import { Refresh, Setting } from '@element-plus/icons-vue';
import { storage } from '@wxt-dev/storage';
import { UPDATE_INFO_KEY, type UpdateInfo } from '../utils/updateCheck';
import '../../styles/theme.css';
import 'element-plus/theme-chalk/base.css';
import 'element-plus/theme-chalk/dark/css-vars.css';

const version = process.env.VUE_APP_VERSION ?? '0.0.0';
const fullLayout = ref(true);
const updateInfo = ref<UpdateInfo | null>(null);

onMounted(async () => {
  try {
    updateInfo.value = await storage.getItem<UpdateInfo>(UPDATE_INFO_KEY);
  } catch (error) {
    console.warn('[VerseVibe] 读取更新信息失败:', error);
  }
  // 监听后台检查结果的变化，实时更新横幅
  try {
    storage.watch<UpdateInfo>(UPDATE_INFO_KEY, (next) => {
      updateInfo.value = next ?? null;
    });
  } catch {
    // ignore
  }
  // 打开设置页时主动触发一次检查（后台返回最新结果）
  try {
    const res: any = await browser.runtime.sendMessage({ type: 'checkUpdateNow' });
    if (res?.info) updateInfo.value = res.info;
  } catch {
    // background 未就绪时忽略，已有 storage 值兜底
  }
});

function reloadExtension() {
  try {
    browser.runtime.reload();
  } catch (error) {
    console.error('[VerseVibe] 扩展重载失败:', error);
  }
}
</script>

<style scoped>
.settings-app {
  min-height: 100vh;
}

.update-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 16px;
  background: linear-gradient(90deg, #fff7ed, #ffedd5);
  border-bottom: 1px solid #fdba74;
  color: #7c2d12;
  font-size: 13px;
}

.update-banner-icon {
  font-size: 16px;
}

.update-banner-text {
  flex: 1 1 auto;
  min-width: 200px;
}

.update-banner-btn {
  flex: 0 0 auto;
  padding: 5px 14px;
  border-radius: 6px;
  background: #ea580c;
  color: #fff !important;
  text-decoration: none;
  font-weight: 600;
}

.update-banner-btn:hover {
  background: #c2410c;
}

.update-banner-help {
  flex: 0 0 auto;
  cursor: help;
  text-decoration: underline dotted;
  opacity: 0.8;
}

:global(html.dark) .update-banner {
  background: linear-gradient(90deg, #2a1a0e, #3a2410);
  border-bottom-color: #9a3412;
  color: #fed7aa;
}

.compact-container {
  min-height: 100vh;
}

.custom-padding {
  padding: 8px 12px;
}

.expand-btn,
.collapse-btn,
.reload-btn {
  padding: 4px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.full-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--fr-bg-color);
}

.full-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--fr-bg-color);
  flex-shrink: 0;
}

.full-title {
  font-size: 1.35em;
  font-weight: 600;
  margin: 0;
  color: var(--fr-text-color-primary);
}

.full-title .version {
  font-size: 0.5em;
  opacity: 0.8;
}

.main-content {
  min-height: calc(100vh - 56px);
  overflow: auto;
  padding: 8px 12px;
  min-width: 0;
}

.full-footer-wrap {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* settings.html 专用：全宽 + 紧凑排版 + 网格密度 */
.settings-main :deep(.margin-left-2em) {
  margin-left: 0.35em !important;
  margin-right: 0.35em !important;
}

.settings-main :deep(.margin-bottom) {
  margin-bottom: 6px !important;
}

.settings-main :deep(.settings-block) {
  padding: 10px !important;
  margin-bottom: 10px !important;
}

.settings-main :deep(.settings-block .section-header) {
  margin-bottom: 8px !important;
  padding-bottom: 6px !important;
}

.settings-main :deep(.group-title) {
  margin-bottom: 6px !important;
}

/* 高级选项双列（仅 settings 页面） */
.settings-main :deep(.main-advanced-body) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.settings-main :deep(.main-advanced-body > .el-row) {
  margin: 0 !important;
}

.settings-main :deep(.main-advanced-body > .el-row:has(textarea)),
.settings-main :deep(.main-advanced-body > .el-row:has(.el-divider)),
.settings-main :deep(.main-advanced-body > .el-row:has(.el-input-number)),
.settings-main :deep(.main-advanced-body > .el-row:has(.el-button)) {
  grid-column: 1 / -1;
}

/* 译文样式：4格一行 */
.settings-main :deep(.style-cards-grid) {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 6px !important;
}

/* 翻译服务：9格一行 */
.settings-main :deep(.service-cards-grid) {
  grid-template-columns: repeat(9, minmax(0, 1fr)) !important;
  gap: 4px !important;
}

.settings-main :deep(.service-card) {
  min-height: 30px !important;
  padding: 4px 3px !important;
}

.settings-main :deep(.service-name) {
  font-size: 12px !important;
}

@media screen and (max-width: 768px) {
  .settings-main :deep(.main-advanced-body) {
    grid-template-columns: 1fr;
  }

  .settings-main :deep(.style-cards-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .settings-main :deep(.service-cards-grid) {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }
}
</style>
