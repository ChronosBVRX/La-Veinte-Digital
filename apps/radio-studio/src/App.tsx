import { useEffect, useRef, useState } from "react";
import { Inicio } from "./screens/Inicio";
import { CrearEpisodio } from "./screens/CrearEpisodio";
import { Produccion } from "./screens/Produccion";
import { Timeline } from "./screens/Timeline";
import { BibliotecaAudio } from "./screens/BibliotecaAudio";
import { BibliotecaNormativaStudio } from "./screens/BibliotecaNormativaStudio";
import { Locutores } from "./screens/Locutores";
import { descartarProduccion, fetchStudioStatus, type StudioStatus } from "./lib/studio-api";
import "./studio.css";

type Screen = "inicio" | "crear" | "produccion" | "timeline" | "biblioteca" | "locutores" | "audio";

const NAV: Array<{ id: Screen; label: string; icon: string }> = [
  { id: "inicio", label: "Inicio", icon: "🏠" },
  { id: "crear", label: "Crear episodio", icon: "🎙️" },
  { id: "produccion", label: "Generar audio", icon: "⚙️" },
  { id: "timeline", label: "Editar audio", icon: "🎚️" },
  { id: "locutores", label: "Voces", icon: "🗣️" },
  { id: "audio", label: "Música", icon: "🎧" },
  { id: "biblioteca", label: "Documentos", icon: "📚" },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>("inicio");
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [sidecarOnline, setSidecarOnline] = useState(false);
  const [tema, setTema] = useState("");
  const [workId, setWorkId] = useState(0);
  const limpioMotor = useRef(false);

  const limpiarTrabajoLocal = () => {
    localStorage.removeItem("studio:guion");
    localStorage.removeItem("studio:contexto-extra");
    setTema("");
  };

  const abrirNuevoTrabajo = (temaNuevo = "") => {
    limpiarTrabajoLocal();
    setTema(temaNuevo);
    setWorkId((x) => x + 1);
    setScreen("crear");
  };

  useEffect(() => {
    localStorage.removeItem("studio:guion");
    localStorage.removeItem("studio:contexto-extra");
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const r = await fetchStudioStatus();
      if (mounted) {
        setStatus(r.status);
        setSidecarOnline(r.sidecarOnline);
        if (r.sidecarOnline && !limpioMotor.current) {
          limpioMotor.current = true;
          void descartarProduccion();
        }
      }
    };
    load();
    const t = setInterval(load, 8000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="studio">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo">🎙️</span>
          <div>
            <div className="brand-title">AI Radio Studio</div>
            <div className="brand-sub">La Veinte Digital</div>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item ${screen === n.id ? "active" : ""}`} onClick={() => n.id === "crear" ? abrirNuevoTrabajo() : setScreen(n.id)}>
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className={`sidecar-dot ${sidecarOnline ? "on" : ""}`} />
          {sidecarOnline ? "Listo para trabajar" : "Preparando motor local"}
        </div>
      </aside>

      <main className="content">
        {screen === "inicio" && <Inicio status={status} onCrear={(t) => abrirNuevoTrabajo(t)} />}
        {screen === "crear" && <CrearEpisodio key={workId} temaInicial={tema} status={status} onProducir={() => setScreen("produccion")} />}
        {screen === "produccion" && <Produccion />}
        {screen === "timeline" && <Timeline />}
        {screen === "biblioteca" && <BibliotecaNormativaStudio onCrearEpisodio={(t) => abrirNuevoTrabajo(t)} />}
        {screen === "locutores" && <Locutores />}
        {screen === "audio" && <BibliotecaAudio />}
      </main>
    </div>
  );
}
