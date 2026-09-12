# Biblia de Personajes e Identidad — La Veinte Radio

**Versión:** 1.0.0 (2026-09-11)  
**Propósito:** Especificar el rol editorial, tono, geometría, paleta cromática y restricciones de cada integrante del equipo de La Veinte Radio.

---

## 1. Eduardo — Conductor Titular

* **Rol:** Conductor principal, ancla editorial y facilitador del diálogo.
* **Tono:** Cálido, claro, institucional, ecuánime, firme y empático con la base trabajadora.
* **Geometría Visual:** Círculos armónicos concéntricos (`shape: "circles"`).
* **Color de Acento:** Ámbar dorado `#F59E0B` (`rgb(245, 158, 11)`).
* **Velocidad de Reactividad:** `speed: 0.25` (ritmo pausado y seguro).
* **Entrada Cinética:** `"warm"` (fade-in suave con desplazamiento sutil desde la izquierda).
* **Restricciones:** No muestra avatar antropomórfico; la identidad se expresa a través de su tipografía, placa y osciloscopio geométrico reactivo.

---

## 2. Andrea — Co-conductora

* **Rol:** Co-conductora, voz de las dudas cotidianas del trabajador y síntesis práctica.
* **Tono:** Dinámico, cercano, incisivo, cuestionador y orientado a la utilidad directa.
* **Geometría Visual:** Curvas fluidas entrelazadas (`shape: "curves"`).
* **Color de Acento:** Amarillo sol `#FBBF24` (`rgb(251, 191, 36)`).
* **Velocidad de Reactividad:** `speed: 0.45` (ágil y enérgica).
* **Entrada Cinética:** `"quick"` (transición rápida con asentamiento elástico).
* **Posición Espacial:** Lado derecho (`side: +1`).

---

## 3. Javier Ríos — Analista Normativo

* **Rol:** Analista jurídico y normativo (especialista en CCT, LFT, LSS y Reglamentos).
* **Tono:** Sobrio, técnico pero pedagógico, preciso, basado rigurosamente en citas documentales.
* **Geometría Visual:** Retícula estructurada y nodos interconectados (`shape: "grid"`).
* **Color de Acento:** Azul cielo analítico `#7DD3FC` (`rgb(125, 211, 252)`).
* **Velocidad de Reactividad:** `speed: 0.18` (estable, metódica y analítica).
* **Entrada Cinética:** `"steady"` (construcción progresiva de nodos al ritmo del argumento).
* **Posición Espacial:** Lado izquierdo (`side: -1`).

---

## 4. Rodrigo Torres — Corresponsal

* **Rol:** Corresponsal de campo y enlace con la realidad operativa en clínicas y hospitales.
* **Tono:** Directo, testimonial, reporteril, práctico y aterrizado a ejemplos numéricos concretos.
* **Geometría Visual:** Barras verticales dinámicas de espectro (`shape: "bars"`).
* **Color de Acento:** Verde esmeralda fresco `#6EE7B7` (`rgb(110, 231, 183)`).
* **Velocidad de Reactividad:** `speed: 0.35` (ritmo activo de transmisión en vivo).
* **Entrada Cinética:** `"firm"` (impacto directo sin dilación).
* **Posición Espacial:** Lado derecho (`side: +1`).

---

## 5. Valeria Soto — Identidad y Aperturas

* **Rol:** Voz institucional, cortinillas, identificadores y presentación de marca.
* **Tono:** Elegante, sobria, envolvente, representativa del estándar de La Veinte Digital.
* **Geometría Visual:** Emblema institucional simétrico (`shape: "brand"`).
* **Color de Acento:** Ámbar dorado corporativo `#F59E0B`.
* **Velocidad de Reactividad:** `speed: 0.25`.
* **Entrada Cinética:** `"brand"`.
* **Posición Espacial:** Centrada (`side: 0`).

---

## 6. Principios de Interacción Espacial

1. **Memoria Conversacional:** Cuando la palabra pasa de un locutor a otro, el sistema registra el cambio (`self.ambient.pulse(1.0)`), ajustando sutilmente la polaridad del espacio para reflejar el diálogo dinámico.
2. **Cero Distracción:** Cuando un locutor introduce una explicación densa o un documento relevante, el fondo se apacigua (`calm: 0.35`) para permitir que la atención visual se concentre en la tarjeta o el dato numérico.
