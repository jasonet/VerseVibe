package com.fluentread.android

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob

class FluentReadApp : Application() {
    val applicationScope = CoroutineScope(SupervisorJob())
}

