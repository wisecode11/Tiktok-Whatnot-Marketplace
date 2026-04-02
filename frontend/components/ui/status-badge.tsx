"use client"

import { cn } from "@/lib/utils"

type StatusVariant = 
  | "success" 
  | "warning" 
  | "danger" 
  | "info" 
  | "default" 
  | "pending" 
  | "active"
  | "inactive"

interface StatusBadgeProps {
  variant?: StatusVariant
  children: React.ReactNode
  className?: string
  dot?: boolean
  pulse?: boolean
}

const variantStyles: Record<StatusVariant, string> = {
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  danger: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  info: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  default: "bg-muted text-muted-foreground border-border",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  inactive: "bg-muted text-muted-foreground border-border",
}

const dotStyles: Record<StatusVariant, string> = {
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-rose-400",
  info: "bg-blue-400",
  default: "bg-muted-foreground",
  pending: "bg-amber-400",
  active: "bg-emerald-400",
  inactive: "bg-muted-foreground",
}

export function StatusBadge({ 
  variant = "default", 
  children, 
  className,
  dot = false,
  pulse = false,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span 
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                dotStyles[variant]
              )} 
            />
          )}
          <span 
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              dotStyles[variant]
            )} 
          />
        </span>
      )}
      {children}
    </span>
  )
}
