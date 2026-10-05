import { createClient } from "@/lib/supabase/client"
import { compressAvatarImage } from "../lib/compress-avatar"

export interface AvatarOperationResult {
  success: boolean
  avatarUrl?: string
  error?: string
}

/**
 * Procesa, comprime y sube la foto de perfil del usuario a Supabase Storage (bucket avatars),
 * actualizando la columna `profiles.avatar_url` con la URL pública generada.
 */
export async function uploadUserAvatar(file: File): Promise<AvatarOperationResult> {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: "Debes tener una sesión activa para cambiar tu foto de perfil." }
    }

    // 1. Compresión y recorte centrado en el cliente (~15-25 KB)
    const compressed = await compressAvatarImage(file)

    const storagePath = `${user.id}/${compressed.fileName}`

    // 2. Subida atómica al bucket de avatars
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(storagePath, compressed.blob, {
        upsert: true,
        contentType: compressed.mimeType,
        cacheControl: "3600",
      })

    if (uploadError) {
      console.error("[avatar-storage] Error subiendo imagen:", uploadError)
      return { success: false, error: "No se pudo subir la foto de perfil. Revisa tu conexión." }
    }

    // 3. Obtener URL pública con timestamp para invalidar caché del navegador al cambiar
    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(storagePath)

    const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

    // 4. Actualizar tabla profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id)

    if (profileError) {
      console.error("[avatar-storage] Error actualizando profile:", profileError)
      return { success: false, error: "Se subió la imagen pero no se pudo asociar a tu perfil." }
    }

    return { success: true, avatarUrl }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al procesar la foto."
    return { success: false, error: message }
  }
}

/**
 * Elimina la foto de perfil del usuario en storage y restaura el valor en profiles a null.
 */
export async function deleteUserAvatar(): Promise<AvatarOperationResult> {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: "Debes tener una sesión activa." }
    }

    // 1. Intentar limpiar archivos en storage
    await supabase.storage
      .from("avatars")
      .remove([`${user.id}/avatar.webp`, `${user.id}/avatar.jpg`])

    // 2. Establecer avatar_url en null en profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id)

    if (profileError) {
      console.error("[avatar-storage] Error al limpiar avatar_url en profiles:", profileError)
      return { success: false, error: "No se pudo actualizar el perfil." }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al eliminar la foto de perfil."
    return { success: false, error: message }
  }
}
