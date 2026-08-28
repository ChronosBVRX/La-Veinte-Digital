package com.laveintedigital.app.internal

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
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

    override fun onPermissionRequest(request: PermissionRequest?) {
        request?.let { onWebPermissionRequest?.invoke(it) ?: it.deny() }
    }
}
