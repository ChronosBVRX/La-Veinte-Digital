import React from "react";

export type BadgeVariant =
  | "ready"
  | "pending"
  | "rendering"
  | "error"
  | "official"
  | "reference"
  | "context"
  | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
  icon?: React.ReactNode;
}

export function Badge({
  variant = "neutral",
  children,
  size = "sm",
  className = "",
  icon,
}: BadgeProps) {
  const styles: Record<BadgeVariant, string> = {
    ready: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    rendering: "bg-blue-500/15 text-blue-300 border-blue-500/30 animate-pulse",
    error: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    official: "bg-emerald-950/40 text-emerald-300 border-emerald-600/40",
    reference: "bg-cyan-950/40 text-cyan-300 border-cyan-600/40",
    context: "bg-slate-800/60 text-slate-300 border-slate-700/60",
    neutral: "bg-slate-800/40 text-slate-300 border-slate-700/40",
  };

  const sizes = {
    sm: "text-[11px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  return (
    <span
      className={`badge badge-${variant} badge-${size} inline-flex items-center gap-1.5 font-medium rounded-md border tracking-tight ${styles[variant]} ${sizes[size]} ${className}`}
    >
      {icon && <span className="opacity-90">{icon}</span>}
      {children}
    </span>
  );
}
