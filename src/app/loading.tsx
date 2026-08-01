import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"

export default function Loading() {
  return (
    <div style={{ minHeight: "60dvh", display: "grid", placeItems: "center" }}>
      <LoadingSpinner />
    </div>
  )
}
