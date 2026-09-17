import Link from "next/link";
import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { Card } from "@/shared/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function ActualizarBaseHubPage(): Promise<React.JSX.Element> {
  const memberships = await getUnionMemberships();
  const isAdmin = memberships.some((m) => m.role === "union_admin");

  if (!isAdmin) {
    redirect("/representacion/acceso-denegado");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "800px" }}>
      <UnionPageHeader
        title="¿Qué deseas actualizar?"
        subtitle="Selecciona la herramienta administrativa correspondiente. Los procesos de padrón laboral y casilleros son operaciones independientes."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        <Card padding="1.5rem">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>👥</div>
              <h3 style={{ margin: "0 0 0.375rem", fontSize: "1.125rem", fontWeight: 700 }}>
                Base de trabajadores
              </h3>
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.4 }}>
                Mantén sincronizado el padrón laboral institucional: altas, modificaciones de categoría, turno, horario y plaza.
              </p>
            </div>
            <Link
              href="/representacion/trabajadores/importar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                backgroundColor: "var(--primary)",
                color: "var(--primary-fg, #fff)",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
                marginTop: "0.5rem",
              }}
            >
              Actualizar base de trabajadores →
            </Link>
          </div>
        </Card>

        <Card padding="1.5rem">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>🗄️</div>
              <h3 style={{ margin: "0 0 0.375rem", fontSize: "1.125rem", fontWeight: 700 }}>
                Base de lockers
              </h3>
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.4 }}>
                Importa y concilia la relación de casilleros y asignaciones activas de los trabajadores registrados en el padrón.
              </p>
            </div>
            <Link
              href="/representacion/lockers/importar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--fg)",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
                marginTop: "0.5rem",
              }}
            >
              Actualizar base de lockers →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
