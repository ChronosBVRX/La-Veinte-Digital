import { useState } from "react";
import type {
  ProductionPreferences,
  OutputFormat,
  VideoQuality,
  VisualStyle,
  VisualFidelity,
  SourcesPriority,
  Profundidad,
} from "@la-veinte/studio-contract";

export interface AdvancedProductionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: ProductionPreferences;
  onChange: (prefs: ProductionPreferences) => void;
  duracionMin: number;
  onDuracionChange: (dur: number) => void;
  profundidad: Profundidad;
  onProfundidadChange: (p: Profundidad) => void;
  contextoExtra: string;
  onContextoChange: (c: string) => void;
}

const DEFAULT_PREFERENCES: ProductionPreferences = {
  mode: "audio_video",
  outputFormats: ["preview", "16x9", "9x16"],
  videoQuality: "produccion",
  visualStyle: "equilibrado",
  visualElements: {
    realReferences: true,
    illustrations: true,
    buildings: true,
    documents: true,
    logos: true,
    charts: true,
    timelines: true,
    diagrams: true,
    keyStats: true,
  },
  researchReferences: true,
  visualFidelity: "referencias_reales",
  sourcesPriority: "oficiales",
  showSources: true,
  autoApproveVerified: true,
  participantsMode: "auto",
  selectedParticipants: ["EDUARDO", "ANDREA", "JAVIER RÍOS", "RODRIGO TORRES", "VALERIA SOTO"],
  customDocuments: [],
  customVisualReferences: [],
};

const ALL_SPEAKERS = [
  { id: "EDUARDO", name: "Eduardo", role: "Conducción principal y moderación" },
  { id: "ANDREA", name: "Andrea", role: "Co-conducción y empatía laboral" },
  { id: "JAVIER RÍOS", name: "Javier Ríos", role: "Fundamentación legal, CCT y LFT" },
  { id: "RODRIGO TORRES", name: "Rodrigo Torres", role: "Casos reales y perspectiva operativa" },
  { id: "VALERIA SOTO", name: "Valeria Soto", role: "Síntesis y verificación de cifras" },
];

export function AdvancedProductionDrawer({
  isOpen,
  onClose,
  preferences,
  onChange,
  duracionMin,
  onDuracionChange,
  profundidad,
  onProfundidadChange,
  contextoExtra,
  onContextoChange,
}: AdvancedProductionDrawerProps) {
  const [activeTab, setActiveTab] = useState<"salida" | "estilo" | "investigacion" | "locutores" | "contenido">("salida");

  if (!isOpen) return null;

  const currentPrefs: ProductionPreferences = {
    ...DEFAULT_PREFERENCES,
    ...preferences,
    outputFormats: preferences.outputFormats ?? DEFAULT_PREFERENCES.outputFormats,
    visualElements: {
      ...DEFAULT_PREFERENCES.visualElements,
      ...(preferences.visualElements ?? {}),
    },
    selectedParticipants: preferences.selectedParticipants ?? DEFAULT_PREFERENCES.selectedParticipants,
  };

  const updatePrefs = (patch: Partial<ProductionPreferences>) => {
    onChange({
      ...currentPrefs,
      ...patch,
    });
  };

  const toggleFormat = (fmt: OutputFormat) => {
    const list = currentPrefs.outputFormats ?? [];
    if (list.includes(fmt)) {
      if (list.length === 1) return; // al menos 1
      updatePrefs({ outputFormats: list.filter((f) => f !== fmt) });
    } else {
      updatePrefs({ outputFormats: [...list, fmt] });
    }
  };

  const toggleParticipant = (spkId: string) => {
    const list = currentPrefs.selectedParticipants ?? [];
    if (list.includes(spkId)) {
      if (list.length === 1) return; // al menos 1 participante
      updatePrefs({
        participantsMode: "manual",
        selectedParticipants: list.filter((p) => p !== spkId),
      });
    } else {
      updatePrefs({
        participantsMode: "manual",
        selectedParticipants: [...list, spkId],
      });
    }
  };

  const toggleVisualElement = (key: keyof NonNullable<ProductionPreferences["visualElements"]>) => {
    const elements = currentPrefs.visualElements ?? DEFAULT_PREFERENCES.visualElements;
    updatePrefs({
      visualElements: {
        ...elements,
        [key]: !elements[key],
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 h-full flex flex-col shadow-2xl text-zinc-100 overflow-hidden animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚙️</span>
              <h2 className="text-lg font-bold text-zinc-100">Controles Avanzados de Producción</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                100% UI
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Configura entregables, estilo visual, apoyos gráficos y fuentes reales sin abrir terminal ni JSONs.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title="Cerrar panel"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/30 px-5 gap-2 overflow-x-auto text-sm">
          <button
            onClick={() => setActiveTab("salida")}
            className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === "salida"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            📺 Salida y Formatos
          </button>
          <button
            onClick={() => setActiveTab("estilo")}
            className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === "estilo"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            🎨 Estilo y Apoyos
          </button>
          <button
            onClick={() => setActiveTab("investigacion")}
            className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === "investigacion"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            🔍 Referencias Reales
          </button>
          <button
            onClick={() => setActiveTab("locutores")}
            className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === "locutores"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            🎙️ Locutores
          </button>
          <button
            onClick={() => setActiveTab("contenido")}
            className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === "contenido"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            📝 Tono y Duración
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: SALIDA Y FORMATOS */}
          {activeTab === "salida" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-2">
                  Formatos de Video a Generar
                </h3>
                <p className="text-xs text-zinc-400 mb-4">
                  El Audio Master (WAV 24kHz + MP3 192k) se produce siempre. Selecciona qué versiones de video renderizar.
                </p>
                <div className="space-y-3">
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      currentPrefs.outputFormats?.includes("16x9")
                        ? "bg-blue-950/20 border-blue-500/50 text-zinc-100"
                        : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={currentPrefs.outputFormats?.includes("16x9")}
                      onChange={() => toggleFormat("16x9")}
                      className="mt-1 accent-blue-500 rounded"
                    />
                    <div>
                      <div className="font-semibold text-sm text-zinc-100">Video Horizontal 16:9 (1080p)</div>
                      <div className="text-xs text-zinc-400 mt-0.5">Formato panorámico para YouTube, monitores y portal web.</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      currentPrefs.outputFormats?.includes("9x16")
                        ? "bg-blue-950/20 border-blue-500/50 text-zinc-100"
                        : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={currentPrefs.outputFormats?.includes("9x16")}
                      onChange={() => toggleFormat("9x16")}
                      className="mt-1 accent-blue-500 rounded"
                    />
                    <div>
                      <div className="font-semibold text-sm text-zinc-100">Video Vertical 9:16 (1080x1920)</div>
                      <div className="text-xs text-zinc-400 mt-0.5">Layout responsive vertical adaptado para TikTok, Reels y Shorts.</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      currentPrefs.outputFormats?.includes("preview")
                        ? "bg-emerald-950/20 border-emerald-500/50 text-zinc-100"
                        : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={currentPrefs.outputFormats?.includes("preview")}
                      onChange={() => toggleFormat("preview")}
                      className="mt-1 accent-emerald-500 rounded"
                    />
                    <div>
                      <div className="font-semibold text-sm text-zinc-100">Preview Rápido en UI (854x480)</div>
                      <div className="text-xs text-zinc-400 mt-0.5">Generación acelerada para revisión y validación previa del resultado visual.</div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-2">
                  Calidad de Video
                </h3>
                <div className="space-y-2">
                  {[
                    {
                      id: "produccion",
                      label: "Producción Estándar (Recomendado)",
                      desc: "Excelente balance de fidelidad visual y tiempo de renderizado con aceleración por hardware.",
                    },
                    {
                      id: "maxima",
                      label: "Máxima Calidad (Broadcast)",
                      desc: "Tasa de bits más alta para pantallas de gran formato y archivo permanente.",
                    },
                    {
                      id: "rapida",
                      label: "Borrador Rápido",
                      desc: "Renderizado más veloz para comprobar montaje y cortes rápidamente.",
                    },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        currentPrefs.videoQuality === opt.id
                          ? "bg-blue-950/20 border-blue-500/50 text-zinc-100"
                          : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="videoQuality"
                        value={opt.id}
                        checked={currentPrefs.videoQuality === opt.id}
                        onChange={() => updatePrefs({ videoQuality: opt.id as VideoQuality })}
                        className="mt-1 accent-blue-500"
                      />
                      <div>
                        <div className="font-semibold text-sm text-zinc-100">{opt.label}</div>
                        <div className="text-xs text-zinc-400 mt-0.5">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ESTILO Y APOYOS */}
          {activeTab === "estilo" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-2">
                  Estilo Visual Editorial
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      id: "sobrio",
                      icon: "🏛️",
                      title: "Sobrio",
                      desc: "Fondos limpios, acentos discretos, menor densidad de elementos. Muy institucional.",
                    },
                    {
                      id: "equilibrado",
                      icon: "⚖️",
                      title: "Equilibrado",
                      badge: "Recomendado",
                      desc: "Balance óptimo entre dinamismo, apoyos gráficos y presencia de locutores.",
                    },
                    {
                      id: "dinamico",
                      icon: "⚡",
                      title: "Dinámico",
                      desc: "Mayor frecuencia de cambios de plano, apoyos llamativos y transiciones activas.",
                    },
                  ].map((st) => (
                    <div
                      key={st.id}
                      onClick={() => updatePrefs({ visualStyle: st.id as VisualStyle })}
                      className={`p-4 rounded-xl border cursor-pointer transition-all relative ${
                        currentPrefs.visualStyle === st.id
                          ? "bg-blue-950/20 border-blue-500 text-zinc-100"
                          : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      {st.badge && (
                        <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {st.badge}
                        </span>
                      )}
                      <div className="text-2xl mb-2">{st.icon}</div>
                      <div className="font-bold text-sm text-zinc-100">{st.title}</div>
                      <div className="text-xs text-zinc-400 mt-1">{st.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-2">
                  Elementos Visuales Permitidos
                </h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Activa o desactiva qué tipos de apoyo pueden aparecer en pantalla durante el episodio.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: "realReferences", label: "Referencias Reales" },
                    { key: "documents", label: "Documentos Oficiales" },
                    { key: "logos", label: "Logos Institucionales" },
                    { key: "keyStats", label: "Cifras y Números Clave" },
                    { key: "charts", label: "Gráficos de Comparación" },
                    { key: "buildings", label: "Hospitales y Edificios" },
                    { key: "diagrams", label: "Diagramas de Proceso" },
                    { key: "timelines", label: "Líneas de Tiempo" },
                    { key: "illustrations", label: "Escenas Ilustrativas" },
                  ].map((elem) => {
                    const k = elem.key as keyof NonNullable<ProductionPreferences["visualElements"]>;
                    const isActive = currentPrefs.visualElements?.[k] ?? true;
                    return (
                      <label
                        key={elem.key}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                          isActive
                            ? "bg-blue-950/20 border-blue-500/50 text-zinc-200 font-medium"
                            : "bg-zinc-900/30 border-zinc-800 text-zinc-500"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => toggleVisualElement(k)}
                          className="accent-blue-500 rounded"
                        />
                        <span>{elem.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INVESTIGACIÓN REAL */}
          {activeTab === "investigacion" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-2">
                  Gobernanza de Referencias Reales
                </h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Si el episodio habla de algo real (IMSS, SNTSS, HGR 1 Charo, CCT), el sistema investiga su apariencia antes de generar la escena.
                </p>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 rounded-xl border bg-zinc-900/40 border-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentPrefs.researchReferences !== false}
                      onChange={(e) => updatePrefs({ researchReferences: e.target.checked })}
                      className="mt-1 accent-blue-500 rounded"
                    />
                    <div>
                      <div className="font-semibold text-sm text-zinc-100">
                        Investigar referencias reales automáticamente
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Detecta entidades clave en el guion y busca sus logos exactos, arquitectura institucional y colores normativos.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 rounded-xl border bg-zinc-900/40 border-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentPrefs.showSources !== false}
                      onChange={(e) => updatePrefs({ showSources: e.target.checked })}
                      className="mt-1 accent-blue-500 rounded"
                    />
                    <div>
                      <div className="font-semibold text-sm text-zinc-100">
                        Mostrar citas y fuentes al aire
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Superpone en pantalla badges y referencias documentales (artículo, cláusula, ley) al citar normativa.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-2">
                  Fidelidad de Representación
                </h3>
                <div className="space-y-2">
                  {[
                    {
                      id: "referencias_reales",
                      label: "Referencias Reales Verificadas (Estricto)",
                      desc: "Solo utiliza assets basados en fotos y documentos oficiales verificados del IMSS y sindicato.",
                    },
                    {
                      id: "contextual",
                      label: "Contextual Flexible",
                      desc: "Permite usar assets genéricos estilizados cuando no exista una referencia real catalogada.",
                    },
                  ].map((fid) => (
                    <label
                      key={fid.id}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        currentPrefs.visualFidelity === fid.id
                          ? "bg-blue-950/20 border-blue-500/50 text-zinc-100"
                          : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="visualFidelity"
                        value={fid.id}
                        checked={currentPrefs.visualFidelity === fid.id}
                        onChange={() => updatePrefs({ visualFidelity: fid.id as VisualFidelity })}
                        className="mt-1 accent-blue-500"
                      />
                      <div>
                        <div className="font-semibold text-sm text-zinc-100">{fid.label}</div>
                        <div className="text-xs text-zinc-400 mt-0.5">{fid.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-2">
                  Prioridad de Fuentes
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "oficiales", label: "Oficiales Primero", desc: "Prioriza CCT, LFT, DOF y circulares IMSS." },
                    { id: "amplias", label: "Fuentes Amplias", desc: "Incluye análisis jurisprudenciales y doctrina." },
                  ].map((prio) => (
                    <label
                      key={prio.id}
                      className={`p-3.5 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                        currentPrefs.sourcesPriority === prio.id
                          ? "bg-blue-950/20 border-blue-500/50 text-zinc-100"
                          : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="sourcesPriority"
                          value={prio.id}
                          checked={currentPrefs.sourcesPriority === prio.id}
                          onChange={() => updatePrefs({ sourcesPriority: prio.id as SourcesPriority })}
                          className="accent-blue-500"
                        />
                        <span className="font-semibold text-xs text-zinc-200">{prio.label}</span>
                      </div>
                      <span className="text-[11px] text-zinc-400 ml-5">{prio.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LOCUTORES */}
          {activeTab === "locutores" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-2">
                  Elenco de Voces y Locutores
                </h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Selecciona qué personajes intervendrán en este episodio. Puedes alternar el elenco para ajustarlo al tema.
                </p>

                <div className="space-y-2.5">
                  {ALL_SPEAKERS.map((spk) => {
                    const isSelected = currentPrefs.selectedParticipants?.includes(spk.id) ?? true;
                    return (
                      <div
                        key={spk.id}
                        onClick={() => toggleParticipant(spk.id)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-blue-950/20 border-blue-500/50 text-zinc-100"
                            : "bg-zinc-900/20 border-zinc-800/60 text-zinc-500 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-sm">
                            {spk.name[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-zinc-100">{spk.name}</div>
                            <div className="text-xs text-zinc-400">{spk.role}</div>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            isSelected
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              : "bg-zinc-800 text-zinc-500"
                          }`}
                        >
                          {isSelected ? "Participa" : "Excluido"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CONTENIDO Y TONO */}
          {activeTab === "contenido" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-2">
                  Duración Deseada
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 15, 20, 25].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onDuracionChange(d)}
                      className={`py-3 rounded-xl border font-bold text-sm transition-all ${
                        duracionMin === d
                          ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30"
                          : "bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-2">
                  Profundidad Editorial
                </h3>
                <div className="space-y-2">
                  {[
                    { id: "breve", label: "Breve — Lo esencial (al grano)" },
                    { id: "estandar", label: "Estándar — Explicación con fundamento y ejemplos" },
                    { id: "profundo", label: "A fondo — Análisis minucioso de cláusulas y jurisprudencia" },
                  ].map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        profundidad === p.id
                          ? "bg-blue-950/20 border-blue-500/50 text-zinc-100"
                          : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="profundidad"
                        value={p.id}
                        checked={profundidad === p.id}
                        onChange={() => onProfundidadChange(p.id as Profundidad)}
                        className="accent-blue-500"
                      />
                      <span className="text-sm font-medium text-zinc-200">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-2">
                  Instrucciones o Contexto Particular para el Episodio
                </h3>
                <textarea
                  value={contextoExtra}
                  onChange={(e) => onContextoChange(e.target.value)}
                  placeholder="Instrucciones específicas: ej. 'Enfocar la discusión en el Régimen de Jubilaciones y Pensiones', 'Mencionar caso particular de HGR 1 Charo'..."
                  rows={4}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onChange(DEFAULT_PREFERENCES);
              onDuracionChange(15);
              onProfundidadChange("estandar");
              onContextoChange("");
            }}
            className="text-xs text-zinc-400 hover:text-zinc-200 underline"
          >
            Restablecer recomendados
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-blue-600/30"
          >
            Guardar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
