"use client"

import { useMemo } from "react"

import { StaffLiveSyncBanner } from "@/components/staff/staff-live-sync-banner"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import { useStaffShipmentSnapshot } from "@/components/staff/use-staff-shipment-snapshot"
import { WhatnotShipmentsTableSection } from "@/components/whatnot/whatnot-shipment-details-ui"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

export function LabellingPage() {
  const { tableRows, isLoading, isRefreshing, error, lastUpdated, refresh } = useStaffShipmentSnapshot(120)
  const syncedCount = useMemo(() => tableRows.filter((row) => row.shipment).length, [tableRows])

  return (
    <StaffModuleGate
      moduleId="labelling"
      title="Labelling"
      description="Shipping labels, tracking, carrier, and ship-to address from the parent seller's synced Whatnot shipments."
    >
      <StaffLiveSyncBanner lastUpdated={lastUpdated} isRefreshing={isRefreshing} onRefresh={() => refresh()} />

      {error ? (
        <Card className="border-destructive/30">
          <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Spinner className="h-4 w-4" />
              Loading labelling details…
            </span>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Whatnot labelling queue</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Label status, carrier, tracking, and print links for shipping labels and packing slips.
              </p>
            </div>
            <Badge variant="outline">{syncedCount} shipments</Badge>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <WhatnotShipmentsTableSection
              rows={tableRows}
              variant="labelling"
              emptyMessage="No shipment snapshots saved yet. Ask the seller to sync shipments from Order Management."
            />
          </CardContent>
        </Card>
      )}
    </StaffModuleGate>
  )
}
