"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"

import type { WhatnotShipmentNode, WhatnotShipmentTableRow } from "@/components/whatnot/whatnot-shipment-details-ui"
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

export function useStaffShipmentSnapshot(limit = 120) {
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
        const result = await getStaffOrderManagementSnapshot(token, { limit })
        const rows = mapStaffShipmentRows(result.shipments || [])
        setTableRows(rows)
        setLastUpdated(
          result.shipments[0]?.updatedAt
            ? new Date(result.shipments[0].updatedAt)
            : result.stats?.updatedAt
              ? new Date(result.stats.updatedAt)
              : null,
        )
      } catch (loadError) {
        setError(getClerkErrorMessage(loadError))
        setTableRows([])
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [getToken, isLoaded, limit],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  return {
    tableRows,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh: () => load(true),
  }
}
