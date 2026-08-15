package com.laveintedigital.app.imss.biometric

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BiometricDiscoveryJsonTest {

    // ── parseDiscoveryState ────────────────────────────────────────────────

    @Test
    fun `estado working nunca se confunde con fallo`() {
        val info = BiometricDiscovery.parseDiscoveryState(
            """{"status":"working","runId":"gen1-att1","startedAt":123}""")
        assertNotNull(info)
        assertEquals("working", info!!.status)
        assertEquals("gen1-att1", info.runId)
        assertNull(info.reason)
        assertTrue(info.periods.isEmpty())
    }

    @Test
    fun `estado success con periodos control y muestras`() {
        val info = BiometricDiscovery.parseDiscoveryState(
            """{"status":"success","runId":"gen1-att1","periods":[{"value":"2026072","label":"2ª quincena de julio 2026"},{"value":"2026071","label":"1ª quincena de julio 2026"}],
               "control":{"kind":"mat","tag":"mat-select","id":"","formcontrolname":"periodo","role":"combobox","ariaLabel":"","label":"Periodo","evidence":"text"},
               "sampleClosed":{"count":0,"exists":false},
               "samples":[{"where":"none","count":0,"visible":0},{"where":"cdk-overlay-container","count":2,"visible":2}]}""")
        assertNotNull(info)
        assertEquals("success", info!!.status)
        assertEquals(2, info.periods.size)
        assertEquals("2026072", info.periods[0].value)
        assertEquals("mat", info.control?.kind)
        assertEquals("periodo", info.control?.formcontrolname)
        assertEquals("text", info.control?.evidence)
        assertEquals(false, info.optionsExistWhenClosed)
        assertEquals(0, info.closedCount)
        assertEquals(2, info.samples.size)
        assertEquals("cdk-overlay-container", info.samples[1].where)
        assertEquals(2, info.samples[1].count)
    }

    @Test
    fun `estado success con opciones existentes cerrado el selector`() {
        val info = BiometricDiscovery.parseDiscoveryState(
            """{"status":"success","runId":"gen1-att1","periods":[{"value":"1","label":"Primera quincena"}],
               "sampleClosed":{"count":8,"exists":true},"samples":[]}""")
        assertNotNull(info)
        assertEquals(true, info!!.optionsExistWhenClosed)
        assertEquals(8, info.closedCount)
    }

    @Test
    fun `estado error conserva la razon del portal`() {
        val info = BiometricDiscovery.parseDiscoveryState(
            """{"status":"error","runId":"gen1-att1","reason":"PERIOD_CONTROL_NOT_FOUND"}""")
        assertNotNull(info)
        assertEquals("error", info!!.status)
        assertEquals("PERIOD_CONTROL_NOT_FOUND", info.reason)
        assertNull(info.control)
    }

    @Test
    fun `estado missing o nulo no es un estado valido`() {
        assertNull(BiometricDiscovery.parseDiscoveryState("""{"status":"missing"}"""))
        assertNull(BiometricDiscovery.parseDiscoveryState(null))
        assertNull(BiometricDiscovery.parseDiscoveryState("null"))
        assertNull(BiometricDiscovery.parseDiscoveryState("undefined"))
    }

    @Test
    fun `doble serializacion de evaluateJavascript`() {
        val raw = "\"{\\\"status\\\":\\\"success\\\",\\\"runId\\\":\\\"gen1-att1\\\",\\\"periods\\\":[{\\\"value\\\":\\\"1\\\",\\\"label\\\":\\\"Única\\\"}]}\""
        val info = BiometricDiscovery.parseDiscoveryState(raw)
        assertNotNull(info)
        assertEquals(1, info!!.periods.size)
        assertEquals("Única", info.periods[0].label)
    }

    // ── parseDump ──────────────────────────────────────────────────────────

    @Test
    fun `dump estructural lista controles sanitizados`() {
        val raw = """{"path":"/guitpei-web/app/administration/biometric/consult-period","url":"https://tuperfil.imss.gob.mx/guitpei-web/app/administration/biometric/consult-period","title":"Consulta de periodos","controls":[
            {"tag":"mat-select","id":"","formcontrolname":"periodo","role":"combobox","text":"2ª quincena de julio 2026","visible":true,"rect":"10,300x200","children":0},
            {"tag":"input","id":"matricula","name":"matricula","type":"password","visible":true,"sensitive":true},
            {"tag":"option","value":"2026072","text":"2ª quincena de julio 2026","visible":false}
        ]}"""
        val report = BiometricDiscovery.parseDump(raw)
        assertNotNull(report)
        assertEquals(3, report!!.controls.size)
        val select = report.controls[0]
        assertEquals("mat-select", select.tag)
        assertEquals("periodo", select.formcontrolname)
        assertTrue(select.visible == true)
        val sensitive = report.controls[1]
        assertTrue(sensitive.sensitive == true)
        assertNull(sensitive.value)
        val option = report.controls[2]
        assertEquals("2026072", option.value)
    }

    @Test
    fun `dump nulo o invalido`() {
        assertNull(BiometricDiscovery.parseDump(null))
        assertNull(BiometricDiscovery.parseDump("undefined"))
    }

    // ── structureLog ───────────────────────────────────────────────────────

    @Test
    fun `estructura de resultados describe contenedores visibles`() {
        val raw = """{"status":"rows","columns":[],"rows":[],"structure":[
            {"kind":"mat-table","cls":"mat-mdc-table","rows":2,"headers":3},
            {"kind":".mat-card","cls":"","rows":0,"headers":0}
        ]}"""
        val log = BiometricDiscovery.structureLog(raw)
        assertEquals("mat-table(rows=2,headers=3) | .mat-card(rows=0,headers=0)", log)
    }

    @Test
    fun `estructura sin contenedores visibles`() {
        assertEquals("sin contenedores visibles",
            BiometricDiscovery.structureLog("""{"status":"loading","structure":[]}"""))
    }

    @Test
    fun `estructura ausente devuelve nulo`() {
        assertNull(BiometricDiscovery.structureLog("""{"status":"loading"}"""))
        assertNull(BiometricDiscovery.structureLog(null))
    }

    // ── Sanidad de los scripts JS (composición) ────────────────────────────

    @Test
    fun `scripts estan compuestos con la libreria compartida`() {
        assertTrue(BiometricDiscovery.startDiscoveryJs("gen1-att1").startsWith("(function(){"))
        assertTrue(BiometricDiscovery.startDiscoveryJs("gen1-att1").contains("__LVD_BIO_LIB__"))
        assertTrue(BiometricDiscovery.readDiscoveryStateJs().contains("__LVD_BIO_DISCOVERY__"))
        assertTrue(BiometricDiscovery.dumpJs().contains("__LVD_BIO_LIB__"))
        assertTrue(BiometricDiscovery.netMonitorJs().contains("__LVD_BIO_NET_V2__"))
    }

    @Test
    fun `startDiscoveryJs embebe el runId`() {
        assertTrue(BiometricDiscovery.startDiscoveryJs("gen1-att1").contains("gen1-att1"))
    }

    // ── Fase de consulta: apply/verify/buttons/counts/net/timeline ─────────

    @Test
    fun `parseApplyDetail conserva las banderas del JS`() {
        val info = BiometricDiscovery.parseApplyDetail(
            """{"ok":true,"controlFound":true,"optionFound":true,"clickPerformed":true,"overlayClosed":true}""")
        assertNotNull(info)
        assertTrue(info!!.ok == true)
        assertTrue(info.controlFound == true)
        assertTrue(info.optionFound == true)
        assertTrue(info.clickPerformed == true)
        assertTrue(info.overlayClosed == true)
        assertNull(info.reason)
    }

    @Test
    fun `parseApplyDetail fallo conserva razon y banderas parciales`() {
        val info = BiometricDiscovery.parseApplyDetail(
            """{"ok":false,"reason":"PERIOD_OPTION_NOT_FOUND","controlFound":true,"optionFound":false,"clickPerformed":false,"overlayClosed":false}""")
        assertNotNull(info)
        assertEquals(false, info!!.ok)
        assertEquals("PERIOD_OPTION_NOT_FOUND", info.reason)
        assertTrue(info.controlFound == true)
        assertTrue(info.optionFound == false)
    }

    @Test
    fun `parseVerifyDetail click ejecutado no implica seleccion aplicada`() {
        // El portal puede mantener el displayText anterior: expectedMatch=false.
        val info = BiometricDiscovery.parseVerifyDetail(
            """{"found":true,"displayText":"1ª QUINCENA JULIO 2026","expectedMatch":false,"overlayOpen":false}""")
        assertNotNull(info)
        assertTrue(info!!.found == true)
        assertEquals("1ª QUINCENA JULIO 2026", info.displayText)
        assertEquals(false, info.expectedMatch)
        assertEquals(false, info.overlayOpen)
    }

    @Test
    fun `parseVerifyDetail seleccion aplicada`() {
        val info = BiometricDiscovery.parseVerifyDetail(
            """{"found":true,"displayText":"2ª QUINCENA JULIO 2026","expectedMatch":true,"overlayOpen":false}""")
        assertNotNull(info)
        assertEquals(true, info!!.expectedMatch)
    }

    @Test
    fun `parseButtons lista botones visibles con diagnostico`() {
        val buttons = BiometricDiscovery.parseButtons(
            """[{"tag":"button","id":"","type":"submit","text":"Consultar","disabled":false,"ariaDisabled":"","cls":"btn btn-primary","rect":"10,120x300"}]""")
        assertEquals(1, buttons.size)
        val b = buttons[0]
        assertEquals("button", b.tag)
        assertEquals("Consultar", b.text)
        assertEquals(false, b.disabled)
        assertEquals("btn btn-primary", b.cls)
        assertEquals("10,120x300", b.rect)
    }

    @Test
    fun `parseSnapshotCounts lee los conteos estructurales`() {
        val c = BiometricDiscovery.parseSnapshotCounts(
            """{"status":"waiting","counts":{"tables":0,"matTables":1,"rows":0,"matRows":0,"roleTables":0,"roleRows":0,"cards":2,"lists":1}}""")
        assertNotNull(c)
        assertEquals(0, c!!.tables)
        assertEquals(1, c.matTables)
        assertEquals(2, c.cards)
        assertEquals(1, c.lists)
        assertTrue(BiometricDiscovery.snapshotCountsLog("""{"counts":{"tables":1,"matTables":1,"rows":12,"matRows":12}}""")!!.contains("matRows=12"))
    }

    @Test
    fun `parseNet y parseActivity alimentan la linea de tiempo`() {
        val net = BiometricDiscovery.parseNet(
            """[{"m":"POST","p":"/api/biometric/consult","s":200,"st":1000,"t":1700,"d":700}]""")
        assertEquals(1, net.size)
        assertEquals("POST", net[0].method)
        assertEquals(700L, net[0].durationMs)
        val activity = BiometricDiscovery.parseActivity("""[{"t":1760,"added":4,"removed":0}]""")
        assertEquals(1, activity.size)
        assertEquals(1760L, activity[0].t)

        val timeline = BiometricDiscovery.buildTimeline(activity, net, startedAt = 1000L, rowsAt = 1900L)
        assertTrue(timeline.startsWith("submit+0ms"))
        assertTrue(timeline.contains("XHR_START+0ms"))
        assertTrue(timeline.contains("HTTP200+700ms"))
        assertTrue(timeline.contains("DOM+760ms"))
        assertTrue(timeline.contains("ROWS+900ms"))
    }

    @Test
    fun `linea de tiempo sin actividad observable`() {
        val timeline = BiometricDiscovery.buildTimeline(emptyList(), emptyList(), startedAt = 0L, rowsAt = null)
        assertEquals("submit+0ms sin actividad observable", timeline)
    }

    @Test
    fun `verify y apply scripts estan compuestos con la libreria`() {
        assertTrue(BiometricDiscovery.verifyPeriodJs("label", "value").contains("__LVD_BIO_LIB__"))
        assertTrue(BiometricDiscovery.applyPeriodJs("label", "value", "17", "Michoacán").contains("__LVD_BIO_APPLY_RESULT__"))
        assertTrue(BiometricDiscovery.dumpButtonsJs().contains("ariaDisabled"))
        assertTrue(BiometricDiscovery.readNetJs().contains("__LVD_BIO_NET_V2__"))
        assertTrue(BiometricDiscovery.readActivityJs().contains("__LVD_BIO_ACTIVITY__"))
    }

    // ── OOAD 17 — Michoacán (1.0.63) ──────────────────────────────────────

    @Test
    fun `parseOoadRead succes devuelve control y opciones`() {
        val info = BiometricDiscovery.parseOoadRead(
            """{"status":"success","runId":"ooad-gen1-att1","ooads":[
                {"value":"17","label":"Michoacán"},{"value":"16","label":"Puebla"}],
               "control":{"kind":"mat","tag":"mat-select","formcontrolname":"ooad","label":"OOAD","evidence":"text"}}""")
        assertNotNull(info)
        assertEquals("success", info!!.status)
        assertEquals(2, info.ooads.size)
        assertEquals("17", info.ooads[0].value)
        assertEquals("Michoacán", info.ooads[0].label)
        assertEquals("mat", info.control?.kind)
        assertEquals("ooad", info.control?.formcontrolname)
    }

    @Test
    fun `parseOoadRead error conserva la razon`() {
        val info = BiometricDiscovery.parseOoadRead(
            """{"status":"error","runId":"ooad-gen1-att1","reason":"OOAD_CONTROL_NOT_FOUND"}""")
        assertNotNull(info)
        assertEquals("error", info!!.status)
        assertEquals("OOAD_CONTROL_NOT_FOUND", info.reason)
        assertTrue(info.ooads.isEmpty())
    }

    @Test
    fun `parseOoadRead missing o nulo no es estado valido`() {
        assertNull(BiometricDiscovery.parseOoadRead("""{"status":"missing"}"""))
        assertNull(BiometricDiscovery.parseOoadRead(null))
    }

    @Test
    fun `parseOoadStatus refleja la OOAD actual`() {
        val ok = BiometricDiscovery.parseOoadStatus(
            """{"found":true,"displayText":"17 - Michoacán","isDefault":true,"overlayOpen":false}""")
        assertNotNull(ok)
        assertTrue(ok!!.found == true)
        assertTrue(ok.isDefault == true)
        assertEquals("17 - Michoacán", ok.displayText)

        val wrong = BiometricDiscovery.parseOoadStatus(
            """{"found":true,"displayText":"16 - Puebla","isDefault":false,"overlayOpen":false}""")
        assertNotNull(wrong)
        assertTrue(wrong!!.found == true)
        assertTrue(wrong.isDefault == false)
    }

    @Test
    fun `parsePeriodRefresh reporta conteo y estado de carga`() {
        val ok = BiometricDiscovery.parsePeriodRefresh(
            """{"status":"success","runId":"refresh-gen1-att1","count":8,"controlFound":true,"loading":false}""")
        assertNotNull(ok)
        assertEquals("success", ok!!.status)
        assertEquals(8, ok.count)
        assertTrue(ok.controlFound == true)
        assertTrue(ok.loading == false)

        val err = BiometricDiscovery.parsePeriodRefresh(
            """{"status":"error","runId":"refresh-gen1-att1","reason":"PERIOD_OPTIONS_EMPTY","loading":true}""")
        assertNotNull(err)
        assertEquals("PERIOD_OPTIONS_EMPTY", err!!.reason)
        assertTrue(err.loading == true)
    }

    @Test
    fun `parseClassify identifica OOAD y Periodo por indice`() {
        val report = BiometricDiscovery.parseClassify(
            """{"controls":[
                {"index":0,"tag":"mat-select","label":"OOAD","formcontrolname":"ooad","ariaLabel":"","placeholder":"","text":"Michoacán","options":0},
                {"index":1,"tag":"mat-select","label":"Periodo","formcontrolname":"periodo","ariaLabel":"","placeholder":"","text":"2ª quincena julio 2026","options":0}],
               "ooad":{"found":true,"index":0,"evidence":"text"},
               "period":{"found":true,"index":1,"evidence":"text"}}""")
        assertNotNull(report)
        assertEquals(2, report!!.controls.size)
        assertTrue(report.ooadFound)
        assertEquals(0, report.ooadIndex)
        assertEquals("text", report.ooadEvidence)
        assertTrue(report.periodFound)
        assertEquals(1, report.periodIndex)
        assertEquals("OOAD", report.controls[0].label)
        assertEquals("Periodo", report.controls[1].label)
    }

    @Test
    fun `parseClassify con selectores ausentes`() {
        val report = BiometricDiscovery.parseClassify(
            """{"controls":[],"ooad":{"found":false,"index":-1,"evidence":""},"period":{"found":false,"index":-1,"evidence":""}}""")
        assertNotNull(report)
        assertTrue(report!!.controls.isEmpty())
        assertTrue(!report.ooadFound)
        assertNull(report.ooadIndex)
        assertTrue(!report.periodFound)
    }

    @Test
    fun `parseApplyDetail conserva ooad y opciones disponibles`() {
        val info = BiometricDiscovery.parseApplyDetail(
            """{"ok":false,"reason":"PERIOD_OPTION_NOT_FOUND","controlFound":true,"optionFound":false,"clickPerformed":false,
                "overlayClosed":false,"ooadVerified":true,"ooadText":"17 - Michoacán",
                "availableLabels":["1ª quincena de agosto 2026","2ª quincena de julio 2026"]}""")
        assertNotNull(info)
        assertEquals(false, info!!.ok)
        assertEquals("PERIOD_OPTION_NOT_FOUND", info.reason)
        assertTrue(info.ooadVerified == true)
        assertEquals("17 - Michoacán", info.ooadText)
        assertEquals(2, info.availableLabels.size)
        assertEquals("1ª quincena de agosto 2026", info.availableLabels[0])
    }

    @Test
    fun `applyPeriod lleva el pre-check de OOAD (WRONG_OOAD)`() {
        val script = BiometricDiscovery.applyPeriodJs("2ª quincena de julio 2026", "2026072", "17", "Michoacán")
        assertTrue(script.contains("WRONG_OOAD"))
        assertTrue(script.contains("OOAD_VALUE"))
        assertTrue(script.contains("Michoacán"))
    }

    @Test
    fun `scripts de OOAD y refresh estan compuestos con la libreria`() {
        assertTrue(BiometricDiscovery.startOoadReadJs("ooad-gen1-att1").contains("__LVD_BIO_OOAD_READ__"))
        assertTrue(BiometricDiscovery.readOoadStateJs().contains("__LVD_BIO_OOAD_READ__"))
        assertTrue(BiometricDiscovery.applyOoadJs("17", "Michoacán").contains("__LVD_BIO_OOAD_APPLY_RESULT__"))
        assertTrue(BiometricDiscovery.verifyOoadJs("17", "Michoacán").contains("__LVD_BIO_LIB__"))
        assertTrue(BiometricDiscovery.ooadStatusJs("17", "Michoacán").contains("isDefault"))
        assertTrue(BiometricDiscovery.startPeriodRefreshJs("refresh-gen1-att1").contains("__LVD_BIO_PERIOD_REFRESH__"))
        assertTrue(BiometricDiscovery.readPeriodRefreshStateJs().contains("__LVD_BIO_PERIOD_REFRESH__"))
        assertTrue(BiometricDiscovery.classifyControlsJs().contains("__LVD_BIO_LIB__"))
    }
}
