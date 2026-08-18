// Prueba del director IA con contexto acumulado + JSON robusto.
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "data/tts/scripts/probe-ia-v2.json");

async function main() {
  const t0 = Date.now();
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 2400000);
  try {
    const r = await fetch("http://127.0.0.1:3977/director", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tema: "Tiempo extraordinario en el IMSS", duracionMin: 25, nivel: "natural", modoCita: "natural", modo: "ia", pulir: false }),
      signal: c.signal,
    } as RequestInit);
    const d = await r.json();
    const verif = d.verificacion ?? [];
    const resumen = {
      status: r.status,
      seg: Math.round((Date.now() - t0) / 1000),
      modo: d.modoUsado,
      turnos: d.script?.turns?.length,
      estimMin: Math.round((d.script?.estimacionDurSec ?? 0) / 60),
      verdes: verif.filter((x: { semaforo: string }) => x.semaforo === "green").length,
      amarillos: verif.filter((x: { semaforo: string }) => x.semaforo === "yellow").length,
      rojos: verif.filter((x: { semaforo: string }) => x.semaforo === "red").length,
      cortinillas: (d.script?.turns ?? []).filter((x: { transition?: string }) => /cortinilla/i.test(x.transition ?? "")).length,
    };
    console.log(JSON.stringify(resumen));
    fs.writeFileSync(OUT, JSON.stringify({ resumen, script: d.script }, null, 2));
    const t2 = d.script?.turns ?? [];
    for (let i = 0; i < Math.min(10, t2.length); i++) {
      console.log(String(i).padStart(2), (t2[i].speaker ?? "").padEnd(9), String((t2[i].text ?? "").length).padStart(4) + "c", "|", (t2[i].text ?? "").substring(0, 70));
    }
    // aperturas duplicadas?
    const aperturas = t2.filter((x: { text?: string }) => /^(Bienvenid|Buenas|Buenos|Hola|¡Hola)/.test(x.text ?? ""));
    console.log("aperturas detectadas:", aperturas.length);
  } catch (e) {
    console.log("FALLO:", e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(t);
  }
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
