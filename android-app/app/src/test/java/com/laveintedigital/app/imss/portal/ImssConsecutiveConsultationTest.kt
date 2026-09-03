package com.laveintedigital.app.imss.portal

import com.laveintedigital.app.imss.credentials.ImssPortal
import com.laveintedigital.app.imss.tarjeton.PortalOoad
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class ImssConsecutiveConsultationTest {

    @Before
    fun setUp() {
        ImssPdfCaptureCoordinator.resetSession()
    }

    @Test
    fun testConsecutiveCaptureSessionsCleanlyReset() {
        val session1 = ImssPdfCaptureCoordinator.startCaptureSession(
            portal = ImssPortal.TARJETON_DIGITAL,
            ooadCode = "09",
            ooadLabel = "DF NORTE",
            periodCode = "202615",
            periodLabel = "Quincena 15 - Agosto 2026",
        )
        assertNotNull("First session must be created", session1)
        assertEquals("09", session1?.ooadCode)
        assertEquals("202615", session1?.periodCode)

        // Without closing modal, user immediately requests another period
        val session2 = ImssPdfCaptureCoordinator.startCaptureSession(
            portal = ImssPortal.TARJETON_DIGITAL,
            ooadCode = "09",
            ooadLabel = "DF NORTE",
            periodCode = "202616",
            periodLabel = "Quincena 16 - Agosto 2026",
        )
        assertNotNull("Second session must not be blocked and must start cleanly", session2)
        assertNotEquals("Each session must have a unique ID", session1?.id, session2?.id)
        assertEquals("202616", session2?.periodCode)

        // Repeat the exact same period consecutively
        val session3 = ImssPdfCaptureCoordinator.startCaptureSession(
            portal = ImssPortal.TARJETON_DIGITAL,
            ooadCode = "09",
            ooadLabel = "DF NORTE",
            periodCode = "202616",
            periodLabel = "Quincena 16 - Agosto 2026",
        )
        assertNotNull("Third session (repeated period) must succeed", session3)
        assertNotEquals("Session 3 must have unique ID", session2?.id, session3?.id)

        // Explicit resetSession clears active session
        ImssPdfCaptureCoordinator.resetSession()
        assertNull("activeSession must be null after resetSession", ImssPdfCaptureCoordinator.activeSession)
    }

    @Test
    fun testTuPerfilConsecutiveSessionsCleanlyReset() {
        val ooad = PortalOoad("01", "01 AGUASCALIENTES", "AGUASCALIENTES")
        val period1 = com.laveintedigital.app.imss.tarjeton.PeriodParser.parse("2026/01")
        val period2 = com.laveintedigital.app.imss.tarjeton.PeriodParser.parse("2026/02")

        val s1 = ImssPdfCaptureCoordinator.startCaptureSession(ImssPortal.TU_PERFIL, ooad, period1)
        assertNotNull("First TuPerfil session must start", s1)
        assertEquals("2026/01", s1?.periodCode)

        val s2 = ImssPdfCaptureCoordinator.startCaptureSession(ImssPortal.TU_PERFIL, ooad, period2)
        assertNotNull("Second TuPerfil session must succeed without manual close", s2)
        assertEquals("2026/02", s2?.periodCode)
        assertNotEquals(s1?.id, s2?.id)

        ImssPdfCaptureCoordinator.finishSession()
        assertNull(ImssPdfCaptureCoordinator.activeSession)
    }
}
