import { useEffect, useState } from "react";
import { Inicio } from "./screens/Inicio";
import { ProyectoSimple } from "./screens/ProyectoSimple";
import { CrearEpisodio } from "./screens/CrearEpisodio";
import { Produccion } from "./screens/Produccion";
import { Timeline } from "./screens/Timeline";
import { BibliotecaAudio } from "./screens/BibliotecaAudio";
import { Locutores } from "./screens/Locutores";
import { Bibliotecas } from "./screens/Bibliotecas";
import { fetchStudioStatus, createProject, type StudioStatus } from "./lib/studio-api";
import { PROFUNDIDAD_MIN, type Profundidad, type Script, type ProductionPreferences } from "@la-veinte/studio-contract";
import { classifyInput, parseScript, deriveShortTitle } from "@la-veinte/radio-core";
import "./studio.css";

type Screen = "inicio" | "proyecto" | "crear" | "produccion" | "timeline" | "biblioteca" | "locutores" | "audio";

const NAV_ESTUDIO: Array<{ id: Screen; label: string; icon: string }> = [
  { id: "inicio", label: "Inicio", icon: "🏠" },
  { id: "crear", label: "Crear episodio", icon: "🎙️" },
  { id: "produccion", label: "Generar audio", icon: "⚙️" },
  { id: "timeline", label: "Editar audio", icon: "🎚️" },
  { id: "locutores", label: "Voces", icon: "🗣️" },
  { id: "audio", label: "Música", icon: "🎧" },
  { id: "biblioteca", label: "Bibliotecas", icon: "📚" },
];

const NAV_SIMPLE: Array<{ id: Screen; label: string; icon: string }> = [
  { id: "inicio", label: "Inicio", icon: "🏠" },
  { id: "proyecto", label: "Proyecto", icon: "🎙️" },
  { id: "biblioteca", label: "Bibliotecas", icon: "📚" },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const s = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("screen") : null;
    return s ? (s as Screen) : "inicio";
  });
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [sidecarOnline, setSidecarOnline] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(() => {
    return typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("projectId") : null;
  });
  const [mode, setMode] = useState<"simple" | "estudio">(() => (localStorage.getItem("studio:modo") === "estudio" ? "estudio" : "simple"));
  const [crearTema, setCrearTema] = useState("");
  const [workId, setWorkId] = useState(0);

  useEffect(() => { localStorage.setItem("studio:modo", mode); }, [mode]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const r = await fetchStudioStatus();
      if (mounted) { setStatus(r.status); setSidecarOnline(r.sidecarOnline); }
    };
    load();
    const t = setInterval(load, 10000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  const abrirNuevoTema = async (
    tema: string,
    comerciales = false,
    profundidad: Profundidad = "estandar",
    options?: { script?: Script | null; forceTopic?: boolean; productionPreferences?: ProductionPreferences }
  ) => {
    if (!tema) return;
    try {
      let scriptToPass: Script | null = options?.script ?? null;
      if (!scriptToPass && !options?.forceTopic) {
        const cl = classifyInput(tema);
        if (cl.kind === "script") {
          try {
            scriptToPass = parseScript(tema);
          } catch {
            // si no se parsea, continuar como tema normal
          }
        }
      }
      const shortTitle = deriveShortTitle(tema);
      console.log("[STUDIO-FRONTEND] Llamando a createProject:", {
        topicLength: tema.length,
        titulo: shortTitle,
        hasScript: !!scriptToPass,
        scriptTurns: scriptToPass?.turns?.length ?? 0,
        productionPreferences: options?.productionPreferences,
      });
      const p = await createProject({
        topic: tema,
        titulo: shortTitle,
        script: scriptToPass,
        productionPreferences: options?.productionPreferences,
        config: {
          duracionMin: PROFUNDIDAD_MIN[profundidad] ?? 15,
          profundidad,
          modo: "ia",
          comerciales: {
            enabled: comerciales,
            ids: [],
            allowDirectorChoice: true,
            count: "auto",
            ubicacion: "auto",
            interaccion: "natural",
            duracionSec: 30,
          },
        },
      });
      console.log("[STUDIO-FRONTEND] Respuesta de createProject recibida:", {
        id: p.id,
        titulo: p.titulo,
        state: p.state,
        hasScript: !!p.script,
        hasResearch: !!p.research,
        hasProposal: !!p.proposal,
      });
      setProjectId(p.id);
      setScreen("proyecto");
    } catch (err) {
      console.error("[STUDIO-FRONTEND] Error en createProject:", err);
      // fallback: pantalla clásica de creación si el sidecar no responde
      setCrearTema(tema);
      setWorkId((x) => x + 1);
      setScreen("crear");
    }
  };

  const nav = mode === "simple" ? NAV_SIMPLE : NAV_ESTUDIO;

  return (
    <div className="studio">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo">🎙️</span>
          <div>
            <div className="brand-title">AI Radio Studio</div>
            <div className="brand-sub">La Veinte Radio</div>
          </div>
        </div>
        <nav>
          {nav.map((n) => (
            <button key={n.id} className={`nav-item ${screen === n.id ? "active" : ""}`} onClick={() => setScreen(n.id)}>
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button
            className="chip"
            onClick={() => { setMode((m) => (m === "simple" ? "estudio" : "simple")); setScreen("inicio"); }}
            title={mode === "simple" ? "Mostrar controles avanzados" : "Volver al modo sencillo"}
          >
            {mode === "simple" ? "CONTROLES AVANZADOS ↗" : "MODO SIMPLE ✓"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div className={`sidecar-dot ${sidecarOnline ? "on" : ""}`} />
            <span>{sidecarOnline ? "Listo para trabajar" : "Conectando con el estudio"}</span>
          </div>
          <div style={{ fontSize: "10px", color: "var(--muted)", opacity: 0.85, fontFamily: "monospace", marginTop: 4, lineHeight: 1.4 }}>
            <div>{__BUILD_GIT_BRANCH__} · {__BUILD_GIT_SHA__}</div>
            <div>{__BUILD_TIME__}</div>
          </div>
        </div>
      </aside>

      <main className="content">
        {mode === "simple" && screen === "inicio" && <Inicio onCrear={abrirNuevoTema} onOpen={(id) => { setProjectId(id); setScreen("proyecto"); }} />}
        {mode === "simple" && screen === "proyecto" && (projectId ? <ProyectoSimple projectId={projectId} onBack={() => setScreen("inicio")} /> : <p className="muted">Abre o crea un episodio desde Inicio.</p>)}
        {mode === "simple" && screen === "biblioteca" && <Bibliotecas onCrearEpisodio={(t) => void abrirNuevoTema(t, false)} />}

        {mode === "estudio" && (
          <>
            {screen === "inicio" && <Inicio onCrear={abrirNuevoTema} onOpen={(id) => { setProjectId(id); setScreen("proyecto"); }} />}
            {screen === "proyecto" && (projectId ? <ProyectoSimple projectId={projectId} onBack={() => setScreen("inicio")} /> : <p className="muted">Abre o crea un episodio desde Inicio.</p>)}
            {screen === "crear" && <CrearEpisodio key={workId} temaInicial={crearTema} status={status} onProducir={() => setScreen("produccion")} />}
            {screen === "produccion" && <Produccion />}
            {screen === "timeline" && <Timeline />}
            {screen === "biblioteca" && <Bibliotecas onCrearEpisodio={(t) => void abrirNuevoTema(t, false)} />}
            {screen === "locutores" && <Locutores />}
            {screen === "audio" && <BibliotecaAudio />}
          </>
        )}
      </main>
    </div>
  );
}
