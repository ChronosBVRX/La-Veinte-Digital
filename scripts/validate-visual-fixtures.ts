/**
 * Validación programática de fixtures representativos para calidad visual documental.
 *
 * Evalúa los 8 casos exigidos:
 * 1. Hoja blanca con iluminación uniforme.
 * 2. Hoja con sombra lateral (degradado).
 * 3. Documento ligeramente amarillo (iluminación cálida).
 * 4. Texto pequeño (trazos de 1-2 px).
 * 5. Firma con tinta fina (trazo tenue).
 * 6. Sello azul y sello rojo.
 * 7. Tabla con líneas finas (cuadrícula de 1 px).
 * 8. INE/credencial de prueba (sin datos personales reales, con tramas y fotografía).
 *
 * Ejecutar con: npx tsx scripts/validate-visual-fixtures.ts
 */

import {
  enhanceDocument,
  enhanceGrayscale,
  enhanceBlackAndWhite,
  enhanceIdentification,
} from "../src/features/document-scanner/lib/document-enhancement"
import {
  createRaster,
  getPixel,
  setPixel,
} from "../src/features/document-scanner/lib/raster"

interface ValidationResult {
  fixture: string
  status: "PASS" | "FAIL"
  details: string
}

const results: ValidationResult[] = []

function assert(condition: boolean, fixture: string, details: string) {
  if (condition) {
    results.push({ fixture, status: "PASS", details })
  } else {
    results.push({ fixture, status: "FAIL", details: `FALLÓ: ${details}` })
  }
}

// 1. Hoja blanca con iluminación uniforme
function testUniformWhitePaper() {
  const raster = createRaster(100, 100)
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
      setPixel(raster, x, y, [238, 238, 238, 255])
    }
  }
  // Línea de texto negro
  for (let x = 20; x < 80; x++) setPixel(raster, x, 50, [30, 30, 30, 255])

  const doc = enhanceDocument(raster)
  const [bgR, bgG, bgB] = getPixel(doc, 10, 10)
  const [textR] = getPixel(doc, 50, 50)

  assert(bgR === 255 && bgG === 255 && bgB === 255, "1. Hoja blanca uniforme", `Fondo papel = (${bgR}, ${bgG}, ${bgB}), esperado (255,255,255)`)
  assert(textR <= 25, "1. Hoja blanca uniforme", `Tinta de texto = ${textR}, esperado <= 25`)
}

// 2. Hoja con sombra lateral
function testLateralShadow() {
  const raster = createRaster(100, 100)
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
      const val = Math.round(235 - (x / 99) * 110) // 235 (luz) -> 125 (sombra)
      setPixel(raster, x, y, [val, val, val, 255])
    }
  }
  const doc = enhanceDocument(raster)
  const [lightR] = getPixel(doc, 10, 50)
  const [shadowR] = getPixel(doc, 90, 50)
  const delta = Math.abs(lightR - shadowR)

  assert(lightR >= 248 && shadowR >= 245 && delta <= 10, "2. Hoja con sombra lateral", `Luz=${lightR}, Sombra=${shadowR}, Delta=${delta} (sombra eliminada con éxito)`)
}

// 3. Documento ligeramente amarillo
function testYellowedDocument() {
  const raster = createRaster(100, 100)
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
      // Tinte cálido: R=242, G=226, B=188
      setPixel(raster, x, y, [242, 226, 188, 255])
    }
  }
  const doc = enhanceDocument(raster)
  const [r, g, b] = getPixel(doc, 50, 50)

  assert(r === 255 && g === 255 && b === 255, "3. Documento amarillo", `Color papel corregido a blanco puro neutro: (${r}, ${g}, ${b})`)
}

// 4. Texto pequeño
function testSmallText() {
  const raster = createRaster(80, 80)
  for (let y = 0; y < 80; y++) {
    for (let x = 0; x < 80; x++) setPixel(raster, x, y, [230, 230, 230, 255])
  }
  // Trazos finos simulando caracteres de 8pt (1 píxel de ancho con separación)
  for (let y = 38; y <= 42; y++) {
    for (let x = 20; x <= 60; x += 3) {
      setPixel(raster, x, y, [50, 50, 50, 255])
    }
  }
  const doc = enhanceDocument(raster)
  const [paper] = getPixel(doc, 10, 10)
  const [charStroke] = getPixel(doc, 20, 40)
  const contrast = paper - charStroke

  assert(paper >= 250 && charStroke <= 35 && contrast > 210, "4. Texto pequeño", `Contraste fondo-letra = ${contrast} (caracteres pequeños negros y nítidos)`)
}

// 5. Firma con tinta fina
function testFineSignature() {
  const raster = createRaster(80, 80)
  for (let y = 0; y < 80; y++) {
    for (let x = 0; x < 80; x++) setPixel(raster, x, y, [228, 228, 228, 255])
  }
  // Trazo suave de bolígrafo (1 px de espesor, valor 160)
  for (let i = 10; i < 70; i++) {
    setPixel(raster, i, Math.round(40 + Math.sin(i / 5) * 6), [160, 160, 175, 255])
  }
  const doc = enhanceDocument(raster)
  const gray = enhanceGrayscale(raster)
  const bw = enhanceBlackAndWhite(raster)

  const [strokeDoc] = getPixel(doc, 30, Math.round(40 + Math.sin(30 / 5) * 6))
  const [strokeGray] = getPixel(gray, 30, Math.round(40 + Math.sin(30 / 5) * 6))
  const [strokeBw] = getPixel(bw, 30, Math.round(40 + Math.sin(30 / 5) * 6))

  assert(strokeDoc < 230, "5. Firma tinta fina (Documento)", `Firma conservada con tono visible=${strokeDoc} sobre papel 255`)
  assert(strokeGray < 230, "5. Firma tinta fina (Grises)", `Firma conservada en grises con tono=${strokeGray}`)
  assert(strokeBw === 0, "5. Firma tinta fina (Blanco y negro)", `Firma detectada como trazo sólido (0) en B/N`)
}

// 6. Sello azul y sello rojo
function testStamps() {
  const raster = createRaster(100, 100)
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) setPixel(raster, x, y, [235, 228, 200, 255])
  }
  // Sello azul
  for (let y = 20; y < 40; y++) {
    for (let x = 20; x < 40; x++) setPixel(raster, x, y, [55, 95, 215, 255])
  }
  // Sello rojo
  for (let y = 60; y < 80; y++) {
    for (let x = 60; x < 80; x++) setPixel(raster, x, y, [215, 55, 55, 255])
  }

  const doc = enhanceDocument(raster)
  const [blueR, , blueB] = getPixel(doc, 30, 30)
  const [redR, , redB] = getPixel(doc, 70, 70)

  assert(blueB > blueR + 100 && blueB > 220, "6. Sello azul", `Azul vibrante conservado: R=${blueR}, B=${blueB}`)
  assert(redR > redB + 100 && redR > 220, "6. Sello rojo", `Rojo vibrante conservado: R=${redR}, B=${redB}`)
}

// 7. Tabla con líneas finas
function testTableGrid() {
  const raster = createRaster(100, 100)
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) setPixel(raster, x, y, [232, 232, 232, 255])
  }
  // Cuadrícula de 1 px cada 25 px
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
      if (x % 25 === 0 || y % 25 === 0) {
        setPixel(raster, x, y, [130, 130, 130, 255])
      }
    }
  }

  const doc = enhanceDocument(raster)
  const bw = enhanceBlackAndWhite(raster)

  const [lineDoc] = getPixel(doc, 25, 50)
  const [cellDoc] = getPixel(doc, 12, 12)
  const [lineBw] = getPixel(bw, 25, 50)

  assert(lineDoc < 200 && cellDoc === 255, "7. Tabla líneas finas", `Línea=${lineDoc}, Celda=${cellDoc} (línea de tabla visible, celda limpia)`)
  assert(lineBw === 0, "7. Tabla líneas finas (B/N)", `Línea de tabla preservada en binarizado`)
}

// 8. INE de prueba (sin datos personales reales)
function testIneCredential() {
  const raster = createRaster(120, 80)
  // Fondo de seguridad guilloché continuo
  for (let y = 0; y < 80; y++) {
    for (let x = 0; x < 120; x++) {
      const wave = Math.sin(x / 4) * 8 + Math.cos(y / 4) * 8
      setPixel(raster, x, y, [Math.round(200 + wave), Math.round(215 + wave * 0.8), 210, 255])
    }
  }
  // Recuadro de fotografía con degradado
  for (let y = 15; y < 65; y++) {
    for (let x = 10; x < 45; x++) {
      const val = Math.round(100 + ((x + y) / 100) * 80)
      setPixel(raster, x, y, [val, Math.round(val * 0.85), Math.round(val * 0.75), 255])
    }
  }

  // Comportamiento del pipeline: en INE se conserva Original
  const idEnhanced = enhanceIdentification(raster)

  const [bgR, bgG, bgB] = getPixel(idEnhanced, 90, 40)
  const [photoR] = getPixel(idEnhanced, 25, 40)

  // En INE el fondo NO se blanquea a 255 para no destruir los elementos de seguridad
  assert(bgR < 250 && bgG < 250, "8. INE credencial", `Fondo de seguridad NO blanqueado agresivamente: (${bgR}, ${bgG}, ${bgB})`)
  // La foto conserva sus tonos continuos
  assert(photoR > 50 && photoR < 220, "8. INE credencial", `Fotografía conserva gradación tonal: R=${photoR}`)
}

console.log("=========================================================================================")
console.log("  VALIDACIÓN VISUAL DE FIXTURES (8 Casos Exigidos)")
console.log("=========================================================================================\n")

testUniformWhitePaper()
testLateralShadow()
testYellowedDocument()
testSmallText()
testFineSignature()
testStamps()
testTableGrid()
testIneCredential()

for (const r of results) {
  const icon = r.status === "PASS" ? "✓" : "✗"
  console.log(`  ${icon} [${r.status}] ${r.fixture}: ${r.details}`)
}

const allPassed = results.every((r) => r.status === "PASS")
console.log(`\nResultado global: ${allPassed ? "TODOS LOS FIXTURES APROBADOS (8/8)" : "HUBO FALLOS"}\n`)
