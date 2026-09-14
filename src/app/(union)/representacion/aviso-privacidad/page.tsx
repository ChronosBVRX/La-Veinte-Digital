import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { Card } from "@/shared/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function AvisoPrivacidadUnion(): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");
  return (
    <div>
      <UnionPageHeader title="Aviso de privacidad" subtitle="Tratamiento de datos en La Veinte Digital · Módulo de Representación Sindical XXI." />
      <Card>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Aviso corto</h2>
        <p style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
          La Veinte Digital (módulo de Representación Sindical, Delegación XXI, HGR No. 1) trata tus datos para preparar, validar y dar
          seguimiento a trámites sindicales (maternidad, lactancia, lockers, pasajes 026/027 y licencias). Solo el personal representante
          habilitado (union_rep / union_admin) accede por delegación. No compartimos tu información con terceros salvo requerimiento fundado
          de autoridad. Minimización: en maternidad solo registramos fecha de incapacidad y datos administrativos (sin diagnóstico clínico); en
          licencias, el motivo en grado indispensable.
        </p>
        <h2 style={{ margin: "1rem 0 0.5rem", fontSize: "1rem" }}>Aviso integral</h2>
        <ul style={{ fontSize: "0.875rem", lineHeight: 1.6, paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <li><strong>Responsable:</strong> Representación Sindical Delegación XXI (operador de La Veinte Digital). Este tratamiento es distinto del que realiza el IMSS en sus formatos institucionales (p. ej. el aviso del formato 027, que se conserva en el PDF generado).</li>
          <li><strong>Finalidades:</strong> padrón de trabajadores, cálculo administrativo de maternidad/lactancia, gestión de lockers y lista de espera, preparación de formatos 026/027 y de solicitud de licencia con oficio, expedientes con timeline y auditoría.</li>
          <li><strong>Datos:</strong> identificación y laborales (nombre, matrícula, categoría, adscripción, turno, horario, descansos), contacto mínimo (teléfono cuando el trámite lo exige), domicilios solo para pasaje 027, periodos y motivos administrativos. No recabamos datos biométricos ni bancarios en este módulo.</li>
          <li><strong>Protección:</strong> autenticación Supabase, RLS por delegación, storage privado (union-private) con URLs firmadas breves, auditoría sanitizada (sin domicilios/teléfonos/matrículas completas en logs).</li>
          <li><strong>Retención:</strong> expedientes activos + archivo por cancelación (no borrado físico desde UI); trabajadores se desactivan, no se eliminan si tienen expedientes; historial de lockers permanente.</li>
          <li><strong>Derechos:</strong> acceso, rectificación, cancelación y oposición ante la Representación (Delegación XXI, HGR No. 1). Respuesta en plazos razonables; la cancelación procede salvo bloqueo por obligaciones laborales o requerimientos de autoridad.</li>
          <li><strong>Contacto:</strong> a través del representante que atiende tu trámite o la Administración del módulo.</li>
        </ul>
      </Card>
    </div>
  );
}
