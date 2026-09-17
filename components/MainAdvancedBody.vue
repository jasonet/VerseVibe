<template>
  <div class="main-advanced-body" :class="{ 'compact-main': group === 'main' }">
    <!-- ============ 翻译选项 主组 ============ -->
    <template v-if="group === 'all' || group === 'main'">
    <!-- 界面语言 -->
    <el-row class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('locale.tip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('locale.label') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <LocaleSelect />
      </el-col>
    </el-row>

    <!-- 主题设置 -->
    <el-row class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <span class="popup-text popup-vertical-left">{{ t('adv.theme') }}</span>
      </el-col>
      <el-col :span="12">
        <el-select :model-value="config.theme" @update:model-value="$emit('update:config', { theme: $event })" :placeholder="t('adv.selectTheme')">
          <el-option class="select-left" v-for="item in options.theme" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-col>
    </el-row>

    <!-- 不翻译页头 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.skipHeaderTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.skipHeader') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.skipTranslateHeader" @update:model-value="$emit('update:config', { skipTranslateHeader: $event })" inline-prompt :active-text="t('common.skip')" :inactive-text="t('common.translate')" />
      </el-col>
    </el-row>

    <!-- 不翻译页尾 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.skipFooterTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.skipFooter') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.skipTranslateFooter" @update:model-value="$emit('update:config', { skipTranslateFooter: $event })" inline-prompt :active-text="t('common.skip')" :inactive-text="t('common.translate')" />
      </el-col>
    </el-row>

    <!-- 缓存开关 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.cacheTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.cache') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.useCache" @update:model-value="$emit('update:config', { useCache: $event })" inline-prompt :active-text="t('common.enabled')" :inactive-text="t('common.disabled')"/>
      </el-col>
    </el-row>

    <!-- 悬浮球开关 -->
    <el-row v-if="config.on" class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.floatingBallTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.floatingBall') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="floatingBallEnabled" @update:model-value="$emit('update:floatingBallEnabled', $event)" inline-prompt :active-text="t('common.enabled')" :inactive-text="t('common.disabled')" />
      </el-col>
    </el-row>

    <!-- 翻译进度面板 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.progressPanelTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.progressPanel') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.translationStatus" @update:model-value="$emit('update:config', { translationStatus: $event })" inline-prompt :active-text="t('common.start')" :inactive-text="t('common.disabled')" />
      </el-col>
    </el-row>

    <!-- 禁用动画设置 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.animationsTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.animations') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.animations" @update:model-value="$emit('update:config', { animations: $event })" inline-prompt :active-text="t('common.start')" :inactive-text="t('common.disabled')" />
      </el-col>
    </el-row>

    <!-- 输入框翻译功能 -->
    <el-row class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.inputBoxTranslationTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.inputBoxTranslation') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-select :model-value="config.inputBoxTranslationTrigger" @update:model-value="$emit('update:config', { inputBoxTranslationTrigger: $event })" :placeholder="t('adv.selectTrigger')">
          <el-option class="select-left" v-for="item in options.inputBoxTranslationTrigger" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-col>
    </el-row>

    <!-- 输入框翻译目标语言 -->
    <el-row v-if="config.inputBoxTranslationTrigger !== 'disabled'" class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <span class="popup-text popup-vertical-left">{{ t('adv.inputBoxTranslationTarget') }}</span>
      </el-col>
      <el-col :span="12">
        <el-select :model-value="config.inputBoxTranslationTarget" @update:model-value="$emit('update:config', { inputBoxTranslationTarget: $event })" :placeholder="t('main.selectTargetLanguage')">
          <el-option class="select-left" v-for="item in options.inputBoxTranslationTarget" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-col>
    </el-row>

    <!-- 翻译并发数 -->
    <el-row class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.concurrentTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.concurrent') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input-number
          :model-value="config.maxConcurrentTranslations"
          @update:model-value="handleConcurrentChange($event)"
          :min="1"
          :max="100"
          :step="1"
          style="width: 100%"
          controls-position="right"
        />
      </el-col>
    </el-row>

    <!-- 最小中文字号 -->
    <el-row class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.minFontSizeTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.minFontSize') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-select :model-value="config.minFontSize" @update:model-value="$emit('update:config', { minFontSize: $event })" :placeholder="t('adv.selectMinFontSize')">
          <el-option class="select-left" v-for="item in options.minFontSizes" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-col>
    </el-row>

    <!-- 中文字体强制黑体 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.forceHeiFontTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.forceHeiFont') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.forceChineseHeiFont" @update:model-value="$emit('update:config', { forceChineseHeiFont: $event })" inline-prompt :active-text="t('common.enabled')" :inactive-text="t('common.disabled')" />
      </el-col>
    </el-row>
    </template>

    <!-- ============ 代理 / AI 提示词组（渲染在“划词翻译”之后） ============ -->
    <template v-if="group === 'all' || group === 'aiprompt'">
    <!-- 使用代理转发 -->
    <el-row v-show="compute.showProxy" class="adv-row">
      <el-col :span="8" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.proxyTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.proxy') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="16">
        <el-input :model-value="config.proxy[config.service]" @update:model-value="$emit('update:config', { proxy: { ...config.proxy, [config.service]: $event } })" :placeholder="t('adv.proxyPlaceholder')" />
      </el-col>
    </el-row>
    </template>

    <!-- ============ AI 风格预设 / 角色提示词组（下移到 Flickr优化 之前显示） ============ -->
    <template v-if="group === 'all' || group === 'aistyle'">
    <!-- 翻译风格预设：一键写入当前服务的 system_role -->
    <el-row v-show="compute.showAI" class="adv-row">
      <el-col :span="8" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.aiStylePresetTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.aiStylePreset') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="16">
        <el-select
          :model-value="promptPresets.find(p => p.system_role === config.system_role[config.service])?.value || ''"
          @update:model-value="(v: string) => { const p = promptPresets.find(i => i.value === v); if (p) $emit('update:config', { system_role: { ...config.system_role, [config.service]: p.system_role } }) }"
          :placeholder="t('adv.selectStylePreset')"
          style="width: 100%;"
        >
          <el-option v-for="p in promptPresets" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
      </el-col>
    </el-row>

    <!-- 角色和模板 -->
    <el-row v-show="compute.showAI" class="adv-row">
      <el-col :span="8" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.systemTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">system<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="16">
        <el-input type="textarea" :model-value="config.system_role[config.service]" @update:model-value="$emit('update:config', { system_role: { ...config.system_role, [config.service]: $event } })" maxlength="8192" placeholder="system message " />
      </el-col>
    </el-row>
    <el-row v-show="compute.showAI" class="adv-row">
      <el-col :span="8" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.userTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">user<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="16">
        <el-input type="textarea" :model-value="config.user_role[config.service]" @update:model-value="$emit('update:config', { user_role: { ...config.user_role, [config.service]: $event } })" maxlength="8192" placeholder="user message template" />
      </el-col>
    </el-row>
    <el-row v-show="compute.showAI" class="adv-row">
      <el-col :span="24" style="text-align: right;">
        <el-button type="primary" link @click="resetTemplate">
          <el-icon><Refresh /></el-icon>
          {{ t('adv.resetTemplate') }}
        </el-button>
      </el-col>
    </el-row>
    </template>

    <!-- ============ PDF 沉浸式翻译 ============ -->
    <template v-if="group === 'all' || group === 'pdf'">
    <!-- 自动接管 PDF -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.pdfTakeoverTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.pdfTakeover') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.pdfTakeover" @update:model-value="$emit('update:config', { pdfTakeover: $event })" inline-prompt :active-text="t('common.enabled')" :inactive-text="t('common.disabled')" />
      </el-col>
    </el-row>

    <!-- PDF 本地服务地址 -->
    <el-row class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.pdfServerUrlTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.pdfServerUrl') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="8">
        <el-input :model-value="config.pdfServerUrl" placeholder="http://127.0.0.1:8765" size="small"
          @update:model-value="$emit('update:config', { pdfServerUrl: $event })" />
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-button size="small" :loading="pdfTesting" @click="testPdfServer">{{ t('adv.testConnection') }}</el-button>
      </el-col>
    </el-row>
    <el-row v-if="pdfTestResult" class="adv-row">
      <el-col :span="24">
        <span class="popup-text" :style="{ color: pdfTestOk ? '#67c23a' : '#f56c6c' }">{{ pdfTestResult }}</span>
      </el-col>
    </el-row>
    </template>

    <!-- ============ Flickr 优化组 ============ -->
    <template v-if="group === 'all' || group === 'flickr'">
    <!-- Flickr 大图下载菜单 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.flickrDownloadMenuTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.flickrDownloadMenu') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.flickrDownloadMenu" @update:model-value="$emit('update:config', { flickrDownloadMenu: $event })" inline-prompt :active-text="t('common.enabled')" :inactive-text="t('common.disabled')" />
      </el-col>
    </el-row>
    </template>

    <!-- ============ Linkedin 优化组 ============ -->
    <template v-if="group === 'all' || group === 'linkedin'">
    <!-- LinkedIn 宽幅 UI -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.linkedinWideUiTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.linkedinWideUi') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.linkedinWideUi" @update:model-value="$emit('update:config', { linkedinWideUi: $event })" inline-prompt :active-text="t('common.enabled')" :inactive-text="t('common.disabled')" />
      </el-col>
    </el-row>

    <!-- LinkedIn 宽幅尺寸 -->
    <el-row v-if="config.linkedinWideUi !== false" class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.linkedinWideScaleTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.linkedinWideScale') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-select :model-value="config.linkedinWideScale" @update:model-value="$emit('update:config', { linkedinWideScale: $event })" :placeholder="t('adv.selectWideScale')">
          <el-option class="select-left" v-for="item in options.linkedinWideScale" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-col>
    </el-row>

    <!-- LinkedIn 自动隐藏推广帖图片 -->
    <el-row v-if="config.linkedinWideUi !== false" class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.linkedinHidePromotedTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.linkedinHidePromoted') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.linkedinAutoHidePromotedMedia" @update:model-value="$emit('update:config', { linkedinAutoHidePromotedMedia: $event })" inline-prompt :active-text="t('common.enabled')" :inactive-text="t('common.disabled')" />
      </el-col>
    </el-row>
    </template>

    <!-- ============ GitHub 优化组 ============ -->
    <template v-if="group === 'all' || group === 'github'">
    <!-- GitHub 仓库首页 README 横排左移 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.githubReadmeLeftTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.githubReadmeLeft') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.githubReadmeLeft" @update:model-value="$emit('update:config', { githubReadmeLeft: $event })" inline-prompt :active-text="t('common.enabled')" :inactive-text="t('common.disabled')" />
      </el-col>
    </el-row>
    </template>

    <!-- ============ Reddit 优化组 ============ -->
    <template v-if="group === 'all' || group === 'reddit'">
    <!-- Reddit 正文/Feed 列宽加宽 -->
    <el-row class="adv-row">
      <el-col :span="24">
        <el-tooltip effect="dark" :content="t('adv.redditFeedWideTip')" placement="top-start" :show-after="500">
          <el-checkbox :model-value="config.redditFeedWide" @update:model-value="$emit('update:config', { redditFeedWide: $event })">{{ t('adv.redditFeedWide') }}</el-checkbox>
        </el-tooltip>
      </el-col>
    </el-row>
    <!-- Reddit 本文/Feed 宽度档位 -->
    <el-row v-if="config.redditFeedWide !== false" class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.redditWideScaleTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.redditWideScale') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-select :model-value="config.redditWideScale || '1.5x'" @update:model-value="$emit('update:config', { redditWideScale: $event })" :placeholder="t('adv.selectRedditWideScale')">
          <el-option class="select-left" v-for="item in options.redditWideScale" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-col>
    </el-row>
    <!-- Reddit 评论页正文贴列阅读优化 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.redditMainOptimizeTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.redditMainOptimize') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.redditMainOptimize" @update:model-value="$emit('update:config', { redditMainOptimize: $event })" inline-prompt :active-text="t('common.enabled')" :inactive-text="t('common.disabled')" />
      </el-col>
    </el-row>
    <!-- Reddit 正文贴列最小字号 -->
    <el-row class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.redditMinFontSizeTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.redditMinFontSize') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-select :model-value="config.redditMinFontSize" @update:model-value="$emit('update:config', { redditMinFontSize: $event })" :placeholder="t('adv.selectMinFontSizeShort')">
          <el-option class="select-left" v-for="item in options.redditMinFontSizes" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-col>
    </el-row>
    </template>

    <!-- ============ X (Twitter) 优化组 ============ -->
    <template v-if="group === 'all' || group === 'x'">
    <!-- X.com（Twitter）主时间线列加宽 -->
    <el-row class="adv-row">
      <el-col :span="24">
        <el-tooltip effect="dark" :content="t('adv.xWideTip')" placement="top-start" :show-after="500">
          <el-checkbox :model-value="config.xWide" @update:model-value="$emit('update:config', { xWide: $event })">{{ t('adv.xWide') }}</el-checkbox>
        </el-tooltip>
      </el-col>
    </el-row>
    <!-- X.com 时间线宽度档位 -->
    <el-row v-if="config.xWide !== false" class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" :content="t('adv.xWideScaleTip')" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ t('adv.xWideScale') }}<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-select :model-value="config.xWideScale" @update:model-value="$emit('update:config', { xWideScale: $event })" :placeholder="t('adv.selectXWideScale')">
          <el-option class="select-left" v-for="item in options.xWideScale" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-col>
    </el-row>
    </template>

    <!-- ============ 配置导入导出（仅 group=all 时随主体同显） ============ -->
    <template v-if="showConfigManagement && (group === 'all' || group === 'main')">
      <div class="config-mgmt-header">
        <span class="config-mgmt-title">{{ t('main.configManagement') }}</span>
        <span class="config-mgmt-actions">
          <el-button type="primary" size="small" @click="handleExport">
            <el-icon><Download /></el-icon>{{ t('common.export') }}
          </el-button>
          <el-button type="success" size="small" @click="handleImport">
            <el-icon><Upload /></el-icon>{{ t('common.import') }}
          </el-button>
        </span>
      </div>

      <el-row v-if="showExportBox" class="adv-row">
        <el-col :span="24">
          <el-input :model-value="exportData" @update:model-value="$emit('update:exportData', $event)" type="textarea" :rows="8" readonly />
        </el-col>
      </el-row>

      <el-row v-if="showImportBox" class="adv-row">
        <el-col :span="24">
          <el-input :model-value="importData" @update:model-value="$emit('update:importData', $event)" type="textarea" :rows="8" :placeholder="t('main.importPlaceholder')" />
          <div style="margin-top: 10px; text-align: right;">
            <el-button @click="saveImport">{{ t('common.save') }}</el-button>
          </div>
        </el-col>
      </el-row>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ChatDotRound, Refresh, Upload, Download } from '@element-plus/icons-vue';
import { ref } from 'vue';
import { promptPresets } from '@/entrypoints/utils/option';
import { t } from '@/entrypoints/utils/i18n';
import LocaleSelect from './LocaleSelect.vue';

const props = withDefaults(defineProps<{
  config: any;
  compute: any;
  options: any;
  floatingBallEnabled: any;
  showExportBox: any;
  exportData: any;
  showImportBox: any;
  importData: any;
  showConfigManagement?: boolean;
  group?: 'all' | 'main' | 'aiprompt' | 'aistyle' | 'pdf' | 'flickr' | 'linkedin' | 'github' | 'reddit' | 'x';
  resetTemplate: () => void;
  handleExport: () => void;
  handleImport: () => void;
  saveImport: () => void;
  handleConcurrentChange: (v: number | undefined) => void;
}>(), { group: 'all' });

defineEmits<{
  (e: 'update:config', patch: Record<string, any>): void;
  (e: 'update:floatingBallEnabled', v: boolean): void;
  (e: 'update:exportData', v: string): void;
  (e: 'update:importData', v: string): void;
}>();

// PDF 本地服务「测试连接」
const pdfTesting = ref(false);
const pdfTestResult = ref('');
const pdfTestOk = ref(false);
async function testPdfServer() {
  if (pdfTesting.value) return;
  pdfTesting.value = true;
  pdfTestResult.value = t('adv.pdfConnecting');
  pdfTestOk.value = false;
  const base = ((props.config?.pdfServerUrl || 'http://127.0.0.1:8765') as string).replace(/\/+$/, '');
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(`${base}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (resp.ok) {
      pdfTestOk.value = true;
      pdfTestResult.value = t('adv.pdfConnected', { url: base });
    } else {
      pdfTestResult.value = t('adv.pdfServerStatus', { status: resp.status });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    pdfTestResult.value = t('adv.pdfConnectFailed', { error: msg });
  } finally {
    pdfTesting.value = false;
  }
}
</script>

<style scoped>
.main-advanced-body {
  padding: 0;
  min-width: 0;
}

/* 统一所有设置组的紧凑行间距与自适应文字 */
.adv-row {
  margin-bottom: 6px;
  min-width: 0;
}

.main-advanced-body :deep(.el-col) {
  min-width: 0 !important;
}

.popup-text {
  font-size: 12.5px !important;
  line-height: 1.35 !important;
  word-break: break-word !important;
}

/* 按钮过宽时文字紧凑化 */
:deep(.el-button--small) {
  font-size: 11.5px !important;
  padding: 4px 8px !important;
}

.compact-main :deep(.el-row + .el-row) {
  margin-top: 0;
}

/* 配置管理：标题与按钮同行 */
.config-mgmt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-top: 8px;
  border-top: 1px dashed var(--el-border-color-lighter);
}
.config-mgmt-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.config-mgmt-actions {
  display: inline-flex;
  gap: 6px;
}
.config-mgmt-actions :deep(.el-button) {
  font-size: 11.5px !important;
  padding: 3px 8px !important;
  height: 24px !important;
}
.config-mgmt-actions .el-icon {
  margin-right: 4px;
}
</style>
