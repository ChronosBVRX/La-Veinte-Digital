package com.laveintedigital.app.offline

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OfflineSnapshotStoreTest {

    @Test
    fun `parseSnapshot parses valid worker profile, payslip 002+011, and commitments`() {
        val raw = """
            {
              "action": "syncOfflineSnapshot",
              "userId": "user-123",
              "snapshot": {
                "ownerId": "user-123",
                "syncedAtMs": 1727460000000,
                "contextRevision": "rev-42",
                "profile": {
                  "fullName": "María López",
                  "matricula": "99112233",
                  "categoria": "Enfermera General Clinica 80",
                  "antiguedad": "8 años 4 quincenas",
                  "adscripcion": "HGZ 20",
                  "workdayHours": 8.0,
                  "shift": "Matutino"
                },
                "latestPayslip": {
                  "periodLabel": "2026-Q18",
                  "totalEarnings": 12400.75,
                  "totalDeductions": 2400.25,
                  "netPay": 10000.50,
                  "vacationDueDate": "2026-11-15",
                  "lines": [
                    { "code": "002", "description": "Sueldo Base Tabular", "amount": 6500.50, "kind": "earning" },
                    { "code": "011", "description": "Ayuda para Pago de Renta Cláusula 63 Bis B", "amount": 2925.25, "kind": "earning" },
                    { "code": "151", "description": "ISR", "amount": 1400.00, "kind": "deduction" }
                  ]
                },
                "commitments": [
                  {
                    "id": "ag-1",
                    "title": "Entrega de rol vacacional",
                    "type": "union_deadline",
                    "typeLabel": "Sindical",
                    "startAt": "2026-10-05T09:00:00Z",
                    "status": "pending",
                    "notes": "Llevar copia de tarjetón"
                  }
                ]
              }
            }
        """.trimIndent()

        val parsed = OfflineSnapshotStore.parseSnapshot(raw)
        assertNotNull(parsed)
        parsed!!
        assertEquals("user-123", parsed.ownerId)
        assertEquals(1727460000000L, parsed.syncedAtMs)
        assertEquals("rev-42", parsed.contextRevision)
        assertEquals("María López", parsed.profile.fullName)
        assertEquals("Enfermera General Clinica 80", parsed.profile.categoria)
        assertEquals(8.0, parsed.profile.workdayHours!!, 0.001)

        assertNotNull(parsed.latestPayslip)
        assertEquals("2026-Q18", parsed.latestPayslip!!.periodLabel)
        assertEquals(10000.50, parsed.latestPayslip!!.netPay, 0.001)
        assertEquals("2026-11-15", parsed.latestPayslip!!.vacationDueDate)
        assertEquals(3, parsed.latestPayslip!!.lines.size)

        // Verifica que calculatorBase infiera 002 y 011 automáticamente desde las líneas del tarjetón
        assertEquals(6500.50, parsed.calculatorBase.sueldoBaseQuincenal002, 0.001)
        assertEquals(2925.25, parsed.calculatorBase.ayudaRentaQuincenal011, 0.001)
        assertEquals((6500.50 + 2925.25) * 2.0, parsed.calculatorBase.sueldoMensualIntegrado, 0.001)

        assertEquals(1, parsed.commitments.size)
        assertEquals("Entrega de rol vacacional", parsed.commitments[0].title)
    }

    @Test
    fun `parseSnapshot rejects invalid ownerId or malformed json`() {
        assertNull(OfflineSnapshotStore.parseSnapshot(""))
        assertNull(OfflineSnapshotStore.parseSnapshot("   "))
        assertNull(OfflineSnapshotStore.parseSnapshot("not-json"))
        assertNull(
            OfflineSnapshotStore.parseSnapshot(
                """{"ownerId":"../bad","syncedAtMs":123}""",
            ),
        )
    }

    @Test
    fun `calculateOfflineSegundaJulio integrates concept 002 plus concept 011`() {
        // Sueldo 002 = 6000, Ayuda de renta 011 = 3000 -> base quincenal = 9000 -> 3 quincenas (45 días) = 27000
        val resWith011 = OfflineSnapshotStore.calculateOfflineSegundaJulio(
            sueldoQuincenal002 = 6000.0,
            ayudaRentaQuincenal011 = 3000.0,
            diasLaboradosAnio = 365,
        )
        assertEquals(27000.0, resWith011, 0.001)

        // Sin 011 -> usa 002 puro (6000 * 3 = 18000)
        val resWithout011 = OfflineSnapshotStore.calculateOfflineSegundaJulio(
            sueldoQuincenal002 = 6000.0,
            ayudaRentaQuincenal011 = 0.0,
            diasLaboradosAnio = 365,
        )
        assertEquals(18000.0, resWithout011, 0.001)
    }

    @Test
    fun `calculateOfflineAguinaldo and TiempoExtra are deterministic`() {
        val aguinaldo = OfflineSnapshotStore.calculateOfflineAguinaldo(
            sueldoMensualBase = 15000.0,
            diasLaboradosAnio = 365,
        )
        // 3 meses (90 días) = 45,000
        assertEquals(45000.0, aguinaldo, 0.001)

        val extra = OfflineSnapshotStore.calculateOfflineTiempoExtra(
            sueldoQuincenalBase = 6000.0,
            workdayHours = 8.0,
            extraHours = 11.0,
        )
        // Diario = 400, hora = 50. Primeras 9h dobles = 9 * 100 = 900; 2h triples = 2 * 150 = 300; total = 1200
        assertEquals(1200.0, extra, 0.001)
    }

    @Test
    fun `searchCatalog matches by code and keywords`() {
        val byCode = OfflineSnapshotStore.searchCatalog("011")
        assertTrue(byCode.any { it.code == "011" })

        val byKeyword = OfflineSnapshotStore.searchCatalog("Fondo de Ahorro")
        assertTrue(byKeyword.any { it.code == "055" })
    }
}
