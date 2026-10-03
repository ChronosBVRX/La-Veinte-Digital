/**
 * Feature flags de proveedores de autenticación.
 *
 * `NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN === "true"` muestra el botón
 * "Continuar con Facebook". Cualquier otro valor (o ausente) lo oculta.
 *
 * CONTEXTO: Meta exige verificación empresarial y el proyecto no está
 * constituido como empresa → botón oculto temporalmente en producción.
 * La integración (signInWithOAuth + credenciales en Supabase/Meta) se
 * conserva intacta; para reactivarlo basta con definir la variable de entorno
 * y redesplegar, sin cambios de código.
 */
export function isFacebookLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN === "true"
}
