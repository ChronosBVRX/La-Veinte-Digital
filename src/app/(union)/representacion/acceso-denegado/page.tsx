import Link from "next/link";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default function AccesoDenegadoPage(): React.JSX.Element {
  return (
    <div style={{ maxWidth: "560px", margin: "2rem auto" }}>
      <Card padding="1.5rem">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <ShieldCheck size={22} weight="duotone" color="var(--primary)" />
          <h1 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
            Se requiere rol de Administrador Sindical
          </h1>
        </div>
        <p style={{ margin: "0 0 1rem", fontSize: "0.9375rem", color: "var(--muted)", lineHeight: 1.55 }}>
          Este apartado (comité, configuración e importaciones) es exclusivo para cuentas con rol
          <strong> union_admin</strong>. Como Representante Sindical conservas acceso a los módulos de
          trabajadores, prestaciones y trámites.
        </p>
        <Link href="/representacion" style={{ textDecoration: "none" }}>
          <Button variant="secondary" size="md">
            Volver al resumen
          </Button>
        </Link>
      </Card>
    </div>
  );
}
