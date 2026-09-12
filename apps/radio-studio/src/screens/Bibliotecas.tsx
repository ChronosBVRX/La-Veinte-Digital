import { useEffect, useState, useMemo, useRef } from "react";
import {
  listAssets,
  uploadAsset,
  toggleAssetFavorite,
  toggleAssetBlock,
  generateAsset,
  SIDECAR_URL_EXPORT,
  type AssetItem,
  type ReferenceItem,
} from "../lib/studio-api";
import { BibliotecaNormativaStudio } from "./BibliotecaNormativaStudio";
import { BibliotecaAudio } from "./BibliotecaAudio";
import { Locutores } from "./Locutores";

interface Props {
  onCrearEpisodio: (tema: string) => void;
}

type Tab = "visuales" | "logos" | "documentos" | "voces" | "musica" | "personajes";

const CATEGORIES = [
  { id: "all", label: "Todas" },
  { id: "logos", label: "Logos" },
  { id: "buildings", label: "Hospitales / Edificios" },
  { id: "documents", label: "Documentos / CCT" },
  { id: "payroll", label: "Nómina / Tarjetón" },
  { id: "union", label: "Sindicato / Asambleas" },
  { id: "general", label: "General" },
];

const TYPES = [
  { id: "all", label: "Todos los tipos" },
  { id: "official", label: "Oficiales" },
  { id: "reference_based", label: "Basados en Ref. Real" },
  { id: "generic", label: "Genéricos" },
  { id: "user_provided", label: "Subidos por Usuario" },
];

interface InstitutionalLogo {
  id: string;
  name: string;
  entity: string;
  file: string;
  format: "SVG" | "PNG";
  colors: Array<{ name: string; hex: string }>;
  description: string;
  source: string;
  license: string;
}

const OFFICIAL_LOGOS: InstitutionalLogo[] = [
  {
    id: "logo_imss_svg",
    name: "Logo Oficial IMSS (Vector SVG)",
    entity: "Instituto Mexicano del Seguro Social",
    file: "logos/imss_official_logo.svg",
    format: "SVG",
    colors: [
      { name: "Verde IMSS", hex: "#006341" },
      { name: "Dorado IMSS", hex: "#B38E5D" },
      { name: "Blanco", hex: "#FFFFFF" },
    ],
    description: "Símbolo canónico: Águila del Seguro Social con la madre y el niño. Vector escalable sin pérdida.",
    source: "Wikimedia Commons / Gobierno de México",
    license: "Dominio Público Oficial",
  },
  {
    id: "logo_imss_png",
    name: "Logo Oficial IMSS (Alta Resolución)",
    entity: "Instituto Mexicano del Seguro Social",
    file: "logos/imss_official_logo.png",
    format: "PNG",
    colors: [
      { name: "Verde IMSS", hex: "#006341" },
      { name: "Dorado IMSS", hex: "#B38E5D" },
    ],
    description: "Versión rasterizada de alta definición con transparencia para composiciones 16:9 y 9:16.",
    source: "IMSS Comunicación Social",
    license: "Uso institucional y periodístico",
  },
  {
    id: "logo_sntss_png",
    name: "Logo Oficial SNTSS",
    entity: "Sindicato Nacional de Trabajadores del Seguro Social",
    file: "logos/sntss_official_logo.png",
    format: "PNG",
    colors: [
      { name: "Rojo Sindical", hex: "#C41230" },
      { name: "Verde SNTSS", hex: "#006847" },
      { name: "Blanco", hex: "#FFFFFF" },
    ],
    description: "Emblema oficial del SNTSS. Utilizado en asambleas, congresos y referencias al Contrato Colectivo.",
    source: "SNTSS Nacional",
    license: "Referencia editorial sindical",
  },
  {
    id: "logo_cfcrl_png",
    name: "Logo Oficial CFCRL",
    entity: "Centro Federal de Conciliación y Registro Laboral",
    file: "logos/cfcrl_official_logo.png",
    format: "PNG",
    colors: [
      { name: "Guinda Laboral", hex: "#691C32" },
      { name: "Dorado Institucional", hex: "#BC955C" },
      { name: "Gris Carbón", hex: "#1A1A1A" },
    ],
    description: "Identidad visual del órgano registral federal donde se deposita el CCT y padrones sindicales.",
    source: "Gobierno de México / CFCRL",
    license: "Institucional Federal",
  },
];

interface CharacterIdentity {
  id: string;
  name: string;
  role: string;
  shape: string;
  shapeDescription: string;
  speed: number;
  enter: string;
  accent: string;
  accentName: string;
  description: string;
}

const CHARACTERS_PROFILES: CharacterIdentity[] = [
  {
    id: "EDUARDO",
    name: "Eduardo",
    role: "Conductor Titular",
    shape: "Círculos Concéntricos",
    shapeDescription: "Ondas circulares concéntricas y calidez central, ritmo de apertura e hilo conductor.",
    speed: 0.25,
    enter: "warm",
    accent: "#F59E0B",
    accentName: "Ámbar Cálido",
    description: "Conduce, abre secciones temáticas y mantiene la continuidad narrativa del episodio.",
  },
  {
    id: "ANDREA",
    name: "Andrea",
    role: "Co-conductora y Analista",
    shape: "Curvas Orgánicas",
    shapeDescription: "Curvas sinusoidales fluidas, empatía pedagógica y desmenuzamiento de dudas.",
    speed: 0.45,
    enter: "quick",
    accent: "#FBBF24",
    accentName: "Amarillo Vibrante",
    description: "Pregunta, responde inquietudes de trabajadores y traduce la normativa a ejemplos cotidianos.",
  },
  {
    id: "NARRADOR",
    name: "Javier Ríos",
    role: "Analista Normativo & Datos",
    shape: "Retícula Analítica (Grid)",
    shapeDescription: "Matriz geométrica ortogonal precisa, sobriedad métrica y rigor documental.",
    speed: 0.18,
    enter: "steady",
    accent: "#7DD3FC",
    accentName: "Azul Celeste",
    description: "Cita artículos de ley, cláusulas del CCT, fechas de vigencia y plazos legales exactos.",
  },
  {
    id: "RODRIGO",
    name: "Rodrigo Torres",
    role: "Corresponsal de Campo",
    shape: "Barras Dinámicas",
    shapeDescription: "Barras de espectro ecualizado, ritmo periodístico y contacto con unidades de trabajo.",
    speed: 0.35,
    enter: "firm",
    accent: "#6EE7B7",
    accentName: "Verde Menta",
    description: "Trae reportes de campo, testimonios y dudas concretas desde hospitales, clínicas y talleres.",
  },
  {
    id: "VALERIA",
    name: "Valeria Soto",
    role: "Voz de Marca & Patrocinios",
    shape: "Escudo Institucional",
    shapeDescription: "Geometría heráldica institucional limpia, separación comercial y claridad de mensaje.",
    speed: 0.25,
    enter: "brand",
    accent: "#F59E0B",
    accentName: "Dorado Institucional",
    description: "Lee patrocinios y avisos institucionales con firewall estricto respecto al contenido editorial.",
  },
];

export function Bibliotecas({ onCrearEpisodio }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const t = typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("tab") as Tab) : null;
    return t && ["visuales", "logos", "documentos", "voces", "musica", "personajes"].includes(t) ? t : "visuales";
  });
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Upload modal state
  const [uploadFile, setUploadFile] = useState<{ name: string; base64: string; preview: string } | null>(null);
  const [uploadEntity, setUploadEntity] = useState("");
  const [uploadCategory, setUploadCategory] = useState("buildings");
  const [uploadOrientation, setUploadOrientation] = useState<"16:9" | "9:16" | "both">("both");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadSource, setUploadSource] = useState("");
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Generate modal state
  const [genEntity, setGenEntity] = useState("");
  const [genCategory, setGenCategory] = useState("buildings");
  const [genInvestigate, setGenInvestigate] = useState(true);
  const [genPrompt, setGenPrompt] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<{
    entity: string;
    reference: ReferenceItem;
    status: string;
    generatedAsset?: AssetItem;
    fallbackAsset?: AssetItem;
    message?: string;
  } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  // Logo view options
  const [logoBgDark, setLogoBgDark] = useState(true);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load assets
  const fetchAssets = async () => {
    setLoadingAssets(true);
    setAssetsError(null);
    try {
      const items = await listAssets();
      setAssets(items);
    } catch (err) {
      setAssetsError(err instanceof Error ? err.message : "Error al cargar assets visuales");
    } finally {
      setLoadingAssets(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    void listAssets()
      .then((items) => {
        if (mounted) {
          setAssets(items);
          setLoadingAssets(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setAssetsError(err instanceof Error ? err.message : "Error al cargar assets visuales");
          setLoadingAssets(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Filter assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (onlyFavorites && !asset.favorite) return false;
      if (selectedCategory !== "all" && asset.category !== selectedCategory) return false;
      if (selectedType !== "all" && asset.type !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inEntity = asset.entity.toLowerCase().includes(q);
        const inId = asset.id.toLowerCase().includes(q);
        const inTags = asset.tags?.some((t) => t.toLowerCase().includes(q));
        const inCategory = asset.category.toLowerCase().includes(q);
        if (!inEntity && !inId && !inTags && !inCategory) return false;
      }
      return true;
    });
  }, [assets, onlyFavorites, selectedCategory, selectedType, searchQuery]);

  // Favorite toggle
  const handleToggleFavorite = async (id: string) => {
    // Optimistic update
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, favorite: !a.favorite } : a))
    );
    try {
      await toggleAssetFavorite(id);
    } catch (err) {
      console.error("Error toggling favorite:", err);
      void fetchAssets();
    }
  };

  // Block toggle
  const handleToggleBlock = async (id: string) => {
    // Optimistic update
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, blocked: !a.blocked } : a))
    );
    try {
      await toggleAssetBlock(id);
    } catch (err) {
      console.error("Error toggling block:", err);
      void fetchAssets();
    }
  };

  // Upload file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64Str = reader.result as string;
      setUploadFile({
        name: file.name,
        base64: base64Str,
        preview: base64Str,
      });
      if (!uploadEntity) {
        setUploadEntity(file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "));
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit upload
  const handleUploadSubmit = async () => {
    if (!uploadFile) {
      setUploadError("Selecciona una imagen para subir.");
      return;
    }
    if (!uploadEntity.trim()) {
      setUploadError("Ingresa el nombre o entidad del asset.");
      return;
    }
    setUploadSubmitting(true);
    setUploadError(null);
    try {
      const orientations = uploadOrientation === "both" ? ["16:9", "9:16"] : [uploadOrientation];
      const tags = uploadTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await uploadAsset({
        filename: uploadFile.name,
        base64: uploadFile.base64,
        entity: uploadEntity.trim(),
        category: uploadCategory,
        type: "user_provided",
        tags,
        orientation: orientations,
        source: uploadSource.trim() || "Subido por usuario en AI Radio Studio",
      });
      await fetchAssets();
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadEntity("");
      setUploadTags("");
      setUploadSource("");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error al subir asset");
    } finally {
      setUploadSubmitting(false);
    }
  };

  // Submit generate
  const handleGenerateSubmit = async () => {
    if (!genEntity.trim()) {
      setGenError("Ingresa la entidad a investigar o generar.");
      return;
    }
    setGenLoading(true);
    setGenError(null);
    setGenResult(null);
    try {
      const res = await generateAsset({
        entity: genEntity.trim(),
        category: genCategory,
        investigateReferences: genInvestigate,
        orientations: ["16:9", "9:16"],
        stylePrompt: genPrompt.trim() || undefined,
      });
      setGenResult(res);
      await fetchAssets();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Error durante la generación de asset");
    } finally {
      setGenLoading(false);
    }
  };

  const copyHex = (hex: string) => {
    void navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  const stats = useMemo(() => {
    const total = assets.length;
    const verified = assets.filter((a) => a.based_on_verified_references).length;
    const favorites = assets.filter((a) => a.favorite).length;
    const official = assets.filter((a) => a.type === "official").length;
    return { total, verified, favorites, official };
  }, [assets]);

  return (
    <div className="screen" style={{ maxWidth: "1280px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Bibliotecas de Producción</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14, maxWidth: 740 }}>
            Centro unificado de recursos editoriales, referencias institucionales verificadas, documentos normativos,
            banco sonoro, voces y parámetros visuales de <strong>La Veinte Radio</strong>.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div className="stat-mini" style={{ padding: "6px 14px" }}>
            <span className="big" style={{ fontSize: 18, color: "var(--primary-fg)" }}>{stats.total}</span>
            <span className="muted" style={{ fontSize: 10, textTransform: "uppercase" }}>Assets Catálogo</span>
          </div>
          <div className="stat-mini" style={{ padding: "6px 14px", borderColor: "rgba(34,197,94,0.4)" }}>
            <span className="big" style={{ fontSize: 18, color: "#86efac" }}>{stats.verified}</span>
            <span className="muted" style={{ fontSize: 10, textTransform: "uppercase" }}>Ref. Verificadas</span>
          </div>
          <div className="stat-mini" style={{ padding: "6px 14px", borderColor: "rgba(245,158,11,0.4)" }}>
            <span className="big" style={{ fontSize: 18, color: "#fbbf24" }}>★ {stats.favorites}</span>
            <span className="muted" style={{ fontSize: 10, textTransform: "uppercase" }}>Favoritos</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 2,
          marginBottom: 20,
          overflowX: "auto",
        }}
      >
        <button
          className={`chip ${activeTab === "visuales" ? "chip-active" : ""}`}
          onClick={() => setActiveTab("visuales")}
          style={{ padding: "8px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
        >
          <span>🖼️</span> Visuales & Assets ({assets.length})
        </button>
        <button
          className={`chip ${activeTab === "logos" ? "chip-active" : ""}`}
          onClick={() => setActiveTab("logos")}
          style={{ padding: "8px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
        >
          <span>🏛️</span> Logos Institucionales ({OFFICIAL_LOGOS.length})
        </button>
        <button
          className={`chip ${activeTab === "documentos" ? "chip-active" : ""}`}
          onClick={() => setActiveTab("documentos")}
          style={{ padding: "8px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
        >
          <span>📚</span> Documentos & Corpus
        </button>
        <button
          className={`chip ${activeTab === "voces" ? "chip-active" : ""}`}
          onClick={() => setActiveTab("voces")}
          style={{ padding: "8px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
        >
          <span>🗣️</span> Voces & Casting
        </button>
        <button
          className={`chip ${activeTab === "musica" ? "chip-active" : ""}`}
          onClick={() => setActiveTab("musica")}
          style={{ padding: "8px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
        >
          <span>🎧</span> Música & ACE-Step
        </button>
        <button
          className={`chip ${activeTab === "personajes" ? "chip-active" : ""}`}
          onClick={() => setActiveTab("personajes")}
          style={{ padding: "8px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
        >
          <span>🎭</span> Identidad de Personajes
        </button>
      </div>

      {/* ── TAB 1: VISUALES & ASSETS ── */}
      {activeTab === "visuales" && (
        <div>
          {/* Controls bar */}
          <div
            className="card"
            style={{
              padding: "14px 16px",
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {/* Search input */}
              <div style={{ flex: "1 1 260px", position: "relative" }}>
                <input
                  type="text"
                  placeholder="Buscar asset por entidad, etiqueta, id…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--panel-2)",
                    color: "var(--fg)",
                    fontSize: 13,
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--muted)",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Type filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--panel-2)",
                  color: "var(--fg)",
                  fontSize: 13,
                  minWidth: 150,
                }}
              >
                {TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>

              {/* Favorites toggle */}
              <button
                className={`chip ${onlyFavorites ? "chip-active" : ""}`}
                onClick={() => setOnlyFavorites((f) => !f)}
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: onlyFavorites ? "#000" : "#fbbf24",
                  borderColor: "#fbbf24",
                }}
              >
                ★ Solo Favoritos
              </button>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                <button
                  className="btn-primary"
                  onClick={() => setShowUploadModal(true)}
                  style={{ fontSize: 13, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span>+</span> Subir Asset Propio
                </button>
                <button
                  className="btn-primary"
                  onClick={() => setShowGenerateModal(true)}
                  style={{
                    fontSize: 13,
                    padding: "8px 14px",
                    background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>✨</span> Generar con IA
                </button>
              </div>
            </div>

            {/* Category pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span className="muted small" style={{ marginRight: 6 }}>Categorías:</span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className={`chip ${selectedCategory === cat.id ? "chip-active" : ""}`}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{ padding: "4px 10px", fontSize: 12 }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Asset list */}
          {loadingAssets ? (
            <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
              Cargando catálogo de assets visuales…
            </div>
          ) : assetsError ? (
            <div className="card" style={{ textAlign: "center", padding: 30, color: "var(--danger)" }}>
              <p>{assetsError}</p>
              <button className="btn-primary" onClick={fetchAssets} style={{ marginTop: 10 }}>
                Reintentar
              </button>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 50, color: "var(--muted)" }}>
              <p style={{ fontSize: 16, marginBottom: 8 }}>No se encontraron assets con los filtros aplicados.</p>
              <p className="small">Puedes limpiar la búsqueda o subir un asset nuevo con el botón superior.</p>
              {(searchQuery || selectedCategory !== "all" || selectedType !== "all" || onlyFavorites) && (
                <button
                  className="chip"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                    setSelectedType("all");
                    setOnlyFavorites(false);
                  }}
                  style={{ marginTop: 12 }}
                >
                  Restablecer Filtros
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {filteredAssets.map((asset) => {
                const mediaUrl = `${SIDECAR_URL_EXPORT}/media?file=assets/editorial/${asset.file}`;
                return (
                  <div
                    key={asset.id}
                    className="card"
                    style={{
                      padding: 0,
                      overflow: "hidden",
                      opacity: asset.blocked ? 0.45 : 1,
                      border: asset.favorite
                        ? "1px solid rgba(245,158,11,0.6)"
                        : "1px solid var(--border)",
                      transition: "transform 0.15s, border-color 0.15s",
                      display: "flex",
                      flexDirection: "column",
                      position: "relative",
                    }}
                  >
                    {/* Media thumbnail container */}
                    <div
                      style={{
                        position: "relative",
                        background: "#080c14",
                        height: 160,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={mediaUrl}
                        alt={asset.entity}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = "none";
                          if (target.parentElement) {
                            target.parentElement.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;color:#64748b;font-size:12px;gap:6px;"><span style="font-size:32px;">🖼️</span><span>${asset.category}</span></div>`;
                          }
                        }}
                      />

                      {/* Top Badges */}
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          display: "flex",
                          gap: 4,
                          flexWrap: "wrap",
                        }}
                      >
                        {asset.based_on_verified_references && (
                          <span
                            className="chip"
                            style={{
                              background: "rgba(34,197,94,0.9)",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: 10,
                              padding: "2px 6px",
                              border: "none",
                            }}
                          >
                            ✓ Ref. Real
                          </span>
                        )}
                        <span
                          className="chip"
                          style={{
                            background:
                              asset.type === "official"
                                ? "rgba(37,99,235,0.85)"
                                : asset.type === "reference_based"
                                ? "rgba(139,92,246,0.85)"
                                : asset.type === "user_provided"
                                ? "rgba(236,72,153,0.85)"
                                : "rgba(100,116,139,0.85)",
                            color: "#fff",
                            fontSize: 10,
                            padding: "2px 6px",
                            border: "none",
                          }}
                        >
                          {asset.type === "official"
                            ? "Oficial"
                            : asset.type === "reference_based"
                            ? "Ref. Verificada"
                            : asset.type === "user_provided"
                            ? "Subido"
                            : "Genérico"}
                        </span>
                      </div>

                      {/* Orientations badge */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: 8,
                          right: 8,
                          display: "flex",
                          gap: 4,
                        }}
                      >
                        {asset.orientation?.map((o) => (
                          <span
                            key={o}
                            className="chip"
                            style={{
                              background: "rgba(15,23,42,0.85)",
                              color: "#cbd5e1",
                              fontSize: 10,
                              padding: "2px 6px",
                            }}
                          >
                            {o}
                          </span>
                        ))}
                      </div>

                      {/* Favorite & Block fast actions in top right */}
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          display: "flex",
                          gap: 4,
                        }}
                      >
                        <button
                          onClick={() => handleToggleFavorite(asset.id)}
                          title={asset.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
                          style={{
                            background: "rgba(15,23,42,0.85)",
                            border: asset.favorite ? "1px solid #fbbf24" : "1px solid rgba(255,255,255,0.2)",
                            borderRadius: 6,
                            padding: "4px 8px",
                            color: asset.favorite ? "#fbbf24" : "#94a3b8",
                            cursor: "pointer",
                            fontSize: 13,
                          }}
                        >
                          ★
                        </button>
                        <button
                          onClick={() => handleToggleBlock(asset.id)}
                          title={asset.blocked ? "Desbloquear asset" : "Bloquear asset de la producción automática"}
                          style={{
                            background: "rgba(15,23,42,0.85)",
                            border: asset.blocked ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.2)",
                            borderRadius: 6,
                            padding: "4px 8px",
                            color: asset.blocked ? "#ef4444" : "#94a3b8",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          🚫
                        </button>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div style={{ padding: 14, display: "flex", flexDirection: "column", flex: 1, gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <strong style={{ fontSize: 14, color: "var(--fg)" }}>{asset.entity}</strong>
                        <span className="muted small" style={{ fontSize: 11 }}>{asset.category}</span>
                      </div>

                      <div className="muted small" style={{ fontSize: 11, wordBreak: "break-all" }}>
                        <code>{asset.file}</code>
                      </div>

                      {asset.tags && asset.tags.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                          {asset.tags.slice(0, 4).map((tag, idx) => (
                            <span key={idx} className="chip" style={{ fontSize: 10, padding: "1px 6px" }}>
                              #{tag}
                            </span>
                          ))}
                          {asset.tags.length > 4 && (
                            <span className="muted small" style={{ fontSize: 10 }}>
                              +{asset.tags.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      {asset.blocked && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: "4px 8px",
                            background: "rgba(239,68,68,0.15)",
                            border: "1px solid rgba(239,68,68,0.3)",
                            borderRadius: 6,
                            color: "#fca5a5",
                            fontSize: 11,
                            fontWeight: 600,
                            textAlign: "center",
                          }}
                        >
                          🚫 Bloqueado para producción
                        </div>
                      )}

                      <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          className="chip"
                          onClick={() => {
                            void navigator.clipboard.writeText(mediaUrl);
                            alert("Enlace copiado al portapapeles");
                          }}
                          style={{ fontSize: 11, padding: "4px 8px" }}
                        >
                          Copiar URL
                        </button>
                        <a
                          href={mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="chip"
                          style={{ fontSize: 11, padding: "4px 8px", textDecoration: "none", color: "inherit" }}
                        >
                          Ver ↗
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: LOGOS INSTITUCIONALES ── */}
      {activeTab === "logos" && (
        <div>
          <div
            className="card"
            style={{
              padding: "14px 16px",
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong>Identidad y Simbología Oficial</strong>
              <p className="muted small" style={{ margin: "2px 0 0" }}>
                Logos vectoriales y rasterizados de alta fidelidad para el IMSS, SNTSS y autoridades laborales.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="muted small">Fondo de previsualización:</span>
              <button
                className={`chip ${logoBgDark ? "chip-active" : ""}`}
                onClick={() => setLogoBgDark(true)}
                style={{ padding: "4px 10px", fontSize: 12 }}
              >
                Oscuro (Estudio)
              </button>
              <button
                className={`chip ${!logoBgDark ? "chip-active" : ""}`}
                onClick={() => setLogoBgDark(false)}
                style={{ padding: "4px 10px", fontSize: 12 }}
              >
                Claro
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
            {OFFICIAL_LOGOS.map((logo) => {
              const url = `${SIDECAR_URL_EXPORT}/media?file=assets/editorial/${logo.file}`;
              return (
                <div key={logo.id} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div
                    style={{
                      height: 180,
                      borderRadius: 8,
                      background: logoBgDark ? "#0a0e17" : "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 16,
                      border: "1px solid var(--border)",
                      transition: "background 0.2s",
                    }}
                  >
                    <img
                      src={url}
                      alt={logo.name}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ margin: 0, fontSize: 16 }}>{logo.name}</h3>
                      <span className="chip" style={{ fontSize: 10, fontWeight: 700 }}>{logo.format}</span>
                    </div>
                    <div className="muted small" style={{ marginTop: 2 }}>{logo.entity}</div>
                  </div>

                  <p className="muted small" style={{ margin: 0, lineHeight: 1.45 }}>
                    {logo.description}
                  </p>

                  {/* Colors palette */}
                  <div>
                    <div className="muted small" style={{ fontSize: 11, marginBottom: 6, fontWeight: 600 }}>
                      PALETA INSTITUCIONAL:
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {logo.colors.map((c) => (
                        <div
                          key={c.hex}
                          onClick={() => copyHex(c.hex)}
                          title="Clic para copiar código HEX"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: "var(--panel-2)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "3px 8px",
                            cursor: "pointer",
                            fontSize: 11,
                          }}
                        >
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: c.hex,
                              border: "1px solid rgba(255,255,255,0.2)",
                            }}
                          />
                          <span>{c.name}</span>
                          <code style={{ color: "var(--primary-fg)", fontSize: 10 }}>{c.hex}</code>
                        </div>
                      ))}
                    </div>
                    {copiedHex && (
                      <div style={{ color: "var(--ok)", fontSize: 10, marginTop: 4 }}>
                        ✓ {copiedHex} copiado al portapapeles
                      </div>
                    )}
                  </div>

                  {/* Footer metadata & download */}
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: 10,
                      borderTop: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 11,
                    }}
                  >
                    <span className="muted">{logo.license}</span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary"
                      style={{ fontSize: 11, padding: "5px 12px", textDecoration: "none" }}
                    >
                      Descargar / Abrir
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: DOCUMENTOS & CORPUS ── */}
      {activeTab === "documentos" && (
        <div>
          <div
            className="card"
            style={{
              padding: "14px 18px",
              marginBottom: 16,
              background: "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(15,23,42,0.6))",
              border: "1px solid rgba(59,130,246,0.3)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <strong>Corpus Normativo Laboral IMSS / SNTSS</strong>
              <div className="muted small" style={{ marginTop: 2 }}>
                82 fuentes oficiales catalogadas · 34/34 temáticas con cobertura FULL (CCT 2025-2027, LFT, LSS, NOMs) · 22,270 chunks con SHA-256 inmutable.
              </div>
            </div>
            <span className="chip" style={{ background: "rgba(34,197,94,0.18)", color: "#86efac", fontWeight: 700 }}>
              ✓ Cobertura Verificada
            </span>
          </div>

          <BibliotecaNormativaStudio onCrearEpisodio={onCrearEpisodio} />
        </div>
      )}

      {/* ── TAB 4: VOCES & CASTING ── */}
      {activeTab === "voces" && (
        <div>
          <div
            className="card"
            style={{
              padding: "14px 18px",
              marginBottom: 16,
              background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(15,23,42,0.6))",
              border: "1px solid rgba(245,158,11,0.3)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <strong>Motor de Voces y Casting Editorial</strong>
              <div className="muted small" style={{ marginTop: 2 }}>
                Speechify simba-3.0 (es-MX) · 5 voces únicas diferenciadas por registro, prosodia y rol firewall estricto.
              </div>
            </div>
            <span className="chip" style={{ background: "rgba(34,197,94,0.18)", color: "#86efac", fontWeight: 700 }}>
              ✓ Casting Activo
            </span>
          </div>

          <Locutores />
        </div>
      )}

      {/* ── TAB 5: MÚSICA & ACE-STEP ── */}
      {activeTab === "musica" && (
        <div>
          <div
            className="card"
            style={{
              padding: "14px 18px",
              marginBottom: 16,
              background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(15,23,42,0.6))",
              border: "1px solid rgba(168,85,247,0.3)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <strong>Diseño Sonoro & Generador Musical Local</strong>
              <div className="muted small" style={{ marginTop: 2 }}>
                Camas de programa uniformes, jingles de apertura/cierre y motor local ACE-Step 1.5 turbo sin costo de API.
              </div>
            </div>
            <span className="chip" style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc", fontWeight: 700 }}>
              🎧 Identidad Sonora
            </span>
          </div>

          <BibliotecaAudio />
        </div>
      )}

      {/* ── TAB 6: IDENTIDAD DE PERSONAJES ── */}
      {activeTab === "personajes" && (
        <div>
          <div
            className="card"
            style={{
              padding: "14px 18px",
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong>Dirección de Arte: Geometría, Ritmo y Safe Zones</strong>
              <p className="muted small" style={{ margin: "2px 0 0" }}>
                Identidad visual editorial sobria y humana. Sin caras generadas por IA: la distinción es
                geometría, velocidad de animación, ritmo y paleta de acento.
              </p>
            </div>
            <span className="chip" style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd" }}>
              Reglas de Layout 16:9 & 9:16
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
            {CHARACTERS_PROFILES.map((char) => (
              <div
                key={char.id}
                className="card"
                style={{
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  borderLeft: `4px solid ${char.accent}`,
                }}
              >
                {/* Header with avatar-like geometry preview */}
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 12,
                      background: `linear-gradient(135deg, ${char.accent}33, #0f172a)`,
                      border: `1px solid ${char.accent}88`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: char.accent,
                      fontSize: 22,
                    }}
                  >
                    {char.id === "EDUARDO" && "◎"}
                    {char.id === "ANDREA" && "〰"}
                    {char.id === "NARRADOR" && "⊞"}
                    {char.id === "RODRIGO" && "▥"}
                    {char.id === "VALERIA" && "🛡"}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17 }}>{char.name}</h3>
                    <span className="muted small" style={{ color: char.accent, fontWeight: 600 }}>
                      {char.role}
                    </span>
                  </div>
                </div>

                <p className="muted small" style={{ margin: 0, lineHeight: 1.5 }}>
                  {char.description}
                </p>

                {/* Visual parameters */}
                <div
                  style={{
                    background: "var(--panel-2)",
                    borderRadius: 8,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">Geometría:</span>
                    <strong>{char.shape}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">Velocidad de movimiento:</span>
                    <code>{char.speed} cps ({char.enter})</code>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="muted">Color de acento:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: char.accent,
                        }}
                      />
                      <code>{char.accent} ({char.accentName})</code>
                    </div>
                  </div>
                </div>

                <div className="muted small" style={{ fontSize: 11, fontStyle: "italic" }}>
                  {char.shapeDescription}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL 1: SUBIR ASSET PROPIO ── */}
      {showUploadModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 540,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>Subir Asset Propio</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <p className="muted small" style={{ margin: 0 }}>
              Sube fotos reales de hospitales, sedes sindicales, tarjetones de prueba o gráficos para enriquecer el catálogo.
            </p>

            {/* Drop area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed var(--border)",
                borderRadius: 10,
                padding: 24,
                textAlign: "center",
                cursor: "pointer",
                background: uploadFile ? "rgba(34,197,94,0.06)" : "var(--panel-2)",
                transition: "border-color 0.2s",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              {uploadFile ? (
                <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "center" }}>
                  <img
                    src={uploadFile.preview}
                    alt="Preview"
                    style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }}
                  />
                  <div style={{ textAlign: "left" }}>
                    <strong>{uploadFile.name}</strong>
                    <div className="muted small">Imagen seleccionada y lista para registrar.</div>
                  </div>
                </div>
              ) : (
                <div>
                  <span style={{ fontSize: 32 }}>📁</span>
                  <div style={{ marginTop: 8, fontWeight: 600 }}>Haz clic para seleccionar imagen</div>
                  <div className="muted small" style={{ marginTop: 2 }}>PNG, JPG, WEBP o SVG (máx. 10MB)</div>
                </div>
              )}
            </div>

            {/* Form fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label className="muted small" style={{ display: "block", marginBottom: 4 }}>
                  Nombre / Entidad *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Hospital General Regional 1 Charo"
                  value={uploadEntity}
                  onChange={(e) => setUploadEntity(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--panel-2)",
                    color: "var(--fg)",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="muted small" style={{ display: "block", marginBottom: 4 }}>
                    Categoría
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--panel-2)",
                      color: "var(--fg)",
                    }}
                  >
                    <option value="buildings">Hospitales / Edificios</option>
                    <option value="documents">Documentos / CCT</option>
                    <option value="logos">Logos Institucionales</option>
                    <option value="payroll">Nómina / Tarjetón</option>
                    <option value="union">Sindicato / Asambleas</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label className="muted small" style={{ display: "block", marginBottom: 4 }}>
                    Orientación Útil
                  </label>
                  <select
                    value={uploadOrientation}
                    onChange={(e) => setUploadOrientation(e.target.value as "16:9" | "9:16" | "both")}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--panel-2)",
                      color: "var(--fg)",
                    }}
                  >
                    <option value="both">16:9 y 9:16 (Ambas)</option>
                    <option value="16:9">Solo 16:9 Horizontal</option>
                    <option value="9:16">Solo 9:16 Vertical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="muted small" style={{ display: "block", marginBottom: 4 }}>
                  Etiquetas (separadas por coma)
                </label>
                <input
                  type="text"
                  placeholder="IMSS, hospital, Michoacán, fachada"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--panel-2)",
                    color: "var(--fg)",
                  }}
                />
              </div>

              <div>
                <label className="muted small" style={{ display: "block", marginBottom: 4 }}>
                  Fuente / Atribución
                </label>
                <input
                  type="text"
                  placeholder="Fotografía tomada en campo / Archivo propio"
                  value={uploadSource}
                  onChange={(e) => setUploadSource(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--panel-2)",
                    color: "var(--fg)",
                  }}
                />
              </div>
            </div>

            {uploadError && (
              <div style={{ color: "var(--danger)", fontSize: 12 }}>{uploadError}</div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
              <button
                className="chip"
                onClick={() => setShowUploadModal(false)}
                disabled={uploadSubmitting}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleUploadSubmit}
                disabled={uploadSubmitting || !uploadFile}
              >
                {uploadSubmitting ? "Subiendo…" : "Guardar en Catálogo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: GENERAR CON IA ── */}
      {showGenerateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setShowGenerateModal(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 580,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span>✨</span> Generar Asset Visual con IA
              </h2>
              <button
                onClick={() => setShowGenerateModal(false)}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <p className="muted small" style={{ margin: 0 }}>
              El sistema investigará primero las características reales de la entidad (arquitectura, logos, colores) antes de componer la representación gráfica.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label className="muted small" style={{ display: "block", marginBottom: 4 }}>
                  Entidad o Concepto a Generar *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Hospital de Traumatología IMSS Magdalena de las Salinas"
                  value={genEntity}
                  onChange={(e) => setGenEntity(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--panel-2)",
                    color: "var(--fg)",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="muted small" style={{ display: "block", marginBottom: 4 }}>
                    Categoría
                  </label>
                  <select
                    value={genCategory}
                    onChange={(e) => setGenCategory(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--panel-2)",
                      color: "var(--fg)",
                    }}
                  >
                    <option value="buildings">Hospitales / Edificios</option>
                    <option value="documents">Documentos / CCT</option>
                    <option value="payroll">Nómina / Tarjetón</option>
                    <option value="union">Sindicato / Asambleas</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
                  <input
                    type="checkbox"
                    id="genInvestigate"
                    checked={genInvestigate}
                    onChange={(e) => setGenInvestigate(e.target.checked)}
                  />
                  <label htmlFor="genInvestigate" className="small" style={{ cursor: "pointer" }}>
                    Investigar referencias reales
                  </label>
                </div>
              </div>

              <div>
                <label className="muted small" style={{ display: "block", marginBottom: 4 }}>
                  Instrucciones de Estilo Adicionales (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Vista exterior diurna sobria, iluminación natural, señalética verde institucional…"
                  value={genPrompt}
                  onChange={(e) => setGenPrompt(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--panel-2)",
                    color: "var(--fg)",
                    fontSize: 12,
                  }}
                />
              </div>
            </div>

            {genError && (
              <div style={{ color: "var(--danger)", fontSize: 12 }}>{genError}</div>
            )}

            {/* Loading state */}
            {genLoading && (
              <div
                style={{
                  padding: 20,
                  background: "var(--panel-2)",
                  borderRadius: 8,
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: 13,
                }}
              >
                <div style={{ marginBottom: 8, fontSize: 24 }}>⚙️</div>
                <div>Investigando referencias institucionales y componiendo imagen…</div>
              </div>
            )}

            {/* Results preview */}
            {genResult && (
              <div
                style={{
                  background: "rgba(34,197,94,0.06)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  borderRadius: 8,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <strong style={{ color: "#86efac", fontSize: 14 }}>✓ Proceso Completado</strong>
                  <span className="chip" style={{ fontSize: 10 }}>{genResult.status}</span>
                </div>

                {genResult.message && (
                  <p className="muted small" style={{ margin: 0 }}>
                    {genResult.message}
                  </p>
                )}

                {genResult.reference && (
                  <div style={{ background: "var(--panel-2)", borderRadius: 6, padding: 10, fontSize: 11 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      Referencia Real Investigada: {genResult.reference.entity}
                    </div>
                    <div className="muted">
                      Estado: {genResult.reference.status} · Basado en características institucionales auditadas.
                    </div>
                  </div>
                )}

                {(genResult.generatedAsset || genResult.fallbackAsset) && (
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <img
                      src={`${SIDECAR_URL_EXPORT}/media?file=assets/editorial/${
                        (genResult.generatedAsset || genResult.fallbackAsset)!.file
                      }`}
                      alt="Asset"
                      style={{ width: 90, height: 60, objectFit: "cover", borderRadius: 6 }}
                    />
                    <div>
                      <strong>{(genResult.generatedAsset || genResult.fallbackAsset)!.entity}</strong>
                      <div className="muted small">
                        Registrado en catálogo con ID: <code>{(genResult.generatedAsset || genResult.fallbackAsset)!.id}</code>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button
                className="chip"
                onClick={() => setShowGenerateModal(false)}
                disabled={genLoading}
              >
                Cerrar
              </button>
              <button
                className="btn-primary"
                onClick={handleGenerateSubmit}
                disabled={genLoading || !genEntity.trim()}
                style={{ background: "linear-gradient(135deg, #8b5cf6, #3b82f6)" }}
              >
                {genLoading ? "Generando…" : "Iniciar Generación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
