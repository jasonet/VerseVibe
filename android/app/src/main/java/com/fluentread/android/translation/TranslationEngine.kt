package com.fluentread.android.translation

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Android 端的翻译引擎抽象。
 *
 * 设计理念：与浏览器扩展中的多引擎结构对齐，但以 Kotlin 接口形式表示，
 * 方便后续根据现有 TS 配置迁移各个引擎的 HTTP 调用逻辑。
 */
interface TranslationEngine {
    val id: String
    val displayName: String

    /**
     * @param text 需要翻译的文本
     * @param source 可选源语言（auto / zh / en 等）
     * @param target 目标语言
     */
    suspend fun translate(
        text: String,
        source: String?,
        target: String,
    ): String
}

/**
 * 一个简单的占位实现：模拟“本地 Echo 翻译”，方便在未接好真实接口前调试 UI 流程。
 */
class EchoTranslationEngine : TranslationEngine {
    override val id: String = "echo"
    override val displayName: String = "本地示例引擎（Echo）"

    override suspend fun translate(
        text: String,
        source: String?,
        target: String,
    ): String = withContext(Dispatchers.Default) {
        "[$target] $text"
    }
}

