package com.laveintedigital.app.external

import android.view.View

/**
 * Tracks vertical scroll direction in a WebView and notifies [onScrollUp] / [onScrollDown].
 * A small dead-zone (5 dp) prevents flickering.
 *
 * Attach to a WebView via `view.setOnScrollChangeListener(...)`.
 *
 * Note: [ExternalWebViewScrollCallback] must be `View.OnScrollChangeListener` so it can be
 * attached to the WebView.  The callbacks run on the main thread.
 */
class ExternalWebViewScrollCallback(
    private val onScrollUp: () -> Unit,
    private val onScrollDown: () -> Unit,
) : View.OnScrollChangeListener {

    private var lastScrollY = 0
    private var accumulator = 0f

    override fun onScrollChange(
        v: View?,
        scrollX: Int,
        scrollY: Int,
        oldScrollX: Int,
        oldScrollY: Int,
    ) {
        val delta = scrollY.toFloat() - lastScrollY.toFloat()
        lastScrollY = scrollY
        accumulator += delta
        val threshold = 24f  // ~6 dp
        if (accumulator > threshold) {
            onScrollDown()
            accumulator = 0f
        } else if (accumulator < -threshold) {
            onScrollUp()
            accumulator = 0f
        }
    }
}
