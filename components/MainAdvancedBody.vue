<template>
  <div class="main-advanced-body" :class="{ 'compact-main': group === 'main' }">
    <!-- ============ 翻译选项 主组 ============ -->
    <template v-if="group === 'all' || group === 'main'">
    <!-- 主题设置 -->
    <el-row class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <span class="popup-text popup-vertical-left">主题设置</span>
      </el-col>
      <el-col :span="12">
        <el-select :model-value="config.theme" @update:model-value="$emit('update:config', { theme: $event })" placeholder="请选择主题模式">
          <el-option class="select-left" v-for="item in options.theme" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-col>
    </el-row>

    <!-- 不翻译页头 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="开启后，全文翻译时智能识别并跳过页头（如导航、顶栏），只翻译正文区域，默认开启。" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">不翻译页头<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.skipTranslateHeader" @update:model-value="$emit('update:config', { skipTranslateHeader: $event })" inline-prompt active-text="跳过" inactive-text="翻译" />
      </el-col>
    </el-row>

    <!-- 不翻译页尾 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="开启后，全文翻译时智能识别并跳过页尾（如版权、链接区），只翻译正文区域，默认开启。" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">不翻译页尾<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.skipTranslateFooter" @update:model-value="$emit('update:config', { skipTranslateFooter: $event })" inline-prompt active-text="跳过" inactive-text="翻译" />
      </el-col>
    </el-row>

    <!-- 缓存开关 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="开启缓存可以提高翻译速度，减少重复请求，但可能导致翻译结果不是最新的" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">缓存翻译结果<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.useCache" @update:model-value="$emit('update:config', { useCache: $event })" inline-prompt active-text="启用" inactive-text="禁用"/>
      </el-col>
    </el-row>

    <!-- 悬浮球开关 -->
    <el-row v-if="config.on" class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="（测试版）控制是否显示屏幕边缘的即时翻译悬浮球，用于对整个网页进行翻译" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">全文翻译悬浮球<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="floatingBallEnabled" @update:model-value="$emit('update:floatingBallEnabled', $event)" inline-prompt active-text="启用" inactive-text="禁用" />
      </el-col>
    </el-row>

    <!-- 翻译进度面板 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="翻译进度面板（默认关）：关闭后将不再显示右下角的全文翻译进度面板，适合移动端或希望更少打扰的用户。" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">翻译进度面板<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.translationStatus" @update:model-value="$emit('update:config', { translationStatus: $event })" inline-prompt active-text="启动" inactive-text="禁用" />
      </el-col>
    </el-row>

    <!-- 禁用动画设置 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="动画效果（默认关）：启用后将开启加载/悬浮等动画。禁用可节省GPU资源和电量，适合低配置设备或希望节省资源的用户。" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">动画效果<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.animations" @update:model-value="$emit('update:config', { animations: $event })" inline-prompt active-text="启动" inactive-text="禁用" />
      </el-col>
    </el-row>

    <!-- 输入框翻译功能 -->
    <el-row class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="输入框翻译：在任何文本输入框中使用指定方式触发翻译当前输入的内容。" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">输入框翻译<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-select :model-value="config.inputBoxTranslationTrigger" @update:model-value="$emit('update:config', { inputBoxTranslationTrigger: $event })" placeholder="请选择触发方式">
          <el-option class="select-left" v-for="item in options.inputBoxTranslationTrigger" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-col>
    </el-row>

    <!-- 输入框翻译目标语言 -->
    <el-row v-if="config.inputBoxTranslationTrigger !== 'disabled'" class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <span class="popup-text popup-vertical-left">翻译目标语言</span>
      </el-col>
      <el-col :span="12">
        <el-select :model-value="config.inputBoxTranslationTarget" @update:model-value="$emit('update:config', { inputBoxTranslationTarget: $event })" placeholder="请选择目标语言">
          <el-option class="select-left" v-for="item in options.inputBoxTranslationTarget" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-col>
    </el-row>

    <!-- 翻译并发数 -->
    <el-row class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="控制同时进行的最大翻译任务数，数值越高翻译速度越快，但可能占用更多系统资源" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">翻译并发数<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
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
        <el-tooltip class="box-item" effect="dark" content="为双语/全文翻译时的中文译文设置一个最小字号，避免在 Reddit 等站点中文字过小难以阅读" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">最小中文字号<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-select :model-value="config.minFontSize" @update:model-value="$emit('update:config', { minFontSize: $event })" placeholder="请选择最小中文字号">
          <el-option class="select-left" v-for="item in options.minFontSizes" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-col>
    </el-row>

    <!-- 中文字体强制黑体 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="开启后，当目标语言为中文时，译文会优先使用黑体字族，提升正文和双语对照的清晰度。默认开启。" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">中文字体强制黑体<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.forceChineseHeiFont" @update:model-value="$emit('update:config', { forceChineseHeiFont: $event })" inline-prompt active-text="启用" inactive-text="禁用" />
      </el-col>
    </el-row>

    <!-- 使用代理转发 -->
    <el-row v-show="compute.showProxy" class="adv-row">
      <el-col :span="8" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="使用代理可以解决网络无法访问的问题，如不熟悉代理设置请留空！" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">代理地址<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="16">
        <el-input :model-value="config.proxy[config.service]" @update:model-value="$emit('update:config', { proxy: { ...config.proxy, [config.service]: $event } })" placeholder="默认不使用代理" />
      </el-col>
    </el-row>

    <!-- 翻译风格预设：一键写入当前服务的 system_role -->
    <el-row v-show="compute.showAI" class="adv-row">
      <el-col :span="8" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="一键套用常用翻译风格，会覆盖下方 system 角色提示词。可在套用后继续手动微调。" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">风格预设<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="16">
        <el-select
          :model-value="promptPresets.find(p => p.system_role === config.system_role[config.service])?.value || ''"
          @update:model-value="(v: string) => { const p = promptPresets.find(i => i.value === v); if (p) $emit('update:config', { system_role: { ...config.system_role, [config.service]: p.system_role } }) }"
          placeholder="选择翻译风格（可选）"
          style="width: 100%;"
        >
          <el-option v-for="p in promptPresets" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
      </el-col>
    </el-row>

    <!-- 角色和模板 -->
    <el-row v-show="compute.showAI" class="adv-row">
      <el-col :span="8" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="以系统身份 system 发送的对话，常用于指定 AI 要扮演的角色" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">system<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="16">
        <el-input type="textarea" :model-value="config.system_role[config.service]" @update:model-value="$emit('update:config', { system_role: { ...config.system_role, [config.service]: $event } })" maxlength="8192" placeholder="system message " />
      </el-col>
    </el-row>
    <el-row v-show="compute.showAI" class="adv-row">
      <el-col :span="8" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="以用户身份 user 发送的对话，其中{{to}}表示目标语言，{{origin}}表示待翻译的文本内容，两者不可缺少。" placement="top-start" :show-after="500">
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
          恢复默认模板
        </el-button>
      </el-col>
    </el-row>
    </template>

    <!-- ============ Flickr 优化组 ============ -->
    <template v-if="group === 'all' || group === 'flickr'">
    <!-- Flickr 大图下载菜单 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="在 Flickr 页面右键时显示“下载最大尺寸图片”菜单。默认开启。" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">Flickr大图下载菜单<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.flickrDownloadMenu" @update:model-value="$emit('update:config', { flickrDownloadMenu: $event })" inline-prompt active-text="启用" inactive-text="禁用" />
      </el-col>
    </el-row>
    </template>

    <!-- ============ Linkedin 优化组 ============ -->
    <template v-if="group === 'all' || group === 'linkedin'">
    <!-- LinkedIn 宽幅 UI -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="在 LinkedIn feed/posts 页面启用宽幅布局，提升信息密度。默认开启。" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">Linkedin宽幅UI<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.linkedinWideUi" @update:model-value="$emit('update:config', { linkedinWideUi: $event })" inline-prompt active-text="启用" inactive-text="禁用" />
      </el-col>
    </el-row>

    <!-- LinkedIn 宽幅尺寸 -->
    <el-row v-if="config.linkedinWideUi !== false" class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="设置 LinkedIn feed/posts 页面的宽幅尺寸档位：原始宽、2倍宽、3倍宽、全宽。" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">Linkedin宽幅尺寸<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-select :model-value="config.linkedinWideScale" @update:model-value="$emit('update:config', { linkedinWideScale: $event })" placeholder="请选择宽幅尺寸">
          <el-option class="select-left" v-for="item in options.linkedinWideScale" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-col>
    </el-row>

    <!-- LinkedIn 自动隐藏推广帖图片 -->
    <el-row v-if="config.linkedinWideUi !== false" class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="开启后，在 LinkedIn feed 页面尝试检测 Promoted/赞助贴并隐藏整贴。注意：LinkedIn 对推广标签做了混淆与多语言处理，识别不稳定，可能漏隐藏或误隐藏，因此默认关闭。" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">Linkedin自动隐藏推广贴图片<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.linkedinAutoHidePromotedMedia" @update:model-value="$emit('update:config', { linkedinAutoHidePromotedMedia: $event })" inline-prompt active-text="启用" inactive-text="禁用" />
      </el-col>
    </el-row>
    </template>

    <!-- ============ GitHub 优化组 ============ -->
    <template v-if="group === 'all' || group === 'github'">
    <!-- GitHub 仓库首页 README 横排左移 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="在 github.com/用户/仓库 项目首页，把左栏的 README 从文件列表下方移到其左侧横排显示（整页由 2 列变 3 列），方便边看说明边看文件。默认开启。" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">GitHub仓库README左移横排<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.githubReadmeLeft" @update:model-value="$emit('update:config', { githubReadmeLeft: $event })" inline-prompt active-text="启用" inactive-text="禁用" />
      </el-col>
    </el-row>
    </template>

    <!-- ============ Reddit 优化组 ============ -->
    <template v-if="group === 'all' || group === 'reddit'">
    <!-- Reddit 评论页正文贴列阅读优化 -->
    <el-row class="adv-row">
      <el-col :span="20" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="在 reddit.com 评论页与 feed 列表页（首页 / 子版块 /r/版块/ / 用户页），只优化左侧主内容列：把偏小的正文、评论、帖子标题文本放大到下方设置的最小字号，方便阅读。右侧社区/推荐侧栏不受影响。默认开启。" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">Reddit正文/列表阅读优化<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="4" class="flex-end">
        <el-switch :model-value="config.redditMainOptimize" @update:model-value="$emit('update:config', { redditMainOptimize: $event })" inline-prompt active-text="启用" inactive-text="禁用" />
      </el-col>
    </el-row>
    <!-- Reddit 正文贴列最小字号 -->
    <el-row class="adv-row">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="Reddit 评论页左侧正文贴列的最小字号。小于此值的正文/评论文本会被放大到此值；本来就更大的文本保持不变。" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">Reddit正文最小字号<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-select :model-value="config.redditMinFontSize" @update:model-value="$emit('update:config', { redditMinFontSize: $event })" placeholder="请选择最小字号">
          <el-option class="select-left" v-for="item in options.redditMinFontSizes" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-col>
    </el-row>
    </template>

    <!-- ============ 配置导入导出（仅 group=all 时随主体同显） ============ -->
    <template v-if="showConfigManagement && (group === 'all' || group === 'main')">
      <div class="config-mgmt-header">
        <span class="config-mgmt-title">配置管理</span>
        <span class="config-mgmt-actions">
          <el-button type="primary" size="small" @click="handleExport">
            <el-icon><Download /></el-icon>导出
          </el-button>
          <el-button type="success" size="small" @click="handleImport">
            <el-icon><Upload /></el-icon>导入
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
          <el-input :model-value="importData" @update:model-value="$emit('update:importData', $event)" type="textarea" :rows="8" placeholder="请在此处粘贴您的JSON配置" />
          <div style="margin-top: 10px; text-align: right;">
            <el-button @click="saveImport">保存</el-button>
          </div>
        </el-col>
      </el-row>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ChatDotRound, Refresh, Upload, Download } from '@element-plus/icons-vue';
import { promptPresets } from '@/entrypoints/utils/option';

withDefaults(defineProps<{
  config: any;
  compute: any;
  options: any;
  floatingBallEnabled: any;
  showExportBox: any;
  exportData: any;
  showImportBox: any;
  importData: any;
  showConfigManagement?: boolean;
  group?: 'all' | 'main' | 'flickr' | 'linkedin' | 'github' | 'reddit';
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
</script>

<style scoped>
.main-advanced-body {
  padding: 0;
}

/* 统一所有设置组的紧凑行间距（不缩小字号） */
.adv-row {
  margin-bottom: 6px;
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
  font-size: 14px;
  color: var(--el-text-color-primary);
}
.config-mgmt-actions {
  display: inline-flex;
  gap: 8px;
}
.config-mgmt-actions .el-icon {
  margin-right: 4px;
}
</style>
