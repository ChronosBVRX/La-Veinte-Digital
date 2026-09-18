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
  DotsThreeCircle,
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

export interface UnionNavGroup {
  id: string;
  label: string;
  modules: UnionNavModule[];
}

export const UNION_NAV_GROUPS: UnionNavGroup[] = [
  {
    id: "panel",
    label: "Panel",
    modules: [{ href: "/representacion", label: "Centro de control", description: "Tablero general", icon: House }],
  },
  {
    id: "personas",
    label: "Personas",
    modules: [
      { href: "/representacion/trabajadores", label: "Trabajadores", description: "Padrón, filtros y expediente", icon: Users },
      { href: "/representacion/expedientes", label: "Expedientes", description: "Timeline de casos", icon: Folder },
    ],
  },
  {
    id: "prestaciones",
    label: "Prestaciones y trámites",
    modules: [
      { href: "/representacion/maternidad", label: "Maternidad", description: "Cálculo 90 días", icon: Baby },
      { href: "/representacion/lactancia", label: "Lactancia", description: "365 días y modalidades", icon: Drop },
      { href: "/representacion/licencias", label: "Licencias", description: "Solicitud y oficio", icon: FileText },
      { href: "/representacion/pasajes", label: "Pasajes", description: "Formatos 026 / 027", icon: Ticket },
      { href: "/representacion/lockers", label: "Lockers", description: "Asignaciones y espera", icon: Lockers },
    ],
  },
  {
    id: "gestion",
    label: "Gestión",
    modules: [
      { href: "/representacion/administracion", label: "Administración", description: "Comité y auditoría", icon: ShieldCheck, adminOnly: true },
    ],
  },
];

export const UNION_MODULES: UnionNavModule[] = UNION_NAV_GROUPS.flatMap((group) => group.modules);

const MOBILE_PRIMARY_MODULES: UnionNavModule[] = [
  "/representacion",
  "/representacion/trabajadores",
  "/representacion/expedientes",
]
  .map((href) => UNION_MODULES.find((module) => module.href === href))
  .filter((module): module is UnionNavModule => Boolean(module));

export interface UnionApplicationShellProps {
  memberships: UnionMembership[];
  userName?: string | null;
  /** true si la cuenta también tiene rol de plataforma `admin` (enlace de regreso a /admin). */
  isPlatformAdmin?: boolean;
  children: ReactNode;
}

function isModuleActive(pathname: string, href: string): boolean {
  return href === "/representacion" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function UnionApplicationShell({ memberships, userName, isPlatformAdmin = false, children }: UnionApplicationShellProps): React.JSX.Element {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => !prev);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  useBackLayer(drawerOpen, closeDrawer, "union-mobile-drawer");

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

  const activeModule =
    UNION_MODULES.find((m) => isModuleActive(pathname, m.href)) ??
    ({
      href: "/representacion",
      label: "Representación Sindical",
      description: "Delegación XXI",
      icon: Handshake,
    } satisfies UnionNavModule);

  const isAdmin = memberships.some((m) => m.role === "union_admin");
  // Los módulos `adminOnly` (Administración Sindical) solo se muestran a
  // union_admin; el representante ve exclusivamente los módulos sindicales.
  const visibleNavGroups = UNION_NAV_GROUPS.map((group) => ({
    ...group,
    modules: group.modules.filter((mod) => !mod.adminOnly || isAdmin),
  })).filter((group) => group.modules.length > 0);
  const delegationCode = memberships[0]?.delegation_code || "XXI";
  const displayIdentity =
    userName && typeof userName === "string" && !userName.includes("@") && userName.trim().length > 0
      ? userName.trim()
      : isAdmin
        ? "Administrador Sindical"
        : "Representante Sindical";

  const renderDesktopNavItem = (mod: UnionNavModule): React.JSX.Element => {
    const isActive = isModuleActive(pathname, mod.href);
    const Icon = mod.icon;
    return (
      <li key={mod.href}>
        <Link
          href={mod.href}
          aria-current={isActive ? "page" : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.625rem",
            borderRadius: "var(--radius-sm)",
            textDecoration: "none",
            fontSize: "0.8125rem",
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "var(--primary)" : "var(--fg)",
            background: isActive ? "#eff6ff" : "transparent",
            borderLeft: isActive ? "3px solid var(--primary)" : "3px solid transparent",
            minHeight: 40,
            boxSizing: "border-box",
            transition: "background 0.15s ease, color 0.15s ease",
          }}
        >
          <Icon size={17} weight={isActive ? "fill" : "regular"} style={{ flexShrink: 0 }} />
          <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mod.label}</span>
          {mod.adminOnly ? <Shield size={13} weight="bold" style={{ opacity: isActive ? 0.9 : 0.4 }} /> : null}
        </Link>
      </li>
    );
  };

  const renderDrawerNavItem = (mod: UnionNavModule): React.JSX.Element => {
    const isActive = isModuleActive(pathname, mod.href);
    const Icon = mod.icon;
    return (
      <li key={mod.href}>
        <Link
          href={mod.href}
          onClick={closeDrawer}
          aria-current={isActive ? "page" : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "var(--radius-sm)",
            textDecoration: "none",
            fontSize: "0.9375rem",
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "var(--primary)" : "var(--fg)",
            background: isActive ? "#eff6ff" : "transparent",
            minHeight: 44,
            boxSizing: "border-box",
          }}
        >
          <Icon size={20} weight={isActive ? "fill" : "regular"} style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div>{mod.label}</div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>{mod.description}</div>
          </div>
          {mod.adminOnly ? <Shield size={14} weight="bold" style={{ opacity: isActive ? 0.9 : 0.4 }} /> : null}
        </Link>
      </li>
    );
  };

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
      <style>{`
        @media (max-width: 768px) {
          .union-header-subtitle { display: none !important; }
        }
        @media (min-width: 769px) {
          .union-mobile-nav { display: none !important; }
        }
      `}</style>

      <header
        style={{
          height: 56,
          background: "linear-gradient(135deg, #1e3a8a 0%, #172554 100%)",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 0.75rem",
          position: "sticky",
          top: 0,
          zIndex: 40,
          boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0, flex: 1 }}>
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
              width: 44,
              height: 44,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "0.5rem",
              color: "#ffffff",
              cursor: "pointer",
              padding: 0,
              flexShrink: 0,
            }}
          >
            {drawerOpen ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
          </button>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
              <Link
                href="/representacion"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  color: "#ffffff",
                  textDecoration: "none",
                  fontWeight: 800,
                  fontSize: "0.9375rem",
                  letterSpacing: "-0.01em",
                  minWidth: 0,
                }}
              >
                <Handshake size={18} weight="fill" style={{ color: "#60a5fa", flexShrink: 0 }} />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Representación Sindical</span>
              </Link>
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  background: "rgba(96, 165, 250, 0.2)",
                  color: "#bfdbfe",
                  border: "1px solid rgba(96, 165, 250, 0.35)",
                  padding: "0.0625rem 0.375rem",
                  borderRadius: "9999px",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Delegación {delegationCode}
              </span>
              <span
                className="desktop-only"
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  background: "rgba(234, 179, 8, 0.2)",
                  color: "#fef08a",
                  border: "1px solid rgba(234, 179, 8, 0.35)",
                  padding: "0.0625rem 0.3125rem",
                  borderRadius: "9999px",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                BETA PRIVADA
              </span>
            </div>
            <p
              className="union-header-subtitle"
              style={{
                margin: 0,
                fontSize: "0.6875rem",
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

        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexShrink: 0 }}>
          <div
            className="desktop-only"
            style={{
              fontSize: "0.8125rem",
              background: "rgba(255,255,255,0.1)",
              padding: "0.25rem 0.625rem",
              borderRadius: "0.375rem",
              color: "#e0f2fe",
              fontWeight: 600,
              maxWidth: 220,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {activeModule.label}
          </div>
          <div className="desktop-only">
            <SignOutButton />
          </div>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
        <aside
          className="desktop-only"
          aria-label="Navegación sindical de escritorio"
          style={{
            width: 232,
            background: "var(--card, #ffffff)",
            borderRight: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflowY: "auto",
            position: "sticky",
            top: 56,
            height: "calc(100vh - 56px)",
          }}
        >
          <nav aria-label="Módulos sindicales" style={{ padding: "0.625rem 0.5rem", flex: 1 }}>
            {visibleNavGroups.map((group, index) => (
              <div key={group.id} style={{ marginTop: index === 0 ? 0 : "0.75rem" }}>
                <span
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    color: "var(--muted, #64748b)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    display: "block",
                    padding: "0 0.625rem 0.25rem",
                  }}
                >
                  {group.label}
                </span>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                  {group.modules.map(renderDesktopNavItem)}
                </ul>
              </div>
            ))}
          </nav>

          <div
            style={{
              padding: "0.625rem",
              borderTop: "1px solid var(--border, #e2e8f0)",
              background: "var(--accent, #f8fafc)",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
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
              style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)", textDecoration: "none", padding: "0.25rem 0" }}
            >
              Aviso de privacidad sindical
            </Link>
            {isPlatformAdmin ? (
              <Link
                href="/admin"
                style={{
                  fontSize: "0.75rem",
                  color: "var(--primary, #2563eb)",
                  textDecoration: "none",
                  padding: "0.25rem 0",
                  fontWeight: 600,
                }}
              >
                Panel de administración
              </Link>
            ) : null}
          </div>
        </aside>

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
            width: 300,
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
              padding: "0.625rem 0.75rem",
              borderBottom: "1px solid var(--border, #e2e8f0)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: "0.9375rem", color: "var(--fg, #0f172a)" }}>Representación Sindical</div>
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
                width: 44,
                height: 44,
                background: "transparent",
                border: "none",
                borderRadius: "0.375rem",
                color: "var(--muted, #64748b)",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
            >
              <X size={20} weight="bold" />
            </button>
          </div>

          <nav aria-label="Módulos sindicales móviles" style={{ padding: "0.625rem 0.5rem", flex: 1 }}>
            {visibleNavGroups.map((group, index) => (
              <div key={group.id} style={{ marginTop: index === 0 ? 0 : "0.75rem" }}>
                <span
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    color: "var(--muted, #64748b)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    display: "block",
                    padding: "0 0.75rem 0.25rem",
                  }}
                >
                  {group.label}
                </span>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                  {group.modules.map(renderDrawerNavItem)}
                </ul>
              </div>
            ))}
          </nav>

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
                minHeight: 44,
                display: "flex",
                alignItems: "center",
              }}
            >
              Aviso de privacidad sindical
            </Link>
            {isPlatformAdmin ? (
              <Link
                href="/admin"
                onClick={closeDrawer}
                style={{
                  fontSize: "0.75rem",
                  color: "var(--primary, #2563eb)",
                  textDecoration: "none",
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  fontWeight: 600,
                }}
              >
                Panel de administración
              </Link>
            ) : null}
            <SignOutButton onDone={closeDrawer} />
          </div>
        </div>

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

      <nav
        className="mobile-only union-mobile-nav"
        aria-label="Navegación rápida sindical"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          display: "flex",
          alignItems: "stretch",
          background: "var(--card, #ffffff)",
          borderTop: "1px solid var(--border, #e2e8f0)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -1px 4px rgba(0,0,0,0.06)",
        }}
      >
        {MOBILE_PRIMARY_MODULES.map((mod) => {
          const isActive = isModuleActive(pathname, mod.href);
          const Icon = mod.icon;
          return (
            <Link
              key={mod.href}
              href={mod.href}
              aria-current={isActive ? "page" : undefined}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.125rem",
                padding: "0.375rem 0.25rem",
                minHeight: 56,
                textDecoration: "none",
                color: isActive ? "var(--primary)" : "var(--muted)",
                fontWeight: isActive ? 700 : 500,
                fontSize: "0.6875rem",
                boxSizing: "border-box",
                minWidth: 0,
              }}
            >
              <Icon size={20} weight={isActive ? "fill" : "regular"} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{mod.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={toggleDrawer}
          aria-label={drawerOpen ? "Cerrar más módulos sindicales" : "Abrir más módulos sindicales"}
          aria-expanded={drawerOpen}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.125rem",
            padding: "0.375rem 0.25rem",
            minHeight: 56,
            background: "none",
            border: "none",
            color: "var(--muted)",
            fontWeight: 500,
            fontSize: "0.6875rem",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <DotsThreeCircle size={20} />
          <span>Más</span>
        </button>
      </nav>
    </div>
  );
}
