import Link from "next/link"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import {
  EnvelopeSimple,
  Prohibit,
  Trash,
  UserCheck,
  UserList,
  UserPlus,
  Users,
  FileText,
} from "@phosphor-icons/react/dist/ssr"
import type { AdminUserMetrics } from "@/shared/contracts/admin-users"

interface MetricCardProps {
  label: string
  value: number | null
  hint: string
  icon: React.ReactNode
}

function MetricCard({ label, value, hint, icon }: MetricCardProps) {
  return (
    <Card padding="1rem">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>{label}</span>
        {icon}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--fg)", lineHeight: 1.1 }}>
        {value === null ? "—" : value}
      </div>
      <div style={{ marginTop: "0.375rem", fontSize: "0.75rem", color: "var(--muted)" }}>{hint}</div>
    </Card>
  )
}

/**
 * Indicadores reales del Centro de Administración de Usuarios.
 * Se calculan en el servidor con la RPC admin_user_metrics (sin cargar
 * usuarios en el cliente). Si la lectura falla, se muestran guiones en lugar
 * de datos simulados.
 */
export function AdminUserMetricsSection({ metrics }: { metrics: AdminUserMetrics | null }) {
  const value = (key: keyof AdminUserMetrics): number | null => metrics?.[key] ?? null

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <h2
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "var(--fg)",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Gestión de Usuarios
        </h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/admin/usuarios" style={{ textDecoration: "none" }}>
            <Button variant="primary" size="sm">
              <Users size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
              Abrir centro de usuarios
            </Button>
          </Link>
          <Link href="/admin/usuarios/auditoria" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="sm">
              Ver bitácora
            </Button>
          </Link>
        </div>
      </div>

      {!metrics && (
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
          Los indicadores de usuarios no están disponibles en este momento. Recarga la página o revisa la bitácora.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <MetricCard label="Usuarios totales" value={value("totalUsers")} hint="Cuentas registradas en la plataforma" icon={<Users size={20} weight="duotone" color="var(--primary)" />} />
        <MetricCard label="Usuarios activos" value={value("activeUsers")} hint="Con acceso habilitado hoy" icon={<UserCheck size={20} weight="duotone" color="#059669" />} />
        <MetricCard label="Registros recientes" value={value("recentRegistrations")} hint="Últimos 7 días" icon={<UserPlus size={20} weight="duotone" color="#2563eb" />} />
        <MetricCard label="Correo pendiente" value={value("pendingEmailConfirmation")} hint="Sin confirmar correo" icon={<EnvelopeSimple size={20} weight="duotone" color="#d97706" />} />
        <MetricCard label="Suspendidos" value={value("suspendedAccounts")} hint="Acceso bloqueado temporalmente" icon={<Prohibit size={20} weight="duotone" color="#b45309" />} />
        <MetricCard label="En papelera" value={value("trashedAccounts")} hint="Recuperables 30 días" icon={<Trash size={20} weight="duotone" color="#b91c1c" />} />
        <MetricCard label="Perfiles incompletos" value={value("incompleteProfiles")} hint="Sin nombre o matrícula" icon={<UserList size={20} weight="duotone" color="#6366f1" />} />
        <MetricCard label="Con tarjetón" value={value("usersWithPayslip")} hint="Al menos un tarjetón importado" icon={<FileText size={20} weight="duotone" color="#0891b2" />} />
      </div>
    </div>
  )
}
