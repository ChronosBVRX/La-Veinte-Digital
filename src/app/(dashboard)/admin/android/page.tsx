import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"

export default async function AdminAndroidPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Acceso restringido</h2>
        <p style={{ color: "var(--muted)" }}>Solo administradores.</p>
      </div>
    )
  }

  const baseUrl = "https://la-veinte-digital.vercel.app"

  // Fetch published manifests
  let stable: any = null, beta: any = null, dev: any = null
  try {
    const [s, b, d] = await Promise.all([
      fetch(`${baseUrl}/android/stable/latest.json`, { next: { revalidate: 60 } }).then(r => r.json()),
      fetch(`${baseUrl}/android/beta/latest.json`, { next: { revalidate: 60 } }).then(r => r.json()),
      fetch(`${baseUrl}/android/dev/latest.json`, { next: { revalidate: 60 } }).then(r => r.json()),
    ])
    stable = s; beta = b; dev = d
  } catch { /* offline — show empty */ }

  // Fetch release history from Supabase (table added by migration 20260810120000)
  const { data: releases } = await (supabase
    .from("android_releases" as any) as any)
    .select("*")
    .order("version_code", { ascending: false })
    .limit(30)

  return (
    <div style={{ padding: "1.5rem", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>Android Releases</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
        Consola de administración de versiones
      </p>

      {/* Current published versions */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        {([["Estable", stable, "#15803D"], ["Beta", beta, "#B45309"], ["Dev", dev, "#64748B"]] as const).map(([label, data, color]) => (
          <Card key={label} padding="1rem" style={{ flex: 1 }}>
            <span style={{
              fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase",
              padding: "0.1rem 0.5rem", borderRadius: 4, background: color, color: "#fff",
            }}>{label}</span>
            {data ? (
              <div style={{ marginTop: "0.5rem" }}>
                <p style={{ fontWeight: 600, fontSize: "1.1rem" }}>v{data.versionName}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Code {data.versionCode} · {(data.apk.size / 1_048_576).toFixed(1)} MB
                  {data.forceUpdate ? " · Forzada" : ""}
                </p>
                {data.apk.sha256 && (
                  <p style={{ fontSize: "0.65rem", color: "var(--muted)", wordBreak: "break-all", marginTop: "0.25rem" }}>
                    {data.apk.sha256.substring(0, 16)}...
                  </p>
                )}
              </div>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: "0.8125rem", marginTop: "0.5rem" }}>Sin versión</p>
            )}
          </Card>
        ))}
      </div>

      {/* Release history table */}
      <Card padding="1.25rem">
        <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "1rem" }}>Historial de builds</h3>
        {releases && releases.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem 0.75rem", color: "var(--muted)" }}>Versión</th>
                  <th style={{ padding: "0.5rem 0.75rem", color: "var(--muted)" }}>Canal</th>
                  <th style={{ padding: "0.5rem 0.75rem", color: "var(--muted)" }}>SHA-256</th>
                  <th style={{ padding: "0.5rem 0.75rem", color: "var(--muted)" }}>Tamaño</th>
                  <th style={{ padding: "0.5rem 0.75rem", color: "var(--muted)" }}>Fecha</th>
                  <th style={{ padding: "0.5rem 0.75rem", color: "var(--muted)" }}>Commit</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>
                      v{r.version_name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({r.version_code})</span>
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      <span style={{
                        fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase",
                        padding: "0.1rem 0.4rem", borderRadius: 3,
                        background: r.channel === "stable" ? "#15803D" : r.channel === "beta" ? "#B45309" : "#64748B",
                        color: "#fff",
                      }}>{r.channel}</span>
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.6875rem", fontFamily: "monospace" }}>
                      {r.apk_sha256 ? `${r.apk_sha256.substring(0, 12)}...` : "—"}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      {r.apk_size ? `${(r.apk_size / 1_048_576).toFixed(1)} MB` : "—"}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap", fontSize: "0.75rem", color: "var(--muted)" }}>
                      {new Date(r.created_at).toLocaleDateString("es-MX")}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.6875rem", fontFamily: "monospace", color: "var(--muted)" }}>
                      {r.commit_sha ? r.commit_sha.substring(0, 7) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>No hay builds registrados aún. El primer release aparecerá aquí cuando se ejecute el CI con Supabase Storage configurado.</p>
        )}
      </Card>

      {/* Instructions */}
      <Card padding="1.25rem" style={{ marginTop: "1.5rem" }}>
        <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.75rem" }}>Flujo de publicación</h3>
        <ol style={{ fontSize: "0.8125rem", color: "var(--muted)", paddingLeft: "1.25rem", lineHeight: 1.8 }}>
          <li>Hacer push a <code>main</code> → CI genera APK firmado y lo sube a Supabase Storage</li>
          <li>Ejecutar <code>workflow_dispatch</code> con channel <code>dev</code> desde GitHub Actions</li>
          <li>Probar la build dev en dispositivo real</li>
          <li>Si pasa pruebas, promover manualmente: actualizar <code>public/android/beta/latest.json</code> y hacer deploy</li>
          <li>Si beta es estable, promover a <code>stable</code> de la misma forma</li>
          <li>El panel muestra el estado actual en tiempo real</li>
        </ol>
      </Card>
    </div>
  )
}
