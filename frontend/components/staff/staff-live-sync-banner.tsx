"use client"

import { Activity, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function StaffLiveSyncBanner({
  lastUpdated,
  isRefreshing,
  onRefresh,
  className,
}: {
  lastUpdated: Date | null
  isRefreshing: boolean
  onRefresh?: () => void
  className?: string
}) {
  const formatted = lastUpdated
    ? new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(lastUpdated)
    : "—"

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/30 px-4 py-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/40" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="font-medium text-foreground">Live sync simulation</span>
        <Badge variant="secondary" className="font-normal">
          TikTok Shop + Whatnot
        </Badge>
        <span className="text-muted-foreground">Last refresh · {formatted}</span>
      </div>
      {onRefresh ? (
        <Button type="button" variant="outline" size="sm" onClick={() => onRefresh()} disabled={isRefreshing}>
          {isRefreshing ? (
            <RefreshCw className="mr-2 size-4 animate-spin" />
          ) : (
            <Activity className="mr-2 size-4" />
          )}
          Refresh
        </Button>
      ) : null}
    </div>
  )
}
