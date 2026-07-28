export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ")
}

export function shortId(): string {
  return crypto.randomUUID().slice(0, 8)
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return ""
  return new Date(date).toLocaleDateString("es-MX", {
    year: "numeric", month: "long", day: "numeric",
  })
}

export function formatTime(date: string | null | undefined): string {
  if (!date) return ""
  return new Date(date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
}
