"use client";

import { useMemo } from "react";
import { Card } from "@/shared/components/ui/Card";
import { LockerDoor } from "./LockerDoor";
import type { LockerBank, LockerMapItem } from "@/features/representacion/lib/lockers";

interface LockerBankGridProps {
  bank: LockerBank;
  lockers: LockerMapItem[];
  highlightedLockerId?: string | null;
  onLockerClick: (locker: LockerMapItem) => void;
  onLockerHover?: (e: React.MouseEvent<HTMLDivElement>, locker: LockerMapItem) => void;
  onLockerLeave?: () => void;
  isAdmin?: boolean;
  onEditBank?: (bank: LockerBank) => void;
}

export function LockerBankGrid({
  bank,
  lockers,
  highlightedLockerId,
  onLockerClick,
  onLockerHover,
  onLockerLeave,
  isAdmin,
  onEditBank,
}: LockerBankGridProps): React.JSX.Element {
  // Construir matriz bidimensional según rows y columns del bloque
  const { matrix, unpositioned } = useMemo(() => {
    const grid: Array<Array<LockerMapItem | null>> = [];
    for (let r = 0; r < bank.rows; r++) {
      grid.push(new Array(bank.columns).fill(null));
    }

    const unpos: LockerMapItem[] = [];

    for (const locker of lockers) {
      const r = locker.row_position;
      const c = locker.column_position;

      if (r && c && r >= 1 && r <= bank.rows && c >= 1 && c <= bank.columns) {
        grid[r - 1][c - 1] = locker;
      } else {
        unpos.push(locker);
      }
    }

    return { matrix: grid, unpositioned: unpos };
  }, [bank, lockers]);

  // Contadores del bloque
  const occupiedCount = lockers.filter((l) => l.effective_state.kind === "assigned").length;
  const availableCount = lockers.filter((l) => l.effective_state.isAvailable).length;
  const issuesCount = lockers.filter((l) => l.effective_state.hasAttention).length;

  return (
    <div style={{ marginBottom: "2rem" }} id={`bank-${bank.id}`}>
      <Card padding="1rem 1.25rem" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
        {/* Cabecera del Bloque / Mueble */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "0.75rem",
            marginBottom: "1rem",
            borderBottom: "1px solid var(--border)",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--fg)" }}>
                {bank.name}
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "var(--muted)",
                  backgroundColor: "var(--accent)",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "0.25rem",
                  fontWeight: 500,
                }}
              >
                {bank.rows} filas × {bank.columns} columnas ({bank.rows * bank.columns} posiciones)
              </span>
              {issuesCount > 0 && (
                <span
                  style={{
                    fontSize: "0.7rem",
                    backgroundColor: "#fff7ed",
                    color: "#c2410c",
                    border: "1px solid #fed7aa",
                    padding: "0.1rem 0.45rem",
                    borderRadius: "9999px",
                    fontWeight: 700,
                  }}
                >
                  ⚠ {issuesCount} por revisar
                </span>
              )}
            </div>
            {bank.description && (
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                {bank.description}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "right" }}>
              <span style={{ fontWeight: 600, color: "#1e40af" }}>{occupiedCount} ocupados</span> ·{" "}
              <span style={{ fontWeight: 600, color: "#166534" }}>{availableCount} libres</span>
            </div>
            {isAdmin && onEditBank && (
              <button
                type="button"
                onClick={() => onEditBank(bank)}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "0.25rem",
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--fg)",
                  cursor: "pointer",
                }}
              >
                Editar bloque
              </button>
            )}
          </div>
        </div>

        {/* Cuadrícula física de puertas (soporta scroll horizontal si hay muchas columnas) */}
        <div style={{ overflowX: "auto", paddingBottom: "0.5rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${bank.columns}, minmax(92px, 1fr))`,
              gap: "0.5rem",
              minWidth: `${bank.columns * 98}px`,
            }}
          >
            {matrix.map((row, rIdx) =>
              row.map((locker, cIdx) => {
                if (!locker) {
                  // Hueco vacío (empty slot)
                  return (
                    <div
                      key={`empty-${rIdx}-${cIdx}`}
                      style={{
                        minHeight: "108px",
                        borderRadius: "0.375rem",
                        border: "1.5px dashed #cbd5e1",
                        backgroundColor: "#f8fafc",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#94a3b8",
                        fontSize: "0.65rem",
                        userSelect: "none",
                      }}
                      title={`Posición Fila ${rIdx + 1}, Columna ${cIdx + 1} (Espacio vacío)`}
                    >
                      <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>∅</span>
                      <span style={{ opacity: 0.75, marginTop: "0.15rem" }}>
                        F{rIdx + 1}:C{cIdx + 1}
                      </span>
                    </div>
                  );
                }

                return (
                  <LockerDoor
                    key={locker.id}
                    locker={locker}
                    isHighlighted={highlightedLockerId === locker.id}
                    onClick={onLockerClick}
                    onMouseEnter={onLockerHover}
                    onMouseLeave={onLockerLeave}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Casilleros sin posición definida dentro de este bloque */}
        {unpositioned.length > 0 && (
          <div
            style={{
              marginTop: "1rem",
              paddingTop: "0.75rem",
              borderTop: "1px dashed var(--border)",
            }}
          >
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.5rem" }}>
              Otros casilleros en este bloque (sin fila/columna asignada):
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
                gap: "0.5rem",
              }}
            >
              {unpositioned.map((locker) => (
                <LockerDoor
                  key={locker.id}
                  locker={locker}
                  isHighlighted={highlightedLockerId === locker.id}
                  onClick={onLockerClick}
                  onMouseEnter={onLockerHover}
                  onMouseLeave={onLockerLeave}
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
