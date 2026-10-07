import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { PageContainer } from "@/shared/components/layout/PageContainer"
import { TarjetonUploaderSection } from "@/features/profile/components/worker/TarjetonUploaderSection"
import { TarjetonHistorySection, type PreviousImport } from "@/features/tarjeton/components/TarjetonHistorySection"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"
import { AvatarUploader } from "@/features/profile/components/worker/AvatarUploader"
import { ImssAutoConsultationCard } from "@/features/profile/components/ImssAutoConsultationCard"

export interface UnifiedProfileViewProps {
  userId: string
  email: string | null
  fullName: string | null
  avatarUrl?: string | null
  matricula: string | null
  categoria: string | null
  antiguedad: string | null
  adscripcion: string | null
  workdayHours: number | null
  activePeriodRaw: string | null
  snapshot: TarjetonProfileSnapshot
  previousImports: PreviousImport[]
  activePayslipId: string | null
  latestPayslipId: string | null
  selectionMode: "AUTO_LATEST" | "PINNED" | "UNKNOWN"
  latestConcepts: Array<{ code: string; description: string; amount: number; kind: "earning" | "deduction" }>
  payslipsQueryError?: boolean
  returnTo?: string
  isInitialOnboarding?: boolean
}

export function UnifiedProfileView({
  userId,
  email,
  fullName,
  avatarUrl,
  matricula,
  categoria,
  antiguedad,
  adscripcion,
  workdayHours,
  activePeriodRaw,
  snapshot,
  previousImports,
  activePayslipId,
  latestPayslipId,
  selectionMode,
  latestConcepts,
  payslipsQueryError = false,
  returnTo,
  isInitialOnboarding = false,
}: UnifiedProfileViewProps) {
  const hasTarjetonData = Boolean(previousImports.length > 0 || matricula || categoria)

  return (
    <PageContainer
      maxWidth={700}
      style={{ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "0.5rem 0" }}
    >
      {isInitialOnboarding && (
        <div
          role="status"
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            padding: "0.875rem 1rem",
            borderRadius: "var(--radius)",
            fontSize: "0.875rem",
            lineHeight: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <span>
            <strong>✅ ¡Tu cuenta está lista!</strong> Importa tu tarjetón IMSS abajo para llenar automáticamente tu perfil laboral.
          </span>
          <Link
            href={returnTo ?? "/"}
            style={{
              fontWeight: 700,
              color: "#166534",
              textDecoration: "underline",
              whiteSpace: "nowrap",
            }}
          >
            Omitir e ir al inicio →
          </Link>
        </div>
      )}

      {!isInitialOnboarding && returnTo && (
        <div>
          <Link
            href={returnTo}
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--primary)",
              textDecoration: "none",
            }}
          >
            ← Volver a la herramienta anterior
          </Link>
        </div>
      )}

      {/* 1. Encabezado del usuario */}
      <AvatarUploader
        initialAvatarUrl={avatarUrl}
        fullName={fullName}
        email={email}
      />

      {/* 2. Ficha Laboral Oficial (automática desde el tarjetón) */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1.25rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginBottom: "0.875rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: hasTarjetonData ? "#dcfce7" : "var(--accent)",
                color: hasTarjetonData ? "#16a34a" : "var(--muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={16} />
            </div>
            <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
              Ficha del Trabajador
            </span>
          </div>
          {hasTarjetonData ? (
            <span
              style={{
                background: "#f0fdf4",
                color: "#166534",
                border: "1px solid #bbf7d0",
                borderRadius: "var(--radius-sm)",
                padding: "0.2rem 0.5rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              ✓ Sincronizado con tarjetón{activePeriodRaw ? ` (${activePeriodRaw})` : ""}
            </span>
          ) : (
            <span
              style={{
                background: "var(--accent)",
                color: "var(--muted)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "0.2rem 0.5rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              Se llena automáticamente al subir tu tarjetón
            </span>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "0.75rem",
            background: "var(--accent)",
            padding: "0.875rem",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Matrícula IMSS</div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
              {matricula || "Pendiente de tarjetón"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Categoría sindical</div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
              {categoria || "Pendiente de tarjetón"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Antigüedad</div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
              {antiguedad || "Pendiente de tarjetón"}
            </div>
          </div>
          {workdayHours && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Jornada</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
                {workdayHours} horas
              </div>
            </div>
          )}
          {adscripcion && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Adscripción</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
                {adscripcion}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Importar tarjetón IMSS (sustituye formularios manuales redundantes) */}
      <section
        id="subir-tarjeton"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: "0 0 0.25rem", wordBreak: "break-word" }}>
            {previousImports.length > 0 ? "Actualizar con nuevo tarjetón IMSS" : "Importar mi tarjetón IMSS"}
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>
            Sube tu archivo PDF para importar tarjetón IMSS y sincronizar automáticamente tu nombre, matrícula, categoría, antigüedad, jornada y conceptos en todas las herramientas de la app.
          </p>
        </div>

        <TarjetonUploaderSection profileSnapshot={snapshot} userId={userId} />

        <Link
          href="/documentos-personales"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--primary)",
            textDecoration: "none",
            width: "fit-content",
            maxWidth: "100%",
          }}
        >
          Ver mis documentos personales →
        </Link>
      </section>

      {/* Bóveda IMSS y Consultas Automáticas */}
      <ImssAutoConsultationCard compact matricula={matricula} />

      {payslipsQueryError && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "0.375rem",
            padding: "0.875rem 1rem",
            color: "#991b1b",
            fontSize: "0.875rem",
          }}
        >
          No pudimos consultar tu historial de tarjetones en este momento. Intenta recargar la página.
        </div>
      )}

      {/* 4. Historial de tarjetones importados */}
      {previousImports.length > 0 && (
        <section
          id="historial-tarjetones"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: "0 0 0.25rem", wordBreak: "break-word" }}>
              Mis tarjetones importados
            </h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>
              Selecciona cuál tarjetón alimenta tus calculadoras, vacaciones y herramientas.
            </p>
          </div>

          <TarjetonHistorySection
            imports={previousImports}
            activePayslipId={activePayslipId}
            latestPayslipId={latestPayslipId}
            selectionMode={selectionMode}
            latestConcepts={latestConcepts}
            uploadHref="#subir-tarjeton"
          />
        </section>
      )}
    </PageContainer>
  )
}
