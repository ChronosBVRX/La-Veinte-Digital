import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SPEAKERS } from "@la-veinte/radio-core";
import { obtenerCasting, SIDECAR_URL_EXPORT, type CastingResult, type SpeakerProfile } from "../lib/studio-api";

type Persona = SpeakerProfile & {
  participa: boolean;
};

const OFFICIAL_IDS = ["EDUARDO", "ANDREA", "NARRADOR", "RODRIGO", "VALERIA"] as const;
const FIJOS = new Set(["EDUARDO", "ANDREA", "NARRADOR"]);

function oficiales(): Persona[] {
  return DEFAULT_SPEAKERS
    .filter((p) => OFFICIAL_IDS.includes(p.id as typeof OFFICIAL_IDS[number]))
    .map((p) => ({ ...p, participa: p.id !== "VALERIA" || p.participa !== false }));
}

function cargarGuardados(): Persona[] {
  try {
    const raw = localStorage.getItem("studio:locutores");
    if (!raw) return oficiales();
    const guardados = new Map((JSON.parse(raw) as Persona[]).map((p) => [p.id, p]));
    return oficiales().map((base) => ({ ...base, ...(guardados.get(base.id) ?? {}) }));
  } catch {
    return oficiales();
  }
}

function descripcionRol(p: Persona): string {
  if (p.id === "EDUARDO") return "Conduce, abre secciones y mantiene el hilo.";
  if (p.id === "ANDREA") return "Pregunta, explica y aterriza ejemplos.";
  if (p.id === "NARRADOR") return "Da fuentes, fechas y avisos breves.";
  if (p.id === "RODRIGO") return "Trae reportes de campo y dudas de unidades.";
  return "Lee patrocinios y anuncios separados del contenido.";
}

export function Locutores() {
  const [personas, setPersonas] = useState<Persona[]>(cargarGuardados);
  const [casting, setCasting] = useState<CastingResult | null>(null);

  useEffect(() => {
    void obtenerCasting().then(setCasting);
  }, []);

  useEffect(() => {
    localStorage.setItem("studio:locutores", JSON.stringify(personas));
  }, [personas]);

  const activos = useMemo(() => personas.filter((p) => p.participa), [personas]);
  const perfilPorId = new Map((casting?.perfiles ?? []).map((p) => [p.id, p]));
  const personaPorId = new Map((casting?.personas ?? []).map((p) => [p.id, p]));

  const setActivo = (id: string, participa: boolean) => {
    if (FIJOS.has(id)) return;
    setPersonas((ps) => ps.map((p) => (p.id === id ? { ...p, participa } : p)));
  };

  const restaurar = () => setPersonas(oficiales());

  return (
    <div className="screen">
      <h1>Voces del programa</h1>
      <p className="muted">
        Este es el reparto oficial. Al crear un episodio solo se podrán elegir estas voces.
      </p>

      <div className="card cast-summary">
        <div>
          <strong>{activos.length} voces activas por defecto</strong>
          <div className="muted small">Eduardo, Andrea y Alonso son la base del programa. Rodrigo y Valeria se activan según el episodio.</div>
        </div>
        <button className="btn-secondary" onClick={restaurar}>Restaurar reparto oficial</button>
      </div>

      <div className="voice-roster">
        {personas.map((p) => {
          const perfil = perfilPorId.get(p.id);
          const persona = personaPorId.get(p.id);
          const preview = perfil?.previewAudioPath ? `${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(perfil.previewAudioPath)}` : null;
          const fijo = FIJOS.has(p.id);
          return (
            <section key={p.id} className={`voice-card ${p.participa ? "selected" : ""}`}>
              <div className="voice-card-head">
                <div>
                  <h2>{p.nombre}</h2>
                  <div className="muted small">{descripcionRol(p)}</div>
                </div>
                <label className="switch-line">
                  <input
                    type="checkbox"
                    checked={p.participa}
                    disabled={fijo}
                    onChange={(e) => setActivo(p.id, e.target.checked)}
                  />
                  {fijo ? "Base" : "Activo"}
                </label>
              </div>
              <div className="voice-meta">
                <span>{p.rol === "comercial" ? "comercial" : p.rol}</span>
                <span>Voz {p.voz}</span>
                <span>{perfil?.voiceSourceLabel ?? "Premium local"}</span>
              </div>
              <p>{persona?.objetivo ?? p.funcionEditorial ?? p.personalidad}</p>
              {preview ? (
                <audio controls preload="none" src={preview} />
              ) : (
                <div className="muted small">Abre el motor local para escuchar la muestra.</div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
