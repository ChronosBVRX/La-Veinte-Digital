"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback, useEffect, type ReactNode, type CSSProperties } from "react";
import {
  House,
  Users,
  Baby,
  Drop,
  Lockers,
  Ticket,
  FileText,
  Folder,
  ShieldCheck,
  List,
  X,
  Handshake,
  Shield,
} from "@phosphor-icons/react";
import { SignOutButton } from "@/shared/components/app/SignOutButton";
import { useBackLayer } from "@/shared/navigation/useBackLayer";
import type { UnionMembership } from "@/features/representacion/services/permissions";

export interface UnionNavModule {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{
    size?: number;
    weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
    style?: CSSProperties;
  }>;
  adminOnly?: boolean;
}

export const UNION_MODULES: UnionNavModule[] = [
  { href: "/representacion", label: "Resumen", description: "Tablero general", icon: House },
  { href: "/representacion/trabajadores", label: "Trabajadores", description: "Padrón y búsqueda", icon: Users },
  { href: "/representacion/maternidad", label: "Maternidad", description: "Cálculo 90 días", icon: Baby },
  { href: "/representacion/lactancia", label: "Lactancia", description: "365 días y modalidades", icon: Drop },
  { href: "/representacion/lockers", label: "Lockers", description: "Asignaciones y espera", icon: Lockers },
  { href: "/representacion/pasajes", label: "Pasajes", description: "Formatos 026 / 027", icon: Ticket },
  { href: "/representacion/licencias", label: "Licencias", description: "Solicitud y oficio", icon: FileText },
  { href: "/representacion/expedientes", label: "Expedientes", description: "Timeline de casos", icon: Folder },
  { href: "/representacion/administracion", label: "Administración", description: "Comité y auditoría", icon: ShieldCheck },
];

export interface UnionApplicationShellProps {
  memberships: UnionMembership[];
  userName?: string | null;
  children: ReactNode;
}

export function UnionApplicationShell({ memberships, userName, children }: UnionApplicationShellProps): React.JSX.Element {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => !prev);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  // Registro en el Back canónico para cerrar el drawer antes de salir de la página
  useBackLayer(drawerOpen, closeDrawer, "union-mobile-drawer");

  // Cerrar con Escape
  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeDrawer();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, closeDrawer]);

  const activeModule = UNION_MODULES.find((m) =>
    m.href === "/representacion"
      ? pathname === "/representacion"
      : pathname === m.href || pathname.startsWith(`${m.href}/`)
  ) ?? {
    href: "/representacion",
    label: "Representación Sindical",
    description: "Delegación XXI",
    icon: Handshake,
  };

  const isAdmin = memberships.some((m) => m.role === "union_admin");
  const delegationCode = memberships[0]?.delegation_code || "XXI";
  const displayIdentity =
    userName && typeof userName === "string" && !userName.includes("@") && userName.trim().length > 0
      ? userName.trim()
      : isAdmin
      ? "Administrador Sindical"
      : "Representante Sindical";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "var(--bg, #f8fafc)",
        color: "var(--fg, #0f172a)",
      }}
    >
      {/* HEADER SUPERIOR INSTITUCIONAL (Común para móvil y escritorio) */}
      <header
        style={{
          height: "60px",
          background: "linear-gradient(135deg, #1e3a8a 0%, #172554 100%)",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1rem",
          position: "sticky",
          top: 0,
          zIndex: 40,
          boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
          {/* Botón hamburguesa accesible en móvil (mínimo 44x44) */}
          <button
            type="button"
            onClick={toggleDrawer}
            aria-label={drawerOpen ? "Alternar menú sindical" : "Abrir menú sindical"}
            aria-expanded={drawerOpen}
            aria-controls="union-mobile-drawer"
            className="mobile-only"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "44px",
              height: "44px",
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "0.5rem",
              color: "#ffffff",
              cursor: "pointer",
              padding: 0,
              flexShrink: 0,
            }}
          >
            {drawerOpen ? <X size={22} weight="bold" /> : <List size={22} weight="bold" />}
          </button>

          {/* Identidad institucional */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <Link
                href="/representacion"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  color: "#ffffff",
                  textDecoration: "none",
                  fontWeight: 800,
                  fontSize: "1rem",
                  letterSpacing: "-0.01em",
                }}
              >
                <Handshake size={20} weight="fill" style={{ color: "#60a5fa" }} />
                <span>Representación Sindical</span>
              </Link>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  background: "rgba(96, 165, 250, 0.2)",
                  color: "#bfdbfe",
                  border: "1px solid rgba(96, 165, 250, 0.35)",
                  padding: "0.125rem 0.4rem",
                  borderRadius: "9999px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Delegación {delegationCode}
              </span>
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  background: "rgba(234, 179, 8, 0.2)",
                  color: "#fef08a",
                  border: "1px solid rgba(234, 179, 8, 0.35)",
                  padding: "0.125rem 0.375rem",
                  borderRadius: "9999px",
                  letterSpacing: "0.04em",
                }}
              >
                BETA PRIVADA
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "0.75rem",
                color: "#93c5fd",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              SNTSS Sección XX · HGR No. 1 Charo
            </p>
          </div>
        </div>

        {/* Módulo activo en desktop + Salida sindical */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            className="desktop-only"
            style={{
              fontSize: "0.8125rem",
              background: "rgba(255,255,255,0.1)",
              padding: "0.25rem 0.625rem",
              borderRadius: "0.375rem",
              color: "#e0f2fe",
              fontWeight: 600,
            }}
          >
            {activeModule.label}
          </div>

          <div style={{ flexShrink: 0 }}>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* CUERPO PRINCIPAL (Sidebar escritorio + Área de contenido) */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
        {/* SIDEBAR ESCRITORIO (Solo módulos sindicales) */}
        <aside
          className="desktop-only"
          aria-label="Navegación sindical de escritorio"
          style={{
            width: "260px",
            background: "var(--card, #ffffff)",
            borderRight: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflowY: "auto",
            position: "sticky",
            top: "60px",
            height: "calc(100vh - 60px)",
          }}
        >
          {/* Título de navegación */}
          <div style={{ padding: "1rem 1rem 0.5rem" }}>
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                color: "var(--muted, #64748b)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                display: "block",
              }}
            >
              MÓDULOS SINDICALES
            </span>
          </div>

          {/* Lista de los 9 módulos */}
          <nav aria-label="Módulos sindicales" style={{ padding: "0 0.5rem", flex: 1 }}>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {UNION_MODULES.map((mod) => {
                const isActive =
                  mod.href === "/representacion"
                    ? pathname === "/representacion"
                    : pathname === mod.href || pathname.startsWith(`${mod.href}/`);
                const Icon = mod.icon;

                return (
                  <li key={mod.href}>
                    <Link
                      href={mod.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.625rem",
                        padding: "0.625rem 0.75rem",
                        borderRadius: "0.375rem",
                        textDecoration: "none",
                        fontSize: "0.875rem",
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? "#ffffff" : "var(--fg, #0f172a)",
                        background: isActive ? "var(--primary, #2563eb)" : "transparent",
                        minHeight: "44px",
                        boxSizing: "border-box",
                        transition: "background 0.15s ease, color 0.15s ease",
                      }}
                    >
                      <Icon size={18} weight={isActive ? "fill" : "regular"} style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mod.label}</div>
                      </div>
                      {mod.adminOnly ? (
                        <Shield size={14} weight="bold" style={{ opacity: isActive ? 0.9 : 0.4 }} />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Pie de navegación lateral: Info de usuario, Aviso de privacidad y Salida */}
          <div
            style={{
              padding: "0.75rem",
              borderTop: "1px solid var(--border, #e2e8f0)",
              background: "var(--accent, #f8fafc)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)" }}>
              Conectado: <strong style={{ color: "var(--fg, #0f172a)" }}>{displayIdentity}</strong>
              <div style={{ fontSize: "0.6875rem", color: isAdmin ? "#16a34a" : "var(--muted)" }}>
                {isAdmin ? "Rol: Administrador Sindical" : "Rol: Representante Sindical"}
              </div>
            </div>

            <Link
              href="/representacion/aviso-privacidad"
              style={{
                fontSize: "0.75rem",
                color: "var(--muted, #64748b)",
                textDecoration: "none",
                padding: "0.25rem 0",
              }}
            >
              Aviso de privacidad sindical
            </Link>
          </div>
        </aside>

        {/* DRAWER MÓVIL SINDICAL (Accesible, táctil >= 44px, safe area, escape, backdrop) */}
        {drawerOpen ? (
          <div
            id="union-mobile-drawer-backdrop"
            onClick={closeDrawer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              zIndex: 50,
              transition: "opacity 0.2s ease",
            }}
          />
        ) : null}

        <div
          id="union-mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación sindical"
          className="mobile-only"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            bottom: 0,
            width: "300px",
            maxWidth: "85vw",
            background: "var(--card, #ffffff)",
            zIndex: 60,
            boxShadow: drawerOpen ? "4px 0 24px rgba(0,0,0,0.25)" : "none",
            transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
            visibility: drawerOpen ? "visible" : "hidden",
            pointerEvents: drawerOpen ? "auto" : "none",
            transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.25s ease",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))",
            paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
            boxSizing: "border-box",
          }}
        >
          {/* Encabezado del Drawer móvil */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid var(--border, #e2e8f0)",
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.9375rem", color: "var(--fg, #0f172a)" }}>
                Representación Sindical
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)" }}>
                Delegación {delegationCode} · HGR No. 1
              </div>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Cerrar menú sindical"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "44px",
                height: "44px",
                background: "transparent",
                border: "none",
                borderRadius: "0.375rem",
                color: "var(--muted, #64748b)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <X size={20} weight="bold" />
            </button>
          </div>

          {/* Lista de módulos en el drawer móvil (mínimo 44px de altura) */}
          <nav style={{ padding: "0.75rem 0.5rem", flex: 1 }}>
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                color: "var(--muted, #64748b)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "0 0.5rem",
                marginBottom: "0.375rem",
                display: "block",
              }}
            >
              MÓDULOS SINDICALES
            </span>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {UNION_MODULES.map((mod) => {
                const isActive =
                  mod.href === "/representacion"
                    ? pathname === "/representacion"
                    : pathname === mod.href || pathname.startsWith(`${mod.href}/`);
                const Icon = mod.icon;

                return (
                  <li key={mod.href}>
                    <Link
                      href={mod.href}
                      onClick={closeDrawer}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.625rem 0.75rem",
                        borderRadius: "0.375rem",
                        textDecoration: "none",
                        fontSize: "0.9375rem",
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? "#ffffff" : "var(--fg, #0f172a)",
                        background: isActive ? "var(--primary, #2563eb)" : "transparent",
                        minHeight: "44px",
                        boxSizing: "border-box",
                      }}
                    >
                      <Icon size={20} weight={isActive ? "fill" : "regular"} style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div>{mod.label}</div>
                        <div
                          style={{
                            fontSize: "0.6875rem",
                            color: isActive ? "#dbeafe" : "var(--muted, #64748b)",
                          }}
                        >
                          {mod.description}
                        </div>
                      </div>
                      {mod.adminOnly ? (
                        <Shield size={14} weight="bold" style={{ opacity: isActive ? 0.9 : 0.4 }} />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Pie del Drawer móvil: Aviso de privacidad y Salida */}
          <div
            style={{
              padding: "0.75rem 1rem",
              borderTop: "1px solid var(--border, #e2e8f0)",
              background: "var(--accent, #f8fafc)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)" }}>
              Conectado: <strong style={{ color: "var(--fg, #0f172a)" }}>{displayIdentity}</strong>
              <div style={{ fontSize: "0.6875rem", color: isAdmin ? "#16a34a" : "var(--muted)" }}>
                {isAdmin ? "Rol: Administrador Sindical" : "Rol: Representante Sindical"}
              </div>
            </div>

            <Link
              href="/representacion/aviso-privacidad"
              onClick={closeDrawer}
              style={{
                fontSize: "0.75rem",
                color: "var(--muted, #64748b)",
                textDecoration: "none",
                minHeight: "44px",
                display: "flex",
                alignItems: "center",
              }}
            >
              Aviso de privacidad sindical
            </Link>

            <SignOutButton onDone={closeDrawer} />
          </div>
        </div>

        {/* ÁREA DE CONTENIDO PRINCIPAL */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            width: "100%",
            maxWidth: "100%",
            padding: "clamp(0.75rem, 2vw, 1.5rem)",
            boxSizing: "border-box",
            overflowX: "hidden",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "1200px",
              margin: "0 auto",
              minWidth: 0,
              boxSizing: "border-box",
              overflowX: "hidden",
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
