<template>
  <div>
    <el-container>
      <el-header class="custom-padding">
        <Header>
          <template #right>
            <div class="header-actions">
              <el-tooltip content="PDF 沉浸式翻译" placement="left">
                <el-button link type="primary" class="reload-btn" @click="openPdfReader" aria-label="打开 PDF 阅读">
                  <el-icon :size="20"><Document /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="重载插件" placement="left">
                <el-button link type="primary" class="reload-btn" @click="reloadExtension" aria-label="重载插件">
                  <el-icon :size="20"><Refresh /></el-icon>
                </el-button>
              </el-tooltip>
              <el-button link type="primary" class="fullpage-settings-btn" @click="openFullPageSettings" aria-label="新标签页打开设置">
                <el-icon :size="20"><Setting /></el-icon>
                <span class="fullpage-settings-label">全页设置</span>
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
import 'element-plus/theme-chalk/base.css';
import 'element-plus/theme-chalk/dark/css-vars.css';

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

.fullpage-settings-label {
  font-size: 12px;
}
</style>
