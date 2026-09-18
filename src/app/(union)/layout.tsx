import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionApplicationShell } from "@/features/union/components/UnionApplicationShell";
import { UnionAccessDenied } from "@/features/union/components/UnionAccessDenied";
import { ToastProvider } from "@/shared/components/ui/Toast";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Representación Sindical — Delegación XXI",
  robots: {
    index: false,
    follow: false,
  },
};

function getSafeUserLabel(
  metaName: unknown,
  roleLabel: string,
): string {
  if (typeof metaName === "string") {
    const trimmed = metaName.trim();
    // Prevenir fuga de correos ingresados accidentalmente en el campo de nombre
    if (trimmed.length > 0 && !trimmed.includes("@")) {
      return trimmed;
    }
  }
  return roleLabel;
}

export default async function UnionLayout({ children }: { children: ReactNode }): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Sin sesión -> redirigir al login
  if (!user) {
    redirect("/login");
  }

  // 2. Con sesión pero sin membresía sindical activa -> pantalla discreta de acceso denegado (sin ciclos de redirección)
  const memberships = await getUnionMemberships();
  if (memberships.length === 0) {
    return <UnionAccessDenied />;
  }

  // 3. Usuario autorizado (union_rep o union_admin):
  const isAdmin = memberships.some((m) => m.role === "union_admin");
  const roleLabel = isAdmin ? "Administrador Sindical" : "Representante Sindical";
  const safeDisplayName = getSafeUserLabel(
    user.user_metadata?.full_name ?? user.user_metadata?.name,
    roleLabel,
  );

  // 4. Si la cuenta también tiene rol de plataforma, se muestra el enlace de
  // regreso al panel de administración (no altera el acceso sindical).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isPlatformAdmin = profile?.role === "admin";

  return (
    <ToastProvider>
      <UnionApplicationShell
        memberships={memberships}
        userName={safeDisplayName}
        isPlatformAdmin={isPlatformAdmin}
      >
        {children}
      </UnionApplicationShell>
    </ToastProvider>
  );
}
