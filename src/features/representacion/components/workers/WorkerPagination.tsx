"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/Button";

function pageWindow(page: number, totalPages: number): number[] {
  const size = Math.min(5, totalPages);
  let start = Math.max(1, page - Math.floor(size / 2));
  const end = Math.min(totalPages, start + size - 1);
  start = Math.max(1, end - size + 1);
  const pages: number[] = [];
  for (let p = start; p <= end; p += 1) pages.push(p);
  return pages;
}

export function WorkerPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}): React.JSX.Element | null {
  if (total <= pageSize) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const pages = pageWindow(safePage, totalPages);

  return (
    <nav
      aria-label="Paginación de trabajadores"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.5rem",
        flexWrap: "wrap",
        padding: "0.25rem 0",
      }}
    >
      <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
        {from}–{to} de {total}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        <Button
          size="sm"
          variant="secondary"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Página anterior"
        >
          <CaretLeft size={14} weight="bold" />
        </Button>
        <span className="desktop-only" style={{ display: "inline-flex", gap: "0.25rem" }}>
          {pages.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={p === safePage ? "primary" : "secondary"}
              onClick={() => onPageChange(p)}
              aria-label={`Página ${p}`}
              aria-current={p === safePage ? "page" : undefined}
            >
              {p}
            </Button>
          ))}
        </span>
        <span className="mobile-only" style={{ fontSize: "0.8125rem", color: "var(--muted)", padding: "0 0.25rem" }}>
          Página {safePage} de {totalPages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Página siguiente"
        >
          <CaretRight size={14} weight="bold" />
        </Button>
      </div>
    </nav>
  );
}
