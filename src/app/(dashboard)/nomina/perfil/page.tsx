import { NominaProfileWizard } from "@/features/nomina/components/NominaProfileWizard"

export default function NominaPerfilPage() {
  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>
        Perfil laboral
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        Configura tus datos laborales para la proyecci&oacute;n de n&oacute;mina.
      </p>
      <NominaProfileWizard profile={null} onSave={() => {}} />
    </div>
  )
}
