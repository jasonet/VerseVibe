<template>
  <!-- 基础设置区块（全页布局下左侧选「基础设置」时显示） -->
  <div v-show="section !== 'advanced'" class="main-section main-basic">
<!-- 插件状态 -->
  <el-row class="margin-bottom margin-left-2em settings-row">
    <el-col :span="20" class="lightblue rounded-corner">
      <span class="popup-text popup-vertical-left">插件状态</span>
    </el-col>
    <el-col :span="4" class="flex-end">
      <el-switch v-model="config.on" inline-prompt active-text="开" inactive-text="关" @change="handlePluginStateChange" />
    </el-col>
  </el-row>

  <!-- 占位符 -->
  <div v-if="!config.on">
    <el-empty description="插件处于禁用状态" />
  </div>

  <div v-show="config.on">
    <!-- 目标语言 -->
    <el-row class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <span class="popup-text popup-vertical-left">目标语言</span>
      </el-col>
      <el-col :span="12">
        <el-select v-model="config.to" placeholder="请选择目标语言">
          <el-option class="select-left" v-for="item in options.to" :key="item.value" :label="item.label"
            :value="item.value" />
        </el-select>
      </el-col>
    </el-row>

    <!--    翻译模式-->
    <el-row class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <span class="popup-text popup-vertical-left">翻译模式</span>
      </el-col>
      <el-col :span="12">
        <el-select v-model="config.display" placeholder="请选择翻译模式">
          <el-option class="select-left" v-for="item in options.display" :key="item.value" :label="item.label"
            :value="item.value" />
        </el-select>
      </el-col>
    </el-row>

    <!-- 翻译选项 Alt+A（原"高级选项"，紧凑排版） -->
    <section v-if="section === 'all'" id="section-advanced" class="settings-block advanced-inline margin-left-2em margin-bottom">
      <div class="section-header">
        <span class="popup-text popup-vertical-left">翻译选项 Alt+A</span>
      </div>
      <MainAdvancedBody
        group="main"
        :config="config"
        :compute="compute"
        :options="options"
        :floatingBallEnabled="floatingBallEnabled"
        :showExportBox="showExportBox"
        :exportData="exportData"
        :showImportBox="showImportBox"
        :importData="importData"
        :showConfigManagement="false"
        @update:config="mergeConfig"
        @update:floatingBallEnabled="applyFloatingBallEnabled"
        @update:exportData="(v) => exportData = v"
        @update:importData="(v) => importData = v"
        :resetTemplate="resetTemplate"
        :handleExport="handleExport"
        :handleImport="handleImport"
        :saveImport="saveImport"
        :handleConcurrentChange="(v) => handleConcurrentChange(v, config.maxConcurrentTranslations)"
      />

      <!-- 鼠标悬浮快捷键 -->
      <el-row class="adv-row" :class="{ 'custom-hotkey-row': config.hotkey === 'custom' }">
        <el-col :span="14" class="lightblue rounded-corner">
          <el-tooltip class="box-item" effect="dark" content="按住指定快捷键并悬停在文本上进行翻译" placement="top-start" :show-after="500">
            <span class="popup-text popup-vertical-left">
              鼠标悬浮快捷键
              <el-icon class="icon-margin"><ChatDotRound /></el-icon>
            </span>
          </el-tooltip>
        </el-col>
        <el-col :span="10" class="flex-end">
          <div class="hotkey-config">
            <el-select v-model="config.hotkey" placeholder="请选择快捷键" size="small" style="width: 100%" @change="handleMouseHotkeyChange">
              <el-option v-for="item in options.keys" :key="item.value" :label="item.label" :value="item.value" :disabled="item.disabled" :class="{ 'select-divider': item.disabled }" />
            </el-select>
            <div v-if="config.hotkey === 'custom'" class="custom-hotkey-display">
              <span class="hotkey-text" v-if="config.customHotkey">{{ getCustomMouseHotkeyDisplayName() }}</span>
              <span class="hotkey-text placeholder-text" v-else>点击设置自定义快捷键</span>
              <el-button size="small" type="text" @click="openCustomMouseHotkeyDialog" class="edit-button">
                <el-icon><Edit /></el-icon>
              </el-button>
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 全文翻译快捷键 -->
      <el-row v-if="config.on" class="adv-row" :class="{ 'custom-hotkey-row': config.floatingBallHotkey === 'custom' }">
        <el-col :span="14" class="lightblue rounded-corner">
          <el-tooltip class="box-item" effect="dark" content="（测试版）设置快捷键以便快速切换全文翻译状态，无需鼠标点击悬浮球" placement="top-start" :show-after="500">
            <span class="popup-text popup-vertical-left">
              全文翻译快捷键
              <el-icon class="icon-margin"><ChatDotRound /></el-icon>
            </span>
          </el-tooltip>
        </el-col>
        <el-col :span="10" class="flex-end">
          <div class="hotkey-config">
            <el-select v-model="config.floatingBallHotkey" placeholder="选择快捷键" size="small" style="width: 100%" @change="handleHotkeyChange">
              <el-option v-for="item in options.floatingBallHotkeys" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <div v-if="config.floatingBallHotkey === 'custom'" class="custom-hotkey-display">
              <span class="hotkey-text" v-if="config.customFloatingBallHotkey">{{ getCustomHotkeyDisplayName() }}</span>
              <span class="hotkey-text placeholder-text" v-else>点击设置自定义快捷键</span>
              <el-button size="small" type="text" @click="openCustomHotkeyDialog" class="edit-button">
                <el-icon><Edit /></el-icon>
              </el-button>
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 划词翻译模式 -->
      <el-row v-if="config.on" class="adv-row">
        <el-col :span="14" class="lightblue rounded-corner">
          <el-tooltip class="box-item" effect="dark" content="选中文本后显示红点，鼠标移到红点上查看翻译结果。可选择关闭、双语显示或只显示译文" placement="top-start" :show-after="500">
            <span class="popup-text popup-vertical-left">
              划词翻译
              <el-icon class="icon-margin"><ChatDotRound /></el-icon>
            </span>
          </el-tooltip>
        </el-col>
        <el-col :span="10" class="flex-end">
          <el-select v-model="config.selectionTranslatorMode" placeholder="选择模式" size="small" style="width: 100%">
            <el-option label="关闭" value="disabled" />
            <el-option label="双语显示" value="bilingual" />
            <el-option label="只显示译文" value="translation-only" />
          </el-select>
        </el-col>
      </el-row>
    </section>

    <!--    译文样式选择器-->
    <section id="section-style" v-show="config.display === 1" class="settings-block margin-bottom margin-left-2em">
    <el-row class="margin-bottom">
      <el-col :span="24">
        <div class="section-header">
          <el-tooltip class="box-item" effect="dark" content="选择双语模式下译文的显示样式，提供多种美观的效果" placement="top-start"
            :show-after="500">
            <span class="popup-text popup-vertical-left">译文样式<el-icon class="icon-margin">
                <ChatDotRound />
              </el-icon></span>
          </el-tooltip>
        </div>
        <div class="style-selector">
          <div v-for="group in styleGroups" :key="group.value" class="style-group-section">
            <div class="group-title">{{ group.label }}</div>
            <div class="style-cards-grid">
              <div 
                v-for="item in group.options" 
                :key="item.value"
                @click="config.style = item.value"
                :class="['style-card', { 'selected': config.style === item.value }]"
              >
                <div class="style-preview">
                  <span :class="['style-text', item.class]">{{ item.label }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
    </section>

    <!-- 翻译服务 -->
    <section id="section-service" class="settings-block margin-bottom margin-left-2em">
    <el-row class="margin-bottom">
      <el-col :span="24">
        <div class="section-header">
          <el-tooltip class="box-item" effect="dark" content="机器翻译：快速稳定，适合日常使用；AI翻译：更自然流畅，需要配置令牌" placement="top-start"
            :show-after="500">
            <span class="popup-text popup-vertical-left">翻译服务<el-icon class="icon-margin">
                <ChatDotRound />
              </el-icon></span>
          </el-tooltip>
        </div>
        <div class="service-selector">
          <div v-for="group in serviceGroups" :key="group.label" class="service-group-section">
            <div class="group-title">{{ group.label }}</div>
            <div class="service-cards-grid">
              <div 
                v-for="item in group.services" 
                :key="item.value"
                @click="config.service = item.value"
                :class="['service-card', { 'selected': config.service === item.value }]"
              >
                <div class="service-name">{{ item.label }}</div>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
    </section>

    <!-- token -->
    <el-row v-show="compute.showToken" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark"
          content="API访问令牌仅保存在本地，用于访问翻译服务。获取方式请参考对应服务的官方文档；翻译服务为 ollama 时，token 可为任意值" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">访问令牌<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.token[config.service]" type="password" show-password placeholder="请输入API访问令牌" />
      </el-col>
    </el-row>

    <!-- Azure OpenAI 端点配置 -->
    <el-row v-show="compute.showAzureOpenaiEndpoint" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark"
          content="Azure OpenAI 服务端点地址，必须包含完整的部署信息。格式：https://your-resource-name.openai.azure.com/openai/deployments/your-deployment-name/chat/completions?api-version=2024-02-15-preview" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">Azure 端点<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input
          v-model="config.azureOpenaiEndpoint"
          placeholder="https://your-resource.openai.azure.com/openai/deployments/your-model/chat/completions?api-version=2024-02-15-preview"
          :class="{ 'input-error': config.azureOpenaiEndpoint && !isValidAzureEndpoint(config.azureOpenaiEndpoint) }"
        />
        <div v-if="config.azureOpenaiEndpoint && !isValidAzureEndpoint(config.azureOpenaiEndpoint)" class="error-text">
          端点地址格式不正确，请确保包含 openai.azure.com 域名和 /chat/completions 路径
        </div>
      </el-col>
    </el-row>

    <!-- DeepLX URL 配置-->
    <el-row v-show="compute.showDeepLX" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark"
          content="DeepLX API 服务地址，默认为本地地址。如果使用远程 DeepLX 服务，请修改为对应的服务地址" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">服务地址</span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.deeplx" placeholder="http://localhost:1188/translate" />
      </el-col>
    </el-row>

    <!-- 使用AkSk -->
    <el-row v-show="compute.showAkSk" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="百度文心一言API密钥对，用于访问翻译服务" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">API Key<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.ak" placeholder="请输入Access Key" />
      </el-col>
    </el-row>
    <el-row v-show="compute.showAkSk" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="百度文心一言API密钥对，用于访问翻译服务" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">Secret Key<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.sk" type="password" placeholder="请输入Secret Key" />
      </el-col>
    </el-row>

    <!-- 有道翻译配置 -->
    <el-row v-show="compute.showYoudao" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="有道智云翻译API应用ID，用于访问有道翻译服务。可在有道智云控制台获取" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">App Key<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.youdaoAppKey" placeholder="有道 AppKey" />
      </el-col>
    </el-row>
    <el-row v-show="compute.showYoudao" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="有道智云翻译API应用密钥，用于访问有道翻译服务。可在有道智云控制台获取" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">App Secret<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.youdaoAppSecret" type="password" show-password placeholder="有道 AppSecret" />
      </el-col>
    </el-row>

    <!-- 腾讯云机器翻译配置 -->
    <el-row v-show="compute.showTencent" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="腾讯云API访问密钥ID，用于访问腾讯云机器翻译服务。可在腾讯云控制台的访问管理中获取" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">Secret ID<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.tencentSecretId" placeholder="腾讯云 SecretId" />
      </el-col>
    </el-row>
    <el-row v-show="compute.showTencent" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="腾讯云API访问密钥，用于访问腾讯云机器翻译服务。可在腾讯云控制台的访问管理中获取" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">Secret Key<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.tencentSecretKey" type="password" show-password placeholder="腾讯云 SecretKey" />
      </el-col>
    </el-row>

    <!-- Chrome 内置 AI 模型管理 -->
    <el-row v-show="compute.showChromeTranslator" class="margin-bottom margin-left-2em">
      <el-col :span="24">
        <div class="section-header">
           <el-tooltip class="box-item" effect="dark" content="管理 Chrome 内置 AI 翻译模型。首次使用或模型未下载时，需在此处手动下载。" placement="top-start" :show-after="500">
            <span class="popup-text popup-vertical-left">AI 模型状态<el-icon class="icon-margin"><ChatDotRound /></el-icon></span>
          </el-tooltip>
        </div>
        <div style="margin-top: 10px; padding: 10px; background-color: var(--el-fill-color-light); border-radius: 8px;">
          <div style="margin-bottom: 10px; font-size: 14px;">
            <span :style="{ color: chromeAIStatusColor }">{{ chromeAIStatusText }}</span>
          </div>
          <el-button type="primary" size="small" @click="checkChromeAIStatus" :loading="checkingChromeAI">检查状态</el-button>
          <el-button type="success" size="small" @click="downloadChromeAIModel" :loading="downloadingChromeAI" v-if="chromeAINeedsDownload">下载模型</el-button>
        </div>
      </el-col>
    </el-row>

    <!--  Coze需显示 robot_id -->
    <el-row v-show="compute.showRobotId" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="Coze机器人ID，可在Coze开发者文档中查看获取方式" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">机器人ID<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.robot_id[config.service]" placeholder="请输入Coze机器人ID" />
      </el-col>
    </el-row>

    <!-- 本地大模型配置 -->
    <el-row v-show="compute.showCustom" class="margin-bottom margin-left-2em custom-interface-row">
      <el-col :span="12" class="custom-interface-label rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="目前仅支持OpenAI格式的请求接口，如http://localhost:3000/v1/chat/completions，其中 localhost:11434 可更换为任意值。
                     ollama 配置请参考：https://fluent.thinkstu.com/guide/faq.html" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">自定义接口<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.custom" placeholder="请输入自定义接口地址" class="custom-interface-input" />
      </el-col>
    </el-row>

    <!-- NewAPI 配置 -->
    <el-row v-show="compute.showNewAPI" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="填写 New API 的访问地址，如：http://localhost:3000" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">NewAPI接口<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.newApiUrl" placeholder="请输入您的New API接口地址" />
      </el-col>
    </el-row>

    <!--  模型 -->
    <el-row v-show="compute.showModel" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <span class="popup-text popup-vertical-left">模型</span>
      </el-col>
      <el-col :span="12">
        <el-select v-model="config.model[config.service]" placeholder="请选择模型">
          <el-option class="select-left" v-for="item in compute.model" :key="item" :label="item" :value="item" />
        </el-select>
      </el-col>
    </el-row>

    <el-row v-show="compute.showCustomModel" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark"
          :content="config.service === 'doubao' ? '豆包的model为接入点，获取方式见官方文档：https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint' : '注意：自定义模型名称需要与服务商提供的模型名称一致，否则无法使用！'"
          placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ config.service === 'doubao' ? '接入点' : '自定义模型' }}<el-icon
              class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.customModel[config.service]" placeholder="例如：gemma:7b" />
      </el-col>
    </el-row>
  </div>

    <div v-if="section === 'advanced'" class="advanced-standalone">
      <section class="settings-block margin-left-2em margin-bottom">
        <div class="section-header">
          <span class="popup-text popup-vertical-left">翻译选项 Alt+A</span>
        </div>
        <MainAdvancedBody
          group="main"
          :config="config" :compute="compute" :options="options"
          :floatingBallEnabled="floatingBallEnabled"
          :showExportBox="showExportBox" :exportData="exportData"
          :showImportBox="showImportBox" :importData="importData"
          :showConfigManagement="true"
          @update:config="mergeConfig"
          @update:floatingBallEnabled="applyFloatingBallEnabled"
          @update:exportData="(v) => exportData = v"
          @update:importData="(v) => importData = v"
          :resetTemplate="resetTemplate" :handleExport="handleExport"
          :handleImport="handleImport" :saveImport="saveImport"
          :handleConcurrentChange="(v) => handleConcurrentChange(v, config.maxConcurrentTranslations)"
        />
      </section>
      <section class="settings-block margin-left-2em margin-bottom">
        <div class="section-header">
          <span class="popup-text popup-vertical-left">Flickr优化</span>
        </div>
        <MainAdvancedBody
          group="flickr"
          :config="config" :compute="compute" :options="options"
          :floatingBallEnabled="floatingBallEnabled"
          :showExportBox="showExportBox" :exportData="exportData"
          :showImportBox="showImportBox" :importData="importData"
          :showConfigManagement="false"
          @update:config="mergeConfig"
          @update:floatingBallEnabled="applyFloatingBallEnabled"
          @update:exportData="(v) => exportData = v"
          @update:importData="(v) => importData = v"
          :resetTemplate="resetTemplate" :handleExport="handleExport"
          :handleImport="handleImport" :saveImport="saveImport"
          :handleConcurrentChange="(v) => handleConcurrentChange(v, config.maxConcurrentTranslations)"
        />
      </section>
      <section class="settings-block margin-left-2em margin-bottom">
        <div class="section-header">
          <span class="popup-text popup-vertical-left">Linkedin优化</span>
        </div>
        <MainAdvancedBody
          group="linkedin"
          :config="config" :compute="compute" :options="options"
          :floatingBallEnabled="floatingBallEnabled"
          :showExportBox="showExportBox" :exportData="exportData"
          :showImportBox="showImportBox" :importData="importData"
          :showConfigManagement="false"
          @update:config="mergeConfig"
          @update:floatingBallEnabled="applyFloatingBallEnabled"
          @update:exportData="(v) => exportData = v"
          @update:importData="(v) => importData = v"
          :resetTemplate="resetTemplate" :handleExport="handleExport"
          :handleImport="handleImport" :saveImport="saveImport"
          :handleConcurrentChange="(v) => handleConcurrentChange(v, config.maxConcurrentTranslations)"
        />
      </section>
    </div>

    <!-- Flickr优化（移至配置管理之前） -->
    <section v-if="section === 'all'" id="section-flickr" class="settings-block margin-left-2em margin-bottom">
      <div class="section-header">
        <span class="popup-text popup-vertical-left">Flickr优化</span>
      </div>
      <MainAdvancedBody
        group="flickr"
        :config="config" :compute="compute" :options="options"
        :floatingBallEnabled="floatingBallEnabled"
        :showExportBox="showExportBox" :exportData="exportData"
        :showImportBox="showImportBox" :importData="importData"
        :showConfigManagement="false"
        @update:config="mergeConfig"
        @update:floatingBallEnabled="applyFloatingBallEnabled"
        @update:exportData="(v) => exportData = v"
        @update:importData="(v) => importData = v"
        :resetTemplate="resetTemplate" :handleExport="handleExport"
        :handleImport="handleImport" :saveImport="saveImport"
        :handleConcurrentChange="(v) => handleConcurrentChange(v, config.maxConcurrentTranslations)"
      />
    </section>

    <!-- Linkedin优化（移至配置管理之前） -->
    <section v-if="section === 'all'" id="section-linkedin" class="settings-block margin-left-2em margin-bottom">
      <div class="section-header">
        <span class="popup-text popup-vertical-left">Linkedin优化</span>
      </div>
      <MainAdvancedBody
        group="linkedin"
        :config="config" :compute="compute" :options="options"
        :floatingBallEnabled="floatingBallEnabled"
        :showExportBox="showExportBox" :exportData="exportData"
        :showImportBox="showImportBox" :importData="importData"
        :showConfigManagement="false"
        @update:config="mergeConfig"
        @update:floatingBallEnabled="applyFloatingBallEnabled"
        @update:exportData="(v) => exportData = v"
        @update:importData="(v) => importData = v"
        :resetTemplate="resetTemplate" :handleExport="handleExport"
        :handleImport="handleImport" :saveImport="saveImport"
        :handleConcurrentChange="(v) => handleConcurrentChange(v, config.maxConcurrentTranslations)"
      />
    </section>

    <section v-if="section === 'all'" class="settings-block margin-bottom margin-left-2em">
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
      <el-row v-if="showExportBox" class="margin-bottom">
        <el-col :span="24">
          <el-input v-model="exportData" type="textarea" :rows="8" readonly />
        </el-col>
      </el-row>
      <el-row v-if="showImportBox" class="margin-bottom">
        <el-col :span="24">
          <el-input v-model="importData" type="textarea" :rows="8" placeholder="请在此处粘贴您的JSON配置" />
          <div style="margin-top: 10px; text-align: right;">
            <el-button @click="saveImport">保存</el-button>
          </div>
        </el-col>
      </el-row>
    </section>

    <!-- 部分设置需刷新页面后生效 -->
    <div v-if="showRefreshTip" class="refresh-tip margin-left-2em margin-bottom">
      <span class="refresh-tip-text">部分设置已更改，刷新浏览的页面后生效</span>
      <el-button type="primary" size="small" class="refresh-button" @click="refreshPage">
        <el-icon><Refresh /></el-icon>
        刷新页面
      </el-button>
    </div>
  </div>

  <!-- 自定义快捷键对话框 -->
  <CustomHotkeyInput
    v-model="showCustomHotkeyDialog"
    :current-value="config.customFloatingBallHotkey"
    @confirm="handleCustomHotkeyConfirm"
    @cancel="handleCustomHotkeyCancel"
  />

  <!-- 自定义鼠标悬浮快捷键对话框 -->
  <CustomHotkeyInput
    v-model="showCustomMouseHotkeyDialog"
    :current-value="config.customHotkey"
    @confirm="handleCustomMouseHotkeyConfirm"
    @cancel="handleCustomMouseHotkeyCancel"
  />



</template>

<script lang="ts" setup>

// Main 处理配置信息
import { computed, ref, watch, onUnmounted } from 'vue'
import { models, options, servicesType, defaultOption, services } from "../entrypoints/utils/option";
import MainAdvancedBody from './MainAdvancedBody.vue';

withDefaults(defineProps<{ section?: 'basic' | 'advanced' | 'all' }>(), { section: 'all' });
import { Config } from "@/entrypoints/utils/model";
import { storage } from '@wxt-dev/storage';
import { ChatDotRound, Refresh, Edit, Upload, Download } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElInputNumber } from 'element-plus'
import browser from 'webextension-polyfill';
import { defineAsyncComponent } from 'vue';
const CustomHotkeyInput = defineAsyncComponent(() => import('@/components/CustomHotkeyInput.vue'));
import { parseHotkey } from '@/entrypoints/utils/hotkey';

// 初始化深色模式媒体查询
const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

// 更新主题函数
function updateTheme(theme: string) {
  if (theme === 'auto') {
    // 自动模式下，直接使用系统主题
    const isDark = darkModeMediaQuery.matches;
    console.log('isDark', isDark);

    document.documentElement.classList.toggle('dark', isDark);
  } else {
    // 手动模式下，使用选择的主题
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

// 配置信息
let config = ref(new Config());

// 从 storage 中获取本地配置
storage.getItem('local:config').then((value: any) => {
  if (typeof value === 'string' && value) {
    try {
      const parsedConfig = JSON.parse(value);
      Object.assign(config.value, parsedConfig);
    } catch (error) {
      console.warn('[VerseVibe] Main: 解析配置失败，使用默认配置', error);
    }
  }
  // 初始应用主题
  updateTheme(config.value.theme || 'auto');
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.toLowerCase().includes('context invalidated')) {
    console.warn('[VerseVibe] Main: 扩展上下文已失效，跳过读取配置');
    return;
  }
  console.warn('[VerseVibe] Main: 读取配置失败:', message);
});

// 监听 storage 中 'local:config' 的变化
// 当其他页面修改了配置时,会触发这个监听器
// newValue 是新的配置值,oldValue 是旧的配置值
storage.watch('local:config', (newValue: any, oldValue: any) => {
  // 检查 newValue 是否为非空字符串
  if (typeof newValue === 'string' && newValue) {
    try {
      const incoming = JSON.parse(newValue);

      // 避免「翻译次数」等运行时字段在设置页中频繁跳动:
      // 当 settings.html 打开期间,忽略对这些字段的外部更新,
      // 以当前页面内的值为准,防止表单 UI 突然刷新影响体验。
      const runtimeOnlyKeys: Array<keyof Config> = ['count'];
      for (const key of runtimeOnlyKeys) {
        if (key in config.value) {
          incoming[key] = (config.value as any)[key];
        }
      }

      // 将新的配置值解析为对象,并合并到当前的 config.value 中
      // 这样可以保持大部分配置在多页面之间同步
      Object.assign(config.value, incoming);
    } catch (e) {
      console.error('Failed to merge config update from storage.watch:', e);
    }
  }
});

// 监听菜单栏配置变化
// 当配置发生改变时,将新的配置序列化为 JSON 字符串并保存到 storage 中
// deep: true 表示深度监听对象内部属性的变化
watch(config, (newValue: any, oldValue: any) => {
  // TODO 监听配置变化，显示刷新提示
  storage.setItem('local:config', JSON.stringify(newValue)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (message.toLowerCase().includes('context invalidated')) return;
    console.warn('[VerseVibe] Main: 保存配置失败:', message);
  });
}, { deep: true });

// 计算属性
let compute = ref({
  // 1、是否是AI服务
  showAI: computed(() => servicesType.isAI(config.value.service)),
  // 2、是否是机器翻译
  showMachine: computed(() => servicesType.isMachine(config.value.service)),
  // 3、是否显示代理
  showProxy: computed(() => servicesType.isUseProxy(config.value.service)),
  // 4、是否显示模型
  showModel: computed(() => servicesType.isUseModel(config.value.service)),
  // 5、是否显示token
  showToken: computed(() => servicesType.isUseToken(config.value.service)),
  // 6、是否显示 AkSk
  showAkSk: computed(() => servicesType.isUseAkSk(config.value.service)),
  // 6.5、是否显示有道翻译配置
  showYoudao: computed(() => servicesType.isYoudao(config.value.service)),
  // 6.6、是否显示腾讯云机器翻译配置
  showTencent: computed(() => servicesType.isTencent(config.value.service)),
  // 7、获取模型列表
  model: computed(() => models.get(config.value.service) || []),
  // 8、是否需要自定义接口
  showCustom: computed(() => servicesType.isCustom(config.value.service)),
  // 9、是否显示 DeepLX URL 配置
  showDeepLX: computed(() => config.value.service === 'deeplx'),
  // 10、是否自定义模型
  showCustomModel: computed(() => servicesType.isAI(config.value.service) && config.value.model[config.value.service] === "自定义模型"),
  // 11、判断是否为"双语模式"，控制一些翻译服务的显示
  filteredServices: computed(() => options.services.filter((service: any) =>
    !([service.google].includes(service.value) && config.value.display !== 1))
  ),
  // 12、判断是否为 coze
  showRobotId: computed(() => servicesType.isCoze(config.value.service)),
  // 13、是否显示New API配置
  showNewAPI: computed(() => servicesType.isNewApi(config.value.service)),
  // 14、是否显示Azure OpenAI端点配置
  showAzureOpenaiEndpoint: computed(() => servicesType.isAzureOpenai(config.value.service)),
  // 15、是否显示 Chrome AI 配置
  showChromeTranslator: computed(() => config.value.service === services.chromeTranslator),
})

// Chrome AI 状态管理
const checkingChromeAI = ref(false);
const downloadingChromeAI = ref(false);
const chromeAIStatusText = ref('点击检查状态...');
const chromeAIStatusColor = ref('var(--el-text-color-regular)');
const chromeAINeedsDownload = ref(false);

const checkChromeAIStatus = async () => {
    checkingChromeAI.value = true;
    try {
        if (!('translation' in self && 'canTranslate' in (self as any).translation)) {
             chromeAIStatusText.value = '当前浏览器不支持 Chrome Translation API';
             chromeAIStatusColor.value = 'red';
             chromeAINeedsDownload.value = false;
             return;
        }
        
        const options = {
            sourceLanguage: 'en',
            targetLanguage: 'zh' // 默认检测英译中，或根据当前 config.to 动态调整
        };
        
        const availability = await (self as any).translation.canTranslate(options);
        
        if (availability === 'no') {
            chromeAIStatusText.value = '模型不可用 (Availability: no)';
             chromeAIStatusColor.value = 'red';
             chromeAINeedsDownload.value = false;
        } else if (availability === 'readily') {
             chromeAIStatusText.value = '模型就绪，可直接使用';
             chromeAIStatusColor.value = 'green';
             chromeAINeedsDownload.value = false;
        } else if (availability === 'after-download') {
             chromeAIStatusText.value = '模型需要下载 (需用户手势触发)';
             chromeAIStatusColor.value = 'orange';
             chromeAINeedsDownload.value = true;
        }
        
    } catch (error) {
        console.error('检查 Chrome AI 状态失败:', error);
        chromeAIStatusText.value = '检查失败: ' + (error instanceof Error ? error.message : String(error));
        chromeAIStatusColor.value = 'red';
    } finally {
        checkingChromeAI.value = false;
    }
};

const downloadChromeAIModel = async () => {
    downloadingChromeAI.value = true;
    try {
         const options = {
            sourceLanguage: 'en',
            targetLanguage: 'zh'
        };
        // 触发下载
        await (self as any).translation.createTranslator(options);
        
        ElMessage.success('模型下载/初始化成功！');
        // 重新检查状态
        await checkChromeAIStatus();
        
    } catch (error) {
        console.error('下载 Chrome AI 模型失败:', error);
        ElMessage.error('下载失败: ' + (error instanceof Error ? error.message : String(error)));
         chromeAIStatusText.value = '下载失败: ' + (error instanceof Error ? error.message : String(error));
         chromeAIStatusColor.value = 'red';
    } finally {
        downloadingChromeAI.value = false;
    }
};

// 监听主题变化
watch(() => config.value.theme, (newTheme) => {
  updateTheme(newTheme || 'auto');
});

// 使用 onchange 监听系统主题变化
darkModeMediaQuery.onchange = (e) => {
  if (config.value.theme === 'auto') {
    updateTheme('auto');
  }
};

// 组件卸载时清理
onUnmounted(() => {
  darkModeMediaQuery.onchange = null;
});

// 计算样式分组
const styleGroups = computed(() => {
  const groups = options.styles.filter(item => item.disabled);
  return groups.map(group => ({
    ...group,
    options: options.styles.filter(item => !item.disabled && item.group === group.value)
  }));
});

// 计算翻译服务分组
const serviceGroups = computed(() => {
  const allServices = compute.value.filteredServices;
  const groups = [];
  let currentGroup: any = null;
  
  for (const item of allServices) {
    if (item.disabled) {
      // 这是分组标题
      if (currentGroup && currentGroup.services.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = {
        label: item.label,
        services: []
      };
    } else if (currentGroup) {
      // 添加到当前分组
      currentGroup.services.push(item);
    }
  }
  
  // 添加最后一个分组
  if (currentGroup && currentGroup.services.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
});

// 恢复默认模板
const resetTemplate = () => {
  ElMessageBox.confirm(
    '确定要恢复默认的 system 和 user 模板吗？此操作将覆盖当前的自定义模板。',
    '恢复默认模板',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    config.value.system_role[config.value.service] = defaultOption.system_role;
    config.value.user_role[config.value.service] = defaultOption.user_role;
    ElMessage({
      message: '已成功恢复默认翻译模板',
      type: 'success',
      duration: 2000
    });
  }).catch(() => {
    // 用户取消操作，不做任何处理
  });
};

// 悬浮球开关的计算属性
const floatingBallEnabled = computed({
  get: () => !config.value.disableFloatingBall && config.value.on,
  set: (value) => {
    config.value.disableFloatingBall = !value;
    // 向所有激活的标签页发送消息
    browser.tabs.query({}).then(tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          browser.tabs.sendMessage(tab.id, { 
            type: 'toggleFloatingBall',
            isEnabled: value 
          }).catch(() => {
            // 忽略发送失败的错误（可能是页面未加载内容脚本）
          });
        }
      });
    });
  }
});

// MainAdvancedBody 通过 emit 更新 config 时合并到 ref
function mergeConfig(patch: Record<string, any>) {
  if (!patch || typeof patch !== 'object') return;
  Object.assign(config.value, patch);
}

// MainAdvancedBody 通过 emit 更新悬浮球开关时应用（与 computed setter 一致）
function applyFloatingBallEnabled(value: boolean) {
  floatingBallEnabled.value = value;
}

// 监听划词翻译模式变化
watch(() => config.value.selectionTranslatorMode, (newMode) => {
  // 向所有激活的标签页发送消息
  browser.tabs.query({}).then(tabs => {
    tabs.forEach(tab => {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, { 
          type: 'updateSelectionTranslatorMode',
          mode: newMode 
        }).catch(() => {
          // 忽略发送失败的错误（可能是页面未加载内容脚本）
        });
      }
    });
  });
});

// 监听开关变化
const handleSwitchChange = () => {
  showRefreshTip.value = true;
};

// 处理翻译服务变化
const handleServiceChange = (value: string) => {
  console.log('Service changed to:', value);
  // 确保值已更新
  config.value.service = value;
  // 触发刷新提示
  showRefreshTip.value = true;
};

// 处理插件状态变化
const handlePluginStateChange = (val: boolean) => {
  // 如果插件被关闭，确保悬浮球和划词翻译也被关闭
  if (!val) {
    // 处理悬浮球
    if (!config.value.disableFloatingBall) {
      config.value.disableFloatingBall = true;
      // 向所有激活的标签页发送消息，关闭悬浮球
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, { 
              type: 'toggleFloatingBall',
              isEnabled: false
            }).catch(() => {
              // 忽略发送失败的错误（可能是页面未加载内容脚本）
            });
          }
        });
      });
    }
    
    // 处理划词翻译
    if (config.value.selectionTranslatorMode !== 'disabled') {
      config.value.selectionTranslatorMode = 'disabled';
      // 向所有激活的标签页发送消息，关闭划词翻译
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, { 
              type: 'updateSelectionTranslatorMode',
              mode: 'disabled'
            }).catch(() => {
              // 忽略发送失败的错误（可能是页面未加载内容脚本）
            });
          }
        });
      });
    }
  }
};

// 处理悬浮球开关变化
const toggleFloatingBall = (val: boolean) => {
  // 向所有激活的标签页发送消息
  browser.tabs.query({}).then(tabs => {
    tabs.forEach(tab => {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, { 
          type: 'toggleFloatingBall',
          isEnabled: val 
        }).catch(() => {
          // 忽略发送失败的错误（可能是页面未加载内容脚本）
        });
      }
    });
  });
};

// 自定义快捷键相关
const showCustomHotkeyDialog = ref(false);
const showCustomMouseHotkeyDialog = ref(false);

// 配置导入导出相关
const showExportConfig = ref(false);
const showImportConfig = ref(false);
const exportedConfig = ref('');
const importConfigText = ref('');
const importLoading = ref(false);

// 处理快捷键选择变化
const handleHotkeyChange = (value: string) => {
  if (value === 'custom') {
    // 选择自定义后，如果没有设置过自定义快捷键，自动打开设置对话框
    if (!config.value.customFloatingBallHotkey) {
      // 延迟一下，让选择框先完成状态更新
      setTimeout(() => {
        openCustomHotkeyDialog();
      }, 100);
    }
  }
};

// 打开自定义快捷键对话框
const openCustomHotkeyDialog = () => {
  showCustomHotkeyDialog.value = true;
};

// 确认自定义快捷键
const handleCustomHotkeyConfirm = (hotkey: string) => {
  config.value.customFloatingBallHotkey = hotkey;
  config.value.floatingBallHotkey = 'custom';
  
  ElMessage({
    message: hotkey === 'none' ? '已禁用快捷键' : `快捷键已设置为: ${getCustomHotkeyDisplayName()}`,
    type: 'success',
    duration: 2000
  });
};

// 取消自定义快捷键
const handleCustomHotkeyCancel = () => {
  // 如果没有自定义快捷键，回退到默认选项
  if (!config.value.customFloatingBallHotkey) {
    config.value.floatingBallHotkey = 'Alt+A';
  }
};

// 获取自定义快捷键显示名称
const getCustomHotkeyDisplayName = () => {
  if (!config.value.customFloatingBallHotkey) return '';
  
  if (config.value.customFloatingBallHotkey === 'none') {
    return '已禁用';
  }
  
  const parsed = parseHotkey(config.value.customFloatingBallHotkey);
  return parsed.isValid ? parsed.displayName : config.value.customFloatingBallHotkey;
};

// 处理鼠标悬浮快捷键选择变化
const handleMouseHotkeyChange = (value: string) => {
  if (value === 'custom') {
    // 选择自定义后，如果没有设置过自定义快捷键，自动打开设置对话框
    if (!config.value.customHotkey) {
      // 延迟一下，让选择框先完成状态更新
      setTimeout(() => {
        openCustomMouseHotkeyDialog();
      }, 100);
    }
  }
};

// 打开自定义鼠标悬浮快捷键对话框
const openCustomMouseHotkeyDialog = () => {
  showCustomMouseHotkeyDialog.value = true;
};

// 确认自定义鼠标悬浮快捷键
const handleCustomMouseHotkeyConfirm = (hotkey: string) => {
  config.value.customHotkey = hotkey;
  config.value.hotkey = 'custom';
  
  ElMessage({
    message: hotkey === 'none' ? '已禁用快捷键' : `快捷键已设置为: ${getCustomMouseHotkeyDisplayName()}`,
    type: 'success',
    duration: 2000
  });
};

// 取消自定义鼠标悬浮快捷键
const handleCustomMouseHotkeyCancel = () => {
  // 如果没有自定义快捷键，回退到默认选项
  if (!config.value.customHotkey) {
    config.value.hotkey = 'Control';
  }
};

// 获取自定义鼠标悬浮快捷键显示名称
const getCustomMouseHotkeyDisplayName = () => {
  if (!config.value.customHotkey) return '';
  
  if (config.value.customHotkey === 'none') {
    return '已禁用';
  }
  
  const parsed = parseHotkey(config.value.customHotkey);
  return parsed.isValid ? parsed.displayName : config.value.customHotkey;
};

// 处理并发数量变化
const handleConcurrentChange = (currentValue: number | undefined, oldValue: number | undefined) => {
  // 验证并发数量的有效性
  if (currentValue === undefined || currentValue < 1 || currentValue > 100) {
    ElMessage({
      message: '并发数量必须在 1-100 之间',
      type: 'warning',
      duration: 2000
    });
    // 恢复默认值
    config.value.maxConcurrentTranslations = 6;
    return;
  }
  // 写入 config，触发 watch 保存到 storage，并更新界面
  config.value.maxConcurrentTranslations = currentValue;
  // 显示刷新提示（内容页需刷新后新并发数才在队列中生效）
  showRefreshTip.value = true;
  ElMessage({
    message: `并发数量已更新为 ${currentValue}`,
    type: 'success',
    duration: 2000
  });
};

// 显示刷新提示
const showRefreshTip = ref(false);

// 刷新页面：优先刷新内容页；若当前为设置/弹窗页则刷新同窗口下第一个内容页
const refreshPage = async () => {
  const extensionOrigin = browser.runtime.getURL('').replace(/\/$/, '');
  const isExtensionPage = (url: string | undefined) => !!url && url.startsWith(extensionOrigin);
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  let tabToReload = activeTab;
  if (activeTab?.id && isExtensionPage(activeTab.url)) {
    const windowTabs = await browser.tabs.query({ currentWindow: true });
    const contentTab = windowTabs.find(t => t.id && !isExtensionPage(t.url));
    if (contentTab?.id) tabToReload = contentTab;
  }
  if (tabToReload?.id) {
    await browser.tabs.reload(tabToReload.id);
    showRefreshTip.value = false;
  } else {
    ElMessage({ message: '请切换到要刷新的网页后再点击刷新', type: 'info', duration: 2000 });
  }
};

const showExportBox = ref(false);
const exportData = ref('');
const showImportBox = ref(false);
const importData = ref('');

// Azure OpenAI 端点地址验证函数
const isValidAzureEndpoint = (endpoint: string) => {
  if (!endpoint || endpoint.trim() === '') {
    return false;
  }

  // 检查是否包含必要的组件
  const hasAzureDomain = endpoint.includes('openai.azure.com');
  const hasChatCompletions = endpoint.includes('/chat/completions');
  const hasHttps = endpoint.startsWith('https://');

  return hasHttps && hasAzureDomain && hasChatCompletions;
};

const handleExport = async () => {
  const configStr = await storage.getItem('local:config');
  if (!configStr) {
    ElMessage({
      message: '没有找到配置信息',
      type: 'warning',
    });
    return;
  }

  const configToExport = JSON.parse(configStr as string);

  // Create a deep copy to avoid modifying the actual config
  const cleanedConfig = JSON.parse(JSON.stringify(configToExport));

  // Clean system_role and user_role if they are default
  if (cleanedConfig.system_role) {
    for (const service in cleanedConfig.system_role) {
      if (cleanedConfig.system_role[service] === defaultOption.system_role) {
        delete cleanedConfig.system_role[service];
      }
    }
    if (Object.keys(cleanedConfig.system_role).length === 0) {
      delete cleanedConfig.system_role;
    }
  }

  if (cleanedConfig.user_role) {
    for (const service in cleanedConfig.user_role) {
      if (cleanedConfig.user_role[service] === defaultOption.user_role) {
        delete cleanedConfig.user_role[service];
      }
    }
    if (Object.keys(cleanedConfig.user_role).length === 0) {
      delete cleanedConfig.user_role;
    }
  }

  exportData.value = JSON.stringify(cleanedConfig, null, 2);
  showExportBox.value = !showExportBox.value;
  showImportBox.value = false;
};

const handleImport = () => {
  showImportBox.value = !showImportBox.value;
  showExportBox.value = false;
};

const saveImport = async () => {
  try {
    const parsedConfig = JSON.parse(importData.value);
    // Add validation here
    if (!validateConfig(parsedConfig)) {
      ElMessage({
        message: '配置无效或格式不正确, 请检查!',
        type: 'error',
      });
      return;
    }
    await storage.setItem('local:config', JSON.stringify(parsedConfig));
    ElMessage({
      message: '配置导入成功!',
      type: 'success',
    });
    showImportBox.value = false;
    importData.value = '';
    // Optionally, reload the extension or relevant parts
  } catch (e) {
    ElMessage({
      message: '配置格式错误, 请检查!',
      type: 'error',
    });
  }
};

// 切换导出配置显示
const toggleExportConfig = async () => {
  if (showExportConfig.value) {
    // 如果已经显示，则隐藏
    showExportConfig.value = false;
    exportedConfig.value = '';
  } else {
    // 如果未显示，则显示并生成配置
    try {
      // 确保从storage获取最新的配置
      const latestConfig = await storage.getItem('local:config');
      let configToExport;

      if (latestConfig && typeof latestConfig === 'string') {
        // 使用storage中的最新配置
        configToExport = JSON.parse(latestConfig);
      } else {
        // 如果storage中没有，使用当前config.value
        configToExport = JSON.parse(JSON.stringify(config.value));
      }

      exportedConfig.value = JSON.stringify(configToExport, null, 2);
      showExportConfig.value = true;

      ElMessage({
        message: '配置已生成，请复制保存',
        type: 'success',
        duration: 2000
      });
    } catch (error) {
      ElMessage({
         message: '导出配置失败：' + ((error as Error)?.message || '未知错误'),
         type: 'error',
         duration: 3000
       });
    }
  }
};

// 复制导出的配置到剪贴板
const copyExportedConfig = async () => {
  try {
    await navigator.clipboard.writeText(exportedConfig.value);
    ElMessage({
      message: '配置已复制到剪贴板',
      type: 'success',
      duration: 2000
    });
  } catch (error) {
    ElMessage({
      message: '复制失败，请手动复制',
      type: 'warning',
      duration: 2000
    });
  }
};

// 切换导入配置显示
const toggleImportConfig = () => {
  if (showImportConfig.value) {
    // 如果已经显示，则隐藏并清空内容
    showImportConfig.value = false;
    importConfigText.value = '';
  } else {
    // 如果未显示，则显示
    showImportConfig.value = true;
    importConfigText.value = '';
  }
};

// 取消导入
const cancelImport = () => {
  // 清空输入框并隐藏导入区域
  importConfigText.value = '';
  showImportConfig.value = false;
  importLoading.value = false;
};

// 导入配置
const importConfig = async () => {
  if (!importConfigText.value.trim()) {
    ElMessage({
      message: '请输入配置内容',
      type: 'warning',
      duration: 2000
    });
    return;
  }

  importLoading.value = true;

  try {
    // 解析JSON配置
    const importedConfig = JSON.parse(importConfigText.value);

    // 验证配置格式
    if (!validateConfig(importedConfig)) {
      throw new Error('配置格式不正确');
    }

    // 确认导入
    await ElMessageBox.confirm(
      '导入配置将覆盖当前所有设置，确定要继续吗？',
      '确认导入',
      {
        confirmButtonText: '确定导入',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    // 应用新配置
    Object.assign(config.value, importedConfig);

    // 保存到storage
    await storage.setItem('local:config', JSON.stringify(config.value));

    // 隐藏导入区域并清空输入
    showImportConfig.value = false;
    importConfigText.value = '';

    ElMessage({
      message: '配置导入成功',
      type: 'success',
      duration: 2000
    });

  } catch (error) {
    if ((error as Error).message !== 'cancel') {
      ElMessage({
        message: '导入失败：' + ((error as Error).message || '配置格式错误'),
        type: 'error',
        duration: 3000
      });
    }
  } finally {
    importLoading.value = false;
  }
};

// 验证配置格式
const validateConfig = (configData: any): boolean => {
  try {
    // 检查是否是对象
    if (typeof configData !== 'object' || configData === null) {
      return false;
    }

    // 检查必要的配置字段
    const requiredFields = ['on', 'service', 'display', 'from', 'to'];
    for (const field of requiredFields) {
      if (!(field in configData)) {
        return false;
      }
    }

    // 检查服务配置
    if (typeof configData.service !== 'string') {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

</script>

<style scoped>

.select-left {
  text-align: left;
}

.flex-end {
  display: flex;
  justify-content: flex-end;
}

.select-divider {
  background: #f2f6fc;
  color: #409eff;
  font-size: 14px;
  padding: 4px 12px;
  cursor: default;
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
  border-bottom: 1px solid #e4e7ed;
  margin: 4px 0;
  pointer-events: none;
  opacity: 0.9;
}

.icon-margin {
  margin-left: 0.25em;
}

/* 添加自适应样式 */
:deep(.el-select) {
  width: 100%;
}

:deep(.el-input) {
  width: 100%;
}

/* 统一紧凑行间距（不缩小字号） */
.margin-bottom {
  margin-bottom: 6px;
}

.adv-row {
  margin-bottom: 6px;
}

/* 段落小标题与卡片之间也统一 */
:deep(.settings-block .group-title) {
  margin-bottom: 4px;
}

/* 自定义接口：橙色高亮 */
.custom-interface-row {
  padding: 6px 8px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(255, 153, 0, 0.10), rgba(255, 102, 0, 0.05));
  border: 1px solid rgba(255, 153, 0, 0.35);
}
.custom-interface-label {
  background: rgba(255, 153, 0, 0.15) !important;
  color: #d35400;
}
:deep(.custom-interface-input .el-input__wrapper) {
  box-shadow: 0 0 0 1px rgba(255, 153, 0, 0.55) inset !important;
  background-color: #fff8ed !important;
}

/* 配置管理：标题与按钮同行 */
.config-mgmt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
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

.margin-left-2em {
  margin-left: 1em;
  margin-right: 1em;
}

/* 设置内导航菜单：插件状态上一行，专业菜单样式 */
.settings-section-menu {
  display: flex;
  align-items: stretch;
  gap: 0;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.settings-section-menu__item {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  text-align: center;
  color: var(--el-text-color-regular);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  transition: color 0.2s, background 0.2s;
  white-space: nowrap;
}

.settings-section-menu__item:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-blank);
}

.settings-section-menu__item:active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

/* 设置区块卡片化，更清晰分层 */
.settings-block {
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.settings-block .section-header {
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.settings-row {
  align-items: center;
}

.margin-top-2em {
  margin-top: 1em;
}

.margin-top-1em {
  margin-top: 0.5em;
}

/* 设置滚动条样式 */
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

.refresh-tip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  margin: 0 1em;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 8px;
}

.refresh-tip-text {
  flex: 1;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.refresh-button {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.5em 1em;
  color: #fff;
  background-color: #409eff;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s, color 0.3s;
}

.refresh-button:hover {
  background-color: #66b1ff;
  color: #fff;
}

.new-feature-badge {
  display: inline-block;
  font-size: 12px;
  background-color: #f56c6c;
  color: white;
  padding: 1px 6px;
  border-radius: 10px;
  margin-right: 8px;
  font-weight: bold;
  animation: bounce 1s infinite alternate;
}

@keyframes pulse-glow {
  0% {
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
  }
  100% {
    box-shadow: 0 2px 12px rgba(64, 158, 255, 0.5);
  }
}

@keyframes bounce {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(-3px);
  }
}

/* 自定义快捷键相关样式 */
.hotkey-config {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.custom-hotkey-display {
  display: flex;
  align-items: center;
  padding: 6px 6px 6px 10px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 4px;
  font-size: 14px;
  height: 32px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.hotkey-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-weight: 600;
  color: var(--el-color-primary);
  font-size: 15px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  max-width: calc(100% - 32px);
}

.edit-button {
  padding: 2px 4px;
  margin-left: 4px;
  color: var(--el-color-primary);
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-button:hover {
  background: var(--el-color-primary-light-8);
}

.edit-button .el-icon {
  font-size: 12px;
}

.placeholder-text {
  color: var(--el-text-color-placeholder) !important;
  font-style: italic;
  font-family: inherit !important;
  font-weight: normal !important;
}

/* 自定义快捷键行样式 */
.custom-hotkey-row {
  border-radius: 8px;
  padding: 8px;
  margin: 6px 0 !important;
  background: linear-gradient(135deg, 
    rgba(64, 158, 255, 0.03) 0%, 
    rgba(64, 158, 255, 0.01) 50%, 
    rgba(103, 194, 58, 0.02) 100%);
  transition: all 0.3s ease;
  position: relative;
  border: 1px solid transparent;
}

.custom-hotkey-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, 
    rgba(64, 158, 255, 0.2) 0%, 
    rgba(64, 158, 255, 0.1) 30%,
    rgba(103, 194, 58, 0.1) 70%,
    rgba(103, 194, 58, 0.2) 100%);
  border-radius: 8px;
  z-index: -1;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.custom-hotkey-row::after {
  content: '';
  position: absolute;
  top: -1px;
  left: -1px;
  right: -1px;
  bottom: -1px;
  background: linear-gradient(135deg, 
    rgba(64, 158, 255, 0.3), 
    rgba(103, 194, 58, 0.3));
  border-radius: 8px;
  z-index: -2;
  opacity: 0.6;
}

.custom-hotkey-row:hover {
  background: linear-gradient(135deg, 
    rgba(64, 158, 255, 0.05) 0%, 
    rgba(64, 158, 255, 0.03) 50%, 
    rgba(103, 194, 58, 0.04) 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}

.custom-hotkey-row:hover::before {
  opacity: 0.1;
}

/* 自定义标识徽章 */
.custom-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  background: var(--el-color-primary);
  color: white;
  font-size: 12px;
  border-radius: 10px;
  font-weight: 500;
  margin-left: 6px;
  line-height: 1;
}

/* 错误样式 */
.input-error {
  border-color: var(--el-color-danger) !important;
}

.input-error:focus {
  border-color: var(--el-color-danger) !important;
  box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.2) !important;
}

.error-text {
  color: var(--el-color-danger);
  font-size: 14px;
  margin-top: 4px;
  line-height: 1.4;
}

/* 翻译服务单选组样式 */
.section-header {
  margin-bottom: 12px;
}

/* Translation service selector styles */
.service-selector {
  width: 100%;
}

.service-group-section {
  margin-bottom: 12px;
}

.service-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.service-card {
  border: 2px solid var(--el-border-color);
  border-radius: 6px;
  padding: 6px 4px;
  cursor: pointer;
  background: var(--el-bg-color);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 36px;
}

.service-card:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-fill-color-light);
}

.service-card.selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.12);
}

.service-name {
  font-size: 14px;
  line-height: 1.2;
}

/* 译文样式卡片选择器样式 */
.style-selector {
  width: 100%;
}

.style-group-section {
  margin-bottom: 10px;
}

.style-group-section:last-child {
  margin-bottom: 0;
}

.group-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  margin-bottom: 4px;
  padding-left: 4px;
}

.style-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  margin-top: 4px;
}

.style-card {
  border: 2px solid var(--el-border-color);
  border-radius: 6px;
  padding: 3px 5px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--el-bg-color);
}

.style-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.12);
  transform: translateY(-1px);
}

.style-card.selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

.style-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  background: var(--el-fill-color-lighter);
  border-radius: 3px;
  min-height: auto;
}

.style-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  text-align: center;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Translation style classes for preview */
.verse-vibe-display-dimmed {
  opacity: 0.7;
}

.verse-vibe-display-solid-underline {
  border-bottom: 2px solid #409EFF;
}

.verse-vibe-display-dot-underline {
  border-bottom: 2px dotted #409EFF;
}

.verse-vibe-display-learning-mode {
  background: linear-gradient(transparent 60%, gold 40%);
}

.verse-vibe-display-transparent-mode {
  opacity: 0.85;
}

.verse-vibe-display-card-mode {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(64, 158, 255, 0.1);
}

.verse-vibe-display-marker {
  background: #FFEB3B;
  padding: 0 4px;
}

.verse-vibe-display-quote {
  border-left: 4px solid #409EFF;
  padding-left: 8px;
  font-style: italic;
}

.verse-vibe-display-bold {
  font-weight: 700;
}

.verse-vibe-display-lightyellow {
  background-color: rgba(255, 235, 59, 0.2);
}

.verse-vibe-display-lightblue {
  background-color: rgba(64, 158, 255, 0.1);
}

.verse-vibe-display-lightgray {
  background-color: rgba(158, 158, 158, 0.1);
}

.verse-vibe-display-italic {
  font-style: italic;
}

.verse-vibe-display-border {
  border: 1px solid #409EFF;
  border-radius: 4px;
  padding: 2px 6px;
}

.verse-vibe-display-text-shadow {
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
}

.verse-vibe-display-modern-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
  border-radius: 8px;
  padding: 6px 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  margin: 4px 0;
}

.verse-vibe-display-wavy {
  text-decoration: wavy underline #409EFF;
  text-underline-offset: 4px;
}

.verse-vibe-display-wavy-red {
  text-decoration: none !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 4'%3E%3Cpath fill='none' stroke='%23f56c6c' stroke-width='1.5' stroke-linecap='round' d='M0 3 Q5 0 10 3 T20 3'/%3E%3C/svg%3E");
  background-repeat: repeat-x;
  background-position: bottom;
  background-size: 20px 4px;
  padding-bottom: 3px;
}

.verse-vibe-display-highlight-fade {
  background: linear-gradient(104deg, rgba(64, 158, 255, 0) 0.9%, rgba(64, 158, 255, 0.1) 2.4%, rgba(64, 158, 255, 0.15) 5.8%, rgba(64, 158, 255, 0.1) 93%, rgba(64, 158, 255, 0.1) 96%);
  padding: 0.5em 0.8em;
  border-radius: 4px;
}

.verse-vibe-display-elegant {
  font-family: Georgia, serif;
  color: #666;
  line-height: 1.6;
  letter-spacing: 0.3px;
}

.verse-vibe-display-focus {
  background: linear-gradient(to right, transparent, rgba(64, 158, 255, 0.1) 4%, rgba(64, 158, 255, 0.1) 96%, transparent);
  padding: 4px 12px;
  border-radius: 3px;
}

.verse-vibe-display-paper {
  background-color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  border: 1px solid #eee;
  padding: 8px 12px;
  border-radius: 6px;
}

.verse-vibe-display-clean {
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 2px;
  margin-bottom: 2px;
}

.verse-vibe-display-tech {
  font-family: 'Consolas', monospace;
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #eee;
}

</style>
