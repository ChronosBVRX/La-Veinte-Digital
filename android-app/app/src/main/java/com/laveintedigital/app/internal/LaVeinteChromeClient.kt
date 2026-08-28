package com.laveintedigital.app.internal

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView

class LaVeinteChromeClient : WebChromeClient() {

    internal var onLaunchFilePicker: ((ValueCallback<Array<Uri>>?, FileChooserParams?) -> Boolean)? = null

    internal var onWebPermissionRequest: ((PermissionRequest) -> Unit)? = null

    override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?,
    ): Boolean {
        return onLaunchFilePicker?.invoke(filePathCallback, fileChooserParams) ?: false
    }

    override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
        // Forward page console output (including our PRINT_FLOW diagnostics) to logcat so the
        // web-side flow can be debugged from adb.
        message?.let {
            val tag = "LVD-WEB[${it.messageLevel()}]"
            android.util.Log.i(tag, it.message() ?: "")
        }
        return true
    }

    override fun onPermissionRequest(request: PermissionRequest?) {
        val r = request ?: return
        val cameraGranted = android.content.pm.PackageManager.PERMISSION_GRANTED ==
            webViewContext()?.let {
                androidx.core.content.ContextCompat.checkSelfPermission(
                    it, android.Manifest.permission.CAMERA,
                )
            }
        android.util.Log.i(
            "PRINT_FLOW",
            "web_permission_request origin=${r.origin} resources=${r.resources?.joinToString(",")} androidCameraGranted=$cameraGranted",
        )
        onWebPermissionRequest?.invoke(r) ?: run {
            android.util.Log.i("PRINT_FLOW", "web_permission_denied (no handler)")
            r.deny()
        }
    }

    private var hostActivity: android.app.Activity? = null
    fun attachActivity(activity: android.app.Activity?) { hostActivity = activity }
    private fun webViewContext(): android.content.Context? = hostActivity
}
