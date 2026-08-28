import { useEffect, useState } from "react";
import { Inicio } from "./screens/Inicio";
import { ProyectoSimple } from "./screens/ProyectoSimple";
import { CrearEpisodio } from "./screens/CrearEpisodio";
import { Produccion } from "./screens/Produccion";
import { Timeline } from "./screens/Timeline";
import { BibliotecaAudio } from "./screens/BibliotecaAudio";
import { BibliotecaNormativaStudio } from "./screens/BibliotecaNormativaStudio";
import { Locutores } from "./screens/Locutores";
import { fetchStudioStatus, createProject, type StudioStatus } from "./lib/studio-api";
import { PROFUNDIDAD_MIN, type Profundidad } from "@la-veinte/studio-contract";
import "./studio.css";

type Screen = "inicio" | "proyecto" | "crear" | "produccion" | "timeline" | "biblioteca" | "locutores" | "audio";

const NAV_ESTUDIO: Array<{ id: Screen; label: string; icon: string }> = [
  { id: "inicio", label: "Inicio", icon: "🏠" },
  { id: "crear", label: "Crear episodio", icon: "🎙️" },
  { id: "produccion", label: "Generar audio", icon: "⚙️" },
  { id: "timeline", label: "Editar audio", icon: "🎚️" },
  { id: "locutores", label: "Voces", icon: "🗣️" },
  { id: "audio", label: "Música", icon: "🎧" },
  { id: "biblioteca", label: "Documentos", icon: "📚" },
];

const NAV_SIMPLE: Array<{ id: Screen; label: string; icon: string }> = [
  { id: "inicio", label: "Inicio", icon: "🏠" },
  { id: "proyecto", label: "Proyecto", icon: "🎙️" },
  { id: "biblioteca", label: "Bibliotecas", icon: "📚" },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>("inicio");
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [sidecarOnline, setSidecarOnline] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
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

  const abrirNuevoTema = async (tema: string, comerciales = false, profundidad: Profundidad = "estandar") => {
    if (!tema) return;
    try {
      const p = await createProject({
        topic: tema,
        config: {
          duracionMin: PROFUNDIDAD_MIN[profundidad] ?? 15,
          profundidad,
          modo: "determinista",
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
      setProjectId(p.id);
      setScreen("proyecto");
    } catch {
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
          <div className={`sidecar-dot ${sidecarOnline ? "on" : ""}`} />
          {sidecarOnline ? "Listo para trabajar" : "Preparando motor local"}
        </div>
      </aside>

      <main className="content">
        {mode === "simple" && screen === "inicio" && <Inicio onCrear={abrirNuevoTema} onOpen={(id) => { setProjectId(id); setScreen("proyecto"); }} />}
        {mode === "simple" && screen === "proyecto" && (projectId ? <ProyectoSimple projectId={projectId} onBack={() => setScreen("inicio")} /> : <p className="muted">Abre o crea un episodio desde Inicio.</p>)}
        {mode === "simple" && screen === "biblioteca" && <BibliotecaNormativaStudio onCrearEpisodio={(t) => void abrirNuevoTema(t, false)} />}

        {mode === "estudio" && (
          <>
            {screen === "inicio" && <Inicio onCrear={abrirNuevoTema} onOpen={(id) => { setProjectId(id); setScreen("proyecto"); }} />}
            {screen === "proyecto" && (projectId ? <ProyectoSimple projectId={projectId} onBack={() => setScreen("inicio")} /> : <p className="muted">Abre o crea un episodio desde Inicio.</p>)}
            {screen === "crear" && <CrearEpisodio key={workId} temaInicial={crearTema} status={status} onProducir={() => setScreen("produccion")} />}
            {screen === "produccion" && <Produccion />}
            {screen === "timeline" && <Timeline />}
            {screen === "biblioteca" && <BibliotecaNormativaStudio onCrearEpisodio={(t) => void abrirNuevoTema(t, false)} />}
            {screen === "locutores" && <Locutores />}
            {screen === "audio" && <BibliotecaAudio />}
          </>
        )}
      </main>
    </div>
  );
}
