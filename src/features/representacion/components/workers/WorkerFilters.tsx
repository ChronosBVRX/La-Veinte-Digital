"use client";

import { useState } from "react";
import { X } from "@phosphor-icons/react";
import { Checkbox } from "@/shared/components/ui/Checkbox";
import { Radio } from "@/shared/components/ui/Radio";
import { Button } from "@/shared/components/ui/Button";
import {
  WORKER_DIRECTORY_SORTS,
  WORKER_DIRECTORY_STATUS_OPTIONS,
  activeWorkerFilterCount,
  toggleWorkerFilterValue,
  type WorkerDirectoryQuery,
  type WorkerDirectorySortId,
  type WorkerDirectoryStatus,
} from "../../lib/worker-directory-params";
import type { WorkerDirectoryFacets } from "../../services/worker-directory";

const COLLAPSED_GROUP_SIZE = 8;

function CheckboxGroup({
  idPrefix,
  label,
  values,
  selected,
  onToggle,
}: {
  idPrefix: string;
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  if (values.length === 0) return <></>;
  const visible = expanded ? values : values.slice(0, COLLAPSED_GROUP_SIZE);
  const hiddenCount = values.length - visible.length;

  return (
    <fieldset style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
      <legend
        style={{
          fontSize: "0.75rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--muted)",
          marginBottom: "0.375rem",
          padding: 0,
        }}
      >
        {label}
        {selected.length > 0 ? ` · ${selected.length}` : ""}
      </legend>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", maxHeight: expanded ? 260 : undefined, overflowY: expanded ? "auto" : undefined }}>
        {visible.map((value) => {
          const isSelected = selected.some((v) => v.toLocaleLowerCase("es-MX") === value.toLocaleLowerCase("es-MX"));
          return (
            <Checkbox
              key={`${idPrefix}-${value}`}
              id={`${idPrefix}-${value}`}
              checked={isSelected}
              onChange={() => onToggle(value)}
              label={<span style={{ fontSize: "0.8125rem", overflowWrap: "anywhere" }}>{value}</span>}
            />
          );
        })}
      </div>
      {hiddenCount > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{
            marginTop: "0.375rem",
            background: "none",
            border: "none",
            padding: 0,
            color: "var(--primary)",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {expanded ? "Ver menos" : `Ver ${hiddenCount} más`}
        </button>
      ) : null}
    </fieldset>
  );
}

export function WorkerFilterControls({
  idPrefix,
  options,
  draft,
  onChange,
}: {
  idPrefix: string;
  options: WorkerDirectoryFacets | null;
  draft: WorkerDirectoryQuery;
  onChange: (next: WorkerDirectoryQuery) => void;
}): React.JSX.Element {
  function patch(patchValue: Partial<WorkerDirectoryQuery>): void {
    onChange({ ...draft, ...patchValue, page: 1 });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <fieldset style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
        <legend
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--muted)",
            marginBottom: "0.375rem",
            padding: 0,
          }}
        >
          Estado
        </legend>
        <div style={{ display: "flex", gap: "0.875rem", flexWrap: "wrap" }}>
          {WORKER_DIRECTORY_STATUS_OPTIONS.map((option) => (
            <Radio
              key={option.id}
              id={`${idPrefix}-estado-${option.id}`}
              name={`${idPrefix}-estado`}
              checked={draft.status === option.id}
              onChange={() => patch({ status: option.id as WorkerDirectoryStatus })}
              label={option.label}
            />
          ))}
        </div>
      </fieldset>

      {options ? (
        <>
          <CheckboxGroup
            idPrefix={`${idPrefix}-cat`}
            label="Categoría"
            values={options.categories}
            selected={draft.categories}
            onToggle={(value) => patch({ categories: toggleWorkerFilterValue(draft.categories, value) })}
          />
          <CheckboxGroup
            idPrefix={`${idPrefix}-turno`}
            label="Turno"
            values={options.turns}
            selected={draft.turns}
            onToggle={(value) => patch({ turns: toggleWorkerFilterValue(draft.turns, value) })}
          />
          <CheckboxGroup
            idPrefix={`${idPrefix}-adsc`}
            label="Adscripción"
            values={options.assignments}
            selected={draft.assignments}
            onToggle={(value) => patch({ assignments: toggleWorkerFilterValue(draft.assignments, value) })}
          />
        </>
      ) : (
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>Cargando opciones de filtro…</p>
      )}
    </div>
  );
}

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

export function WorkerActiveChips({
  query,
  onChange,
}: {
  query: WorkerDirectoryQuery;
  onChange: (next: WorkerDirectoryQuery) => void;
}): React.JSX.Element | null {
  if (activeWorkerFilterCount(query) === 0 && query.q === "") return null;

  const chips: Chip[] = [];
  if (query.q) {
    chips.push({
      key: "q",
      label: `“${query.q}”`,
      onRemove: () => onChange({ ...query, q: "", page: 1 }),
    });
  }
  for (const value of query.categories) {
    chips.push({
      key: `cat-${value}`,
      label: value,
      onRemove: () => onChange({ ...query, categories: query.categories.filter((v) => v !== value), page: 1 }),
    });
  }
  for (const value of query.turns) {
    chips.push({
      key: `turno-${value}`,
      label: value,
      onRemove: () => onChange({ ...query, turns: query.turns.filter((v) => v !== value), page: 1 }),
    });
  }
  for (const value of query.assignments) {
    chips.push({
      key: `adsc-${value}`,
      label: value,
      onRemove: () => onChange({ ...query, assignments: query.assignments.filter((v) => v !== value), page: 1 }),
    });
  }
  if (query.status !== "todos") {
    const label = WORKER_DIRECTORY_STATUS_OPTIONS.find((o) => o.id === query.status)?.label ?? query.status;
    chips.push({
      key: "estado",
      label,
      onRemove: () => onChange({ ...query, status: "todos", page: 1 }),
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
      {chips.map((chip) => (
        <span
          key={chip.key}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            background: "var(--accent)",
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "0.1875rem 0.375rem 0.1875rem 0.625rem",
            fontSize: "0.75rem",
            fontWeight: 600,
            maxWidth: "100%",
            minWidth: 0,
          }}
        >
          <span style={{ overflowWrap: "anywhere" }}>{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Quitar filtro ${chip.label}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: "none",
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
              flexShrink: 0,
              padding: 0,
            }}
          >
            <X size={12} weight="bold" />
          </button>
        </span>
      ))}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange({ ...query, q: "", categories: [], turns: [], assignments: [], status: "todos", page: 1 })}
      >
        Limpiar todos
      </Button>
    </div>
  );
}

export function WorkerSortList({
  value,
  onChange,
}: {
  value: WorkerDirectorySortId;
  onChange: (sort: WorkerDirectorySortId) => void;
}): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label="Ordenar trabajadores" style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      {WORKER_DIRECTORY_SORTS.filter((option) => option.dataAvailable).map((option) => (
        <Radio
          key={option.id}
          id={`sort-${option.id}`}
          name="worker-sort"
          checked={value === option.id}
          onChange={() => onChange(option.id)}
          label={option.label}
        />
      ))}
    </div>
  );
}
