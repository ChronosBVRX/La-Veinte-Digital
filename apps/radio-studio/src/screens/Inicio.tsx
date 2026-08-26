import { useState } from "react";
import type { StudioStatus } from "../lib/studio-api";

interface Props {
  status: StudioStatus | null;
  onCrear: (tema: string) => void;
}

export function Inicio({ status, onCrear }: Props) {
  const motor = status?.motor;
  const [tema, setTema] = useState("");
  const temas = ["Cláusula 97", "Accidente de trabajo: ST-7", "Tiempo extraordinario en el IMSS", "¿Me pueden cambiar el horario?", "Faltas, retardos y biométrico", "Bolsa de Trabajo para sustitutos"];
  const listo = !!status;
  const corpus = status?.corpus;
  const disponibles = corpus?.disponibles ?? 0;
  const bloqueadas = corpus?.bloqueadas ?? 0;

  return (
    <div className="screen">
      <div className="home-hero">
        <div>
          <h1>Crear un episodio de podcast</h1>
          <p className="muted">Escribe un tema laboral, revisa el guion y genera el audio final con voces, música breve y fuentes verificadas.</p>
        </div>
        <div className={`ready-pill ${listo ? "ok" : "warn"}`}>{listo ? "Listo" : "Preparando"}</div>
      </div>

      <section className="card start-card">
        <label className="field">
          <span>Tema del episodio</span>
          <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ej. Cláusula 97, accidente de trabajo, tiempo extra..." />
        </label>
        <button className="btn-primary btn-main-action" onClick={() => onCrear(tema.trim())} disabled={!tema.trim()}>
          EMPEZAR EPISODIO
        </button>
        <div className="quick-topics">
          <span className="muted">O elige un tema:</span>
          {temas.map((t) => (
            <button key={t} className="chip" onClick={() => onCrear(t)}>{t}</button>
          ))}
        </div>
      </section>

      <div className="step-strip">
        <section className="step-card">
          <span className="step-num">1</span>
          <div>
            <h2>Guion</h2>
            <p className="muted small">DeepSeek investiga y arma la conversación.</p>
          </div>
        </section>

        <section className="step-card">
          <span className="step-num">2</span>
          <div>
            <h2>Revisión</h2>
            <p className="muted small">Puedes editar textos, voces y comerciales.</p>
          </div>
        </section>

        <section className="step-card">
          <span className="step-num">3</span>
          <div>
            <h2>Audio final</h2>
            <p className="muted small">La app genera voces y mezcla el master.</p>
          </div>
        </section>
      </div>

      <section className="card quiet-card">
        <h2>Estado del estudio</h2>
        <div className="status-row">
          <span className={`status-dot ${listo ? "ok" : "warn"}`} />
          <span>{listo ? "Motor local conectado" : "El motor local está iniciando"}</span>
          <span className="muted">Voz: {motor?.provider === "qwen-base-clone" ? "Qwen Base clone" : motor?.provider ?? "pendiente"}</span>
          <span className="muted">Documentos listos: {listo ? `${disponibles}/${corpus?.documentos ?? 0}` : "..."}</span>
          {bloqueadas > 0 && <span className="muted">Bloqueados por portal oficial: {bloqueadas}</span>}
        </div>
        {bloqueadas > 0 && (
          <p className="muted small">
            La app ya usa los documentos verificados. Algunos PDFs oficiales del IMSS no se pudieron bajar automáticamente porque el portal rechazó la descarga; puedes seguir creando borradores, pero esos temas quedan marcados como pendientes hasta cargar la fuente.
          </p>
        )}
      </section>
    </div>
  );
}
