import { createClient } from "@/lib/supabase/client"

export function signInWithOAuth(provider: "google" | "facebook") {
  const supabase = createClient()
  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/callback`,
    },
  })
}
