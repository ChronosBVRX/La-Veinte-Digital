"use client";

import { useState, useMemo } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import type { LockerBank, LockerZone } from "@/features/representacion/lib/lockers";

interface LockerBankEditorProps {
  isOpen: boolean;
  onClose: () => void;
  zone: LockerZone | null;
  bankToEdit?: LockerBank | null;
  onSuccess: () => void;
}

export function LockerBankEditor({
  isOpen,
  onClose,
  zone,
  bankToEdit,
  onSuccess,
}: LockerBankEditorProps): React.JSX.Element | null {
  const [name, setName] = useState(bankToEdit?.name || "");
  const [description, setDescription] = useState(bankToEdit?.description || "");
  const [rows, setRows] = useState(bankToEdit?.rows || 5);
  const [columns, setColumns] = useState(bankToEdit?.columns || 8);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">((bankToEdit?.orientation as "horizontal" | "vertical") || "horizontal");

  // Asignación por rango
  const [enableRange, setEnableRange] = useState(false);
  const [startNumber, setStartNumber] = useState("");
  const [endNumber, setEndNumber] = useState("");
  const [orderDirection, setOrderDirection] = useState<"ltr_ttb" | "ttb_ltr">("ltr_ttb");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vista previa de la cuadrícula
  const previewMatrix = useMemo(() => {
    const s = parseInt(startNumber, 10);
    const e = parseInt(endNumber, 10);
    const hasRange = enableRange && !isNaN(s) && !isNaN(e) && e >= s;

    const grid: Array<Array<number | null>> = [];
    for (let r = 0; r < rows; r++) {
      grid.push(new Array(columns).fill(null));
    }

    if (!hasRange) return grid;

    let idx = 0;
    const max = rows * columns;

    if (orderDirection === "ltr_ttb") {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
          const num = s + idx;
          if (num <= e && idx < max) {
            grid[r][c] = num;
          }
          idx++;
        }
      }
    } else {
      for (let c = 0; c < columns; c++) {
        for (let r = 0; r < rows; r++) {
          const num = s + idx;
          if (num <= e && idx < max) {
            grid[r][c] = num;
          }
          idx++;
        }
      }
    }

    return grid;
  }, [rows, columns, enableRange, startNumber, endNumber, orderDirection]);

  if (!isOpen || !zone) return null;

  async function handleSave(): Promise<void> {
    if (!name.trim()) {
      setError("El nombre del bloque es obligatorio (ej. Mueble A, Hilera 1).");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const s = parseInt(startNumber, 10);
      const e = parseInt(endNumber, 10);
      const hasRange = enableRange && !isNaN(s) && !isNaN(e) && e >= s;

      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim(),
        rows,
        columns,
        orientation,
      };

      if (!bankToEdit) {
        payload.zone_id = zone?.id;
        if (hasRange) {
          payload.range_assignment = {
            start_number: s,
            end_number: e,
            order_direction: orderDirection,
          };
        }

        const res = await fetch("/api/union/lockers/banks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al crear bloque");
      } else {
        payload.id = bankToEdit.id;
        const res = await fetch("/api/union/lockers/banks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al actualizar bloque");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fallo al guardar bloque");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(15, 23, 42, 0.5)",
        backdropFilter: "blur(2px)",
        padding: "1rem",
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          backgroundColor: "var(--card)",
          borderRadius: "0.75rem",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "1.5rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--fg)" }}>
              {bankToEdit ? `Editar Bloque: ${bankToEdit.name}` : `Nuevo Bloque en ${zone.name}`}
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              Define la cuadrícula física (filas × columnas) y asigna casilleros.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--muted)" }}
          >
            ✕
          </button>
        </div>

        {/* Datos Básicos */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.25rem" }}>
              Nombre del Bloque / Mueble:
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Mueble A, Hilera Norte, Bloque 1"
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.25rem" }}>
              Orientación:
            </label>
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as "horizontal" | "vertical")}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
                color: "var(--fg)",
                fontSize: "0.875rem",
              }}
            >
              <option value="horizontal">Horizontal (por defecto)</option>
              <option value="vertical">Vertical</option>
            </select>
          </div>
        </div>

        {/* Descripción */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.25rem" }}>
            Descripción o Referencia:
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej. Frente a regaderas masculinas, pasillo poniente"
          />
        </div>

        {/* Dimensiones */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.25rem" }}>
              Filas:
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={rows}
              onChange={(e) => setRows(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
                color: "var(--fg)",
                fontSize: "0.875rem",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.25rem" }}>
              Columnas:
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={columns}
              onChange={(e) => setColumns(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
                color: "var(--fg)",
                fontSize: "0.875rem",
              }}
            />
          </div>
        </div>

        {/* Asistente de Asignación por Rango (Solo al crear) */}
        {!bankToEdit && (
          <div
            style={{
              backgroundColor: "var(--accent)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
              <input
                type="checkbox"
                checked={enableRange}
                onChange={(e) => setEnableRange(e.target.checked)}
              />
              <span>Asignar casilleros existentes por rango numérico</span>
            </label>

            {enableRange && (
              <div style={{ marginTop: "0.75rem", display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: "0.5rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.2rem" }}>
                    Inicio (ej. 101):
                  </label>
                  <Input
                    value={startNumber}
                    onChange={(e) => setStartNumber(e.target.value)}
                    placeholder="101"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.2rem" }}>
                    Fin (ej. 140):
                  </label>
                  <Input
                    value={endNumber}
                    onChange={(e) => setEndNumber(e.target.value)}
                    placeholder="140"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.2rem" }}>
                    Dirección:
                  </label>
                  <select
                    value={orderDirection}
                    onChange={(e) => setOrderDirection(e.target.value as "ltr_ttb" | "ttb_ltr")}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.5rem",
                      borderRadius: "0.375rem",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                      color: "var(--fg)",
                      fontSize: "0.75rem",
                    }}
                  >
                    <option value="ltr_ttb">Izq → Der, Arriba → Abajo</option>
                    <option value="ttb_ltr">Arriba → Abajo, Izq → Der</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vista previa de la matriz */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: "0.4rem" }}>
            Vista previa del mueble ({rows} × {columns} = {rows * columns} espacios)
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: "4px",
              padding: "0.5rem",
              backgroundColor: "var(--accent)",
              borderRadius: "0.375rem",
              border: "1px solid var(--border)",
              maxHeight: "180px",
              overflowY: "auto",
            }}
          >
            {previewMatrix.map((row, rIdx) =>
              row.map((num, cIdx) => (
                <div
                  key={`${rIdx}-${cIdx}`}
                  style={{
                    backgroundColor: num ? "#eff6ff" : "var(--card)",
                    border: num ? "1px solid #bfdbfe" : "1px dashed var(--border)",
                    borderRadius: "0.25rem",
                    padding: "0.25rem 0.15rem",
                    textAlign: "center",
                    fontSize: "0.6875rem",
                    fontWeight: num ? 700 : 400,
                    color: num ? "#1e40af" : "var(--muted)",
                    minHeight: "28px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {num ? num : "—"}
                </div>
              ))
            )}
          </div>
        </div>

        {error && (
          <div style={{ color: "#dc2626", fontSize: "0.8125rem", marginBottom: "1rem" }} role="alert">
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={submitting}>
            {bankToEdit ? "Guardar cambios" : "Crear bloque físico"}
          </Button>
        </div>
      </div>
    </div>
  );
}
