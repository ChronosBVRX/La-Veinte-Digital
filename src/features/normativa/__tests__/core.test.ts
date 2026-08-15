import { describe, expect, it } from "vitest"
import { sha256Hex, isPdfBuffer, isChallengePage, daysUntil, stableId } from "@/features/normativa/core/hashing"
import { fixMojibake, normalizeText, normalizeKey, stripAccents } from "@/features/normativa/core/normalize"
import { htmlToText } from "@/features/normativa/services/extractor"
import { loadManifest } from "@/features/normativa/core/manifest"
import { computeValidity, computeProvenance } from "@/features/normativa/services/bootstrap"
import type { SourceSpec } from "@/features/normativa/core/types"

describe("hashing", () => {
  it("calcula sha256 estable", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    expect(sha256Hex("abc")).toBe(sha256Hex("abc"))
  })

  it("detecta magic bytes de PDF", () => {
    const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from("resto")])
    expect(isPdfBuffer(pdf)).toBe(true)
    expect(isPdfBuffer(Buffer.from("<html></html>"))).toBe(false)
  })

  it("detecta página de desafío Incapsula", () => {
    const challenge = Buffer.from('<html><script src="/_Incapsula_Resource?x"></script></html>')
    expect(isChallengePage(challenge)).toBe(true)
  })

  it("calcula días hasta una fecha", () => {
    const from = new Date("2026-08-14T12:00:00")
    expect(daysUntil("2026-10-15", from)).toBe(62)
    expect(daysUntil("2026-08-10", from)).toBe(-4)
  })

  it("genera ids estables", () => {
    expect(stableId("x")).toBe(stableId("x"))
    expect(stableId("x")).not.toBe(stableId("y"))
  })
})

describe("normalize", () => {
  it("corrige mojibake de codificación", () => {
    expect(fixMojibake("PolÌticas de operaciÛn")).toBe("Políticas de operación")
    expect(fixMojibake("comisiÃ³n")).toBe("comisión")
    expect(fixMojibake("secciÃ³n")).toBe("sección")
  })

  it("normaliza espacios y saltos", () => {
    expect(normalizeText("  a   b \n\n\n c ")).toBe("a b\n\nc")
  })

  it("normaliza claves", () => {
    expect(normalizeKey("  1A74-003-031. ")).toBe("1A74-003-031")
  })

  it("quita acentos", () => {
    expect(stripAccents("cláusula")).toBe("clausula")
  })

  it("convierte HTML del DOF a texto", () => {
    const html = "<html><body><p>Objetivo</p><table><tr><td>1.1</td><td>Objetivo</td></tr></table>&nbsp;&aacute;</body></html>"
    const text = htmlToText(html)
    expect(text).toContain("Objetivo")
    expect(text).toContain("1.1 | Objetivo")
    expect(text).toContain("á")
  })
})

describe("manifest", () => {
  it("carga el bootstrap-sources.yaml del repo", () => {
    const m = loadManifest("resources/normativa/bootstrap-sources.yaml")
    expect(m.cutoff).toBe("2026-08-14")
    expect(m.sources.length).toBeGreaterThanOrEqual(40)
    const cct = m.sources.find((s) => s.id === "CCT-IMSS-SNTSS-2025-2027")
    expect(cct?.effectiveFrom).toBe("2025-10-16")
    expect(cct?.effectiveUntil).toBe("2027-10-15")
    const estatutos = m.sources.find((s) => s.id === "SNTSS-ESTATUTOS-2022")
    expect(estatutos?.verificationStatus).toBe("REVIEW_REQUIRED_2026")
    const tabulador = m.sources.find((s) => s.id === "IMSS-TABULADOR-BASE-2025-2026")
    expect(tabulador?.effectiveUntil).toBe("2026-10-15")
    const st9 = m.sources.find((s) => s.id === "IMSS-3A21-003-003")
    expect(st9?.url).toBeNull()
    expect(st9?.discoveryRequired).toBe(true)
  })
})

describe("vigencia y procedencia", () => {
  it("los Estatutos 2022 nunca se marcan como vigentes automáticamente", () => {
    const spec: SourceSpec = {
      id: "SNTSS-ESTATUTOS-2022",
      title: "Estatutos SNTSS",
      organization: "SNTSS",
      type: "union_statutes",
      category: "sntss",
      url: "https://example.com/e.pdf",
      status: "official_version_available_but_current_validity_requires_check",
    }
    expect(computeValidity(spec)).toBe("PENDING_REVIEW")
  })

  it("el CCT con status current es CURRENT", () => {
    const spec: SourceSpec = {
      id: "CCT-IMSS-SNTSS-2025-2027",
      title: "CCT",
      organization: "IMSS",
      type: "collective_agreement",
      category: "cct",
      url: "https://www.imss.gob.mx/x.pdf",
      status: "current",
    }
    expect(computeValidity(spec)).toBe("CURRENT")
  })

  it("una fuente no canónica es SECONDARY", () => {
    const spec: SourceSpec = {
      id: "X",
      title: "X",
      organization: "IMSS",
      type: "regulation",
      category: "imss",
      url: "https://media.sntss.org.mx/x.pdf",
      canonical: false,
    }
    expect(computeProvenance(spec)).toBe("SECONDARY")
  })

  it("una fuente canónica es OFFICIAL", () => {
    const spec: SourceSpec = {
      id: "Y",
      title: "Y",
      organization: "IMSS",
      type: "regulation",
      category: "imss",
      url: "https://www.imss.gob.mx/y.pdf",
      canonical: true,
    }
    expect(computeProvenance(spec)).toBe("OFFICIAL")
  })
})
