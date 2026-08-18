// Prueba del director IA (LOTE=3): escribe el resultado a un archivo.
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "data/tts/scripts/probe-ia-lote3.json");

async function main() {
  const t0 = Date.now();
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 1500000);
  try {
    const r = await fetch("http://127.0.0.1:3977/director", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tema: "Tiempo extraordinario en el IMSS", duracionMin: 25, nivel: "natural", modoCita: "natural", modo: "ia", pulir: true }),
      signal: c.signal,
    } as RequestInit);
    const d = await r.json();
    const resumen = {
      status: r.status,
      seg: Math.round((Date.now() - t0) / 1000),
      modoUsado: d.modoUsado,
      turnos: d.script?.turns?.length,
      estimMin: Math.round((d.script?.estimacionDurSec ?? 0) / 60),
      verif: {
        verdes: (d.verificacion ?? []).filter((x: { semaforo: string }) => x.semaforo === "green").length,
        amarillos: (d.verificacion ?? []).filter((x: { semaforo: string }) => x.semaforo === "yellow").length,
        rojos: (d.verificacion ?? []).filter((x: { semaforo: string }) => x.semaforo === "red").length,
      },
      diversity: d.diversity?.score ?? null,
      rojos: (d.verificacion ?? [])
        .filter((x: { semaforo: string }) => x.semaforo === "red")
        .map((x: { turnId: string }) => {
          const tt = d.script.turns.find((t2: { id: string }) => t2.id === x.turnId);
          return `${x.turnId} | ${(tt?.text ?? "").slice(0, 90)}`;
        }),
    };
    fs.writeFileSync(OUT, JSON.stringify(resumen, null, 2));
    console.log("escrito:", OUT);
    console.log(JSON.stringify(resumen));
  } catch (e) {
    console.log("FALLO:", e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(t);
  }
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
