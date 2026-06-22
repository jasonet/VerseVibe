<template>
  <div>
    <el-container>
      <el-header class="custom-padding">
        <Header>
          <template #right>
            <div class="header-actions">
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
import { Refresh, Setting } from '@element-plus/icons-vue';
import browser from 'webextension-polyfill';
import '../../styles/theme.css';
import 'element-plus/theme-chalk/base.css';
import 'element-plus/theme-chalk/dark/css-vars.css';

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
