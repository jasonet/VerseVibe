<template>
  <div class="footer-container footer-size">
    <p class="translation-count">你已经翻译
      <el-text class="count-number" type="primary">{{ countMachine }}</el-text>
      <span class="count-sep">/</span>
      <el-text class="count-number ai" type="primary">{{ countAI }}</el-text>
      <span class="count-sep">/</span>
      <el-text class="count-number chrome" type="primary">{{ countChrome }}</el-text>
      词条
    </p>
    <p class="count-legend">API在线翻译 / AI翻译 / Chrome本地（按词条计，每段文本算 1 条）</p>
    <div class="footer-links">
      <el-link class="action-link left" :class="{ 'failed': buttonText === '清除失败', 'success': buttonText === '清除成功' }" @click="clearCache"
        :disabled="buttonDisabled">
        <el-icon v-if="showLoading">
          <Loading class="el-icon-loading" />
        </el-icon>
        {{ buttonText }}
      </el-link>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';
import { Star, Loading, Coffee } from "@element-plus/icons-vue";
import { Config } from "../entrypoints/utils/model";
import { storage } from '@wxt-dev/storage';
import browser from 'webextension-polyfill';

// 实际上是 el-link 而不是 el-button
const buttonDisabled = ref(false);
const buttonText = ref('清除翻译缓存');

const showLoading = ref(false);
async function clearCache() {
  try {
    buttonDisabled.value = true;
    buttonText.value = "正在清除...";
    showLoading.value = true;

    // 获取当前标签页
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      throw new Error('No active tab found');
    }

    // 发送消息到 content.js
    await browser.tabs.sendMessage(tabs[0].id, { message: 'clearCache' });

    // 显示成功状态
    buttonText.value = "清除成功";

    // 恢复按钮状态
    setTimeout(() => {
      buttonDisabled.value = false;
      buttonText.value = '清除翻译缓存';
      showLoading.value = false;
    }, 1500);

  } catch (error) {
    console.error('清除缓存失败:', error);
    buttonText.value = "清除失败";

    // 恢复按钮状态
    setTimeout(() => {
      buttonDisabled.value = false;
      buttonText.value = '清除翻译缓存';
      showLoading.value = false;
    }, 1500);
  }
}

// 获取配置,用于显示翻译次数
// 这里采用「快照」模式: 仅在设置页打开时读取一次,避免在使用过程中
// 后台频繁更新 count 导致 settings.html 中“翻译次数”数字来回跳动。
let localConfig = reactive(new Config());

storage.getItem('local:config').then((value) => {
  if (typeof value === 'string' && value) {
    try {
      Object.assign(localConfig, JSON.parse(value));
    } catch (e) {
      console.error('Failed to parse local:config for Footer:', e);
    }
  }
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.toLowerCase().includes('context invalidated')) {
    console.warn('[VerseVibe] Footer: 扩展上下文已失效，跳过读取配置');
    return;
  }
  console.warn('[VerseVibe] Footer: 读取配置失败:', message);
});

// 三模块分项统计（旧数据无这些字段时按 0 处理，兼容历史安装）
const countMachine = computed(() => localConfig.countMachine ?? 0);
const countAI = computed(() => localConfig.countAI ?? 0);
const countChrome = computed(() => localConfig.countChrome ?? 0);


</script>

<style scoped>
.footer-size {
  font-size: 0.8em;
}

.footer-container {
  margin: -16px;
}

.translation-count {
  margin: 0px;
  font-size: 1.2em;
  color: var(--fr-text-color-regular);
  text-align: center;
}

.count-number {
  font-weight: 600;
  font-size: 1.1em;
  margin: 0 3px;
  color: var(--el-color-success);
}

.count-number.ai {
  color: var(--el-color-primary);
}

.count-number.chrome {
  color: var(--el-color-warning);
}

.count-sep {
  color: var(--fr-text-color-secondary);
  opacity: 0.6;
}

.count-legend {
  margin: 2px 0 0;
  font-size: 0.95em;
  color: var(--fr-text-color-secondary);
  opacity: 0.75;
  text-align: center;
}

.footer-links {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 16px;
}

.right-links {
  display: flex;
  gap: 12px;
}

.action-link {
  font-size: 1.2em;
  transition: all 1s ease;
  text-decoration: none !important;
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-link:hover {
  opacity: 0.8;
}

.action-link:active {
  transform: scale(0.98);
}

.github-icon, .donate-icon {
  font-size: 1.2em;
  margin-right: 2px;
}

.donate-icon {
  color: var(--el-color-warning);
}

:deep(.el-icon-loading) {
  animation: rotating 1s linear infinite;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.clearing {
  color: var(--el-color-success) !important;
}

.failed {
  color: var(--el-color-danger) !important;
}

/* 添加成功状态样式 */
.action-link.success {
  color: var(--el-color-success) !important;
}

/* 赞赏码弹窗样式 */
.donate-dialog :deep(.el-dialog__header) {
  padding-bottom: 10px;
  margin-right: 0;
  text-align: center;
  border-bottom: 1px solid var(--fr-border-color-lighter);
}

.donate-dialog :deep(.el-dialog__headerbtn) {
  top: 15px;
}

.donate-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: -5px;
}

.donate-text {
  text-align: center;
  margin-bottom: 15px;
  color: var(--fr-text-color-primary);
  line-height: 1.5;
}

.qrcode-container {
  width: 200px;
  height: 200px;
  margin: 0 auto 15px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--fr-border-color-light);
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.qrcode-container:hover {
  transform: scale(1.02);
}

.qrcode-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background-color: #fff;
}

.donate-thanks {
  text-align: center;
  margin: 10px 0 15px;
  color: var(--el-color-success);
  font-weight: bold;
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .qrcode-image {
    border: 1px solid var(--fr-border-color);
  }
}
</style>
