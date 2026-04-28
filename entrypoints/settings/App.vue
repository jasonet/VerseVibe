<template>
  <div class="settings-app" :class="{ 'full-layout': fullLayout }">
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
import { ref } from 'vue';
import Header from '../../components/Header.vue';
import Main from '../../components/Main.vue';
import Footer from '../../components/Footer.vue';
import { Refresh, Setting } from '@element-plus/icons-vue';
import '../../styles/theme.css';
import 'element-plus/theme-chalk/base.css';
import 'element-plus/theme-chalk/dark/css-vars.css';

const version = process.env.VUE_APP_VERSION ?? '0.0.0';
const fullLayout = ref(true);

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
