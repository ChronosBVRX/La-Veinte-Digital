# Guía de Estilo Visual Editorial — La Veinte Radio

**Versión:** 1.0.0 (2026-09-11)  
**Propósito:** Definir los principios estéticos, paletas cromáticas, composición geométrica y estándares de renderizado visual para La Veinte Radio.

---

## 1. Filosofía y Estética

La Veinte Radio adopta una estética **editorial moderna, documental ilustrada, informativa, limpia y accesible**, orientada al trabajador mexicano contemporáneo.

### Principios Fundamentales
* **Realidad Primero, Generación Después:** Antes de representar cualquier entidad, hospital, sindicato, ley o comprobante, el sistema investiga cómo se ve en el mundo real a través de fuentes oficiales.
* **Propósito Editorial:** No se cambia de visual por azar ni por ritmo artificial (no una imagen cada 5 segundos). Se introduce un elemento visual únicamente cuando **ayuda al trabajador a comprender mejor lo que se explica**.
* **Precisión Matemática en Datos:** Ninguna cifra, porcentaje o gráfica es dibujada con IA generativa. Todas las tablas, barras y comparativas se generan programáticamente con Pillow y tipografías TrueType.
* **Respeto a la Identidad Institucional:** Los logotipos oficiales (IMSS, SNTSS, CFCRL) se incorporan como overlays vectoriales/PNG limpios sin deformaciones, sin alterar colores ni tipografías. Su presencia es estrictamente informativa/contextual.

### Qué Evitamos
* ❌ Estética tipo anime, caricatura o estilo Pixar infantil.
* ❌ Fotografías genéricas de stock corporativo falso.
* ❌ Iconografía o banderas de propaganda política o partidista.
* ❌ Alucinaciones de IA (manos deformes, textos en idiomas inventados, equipo médico imposible).
* ❌ Copia literal pixel por pixel de fotografías con derechos de autor inciertos.

---

## 2. Paleta Cromática y Tokens

| Token | Hex / RGB | Uso |
| :--- | :--- | :--- |
| **`BG_CANVAS`** | `#101218` / `rgb(16, 18, 24)` | Lienzo base editorial oscuro |
| **`CARD_BG`** | `#181C26` / `rgb(24, 28, 38)` | Fondo de tarjetas informativas y gráficas |
| **`CARD_BORDER`** | `#2C3446` / `rgb(44, 52, 70)` | Bordes y divisiones sutiles |
| **`TEXT_CREAM`** | `#F5F1E8` / `rgb(245, 241, 232)` | Tipografía principal de alta legibilidad |
| **`TEXT_MUTED`** | `#A8A29A` / `rgb(168, 162, 154)` | Notas secundarias, subtítulos y fuentes |
| **`ACCENT_GOLD`** | `#F59E0B` / `rgb(245, 158, 11)` | Identidad La Veinte Radio / Conducción Eduardo |
| **`IMSS_GREEN`** | `#0B4F37` / `rgb(11, 79, 55)` | Verde oficial institucional IMSS |
| **`SNTSS_GREEN`** | `#007A33` / `rgb(0, 122, 51)` | Verde sindical SNTSS |
| **`CFCRL_GUINDA`** | `#691C32` / `rgb(105, 28, 50)` | Guinda oficial Gobierno de México / CFCRL |
| **`ANALYSIS_BLUE`** | `#38BDF8` / `rgb(56, 189, 248)` | Cifras analíticas / Javier Ríos |
| **`BENEFIT_GREEN`**| `#10B981` / `rgb(16, 185, 129)` | Aportaciones favorables, fondos de retiro |

---

## 3. Composición y Zonas Seguras (Safe Zones)

### Formato Horizontal 16:9 (`1920x1080`)
* **Lienzo:** `1920 × 1080 px` @ 30 fps.
* **Safe Zone Editorial:** `[96, 54, 1824, 1026]` (margen del 5%).
* **Estructura:**
  * Barra superior / Branding: `y: 54..96`.
  * Logos oficiales (overlay): Esquina superior derecha `x: 1550..1820, y: 60..104`.
  * Bloque principal / Gráficos / B-roll: `x: 280..1640, y: 160..920`.
  * Indicador reactivo de audio: `x: 96..1824, y: 880..1000`.

### Formato Vertical 9:16 (`1080x1920`)
* **Lienzo:** `1080 × 1920 px` @ 30 fps.
* **Safe Zone Plataforma (Shorts / Reels / TikTok):** `[70, 200, 940, 1450]`.
* **Estructura Vertical:**
  * Margen superior libre de controles: `y: 0..200`.
  * Insignia del locutor / conductor: `y: 220..405`.
  * Bloque central de contenido / Gráficos / Tarjetas: `x: 80..930, y: 430..1330`.
  * Indicador reactivo de audio: `y: 1360..1445`.
  * Margen inferior libre de subtítulos externos y botones sociales: `y: 1450..1920`.
  * **Cero tolerancia a desbordes:** Todo elemento crítico debe satisfacer `x >= 70`, `x <= 940`, `y >= 200`, `y <= 1450`.

---

## 4. Multicapa y Profundidad

Cada frame de video se construye en capas deterministas:

```text
[ CAPA 1: FONDO ]
Lienzo oscuro (#101218) con textura sutil o B-roll editorial investigado (tratamiento viñeta + brillo 0.42).

[ CAPA 2: CONTENIDO EDITORIAL ]
Gráfico programático (Pillow), portada de documento o desglose de nómina dentro del área segura.

[ CAPA 3: OVERLAYS OFICIALES ]
Logotipo oficial transparente en proporción fija, ubicado en margen superior sin interferir con textos.

[ CAPA 4: IDENTIDAD Y REACTIVIDAD ]
Insignia del personaje locutor, reactividad de voz y tipografía cinética con paginación automática.
```
