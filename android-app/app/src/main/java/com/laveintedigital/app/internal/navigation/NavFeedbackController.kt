package com.laveintedigital.app.internal.navigation

import android.os.Handler
import android.os.Looper

/**
 * Foto UI que consume Compose: solo visibilidad del overlay y variante de texto.
 */
internal data class NavUiState(
    val overlayVisible: Boolean = false,
    val slowText: Boolean = false,
)

/**
 * Programador de temporizadores inyectable para no depender de coroutines-test
 * en pruebas JVM (cero dependencias nuevas).
 */
internal interface NavScheduler {
    fun schedule(delayMs: Long, token: Any, action: () -> Unit)
    fun cancel(token: Any)
}

/** Implementación productiva sobre el hilo principal. */
internal object MainHandlerScheduler : NavScheduler {
    private val handler = Handler(Looper.getMainLooper())
    private val pending = mutableMapOf<Any, Runnable>()

    override fun schedule(delayMs: Long, token: Any, action: () -> Unit) {
        cancel(token)
        val runnable = Runnable { action() }
        pending[token] = runnable
        handler.postDelayed(runnable, delayMs)
    }

    override fun cancel(token: Any) {
        pending.remove(token)?.let(handler::removeCallbacks)
    }
}

/**
 * Controlador del feedback nativo de navegación.
 *
 * Distingue carga real del WebView ([real]) de intención sintética SPA
 * ([pending]) con las siguientes prioridades:
 * - La carga real confirmada por `onPageStarted` SIEMPRE tiene prioridad sobre
 *   el watchdog sintético (nunca se cancela una carga real).
 * - Un `commit` viejo (generación distinta) nunca cancela una intención nueva.
 * - Un evento produce como máximo un cambio coherente; los timers llevan
 *   `epoch` para ignorar callbacks de navegaciones ya superadas
 *   (nav A start, nav B start, nav A finish → A no esconde a B).
 *
 * Toda la lógica es síncrona y corre en el hilo principal en producción;
 * en tests se maneja con reloj y scheduler falsos (determinista).
 */
internal class NavFeedbackController(
    private val clock: () -> Long = { android.os.SystemClock.uptimeMillis() },
    private val scheduler: NavScheduler = MainHandlerScheduler,
    private val config: NavFeedbackConfig = NavFeedbackConfig,
) {
    private enum class Phase { IDLE, PENDING, VISIBLE, SLOW }
    private enum class Timer { SHOW, SLOW, HIDE, WATCHDOG }

    private data class Pending(val path: String, val pageGen: Long?)

    private var enabled = true
    private var phase = Phase.IDLE
    private var real = false
    private var pending: Pending? = null
    private var epoch = 0L
    private var tStart = 0L
    private var tVisible = 0L

    /** Observador UI (Compose lo puentea a `MutableState`). */
    var onChange: (() -> Unit)? = null

    fun snapshot(): NavUiState = NavUiState(
        overlayVisible = phase == Phase.VISIBLE || phase == Phase.SLOW,
        slowText = phase == Phase.SLOW,
    )

    /** El controller solo trabaja tras el splash inicial (`initialLoadDone`). */
    fun setEnabled(value: Boolean) {
        if (enabled == value) return
        enabled = value
        if (!value) resetToIdle()
    }

    /** Tap en enlace interno detectado por el script document-start. */
    fun onIntent(path: String, pageGen: Long?) {
        if (!enabled) return
        epoch++
        pending = Pending(path, pageGen)
        if (!real) {
            tStart = clock()
            phase = Phase.PENDING
        }
        armSyntheticTimers()
        emit()
    }

    /** La URL real cambió (history API observada o popstate). */
    fun onCommit(path: String, pageGen: Long?) {
        if (!enabled) return
        val current = pending ?: return
        // Un commit viejo no cancela una generación nueva.
        if (pageGen != null && pageGen != current.pageGen) return
        if (pageGen == null && path != current.path) return
        pending = null
        cancelSyntheticTimers()
        if (!real) hideRespectingMinVisible()
        emit()
    }

    /** Fuente de verdad de documento: `onPageStarted(true)` / `onPageFinished(false)`. */
    fun onRealLoading(loading: Boolean) {
        if (!enabled) return
        if (loading) {
            epoch++
            // La carga real confirma navegación: suplanta cualquier pendiente.
            real = true
            pending = null
            cancelAllTimers()
            tStart = clock()
            if (phase == Phase.IDLE) phase = Phase.PENDING
            arm(Timer.SHOW, config.SHOW_DELAY_MS)
            arm(Timer.SLOW, config.SLOW_THRESHOLD_MS)
        } else {
            if (!real) return
            real = false
            cancelAllTimers()
            val resumed = pending
            if (resumed != null) {
                // Intención que llegó a mitad de la carga real: continúa como
                // sintética con temporizadores frescos.
                epoch++
                tStart = clock()
                phase = Phase.PENDING
                armSyntheticTimers()
            } else {
                hideRespectingMinVisible()
            }
        }
        emit()
    }

    /** Navegación consumida fuera del WebView (externa, Custom Tab, intent). */
    fun onExternallyConsumed() {
        resetToIdle()
    }

    /** Error main-frame / SSL / offline: limpiar visual, sin reintentos aquí. */
    fun onLoadFailed() {
        resetToIdle()
    }

    fun onOffline() {
        resetToIdle()
    }

    // -- Timers (siempre verifican epoch: lo viejo no toca lo nuevo). --------

    private fun onShowTimer(timerEpoch: Long) {
        if (timerEpoch != epoch) return
        if (phase == Phase.PENDING && (real || pending != null)) {
            phase = Phase.VISIBLE
            tVisible = clock()
        }
        emit()
    }

    private fun onSlowTimer(timerEpoch: Long) {
        if (timerEpoch != epoch) return
        if ((phase == Phase.VISIBLE || phase == Phase.PENDING) && (real || pending != null)) {
            if (phase == Phase.PENDING) tVisible = clock()
            phase = Phase.SLOW
        }
        emit()
    }

    private fun onHideTimer(timerEpoch: Long) {
        if (timerEpoch != epoch) return
        if ((phase == Phase.VISIBLE || phase == Phase.SLOW) && !real && pending == null) {
            phase = Phase.IDLE
        }
        emit()
    }

    private fun onWatchdogTimer(timerEpoch: Long) {
        if (timerEpoch != epoch) return
        // Prioridad real: con carga confirmada el watchdog no actúa.
        if (!real && pending != null) {
            pending = null
            phase = Phase.IDLE
        }
        emit()
    }

    // -- Internos -------------------------------------------------------------

    private fun hideRespectingMinVisible() {
        if (phase == Phase.VISIBLE || phase == Phase.SLOW) {
            val elapsed = clock() - tVisible
            if (elapsed >= config.MIN_VISIBLE_MS) {
                phase = Phase.IDLE
            } else {
                arm(Timer.HIDE, config.MIN_VISIBLE_MS - elapsed)
            }
        } else {
            phase = Phase.IDLE
        }
    }

    private fun resetToIdle() {
        epoch++
        cancelAllTimers()
        pending = null
        real = false
        phase = Phase.IDLE
        emit()
    }

    private fun armSyntheticTimers() {
        val e = epoch
        scheduler.schedule(config.SHOW_DELAY_MS, Timer.SHOW) { onShowTimer(e) }
        scheduler.schedule(config.SLOW_THRESHOLD_MS, Timer.SLOW) { onSlowTimer(e) }
        scheduler.schedule(config.SYNTHETIC_WATCHDOG_MS, Timer.WATCHDOG) { onWatchdogTimer(e) }
    }

    private fun cancelSyntheticTimers() {
        scheduler.cancel(Timer.SHOW)
        scheduler.cancel(Timer.SLOW)
        scheduler.cancel(Timer.WATCHDOG)
    }

    private fun arm(timer: Timer, delayMs: Long) {
        val e = epoch
        scheduler.schedule(delayMs, timer) {
            when (timer) {
                Timer.SHOW -> onShowTimer(e)
                Timer.SLOW -> onSlowTimer(e)
                Timer.HIDE -> onHideTimer(e)
                Timer.WATCHDOG -> onWatchdogTimer(e)
            }
        }
    }

    private fun cancelAllTimers() {
        Timer.entries.forEach(scheduler::cancel)
    }

    private fun emit() {
        onChange?.invoke()
    }
}
