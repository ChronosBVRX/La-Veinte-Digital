import { useEffect, useState } from "react";
import { Inicio } from "./screens/Inicio";
import { ProyectoSimple } from "./screens/ProyectoSimple";
import { Bibliotecas } from "./screens/Bibliotecas";
import { Diagnostico } from "./screens/Diagnostico";
import { fetchStudioStatus, createProject } from "./lib/studio-api";
import { PROFUNDIDAD_MIN, type Profundidad, type Script, type ProductionPreferences } from "@la-veinte/studio-contract";
import { classifyInput, parseScript, deriveShortTitle } from "@la-veinte/radio-core";
import { Home, Mic, BookOpen, Activity, Radio } from "./components/ui/Icons";
import { ToastProvider } from "./components/ui/Toast";
import "./studio.css";

type Screen = "inicio" | "proyecto" | "biblioteca" | "diagnostico";

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const s = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("screen") : null;
    return s ? (s as Screen) : "inicio";
  });
  const [sidecarOnline, setSidecarOnline] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(() => {
    return typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("projectId") : "d5f1fc16";
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const r = await fetchStudioStatus();
        if (mounted) setSidecarOnline(r.sidecarOnline);
      } catch {
        if (mounted) setSidecarOnline(false);
      }
    };
    load();
    const t = setInterval(load, 8000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
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
          } catch {}
        }
      }
      const shortTitle = deriveShortTitle(tema);
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
      setProjectId(p.id);
      setScreen("proyecto");
    } catch (err) {
      console.error("[STUDIO-FRONTEND] Error creando proyecto:", err);
    }
  };

  const navItems = [
    { id: "inicio" as Screen, label: "Inicio", icon: <Home size={16} /> },
    { id: "proyecto" as Screen, label: "Episodio Actual", icon: <Mic size={16} />, badge: projectId ? "Activo" : undefined },
    { id: "biblioteca" as Screen, label: "Biblioteca Normativa", icon: <BookOpen size={16} /> },
    { id: "diagnostico" as Screen, label: "Diagnóstico", icon: <Activity size={16} /> },
  ];

  return (
    <ToastProvider>
      <div className="studio">
        {/* Sidebar Profesional */}
        <aside className="sidebar">
          <div className="brand cursor-pointer" onClick={() => setScreen("inicio")}>
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Radio size={20} />
            </div>
            <div>
              <div className="brand-title">AI Radio Studio</div>
              <div className="brand-sub">La Veinte Radio</div>
            </div>
          </div>

          <nav>
            {navItems.map((n) => (
              <button
                key={n.id}
                className={`nav-item ${screen === n.id ? "active" : ""}`}
                onClick={() => setScreen(n.id)}
              >
                <span className="shrink-0">{n.icon}</span>
                <span className="flex-1 text-left">{n.label}</span>
                {n.badge && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {n.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Footer limpio de conexión sin datos debug */}
          <div className="sidebar-foot">
            <div className="flex items-center gap-2.5 px-2 py-1">
              <div className={`sidecar-dot ${sidecarOnline ? "on" : ""}`} />
              <span className="text-xs font-medium text-slate-300">
                {sidecarOnline ? "Estudio Conectado" : "Conectando con el motor…"}
              </span>
            </div>
          </div>
        </aside>

        {/* Workspace Central */}
        <main className="content">
          {screen === "inicio" && (
            <Inicio
              onCrear={abrirNuevoTema}
              onOpen={(id) => {
                setProjectId(id);
                setScreen("proyecto");
              }}
            />
          )}

          {screen === "proyecto" && (
            projectId ? (
              <ProyectoSimple projectId={projectId} onBack={() => setScreen("inicio")} />
            ) : (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <p>Selecciona un episodio desde Inicio para comenzar.</p>
                <button
                  onClick={() => setScreen("inicio")}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                >
                  Ir a Inicio
                </button>
              </div>
            )
          )}

          {screen === "biblioteca" && (
            <Bibliotecas onCrearEpisodio={(t) => void abrirNuevoTema(t, false)} />
          )}

          {screen === "diagnostico" && <Diagnostico />}
        </main>
      </div>
    </ToastProvider>
  );
}
