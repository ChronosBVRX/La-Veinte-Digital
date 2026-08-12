"use client"

import { useNomina } from "../hooks/useNomina"
import { OptInConsent } from "./OptInConsent"
import { NominaProfileWizard } from "./NominaProfileWizard"
import { ProjectionView } from "./ProjectionView"
import { CategoryResolutionCard } from "./CategoryResolutionCard"
import { ConditionalQuestionsFlow } from "./ConditionalQuestionsFlow"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import Link from "next/link"
import {
  User, FileText, Trash2, FileUp,
  ArrowRight, RefreshCw, BarChart3,
} from "lucide-react"
import { Badge } from "@/shared/components/ui/Badge"

export function NominaIndex() {
  const {
    consented, profile, category, categoryState, seniority, period,
    projection, projections, step, loading, hydrating, deleting, deletionError,
    pendingQuestions,
    giveConsent, revokeConsent, deleteDataPermanently, updateProfile,
    resolveAmbiguousCategory,
    generateProjection, resetProfile, setStep, selectProjection,
    answerQuestion, removeProjection,
  } = useNomina()

  if (loading) {
    return <LoadingSpinner text="Cargando..." />
  }

  if (deleting) {
    return <LoadingSpinner text="Borrando tus datos del servidor..." />
  }

  if (!consented) {
    return (
      <OptInConsent
        onAccept={giveConsent}
        onDecline={() => { window.history.back?.() }}
      />
    )
  }

  if (step === "profile" || step === "category" || step === "seniority" || step === "conditions") {
    return (
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, margin: 0 }}>
            Configurar perfil laboral
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Tus datos se usan solo para calcular proyecciones.
          </p>
        </div>
        <NominaProfileWizard profile={profile} onSave={updateProfile} />
      </div>
    )
  }

  if (categoryState.status === "ambiguous") {
    return (
      <CategoryResolutionCard
        matches={categoryState.matches ?? []}
        onSelect={resolveAmbiguousCategory}
        onRetry={() => setStep("profile")}
      />
    )
  }

  if (categoryState.status === "resolving") {
    return <LoadingSpinner text="Estamos identificando tu categoría..." />
  }

  if (categoryState.status === "not_found") {
    return (
      <div style={{ maxWidth: "560px", margin: "2rem auto" }}>
        <Card padding="1.5rem" style={{ textAlign: "center" }}>
          <h3 style={{ margin: "0 0 0.5rem" }}>Categoría no encontrada</h3>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1rem" }}>
            No pudimos identificar tu categor&iacute;a &ldquo;{categoryState.originalValue}&rdquo;.
            Revisa el nombre en tu tarjet&oacute;n e int&eacute;ntalo de nuevo.
          </p>
          <Button onClick={() => setStep("profile")}>Volver al perfil</Button>
        </Card>
      </div>
    )
  }

  if (step === "questions" && pendingQuestions.length > 0) {
    return (
      <ConditionalQuestionsFlow
        questions={pendingQuestions}
        onAnswer={answerQuestion}
        onSkip={() => setStep("ready")}
        onGenerate={() => setStep("ready")}
      />
    )
  }

  if (step === "projection" && projection) {
    return (
      <ProjectionView
        projection={projection}
        onBack={() => setStep("ready")}
      />
    )
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: "1.5rem",
      }}>
        <div>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, margin: 0 }}>
            Proyecci&oacute;n de N&oacute;mina
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Simulador de tarjet&oacute;n del IMSS
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm("¿Desactivar la proyección de nómina? Tus datos guardados se conservan en el servidor por si quieres reactivarla después.")) {
                revokeConsent()
              }
            }}
            style={{ fontSize: "0.75rem" }}
          >
            <Trash2 size={14} /> Desactivar
          </Button>
          <Button
            variant="ghost"
            disabled={deleting}
            onClick={() => {
              if (window.confirm("¿Borrar permanentemente todos tus datos de nómina y tarjetones del servidor? Esta acción no se puede deshacer.")) {
                deleteDataPermanently()
              }
            }}
            style={{ fontSize: "0.75rem", color: "#dc2626" }}
          >
            Borrar mis datos
          </Button>
        </div>
      </div>

      {deletionError && (
        <div style={{
          background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)",
          borderRadius: "var(--radius)", padding: "0.75rem 1rem",
          fontSize: "0.8125rem", color: "#991b1b", marginBottom: "1rem",
        }}>
          {deletionError}
        </div>
      )}

      {profile && (
        <Card padding="1.25rem" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",              background: "rgba(37,99,235,0.1)", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>
              <User size={18} style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                {profile.categoryName || "Perfil laboral"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {profile.employmentType} &middot; {profile.workdayHours}h
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={resetProfile} style={{ marginLeft: "auto" }}>
              <RefreshCw size={14} /> Editar
            </Button>
          </div>

          {category && (
            <div style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <span><strong>Sueldo quincenal:</strong> ${category.biweeklyBaseSalary.toFixed(2)}</span>
              {seniority && (
                <span><strong>Antigüedad:</strong> {seniority.years}a {seniority.months}m</span>
              )}
              {period && (
                <span><strong>Periodo:</strong> {period.label}</span>
              )}
            </div>
          )}
        </Card>
      )}

      {profile?.displayedSeniorityAtLastPayslip?.referenceDate ? (
        <Link href="/tarjeton" style={{ textDecoration: "none", display: "block", marginBottom: "1rem" }}>
          <div style={{
            background: "var(--accent)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "0.75rem 1rem",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", fontSize: "0.875rem" }}>
              <FileUp size={18} style={{ color: "var(--primary)" }} />
              <span>
                <strong>Actualiza tu tarjetón</strong> para mantener tus importes al día.
              </span>
            </div>
            <ArrowRight size={16} style={{ color: "var(--primary)" }} />
          </div>
        </Link>
      ) : (
        <Link href="/tarjeton" style={{ textDecoration: "none", display: "block", marginBottom: "1rem" }}>
          <div style={{
            background: "var(--accent)", border: "1px dashed var(--primary)",
            borderRadius: "var(--radius)", padding: "0.875rem 1rem",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", fontSize: "0.875rem" }}>
              <FileUp size={18} style={{ color: "var(--primary)" }} />
              <span>
                <strong>¿Tienes tu tarjetón?</strong> Impórtalo para que las proyecciones usen tus importes reales.
              </span>
            </div>
            <ArrowRight size={16} style={{ color: "var(--primary)" }} />
          </div>
        </Link>
      )}

      {projections.length > 0 && (
        <Card padding="1.25rem" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <BarChart3 size={16} style={{ color: "var(--muted)" }} />
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: 0 }}>
              Proyecciones guardadas ({projections.length})
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[...projections].reverse().slice(0, 5).map((p) => (
              <div key={p.id} style={{ display: "flex", gap: "0.25rem" }}>
                <button
                  onClick={() => selectProjection(p.id)}
                  style={{
                    flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0.5rem 0.75rem", borderRadius: "var(--radius)",
                    border: "1px solid var(--border)", background: "transparent",
                    cursor: "pointer", fontSize: "0.8125rem", textAlign: "left",
                  }}
                >
                  <span>{p.period.label}</span>
                  <span style={{ fontWeight: 600 }}>${p.totalEarnings.toFixed(2)}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeProjection(p.id) }}
                  title="Eliminar proyección"
                  style={{
                    padding: "0.5rem 0.5rem", borderRadius: "var(--radius)",
                    border: "1px solid var(--border)", background: "transparent",
                    cursor: "pointer", fontSize: "0.8125rem", color: "var(--muted)",
                    lineHeight: 1,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card padding="1.5rem" style={{ textAlign: "center" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
          Generar proyecci&oacute;n
        </h3>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1rem" }}>
          Calcula una estimaci&oacute;n del pr&oacute;ximo tarjet&oacute;n basada en tu perfil
          y las reglas del CCT.
        </p>
        {(() => {
          const missing: string[] = []
          if (!category) missing.push("categoría")
          if (!seniority) missing.push("antigüedad")
          if (!period) missing.push("periodo")
          if (missing.length > 0) {
            return (
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--warning)", margin: "0 0 0.5rem" }}>
                  Faltan datos necesarios: <strong>{missing.join(", ")}</strong>
                  {hydrating ? " (cargando...)" : ". Revisa tu perfil laboral."}
                </p>
                <Button disabled>
                  <FileText size={16} /> Generar proyecci&oacute;n <ArrowRight size={16} />
                </Button>
              </div>
            )
          }
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center" }}>
              <Button onClick={() => {
                const result = generateProjection("assisted")
                if (result && result.questions.length > 0) {
                  setStep("questions")
                }
              }}>
                <FileText size={16} /> Generar proyecci&oacute;n <ArrowRight size={16} />
              </Button>
              {pendingQuestions.length > 0 && (
                <span
                  onClick={() => setStep("questions")}
                  style={{ cursor: "pointer" }}
                >
                  <Badge variant="info" size="sm">
                    {pendingQuestions.length} pregunta{pendingQuestions.length > 1 ? "s" : ""} opcional{pendingQuestions.length > 1 ? "es" : ""} para afinar
                  </Badge>
                </span>
              )}
            </div>
          )
        })()}
      </Card>

      <div style={{
        marginTop: "1.5rem", padding: "0.75rem",
        background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)",
        borderRadius: "var(--radius)", fontSize: "0.6875rem", color: "var(--muted)",
        textAlign: "center", lineHeight: 1.5,
      }}>
        Los datos almacenados se usan exclusivamente para generar estimaciones de n&oacute;mina.
        Puedes desactivar este m&oacute;dulo en cualquier momento desde este panel.
      </div>
    </div>
  )
}
