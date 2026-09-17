<template>
  <div>
    <el-container>
      <el-header class="custom-padding">
        <Header>
          <template #right>
            <div class="header-actions">
              <LocaleSelect size="small" class="header-locale" />
              <el-tooltip :content="t('app.openPdfReader')" placement="left">
                <el-button link type="primary" class="reload-btn" @click="openPdfReader" :aria-label="t('app.ariaOpenPdf')">
                  <el-icon :size="20"><Document /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip :content="t('app.reloadExtension')" placement="left">
                <el-button link type="primary" class="reload-btn" @click="reloadExtension" :aria-label="t('app.reloadExtension')">
                  <el-icon :size="20"><Refresh /></el-icon>
                </el-button>
              </el-tooltip>
              <el-button link type="primary" class="fullpage-settings-btn" @click="openFullPageSettings" :aria-label="t('app.ariaFullPageSettings')">
                <el-icon :size="20"><Setting /></el-icon>
                <span class="fullpage-settings-label">{{ t('app.fullPageSettings') }}</span>
              </el-button>
            </div>
          </template>
        </Header>
      </el-header>
      <el-main class="custom-padding" style="min-height: 320px">
        <Main/>
      </el-main>
      <el-footer class="custom-padding">
        <Footer/>
      </el-footer>
    </el-container>
  </div>
</template>

<script lang="ts" setup>
import Header from '../../components/Header.vue';
import Main from "../../components/Main.vue";
import Footer from "../../components/Footer.vue";
import { Refresh, Setting, Document } from '@element-plus/icons-vue';
import browser from 'webextension-polyfill';
import '../../styles/theme.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import { t } from '../utils/i18n';
import LocaleSelect from '../../components/LocaleSelect.vue';

async function openPdfReader() {
  // 若当前标签是 PDF，带入其 URL；否则进入本地文件模式
  let pdfUrl: string | undefined;
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const u = tab?.url || '';
    if (/\.pdf(\?.*)?$/i.test(u) || /pdf/i.test((tab as any)?.contentType || '')) {
      pdfUrl = u;
    }
  } catch { /* 忽略，进入本地模式 */ }
  try {
    await browser.runtime.sendMessage({ type: 'openPdfReader', url: pdfUrl, local: !pdfUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (message.toLowerCase().includes('context invalidated')) {
      console.warn('[VerseVibe] 扩展上下文已失效，无法打开 PDF 阅读器');
      return;
    }
    console.warn('[VerseVibe] 打开 PDF 阅读器失败:', message);
  }
}

function openFullPageSettings() {
  browser.runtime.sendMessage({ type: 'openOptionsPage' }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (message.toLowerCase().includes('context invalidated')) {
      console.warn('[VerseVibe] Popup: 扩展上下文已失效，无法打开设置页');
      return;
    }
    console.warn('[VerseVibe] Popup: 打开设置页失败:', message);
  });
}

function reloadExtension() {
  try {
    browser.runtime.reload();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    console.warn('[VerseVibe] Popup: 重载插件失败:', message);
  }
}
</script>

<style scoped>
@media screen and (max-height: 800px) {
  .popup-container {
    max-height: 90vh;
  }
}

@media screen and (max-width: 480px) {
  .popup-container {
    width: 95vw;
  }
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 3px;
}

::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 3px;
}

.el-main {
  min-height: 460px;
  height: auto;
}

.custom-padding {
  padding: 12px 16px;
}

.fullpage-settings-btn {
  padding: 4px 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.reload-btn {
  padding: 4px 6px;
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.header-locale {
  width: 52px !important;
  min-width: 52px !important;
  max-width: 56px !important;
  flex-shrink: 0 !important;
}

.header-locale :deep(.el-select__wrapper) {
  padding: 1px 5px !important;
  height: 24px !important;
  min-height: 24px !important;
  border-radius: 4px !important;
}

.header-locale :deep(.el-select__prefix) {
  margin-right: 0 !important;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-locale :deep(.el-select__selected-item),
.header-locale :deep(.el-select__placeholder) {
  display: none !important;
}

.header-locale :deep(.el-select__suffix) {
  margin-left: 2px !important;
}

.header-locale :deep(.el-select__caret) {
  font-size: 11px !important;
}

.fullpage-settings-label {
  font-size: 11px;
}
</style>
