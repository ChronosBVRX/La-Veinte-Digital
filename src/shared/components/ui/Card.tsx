import type { ReactNode, CSSProperties } from "react"
import { cn } from "@/shared/lib/ui/cn"

export type CardVariant = "default" | "subtle" | "interactive" | "highlighted"

export interface CardProps {
  children: ReactNode
  style?: CSSProperties
  padding?: string
  variant?: CardVariant
  className?: string
}

export interface CardHeaderProps {
  children: ReactNode
  style?: CSSProperties
  className?: string
}

export interface CardTitleProps {
  children: ReactNode
  style?: CSSProperties
  className?: string
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
}

export interface CardDescriptionProps {
  children: ReactNode
  style?: CSSProperties
  className?: string
}

export interface CardContentProps {
  children: ReactNode
  style?: CSSProperties
  className?: string
}

export interface CardFooterProps {
  children: ReactNode
  style?: CSSProperties
  className?: string
}

function getVariantStyle(variant: CardVariant): CSSProperties {
  const base: CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxSizing: "border-box",
    maxWidth: "100%",
    minWidth: 0,
  }

  switch (variant) {
    case "subtle":
      return {
        background: "var(--surface-muted)",
        borderRadius: "var(--radius-lg)",
      }
    case "interactive":
      return {
        ...base,
        cursor: "pointer",
        transition: "transform var(--transition), box-shadow var(--transition)",
      }
    case "highlighted":
      return {
        ...base,
        borderLeft: "3px solid var(--primary)",
      }
    default:
      return base
  }
}

export function CardHeader({ children, style, className }: CardHeaderProps) {
  return (
    <div
      className={className}
      style={{
        padding: "var(--space-5)",
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children, style, className, as = "h3" }: CardTitleProps) {
  const Tag = as
  return (
    <Tag
      className={className}
      style={{
        fontSize: "var(--text-md)",
        fontWeight: 700,
        margin: 0,
        color: "var(--fg)",
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}

export function CardDescription({ children, style, className }: CardDescriptionProps) {
  return (
    <p
      className={className}
      style={{
        fontSize: "var(--text-sm)",
        color: "var(--muted)",
        margin: "0.25rem 0 0 0",
        ...style,
      }}
    >
      {children}
    </p>
  )
}

export function CardContent({ children, style, className }: CardContentProps) {
  return (
    <div
      className={className}
      style={{
        padding: "0 var(--space-5) var(--space-5) var(--space-5)",
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function CardFooter({ children, style, className }: CardFooterProps) {
  return (
    <div
      className={className}
      style={{
        padding: "var(--space-4) var(--space-5)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Card({
  children,
  style,
  padding,
  variant = "default",
  className,
}: CardProps) {
  const variantStyle = getVariantStyle(variant)

  const interactiveStyle: CSSProperties =
    variant === "interactive"
      ? {
          transition: "transform var(--transition), box-shadow var(--transition)",
        }
      : {}

  const hoverProps: Record<string, unknown> =
    variant === "interactive"
      ? {
          onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
            e.currentTarget.style.transform = "translateY(-2px)"
            e.currentTarget.style.boxShadow = "var(--shadow-md)"
          },
          onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
            e.currentTarget.style.transform = "translateY(0)"
            e.currentTarget.style.boxShadow = "none"
          },
        }
      : {}

  return (
    <div
      className={cn(
        className,
        variant === "interactive" && "hover-lift"
      )}
      style={{
        ...variantStyle,
        ...(padding ? { padding } : {}),
        ...interactiveStyle,
        ...style,
      }}
      {...hoverProps}
    >
      {children}
    </div>
  )
}

Card.Header = CardHeader
Card.Title = CardTitle
Card.Description = CardDescription
Card.Content = CardContent
Card.Footer = CardFooter
