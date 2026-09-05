package com.laveintedigital.app.internal.navigation

/** Scheduler manual y determinista para pruebas JVM (sin coroutines-test). */
internal class FakeNavScheduler(var now: Long = 0L) : NavScheduler {

    private data class Task(val dueAt: Long, val token: Any, val action: () -> Unit)

    private val tasks = mutableListOf<Task>()

    override fun schedule(delayMs: Long, token: Any, action: () -> Unit) {
        cancel(token)
        tasks += Task(now + delayMs, token, action)
    }

    override fun cancel(token: Any) {
        tasks.removeAll { it.token == token }
    }

    fun advanceBy(ms: Long) {
        advanceTo(now + ms)
    }

    fun advanceTo(target: Long) {
        while (true) {
            val next = tasks.filter { it.dueAt <= target }.minByOrNull { it.dueAt } ?: break
            tasks.remove(next)
            now = next.dueAt
            next.action()
        }
        now = target
    }

    fun pendingCount(): Int = tasks.size
}
