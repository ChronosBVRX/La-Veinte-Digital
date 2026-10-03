import { createClient } from "@/lib/supabase/server"
import { User, Shield, Trash2, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { ProfileForm } from "@/features/profile/components/ProfileForm"
import { BiometricSecurityCard } from "@/features/profile/components/BiometricSecurityCard"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p>Debes iniciar sesión</p>

  await supabase.rpc("ensure_profile_exists")

  const [profileRes, payrollRes, payslipRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single(),
    supabase
      .from("payroll_contexts")
      .select("category_name, matricula, adscripcion, effective_seniority_date, workday_hours, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("imported_payslips")
      .select("period_raw, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const profile = profileRes.data
  const payroll = payrollRes.data
  const latestPayslip = payslipRes.data

  const effectiveProfile = {
    ...profile,
    id: user.id,
    full_name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    matricula: profile?.matricula || payroll?.matricula || null,
    adscripcion: profile?.adscripcion || payroll?.adscripcion || null,
    categoria: profile?.categoria || payroll?.category_name || null,
    antiguedad: profile?.antiguedad || (payroll?.effective_seniority_date ? String(payroll.effective_seniority_date) : null),
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--primary), #6366f1)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <User size={22} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            {profile?.full_name ?? "Mi Perfil"}
          </h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
            {user.email}
          </p>
        </div>
      </div>

      {/* Ficha Laboral Oficial sincronizada */}
      {(effectiveProfile.categoria || effectiveProfile.matricula || latestPayslip) && (
        <div style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1.25rem",
          marginBottom: "1.5rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.875rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "#dcfce7", color: "#16a34a",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <CheckCircle2 size={16} />
              </div>
              <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
                Ficha Laboral Oficial
              </span>
            </div>
            {latestPayslip && (
              <span style={{
                background: "#f0fdf4",
                color: "#166534",
                border: "1px solid #bbf7d0",
                borderRadius: "var(--radius-sm)",
                padding: "0.2rem 0.5rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}>
                ✓ Sincronizado con tarjetón ({latestPayslip.period_raw || "Reciente"})
              </span>
            )}
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "0.75rem",
            background: "var(--accent)",
            padding: "0.875rem",
            borderRadius: "var(--radius-sm)",
            marginBottom: "0.75rem",
          }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Matrícula IMSS</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
                {effectiveProfile.matricula || "No registrada"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Categoría sindical</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
                {effectiveProfile.categoria || "No registrada"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Antigüedad</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
                {effectiveProfile.antiguedad || "No registrada"}
              </div>
            </div>
            {effectiveProfile.adscripcion && (
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Adscripción</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
                  {effectiveProfile.adscripcion}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link
              href="/profile/mi-informacion-laboral#subir-tarjeton"
              style={{
                fontSize: "0.8125rem",
                color: "var(--primary)",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Actualizar con nuevo tarjetón IMSS →
            </Link>
          </div>
        </div>
      )}

      {/* CTA unificado: datos laborales + tarjetones */}
      <Link href="/profile/mi-informacion-laboral" style={{
        display: "block", textDecoration: "none", marginBottom: "1.5rem",
        background: "linear-gradient(135deg, rgba(37,99,235,0.06), var(--card))",
        border: "1px solid var(--border)", borderRadius: "var(--radius)",
        padding: "1rem 1.25rem",
      }}>
        <div style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: "0.125rem", color: "var(--fg)" }}>
          Datos laborales y tarjetones IMSS →
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Configura tu categoría, antigüedad y jornada. Sube tu tarjetón cuando quieras y tus datos se actualizan solos; ahí mismo queda tu historial de recibos.
        </div>
      </Link>

      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", overflow: "hidden",
      }}>
        <div style={{ padding: "0 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.75rem 0", borderBottom: "2px solid var(--primary)",
              marginBottom: "-1px", cursor: "default",
            }}>
              <Shield size={16} style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--primary)" }}>
                Información personal
              </span>
            </div>
            <Link href="/profile/mi-informacion-laboral" style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.75rem 0", cursor: "pointer", textDecoration: "none",
              fontSize: "0.9375rem", color: "var(--muted)",
            }}>
              Datos laborales
            </Link>
          </div>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <ProfileForm profile={effectiveProfile} />
        </div>
      </div>

      <BiometricSecurityCard />

      {/* Privacidad y cuenta */}
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "1rem 1.25rem", marginTop: "1.5rem",
      }}>
        <div style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: "0.625rem" }}>
          Privacidad y cuenta
        </div>
        <Link href="/eliminar-cuenta" style={{
          display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none",
          fontSize: "0.875rem", color: "#dc2626", padding: "0.375rem 0",
        }}>
          <Trash2 size={16} />
          Eliminar mi cuenta
        </Link>
        <Link href="/privacidad" style={{
          display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none",
          fontSize: "0.875rem", color: "var(--muted)", padding: "0.375rem 0",
        }}>
          Política de privacidad
        </Link>
      </div>
    </div>
  )
}
