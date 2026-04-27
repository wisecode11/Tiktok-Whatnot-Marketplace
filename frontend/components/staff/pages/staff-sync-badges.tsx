import { Badge } from "@/components/ui/badge"
import type { SyncState } from "@/lib/staff/mock-workspace-data"

export function PlatformSyncBadge({ state, label }: { state: SyncState; label: string }) {
  const variant =
    state === "synced" ? "secondary" : state === "pending" ? "outline" : "destructive"
  const text =
    state === "synced" ? `${label} · synced` : state === "pending" ? `${label} · pending` : `${label} · action needed`

  return (
    <Badge variant={variant} className="font-normal">
      {text}
    </Badge>
  )
}
