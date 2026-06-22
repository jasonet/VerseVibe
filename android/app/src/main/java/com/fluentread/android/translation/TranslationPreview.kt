package com.fluentread.android.translation

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@Composable
fun TranslationPreview(
    modifier: Modifier = Modifier,
    repository: TranslationRepository = remember { TranslationRepository() },
) {
    val scope = rememberCoroutineScope()
    var input by remember { mutableStateOf("Hello, FluentRead!") }
    var output by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(repository) {
        // 初始化时先做一次示例翻译
        scope.launch {
            repository.translate(input, source = "en", target = "zh")
            output = repository.lastResult.value
        }
    }

    Column(
        modifier = modifier.padding(8.dp),
    ) {
        OutlinedTextField(
            value = input,
            onValueChange = { input = it },
            label = { Text("示例输入文本") },
            modifier = Modifier.fillMaxWidth(),
        )

        Button(
            onClick = {
                scope.launch {
                    repository.translate(input, source = null, target = "zh")
                    output = repository.lastResult.value
                }
            },
            modifier = Modifier
                .padding(top = 8.dp),
        ) {
            Text("翻译为中文（示例引擎）")
        }

        if (!output.isNullOrEmpty()) {
            Text(
                text = "翻译结果：$output",
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

