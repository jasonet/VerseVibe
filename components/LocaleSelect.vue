<template>
  <el-select
    :model-value="langPref"
    @update:model-value="setLangPref"
    :size="size"
    class="locale-select"
    popper-class="locale-dropdown-popper"
    :title="selectTooltip"
  >
    <template #prefix>
      <span class="locale-current-tag">{{ currentStatusText }}</span>
    </template>
    <el-option
      v-for="item in options.languages"
      :key="item.value"
      :label="item.label"
      :value="item.value"
    >
      <div class="locale-option-row">
        <span>{{ item.label }}</span>
        <span class="locale-option-tag">{{ getTag(item.value) }}</span>
      </div>
    </el-option>
  </el-select>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { options } from '@/entrypoints/utils/option';
import { langPref, setLangPref, locale, t } from '@/entrypoints/utils/i18n';

withDefaults(defineProps<{ size?: 'large' | 'default' | 'small' }>(), { size: 'default' });

/**
 * 语言选择下拉框当前语言状态显示：
 * 中文环境：显示单中文字「中」（繁体显示「繁」）
 * 英文环境：显示「En」
 * 日文环境：显示「日」
 * 自动/跟随浏览器：根据当前实际生效的 locale 解析显示对应的语言代码
 */
const currentStatusText = computed(() => {
  const active = langPref.value === 'auto' ? locale.value : langPref.value;
  switch (active) {
    case 'en':
      return 'En';
    case 'ja':
      return '日';
    case 'zh-Hant':
      return '繁';
    case 'zh-Hans':
    default:
      return '中';
  }
});

const selectTooltip = computed(() => {
  const cur = currentStatusText.value;
  if (langPref.value === 'auto') {
    return `${t('locale.label')}: ${t('locale.auto')} (${cur})`;
  }
  return `${t('locale.label')}: ${cur}`;
});

function getTag(val: string): string {
  switch (val) {
    case 'auto':
      return 'Auto';
    case 'en':
      return 'En';
    case 'ja':
      return '日';
    case 'zh-Hant':
      return '繁';
    case 'zh-Hans':
    default:
      return '中';
  }
}
</script>

<style scoped>
.locale-select {
  vertical-align: middle;
}

.locale-current-tag {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.locale-option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

.locale-option-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 1px 5px;
  border-radius: 3px;
  line-height: 1.2;
}
</style>
