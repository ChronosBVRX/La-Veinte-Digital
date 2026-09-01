import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { DatabaseSync } from "node:sqlite"
import {
  retrieveNormativaSources,
  extractExactNormativaRefs,
  normalizeLegalRef,
} from "@/shared/server/normativa/normativa-retrieval"
import {
  verifyGrounding,
} from "../server/generar-escrito-service"

describe("Grounding Normativo Estricto y Verificación de Catálogo", () => {
  let tmpDir: string
  let testDbPath: string
  let db: DatabaseSync

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "normativa-test-"))
    testDbPath = path.join(tmpDir, "catalog.sqlite")
    db = new DatabaseSync(testDbPath)

    // Esquema de prueba
    db.exec(`
      CREATE TABLE documents (
        id TEXT PRIMARY KEY,
        title TEXT,
        validity TEXT,
        priority INTEGER DEFAULT 1,
        verification_status TEXT
      );

      CREATE TABLE versions (
        id TEXT PRIMARY KEY,
        document_id TEXT,
        status TEXT
      );

      CREATE TABLE chunks (
        id INTEGER PRIMARY KEY,
        chunk_key TEXT,
        document_id TEXT,
        version_id TEXT,
        pdf_page INTEGER,
        printed_page INTEGER,
        section_label TEXT,
        article TEXT,
        clause TEXT,
        numeral TEXT,
        text TEXT
      );

      CREATE VIRTUAL TABLE chunks_fts USING fts5(
        text,
        content='chunks',
        content_rowid='id'
      );
    `)
  })

  afterEach(() => {
    try {
      db.close()
    } catch {
      // noop
    }
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("incluye chunks con versions status='VERIFIED' y excluye versions status='PENDING_REVIEW' o inexistentes", async () => {
    // Documento 1: CCT vigente
    db.prepare(`INSERT INTO documents VALUES (?, ?, ?, ?, ?)`).run(
      "doc_cct",
      "Contrato Colectivo de Trabajo 2025-2027",
      "CURRENT",
      1,
      null
    )

    // Versión 1: VERIFIED
    db.prepare(`INSERT INTO versions VALUES (?, ?, ?)`).run("v_verified", "doc_cct", "VERIFIED")
    // Versión 2: PENDING_REVIEW
    db.prepare(`INSERT INTO versions VALUES (?, ?, ?)`).run("v_pending", "doc_cct", "PENDING_REVIEW")

    // Chunk con versión verificada (Cláusula 142)
    db.prepare(
      `INSERT INTO chunks (id, chunk_key, document_id, version_id, pdf_page, clause, text) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(1, "chunk_142", "doc_cct", "v_verified", 85, "142", "Permisos económicos y pases de salida.")
    db.prepare(`INSERT INTO chunks_fts (rowid, text) VALUES (?, ?)`).run(1, "Permisos económicos y pases de salida.")

    // Chunk con versión en revisión (Cláusula 999)
    db.prepare(
      `INSERT INTO chunks (id, chunk_key, document_id, version_id, pdf_page, clause, text) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(2, "chunk_999", "doc_cct", "v_pending", 120, "999", "Permisos especiales en revisión.")
    db.prepare(`INSERT INTO chunks_fts (rowid, text) VALUES (?, ?)`).run(2, "Permisos especiales en revisión.")

    // Chunk sin versión registrada en tabla versions
    db.prepare(
      `INSERT INTO chunks (id, chunk_key, document_id, version_id, pdf_page, clause, text) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(3, "chunk_no_ver", "doc_cct", "v_nonexistent", 130, "777", "Permisos no registrados.")
    db.prepare(`INSERT INTO chunks_fts (rowid, text) VALUES (?, ?)`).run(3, "Permisos no registrados.")

    const results = await retrieveNormativaSources("Permisos", 10, testDbPath)

    // Solo debe recuperar el chunk de la versión VERIFIED
    expect(results).toHaveLength(1)
    expect(results[0].chunkId).toBe("chunk_142")
    expect(results[0].clause).toBe("142")
  })

  it("no valida un Artículo 1 únicamente porque la página o fecha del fragmento contenga el dígito 1", () => {
    // Evidencia con fecha 2026-01-15 y página 1, pero sin article='1' (es artículo 84)
    const evidence = [
      {
        id: "c_84",
        chunkId: "c_84",
        documentId: "doc_lft",
        documento: "Ley Federal del Trabajo",
        version: "2026-05-14",
        tipo: null,
        numero: "Artículo 84",
        clause: null,
        article: "84",
        paginaInicio: 1,
        paginaFin: 1,
        fragmento: "Publicado el 1 de enero de 2026. El salario se integra con las gratificaciones.",
        sourceUrl: null,
        validity: "CURRENT",
        score: 90,
      },
    ]

    // Texto generado que menciona Artículo 1 (que NO está respaldado en article='84')
    const textoConArticulo1 = "Con fundamento en el Artículo 1 de la Ley Federal del Trabajo, solicito..."
    const grounding = verifyGrounding(textoConArticulo1, evidence)

    expect(grounding.isGrounded).toBe(false)
    expect(grounding.unsupportedRefs).toContain("Artículo 1")

    // Si menciona Artículo 84, sí está respaldado
    const textoConArticulo84 = "Conforme al Artículo 84 de la Ley Federal del Trabajo, el salario..."
    const grounding84 = verifyGrounding(textoConArticulo84, evidence)
    expect(grounding84.isGrounded).toBe(true)
    expect(grounding84.unsupportedRefs).toHaveLength(0)
  })

  it("normaliza exactamente cláusulas con variantes Bis / Ter", () => {
    const evidence = [
      {
        id: "c_bis",
        chunkId: "c_bis",
        documentId: "doc_cct",
        documento: "CCT",
        version: "2025-2027",
        tipo: null,
        numero: "Cláusula 47 Bis",
        clause: "47 bis",
        article: null,
        paginaInicio: 30,
        paginaFin: 30,
        fragmento: "Cláusula 47 Bis: Licencias por maternidad y cuidados maternos.",
        sourceUrl: null,
        validity: "CURRENT",
        score: 95,
      },
    ]

    expect(normalizeLegalRef("Cláusula  47   BIS")).toBe("clausula 47 bis")
    const extracted = extractExactNormativaRefs("Según la Cláusula 47 Bis del CCT...")
    expect(extracted.clause).toBe("47 bis")

    const groundingBis = verifyGrounding("De acuerdo con la Cláusula 47 Bis del CCT...", evidence)
    expect(groundingBis.isGrounded).toBe(true)

    // Cláusula 47 (sin Bis) no está respaldada por 47 Bis
    const groundingSinBis = verifyGrounding("De acuerdo con la Cláusula 47 del CCT...", evidence)
    expect(groundingSinBis.isGrounded).toBe(false)
    expect(groundingSinBis.unsupportedRefs).toContain("Cláusula 47")
  })
})
