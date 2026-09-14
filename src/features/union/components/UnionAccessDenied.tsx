import Link from "next/link";
import { ShieldSlash } from "@phosphor-icons/react/dist/ssr";
import { SignOutButton } from "@/shared/components/app/SignOutButton";

export function UnionAccessDenied(): React.JSX.Element {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #f8fafc)",
        color: "var(--fg, #0f172a)",
        padding: "1.5rem",
        boxSizing: "border-box",
      }}
    >
      <div
        role="alert"
        aria-live="polite"
        style={{
          maxWidth: "460px",
          width: "100%",
          background: "var(--card, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "0.75rem",
          padding: "2rem 1.75rem",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.25rem",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            background: "rgba(100, 116, 139, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--muted, #64748b)",
          }}
        >
          <ShieldSlash size={28} weight="duotone" />
        </div>

        <div>
          <h1
            style={{
              fontSize: "1.125rem",
              fontWeight: 700,
              margin: "0 0 0.5rem 0",
              color: "var(--fg, #0f172a)",
              letterSpacing: "-0.01em",
            }}
          >
            No tienes autorización para acceder a Representación Sindical.
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--muted, #64748b)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Este espacio está reservado para el cuerpo de representación de la Delegación Sindical. Si consideras que debes tener acceso, contacta a tu administración delegacional.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            width: "100%",
            marginTop: "0.5rem",
          }}
        >
          <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <SignOutButton />
          </div>

          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "44px",
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--muted, #64748b)",
              textDecoration: "none",
              background: "transparent",
              border: "1px solid var(--border, #e2e8f0)",
            }}
          >
            Ir al inicio de La Veinte Digital
          </Link>
        </div>
      </div>
    </div>
  );
}
