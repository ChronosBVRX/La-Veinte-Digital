"use client";

import Link from "next/link";
import { getWorkerDisplayName } from "../WorkerPicker";
import type { WorkerDirectoryRow } from "../../services/worker-directory";
import {
  RepresentationTable,
  RepresentationStatusBadge,
  representationTableCellStyle,
  type RepresentationTableColumn,
} from "../ui";

function formatSeniority(years: number | null): string {
  if (years === null || years === undefined) return "—";
  if (years <= 0) return "< 1 año";
  return `${years} ${years === 1 ? "año" : "años"}`;
}

const COLUMNS: RepresentationTableColumn[] = [
  { label: "Nombre", align: "left" },
  { label: "Categoría", align: "left" },
  { label: "Turno", align: "left" },
  { label: "Adscripción", align: "left" },
  { label: "Matrícula", align: "left" },
  { label: "Antigüedad", align: "left" },
  { label: "Estado", align: "center" },
  { label: "Acción", align: "right" },
];

export function WorkerTable({
  workers,
  buildHref,
}: {
  workers: WorkerDirectoryRow[];
  buildHref: (workerId: string) => string;
}): React.JSX.Element {
  return (
    <RepresentationTable columns={COLUMNS} caption="Directorio de trabajadores">
      {workers.map((w) => (
        <tr key={w.id} className="union-worker-row">
          <td style={{ ...representationTableCellStyle, fontWeight: 600, maxWidth: 240 }}>
            <span style={{ overflowWrap: "anywhere" }}>{getWorkerDisplayName(w)}</span>
          </td>
          <td style={{ ...representationTableCellStyle, maxWidth: 200 }}>{w.category || "—"}</td>
          <td style={representationTableCellStyle}>{w.turn || "—"}</td>
          <td style={{ ...representationTableCellStyle, maxWidth: 200 }}>{w.assignment || "—"}</td>
          <td style={{ ...representationTableCellStyle, whiteSpace: "nowrap" }}>{w.employee_number}</td>
          <td style={{ ...representationTableCellStyle, whiteSpace: "nowrap" }}>{formatSeniority(w.seniority_years)}</td>
          <td style={{ ...representationTableCellStyle, textAlign: "center", whiteSpace: "nowrap" }}>
            <RepresentationStatusBadge status={w.active ? "activo" : "inactivo"} size="sm" />
          </td>
          <td style={{ ...representationTableCellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
            <Link
              href={buildHref(w.id)}
              style={{
                color: "var(--primary)",
                fontWeight: 600,
                fontSize: "0.8125rem",
                textDecoration: "none",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.25rem",
              }}
            >
              Ver expediente
            </Link>
          </td>
        </tr>
      ))}
      <style>{`
        .union-worker-row:hover { background: var(--accent); }
      `}</style>
    </RepresentationTable>
  );
}
