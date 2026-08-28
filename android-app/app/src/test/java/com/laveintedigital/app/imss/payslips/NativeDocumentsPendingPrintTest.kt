package com.laveintedigital.app.imss.payslips

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Tests the PendingPrint generation state machine, which the native "send to printer" QR flow
 * depends on: a freshly (re)mounted InternalWebScreen must load /transfer?print=1 exactly once per
 * "print" request, and must not re-trigger on recomposition.
 */
class NativeDocumentsPendingPrintTest {

    @Before
    fun reset() {
        NativeDocuments.PendingPrint.clear()
        NativeDocuments.PendingPrint.consume(NativeDocuments.PendingPrint.pendingGeneration())
    }

    @Test
    fun `initially there is no pending document`() {
        assertNull(NativeDocuments.PendingPrint.get())
    }

    @Test
    fun `setting a doc stores it and bumps generation`() {
        val before = NativeDocuments.PendingPrint.pendingGeneration()
        NativeDocuments.PendingPrint.set("/data/user/0/app/files/tarjetones/tarjeton_1.pdf")
        assertEquals("/data/user/0/app/files/tarjetones/tarjeton_1.pdf", NativeDocuments.PendingPrint.get())
        assertTrue(NativeDocuments.PendingPrint.pendingGeneration() > before)
    }

    @Test
    fun `an unset path means there is nothing to send`() {
        // Nothing set → the consumer must skip via get() == null regardless of generation.
        val generation = NativeDocuments.PendingPrint.pendingGeneration()
        assertNull(NativeDocuments.PendingPrint.get())
        // A generation with no path is consumable but has nothing to load.
        NativeDocuments.PendingPrint.consume(generation)
        assertTrue(NativeDocuments.PendingPrint.alreadyConsumed(generation))
    }

    @Test
    fun `consume prevents re-loading the same generation`() {
        NativeDocuments.PendingPrint.set("/path/a.pdf")
        val gen = NativeDocuments.PendingPrint.pendingGeneration()

        NativeDocuments.PendingPrint.consume(gen)

        assertTrue(NativeDocuments.PendingPrint.alreadyConsumed(gen))
    }

    @Test
    fun `setting again after consume allows a new load`() {
        NativeDocuments.PendingPrint.set("/path/a.pdf")
        val first = NativeDocuments.PendingPrint.pendingGeneration()
        NativeDocuments.PendingPrint.consume(first)
        assertTrue(NativeDocuments.PendingPrint.alreadyConsumed(first))

        NativeDocuments.PendingPrint.set("/path/b.pdf")
        val second = NativeDocuments.PendingPrint.pendingGeneration()
        assertTrue(second > first)
        assertFalse(NativeDocuments.PendingPrint.alreadyConsumed(second))
    }

    @Test
    fun `clear removes the doc and bumps generation`() {
        NativeDocuments.PendingPrint.set("/path/a.pdf")
        val gen = NativeDocuments.PendingPrint.pendingGeneration()
        NativeDocuments.PendingPrint.clear()
        assertNull(NativeDocuments.PendingPrint.get())
        assertTrue(NativeDocuments.PendingPrint.pendingGeneration() > gen)
    }

    @Test
    fun `consume resets the lastConsumed so a new set does not collide`() {
        NativeDocuments.PendingPrint.set("/path/a.pdf")
        val first = NativeDocuments.PendingPrint.pendingGeneration()
        NativeDocuments.PendingPrint.consume(first)

        NativeDocuments.PendingPrint.set("/path/a.pdf")
        val second = NativeDocuments.PendingPrint.pendingGeneration()

        assertFalse(NativeDocuments.PendingPrint.alreadyConsumed(second))
    }
}
