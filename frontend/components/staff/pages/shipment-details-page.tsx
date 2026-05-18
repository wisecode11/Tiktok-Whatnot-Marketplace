"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { StaffLiveSyncBanner } from "@/components/staff/staff-live-sync-banner"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import {
  WhatnotShipmentsTableSection,
  type WhatnotShipmentNode,
  type WhatnotShipmentTableRow,
} from "@/components/whatnot/whatnot-shipment-details-ui"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  getClerkErrorMessage,
  getStaffOrderManagementSnapshot,
  type StaffOrderManagementShipmentRow,
  waitForSessionToken,
} from "@/lib/auth"

function mapStaffShipmentRows(shipments: StaffOrderManagementShipmentRow[]): WhatnotShipmentTableRow[] {
  return shipments.map((row, index) => ({
    rowKey:
      row.shipmentKey ||
      row.shipmentGlobalId ||
      row.shipmentIdInput ||
      `shipment-${index}`,
    shipment: (row.shipment || null) as WhatnotShipmentNode | null,
    error: row.shipment ? null : "Missing shipment payload in snapshot.",
  }))
}

export function ShipmentDetailsPage() {
  const { getToken, isLoaded } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [tableRows, setTableRows] = useState<WhatnotShipmentTableRow[]>([])

  const load = useCallback(
    async (manual: boolean) => {
      if (!isLoaded) {
        return
      }

      try {
        if (manual) {
          setIsRefreshing(true)
        } else {
          setIsLoading(true)
        }
        setError(null)

        const token = await waitForSessionToken(getToken)
        const result = await getStaffOrderManagementSnapshot(token, { limit: 120 })
        const rows = mapStaffShipmentRows(result.shipments || [])
        setTableRows(rows)
        setLastUpdated(
          result.shipments[0]?.updatedAt
            ? new Date(result.shipments[0].updatedAt)
            : result.stats?.updatedAt
              ? new Date(result.stats.updatedAt)
              : new Date(),
        )
      } catch (loadError) {
        setError(getClerkErrorMessage(loadError))
        setTableRows([])
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [getToken, isLoaded],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  const syncedCount = useMemo(() => tableRows.filter((row) => row.shipment).length, [tableRows])

  return (
    <StaffModuleGate
      moduleId="shipment_details"
      title="Shipment Details"
      description="Whatnot shipment records synced from the parent seller workspace."
    >
      <StaffLiveSyncBanner
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRefresh={() => void load(true)}
      />

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
              Loading shipment details…
            </span>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Whatnot shipments</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Packaging, labels, and tracking from the seller&apos;s synced shipment snapshots.
              </p>
            </div>
            <Badge variant="outline">{syncedCount} saved</Badge>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <WhatnotShipmentsTableSection
              rows={tableRows}
              emptyMessage="No shipment snapshots saved yet for this seller. Ask the seller to refresh shipments on Order Management."
            />
          </CardContent>
        </Card>
      )}
    </StaffModuleGate>
  )
}
