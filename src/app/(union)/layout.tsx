import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionApplicationShell } from "@/features/union/components/UnionApplicationShell";
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

export default async function UnionLayout({ children }: { children: ReactNode }): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Autorización en servidor: verificación estricta contra union_members
  // Si no tiene membresía activa en ninguna delegación, rechazo inmediato hacia "/"
  const memberships = await getUnionMemberships();
  if (memberships.length === 0) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <ToastProvider>
      <UnionApplicationShell
        memberships={memberships}
        userName={profile?.full_name ?? user.email ?? null}
      >
        {children}
      </UnionApplicationShell>
    </ToastProvider>
  );
}
