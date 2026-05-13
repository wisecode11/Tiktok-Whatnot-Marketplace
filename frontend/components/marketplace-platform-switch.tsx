"use client"

import { PackageSearch, ShoppingBag } from "lucide-react"

import { cn } from "@/lib/utils"

export type MarketplacePlatform = "whatnot" | "tiktok"

interface MarketplacePlatformSwitchProps {
  value: MarketplacePlatform
  onValueChange: (value: MarketplacePlatform) => void
  ariaLabel: string
  whatnotLabel?: string
  tiktokLabel?: string
  className?: string
  idPrefix?: string
}

export function MarketplacePlatformSwitch({
  value,
  onValueChange,
  ariaLabel,
  whatnotLabel = "Whatnot",
  tiktokLabel = "TikTok",
  className,
  idPrefix = "marketplace-platform",
}: MarketplacePlatformSwitchProps) {
  return (
    <div
      className={cn("flex flex-wrap gap-1 rounded-xl border border-border/50 bg-muted/50 p-1", className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "whatnot"}
        id={`${idPrefix}-whatnot`}
        className={cn(
          "relative inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:flex-none sm:justify-start sm:px-4",
          value === "whatnot"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
        )}
        onClick={() => onValueChange("whatnot")}
      >
        <PackageSearch className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        {whatnotLabel}
        {value === "whatnot" ? (
          <span
            className="bg-primary absolute bottom-0 left-3 right-3 h-0.5 rounded-full sm:left-4 sm:right-4"
            aria-hidden
          />
        ) : null}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "tiktok"}
        id={`${idPrefix}-tiktok`}
        className={cn(
          "relative inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:flex-none sm:justify-start sm:px-4",
          value === "tiktok"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
        )}
        onClick={() => onValueChange("tiktok")}
      >
        <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
        {tiktokLabel}
        {value === "tiktok" ? (
          <span
            className="bg-primary absolute bottom-0 left-3 right-3 h-0.5 rounded-full sm:left-4 sm:right-4"
            aria-hidden
          />
        ) : null}
      </button>
    </div>
  )
}