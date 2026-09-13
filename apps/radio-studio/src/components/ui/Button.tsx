import React from "react";
import { Loader2 } from "./Icons";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 active:scale-[0.98]",
    secondary:
      "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-600 active:scale-[0.98]",
    ghost:
      "bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white active:scale-[0.98]",
    danger:
      "bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 active:scale-[0.98]",
  };

  const sizes = {
    sm: "text-xs px-2.5 py-1.5 gap-1.5 min-h-[32px]",
    md: "text-xs px-3.5 py-2 gap-2 min-h-[38px]",
    lg: "text-sm px-4 py-2.5 gap-2.5 min-h-[44px]",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === "sm" ? 12 : 14} className="animate-spin" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
}
