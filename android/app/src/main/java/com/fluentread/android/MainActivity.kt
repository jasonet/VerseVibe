package com.fluentread.android

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.fluentread.android.overlay.FloatingBubbleService
import com.fluentread.android.translation.TranslationPreview
import com.fluentread.android.ui.theme.FluentReadAndroidTheme

class MainActivity : ComponentActivity() {

    private val overlayPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            // 回到应用时，Compose 会重新读取权限状态
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            FluentReadAndroidTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    MainScreen(
                        onRequestOverlayPermission = { openOverlayPermissionPage() },
                        onToggleBubble = { enabled ->
                            if (enabled) {
                                FloatingBubbleService.start(this)
                            } else {
                                FloatingBubbleService.stop(this)
                            }
                        },
                    )
                }
            }
        }
    }

    private fun openOverlayPermissionPage() {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:$packageName"),
        )
        overlayPermissionLauncher.launch(intent)
    }
}

@Composable
private fun MainScreen(
    onRequestOverlayPermission: () -> Unit,
    onToggleBubble: (Boolean) -> Unit,
) {
    val context = LocalContext.current
    var hasOverlayPermission by remember { mutableStateOf(canDrawOverlays(context.packageName)) }
    var bubbleEnabled by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        hasOverlayPermission = canDrawOverlays(context.packageName)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Top,
        horizontalAlignment = Alignment.Start,
    ) {
        Text(
            text = "FluentRead 全局翻译（Android）",
            style = MaterialTheme.typography.headlineSmall,
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "1. 授予悬浮窗权限，以便在任意应用上显示悬浮球。\n" +
                "2. 打开悬浮球后，可通过复制文本或系统分享，将内容发送给 FluentRead 进行翻译。",
            style = MaterialTheme.typography.bodyMedium,
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "悬浮球权限",
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(modifier = Modifier.height(8.dp))
        if (hasOverlayPermission) {
            Text(
                text = "已授予在其他应用上层显示的权限。",
                style = MaterialTheme.typography.bodyMedium,
            )
        } else {
            Button(onClick = onRequestOverlayPermission) {
                Text("去系统设置中授予悬浮窗权限")
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "系统级悬浮球",
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(modifier = Modifier.height(8.dp))
        RowWithSwitch(
            label = "启用悬浮球（复制 → 点击悬浮球 → 翻译）",
            checked = bubbleEnabled,
            enabled = hasOverlayPermission,
            onCheckedChange = {
                bubbleEnabled = it
                onToggleBubble(it)
            },
        )

        Spacer(modifier = Modifier.height(32.dp))

        Text(
            text = "翻译效果预览（示例）",
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(modifier = Modifier.height(8.dp))
        TranslationPreview(
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun RowWithSwitch(
    label: String,
    checked: Boolean,
    enabled: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    androidx.compose.foundation.layout.Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f),
        )
        Switch(
            checked = checked,
            enabled = enabled,
            onCheckedChange = onCheckedChange,
        )
    }
}

private fun canDrawOverlays(packageName: String): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        Settings.canDrawOverlays(null)
    } else {
        true
    }
}

