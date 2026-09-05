package com.laveintedigital.app.internal.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Máquina de estados del feedback nativo de navegación.
 *
 * Contrato: IDLE → PENDING → VISIBLE → (SLOW) → IDLE, con la carga real del
 * WebView siempre prioritaria sobre el watchdog sintético y generaciones que
 * impiden que un finish/commit viejo esconda una navegación nueva.
 */
class NavFeedbackControllerTest {

    private lateinit var clock: FakeNavScheduler
    private lateinit var controller: NavFeedbackController
    private var changes = 0

    @Before
    fun setUp() {
        clock = FakeNavScheduler()
        controller = NavFeedbackController(clock = { clock.now }, scheduler = clock)
        changes = 0
        controller.onChange = { changes++ }
    }

    @Test
    fun `initial state is idle`() {
        val snap = controller.snapshot()
        assertFalse(snap.overlayVisible)
        assertFalse(snap.slowText)
    }

    @Test
    fun `synthetic intent stays pending under show delay`() {
        controller.onIntent("/calculadoras", 1L)
        clock.advanceBy(179L)
        assertFalse(controller.snapshot().overlayVisible)
    }

    @Test
    fun `synthetic intent becomes visible after show delay`() {
        controller.onIntent("/calculadoras", 1L)
        clock.advanceBy(180L)
        assertTrue(controller.snapshot().overlayVisible)
        assertFalse(controller.snapshot().slowText)
    }

    @Test
    fun `fast completion never shows the overlay`() {
        var everVisible = false
        controller.onChange = { if (controller.snapshot().overlayVisible) everVisible = true }
        controller.onIntent("/guia", 1L)
        clock.advanceBy(100L)
        controller.onCommit("/guia", 1L)
        clock.advanceBy(5_000L)
        assertFalse(everVisible)
        assertFalse(controller.snapshot().overlayVisible)
    }

    @Test
    fun `commit hides honoring minimum visible time`() {
        controller.onIntent("/vacaciones", 1L)
        clock.advanceBy(180L) // visible at t=180
        assertTrue(controller.snapshot().overlayVisible)
        clock.advanceBy(20L) // commit at t=200
        controller.onCommit("/vacaciones", 1L)
        clock.advanceBy(50L) // t=250: min-visible (300) not yet met
        assertTrue(controller.snapshot().overlayVisible)
        clock.advanceBy(300L) // t=550 > 180+300
        assertFalse(controller.snapshot().overlayVisible)
    }

    @Test
    fun `slow threshold switches the text`() {
        controller.onIntent("/agenda", 1L)
        clock.advanceBy(2_499L)
        assertFalse(controller.snapshot().slowText)
        clock.advanceBy(1L)
        val snap = controller.snapshot()
        assertTrue(snap.overlayVisible)
        assertTrue(snap.slowText)
    }

    @Test
    fun `synthetic watchdog clears an intent without confirmation`() {
        controller.onIntent("/perfil", 1L)
        clock.advanceBy(180L)
        assertTrue(controller.snapshot().overlayVisible)
        clock.advanceBy(12_000L)
        val snap = controller.snapshot()
        assertFalse(snap.overlayVisible)
        assertFalse(snap.slowText)
    }

    @Test
    fun `real load start drives feedback without synthetic intent`() {
        controller.onRealLoading(true)
        clock.advanceBy(179L)
        assertFalse(controller.snapshot().overlayVisible)
        clock.advanceBy(1L)
        assertTrue(controller.snapshot().overlayVisible)
    }

    @Test
    fun `real load finish hides honoring minimum visible`() {
        controller.onRealLoading(true)
        clock.advanceBy(180L)
        assertTrue(controller.snapshot().overlayVisible)
        clock.advanceBy(20L)
        controller.onRealLoading(false)
        clock.advanceBy(50L)
        assertTrue(controller.snapshot().overlayVisible)
        clock.advanceBy(500L)
        assertFalse(controller.snapshot().overlayVisible)
    }

    @Test
    fun `real load has priority over the synthetic watchdog`() {
        controller.onIntent("/escritos", 1L)
        clock.advanceBy(100L)
        controller.onRealLoading(true) // confirmación real: suplanta el pendiente
        clock.advanceBy(180L)
        assertTrue(controller.snapshot().overlayVisible)
        // El watchdog sintético (12s desde el intent) NO cancela la carga real.
        clock.advanceBy(15_000L)
        assertTrue(controller.snapshot().overlayVisible)
        controller.onRealLoading(false)
        clock.advanceBy(1_000L)
        assertFalse(controller.snapshot().overlayVisible)
    }

    @Test
    fun `stale commit does not cancel a newer generation`() {
        controller.onIntent("/a", 1L)
        controller.onIntent("/b", 2L)
        controller.onCommit("/a", 1L) // viejo: se ignora
        clock.advanceBy(180L)
        assertTrue(controller.snapshot().overlayVisible)
        controller.onCommit("/b", 2L)
        clock.advanceBy(1_000L)
        assertFalse(controller.snapshot().overlayVisible)
    }

    @Test
    fun `commit without generation must match path`() {
        controller.onIntent("/a", 1L)
        controller.onCommit("/otra", null) // no corresponde: se ignora
        clock.advanceBy(180L)
        assertTrue(controller.snapshot().overlayVisible)
        controller.onCommit("/a", null)
        clock.advanceBy(1_000L)
        assertFalse(controller.snapshot().overlayVisible)
    }

    @Test
    fun `stray commit without pending intent is ignored`() {
        controller.onCommit("/x", 9L)
        clock.advanceBy(5_000L)
        assertFalse(controller.snapshot().overlayVisible)
        assertEquals(0, clock.pendingCount())
    }

    @Test
    fun `intent during real load resumes after real finish`() {
        controller.onRealLoading(true)
        clock.advanceBy(50L)
        controller.onIntent("/documentos", 7L)
        controller.onRealLoading(false)
        // Continúa como sintética con temporizadores frescos.
        clock.advanceBy(179L)
        assertFalse(controller.snapshot().overlayVisible)
        clock.advanceBy(1L)
        assertTrue(controller.snapshot().overlayVisible)
    }

    @Test
    fun `error clears visible state immediately`() {
        controller.onRealLoading(true)
        clock.advanceBy(500L)
        assertTrue(controller.snapshot().overlayVisible)
        controller.onLoadFailed()
        assertFalse(controller.snapshot().overlayVisible)
        clock.advanceBy(20_000L)
        assertFalse(controller.snapshot().overlayVisible)
    }

    @Test
    fun `offline clears synthetic pending and overlay`() {
        controller.onIntent("/bitacora", 3L)
        clock.advanceBy(500L)
        assertTrue(controller.snapshot().overlayVisible)
        controller.onOffline()
        assertFalse(controller.snapshot().overlayVisible)
        clock.advanceBy(20_000L)
        assertFalse(controller.snapshot().overlayVisible)
    }

    @Test
    fun `externally consumed navigation clears synthetic intent`() {
        controller.onIntent("/calculadoras", 4L)
        clock.advanceBy(500L)
        assertTrue(controller.snapshot().overlayVisible)
        controller.onExternallyConsumed()
        assertFalse(controller.snapshot().overlayVisible)
        clock.advanceBy(20_000L)
        assertFalse(controller.snapshot().overlayVisible)
    }

    @Test
    fun `disabled controller ignores everything until enabled`() {
        controller.setEnabled(false)
        controller.onIntent("/x", 1L)
        controller.onRealLoading(true)
        clock.advanceBy(20_000L)
        assertFalse(controller.snapshot().overlayVisible)
        controller.setEnabled(true)
        controller.onIntent("/x", 1L)
        clock.advanceBy(180L)
        assertTrue(controller.snapshot().overlayVisible)
    }

    @Test
    fun `old generation finish cannot hide a newer navigation`() {
        controller.onIntent("/a", 1L)
        clock.advanceBy(180L)
        assertTrue(controller.snapshot().overlayVisible)
        // Una navegación real nueva suplanta; su finish cierra lo suyo.
        controller.onRealLoading(true)
        controller.onRealLoading(false)
        clock.advanceBy(1_000L)
        assertFalse(controller.snapshot().overlayVisible)
    }

    @Test
    fun `state changes are observable`() {
        controller.onIntent("/q", 1L)
        assertTrue(changes > 0)
    }
}
