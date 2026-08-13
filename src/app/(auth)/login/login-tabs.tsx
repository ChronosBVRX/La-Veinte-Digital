"use client"

import { Tabs } from "@/shared/components/ui/Tabs"
import { LoginForm } from "./login-form"
import { TransferDocumentsButton } from "@/features/transferir/components/TransferDocumentsButton"

export function LoginTabs() {
  return (
    <Tabs
      tabs={[
        { id: "login", label: "Iniciar sesión" },
        { id: "transfer", label: "Transferir documentos" },
      ]}
      defaultTab="login"
    >
      {(active) =>
        active === "login" ? (
          <div style={{ paddingTop: "1.25rem" }}>
            <LoginForm />
          </div>
        ) : (
          <div
            style={{
              paddingTop: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.6 }}>
              ¿Necesitas imprimir un documento de tu teléfono en esta computadora?
              Escanea un código con tu teléfono y envíalo aquí al instante.
            </p>
            <TransferDocumentsButton
              label="Conectar mi teléfono"
              style={{ width: "100%", justifyContent: "center" }}
            />
          </div>
        )
      }
    </Tabs>
  )
}
