package com.laveintedigital.app.imss.portal

import org.junit.Assert.assertTrue
import org.junit.Test

class TarjetonDigitalScriptContractTest {

    @Test
    fun testReportInterceptScriptHooksWindowOpenAndLoadEvent() {
        val script = TarjetonDigitalFlowController.REPORT_INTERCEPT_SCRIPT
        assertTrue("Must hook iframe window open", script.contains("w.open=function"))
        assertTrue("Must intercept wfrReporteTarjeton", script.contains("wfrReporteTarjeton"))
        assertTrue("Must call bridge onReport", script.contains("bridge.onReport(abs)"))
        assertTrue("Must attach load event listener to iframe", script.contains("addEventListener('load'"))
    }
}
