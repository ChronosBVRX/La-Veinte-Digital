import type { ReactNode, CSSProperties, ElementType } from "react"
import { cn } from "@/shared/lib/ui/cn"

interface PageContainerProps {
  children: ReactNode
  maxWidth?: number | string
  padding?: string
  style?: CSSProperties
  className?: string
  as?: ElementType
}

export function PageContainer({
  children,
  maxWidth = 720,
  padding,
  style,
  className,
  as: Component = "div",
}: PageContainerProps) {
  const maxW = typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth

  return (
    <Component
      className={cn(className)}
      style={{
        width: "100%",
        maxWidth: `min(100%, ${maxW})`,
        minWidth: 0,
        margin: "0 auto",
        boxSizing: "border-box",
        ...(padding ? { padding } : {}),
        ...style,
      }}
    >
      {children}
    </Component>
  )
}
