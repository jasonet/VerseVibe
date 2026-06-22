package com.fluentread.android.translation

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * 简单的翻译仓库：
 * - 持有当前选中的引擎
 * - 负责调用具体引擎，并对外暴露最近一次翻译结果
 */
class TranslationRepository(
    private val engines: List<TranslationEngine> = listOf(EchoTranslationEngine()),
) {

    private val _currentEngine =
        MutableStateFlow<TranslationEngine>(engines.first())
    val currentEngine: StateFlow<TranslationEngine> = _currentEngine.asStateFlow()

    private val _lastResult = MutableStateFlow<String?>(null)
    val lastResult: StateFlow<String?> = _lastResult.asStateFlow()

    fun availableEngines(): List<TranslationEngine> = engines

    fun selectEngine(id: String) {
        engines.firstOrNull { it.id == id }?.let {
            _currentEngine.value = it
        }
    }

    suspend fun translate(text: String, source: String?, target: String) {
        val engine = _currentEngine.value
        val result = engine.translate(text, source, target)
        _lastResult.value = result
    }
}

