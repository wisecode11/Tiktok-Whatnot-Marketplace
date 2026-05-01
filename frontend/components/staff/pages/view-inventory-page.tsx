"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"

import { StaffLiveSyncBanner } from "@/components/staff/staff-live-sync-banner"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getClerkErrorMessage, getWhatnotInventoryLive, type WhatnotInventoryLiveResponse, waitForSessionToken } from "@/lib/auth"

type InventoryRow = {
  id: string
  title: string
  subtitle: string
  category: string
  quantity: number
  priceText: string
  format: string
}

function toInventoryRows(payload: WhatnotInventoryLiveResponse | null): InventoryRow[] {
  const edges = payload?.responsePayload?.data?.me?.inventory?.edges || []

  return edges
    .map((edge) => {
      const node = edge?.node
      if (!node || !node.id) {
        return null
      }

      const normalizedId = String(node.id)
      const trimmedTitle = typeof node.title === "string" && node.title.trim() ? node.title.trim() : "Untitled product"
      const subtitle =
        typeof node.subtitle === "string" && node.subtitle.trim()
          ? node.subtitle.trim()
          : typeof node.description === "string" && node.description.trim()
            ? node.description.trim()
            : "No description"
      const stock = typeof node.quantity === "number" && Number.isFinite(node.quantity) ? Math.max(0, Math.floor(node.quantity)) : 0
      const category =
        typeof node.product?.category?.label === "string" && node.product.category.label.trim()
          ? node.product.category.label.trim()
          : "Uncategorized"
      const rawAmount = typeof node.price?.amount === "number" && Number.isFinite(node.price.amount) ? node.price.amount : null
      const currency = typeof node.price?.currency === "string" && node.price.currency.trim() ? node.price.currency.trim() : "USD"
      const amount = rawAmount === null ? 0 : rawAmount / 100
      const priceText = `${currency} ${amount.toFixed(2)}`
      const format = typeof node.transactionType === "string" && node.transactionType.trim() ? node.transactionType.trim() : "BUY_IT_NOW"

      return {
        id: normalizedId,
        title: trimmedTitle,
        subtitle,
        category,
        quantity: stock,
        priceText,
        format,
      }
    })
    .filter((row): row is InventoryRow => row !== null)
}

export function ViewInventoryPage() {
  const { getToken, isLoaded } = useAuth()
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadInventory = useCallback(
    async (isManualRefresh: boolean) => {
      try {
        if (isManualRefresh) {
          setIsRefreshing(true)
        } else {
          setIsLoading(true)
        }

        setError(null)
        const token = await waitForSessionToken(getToken)
        const result = await getWhatnotInventoryLive(token, { status: "ACTIVE" })
        setRows(toInventoryRows(result))
        setLastUpdated(result.syncedAt ? new Date(result.syncedAt) : new Date())
      } catch (loadError) {
        setError(getClerkErrorMessage(loadError))
        setRows([])
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [getToken],
  )

  useEffect(() => {
    if (!isLoaded) {
      return
    }
    void loadInventory(false)
  }, [isLoaded, loadInventory])

  const totalProducts = useMemo(() => rows.length, [rows])

  return (
    <StaffModuleGate
      moduleId="view_inventory"
      title="View Inventory"
      description="Read-only Whatnot inventory for your parent seller workspace."
    >
      <StaffLiveSyncBanner
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRefresh={() => void loadInventory(true)}
      />

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading parent seller inventory…</CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Whatnot inventory overview</CardTitle>
            <p className="text-sm text-muted-foreground">
              Only products synced under your parent seller are visible here. Other sellers&apos; products are excluded.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Total products: {totalProducts}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Price &amp; Format</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium">{row.title}</p>
                      <p className="text-xs text-muted-foreground">{row.subtitle}</p>
                    </TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
                    <TableCell>
                      <p className="font-medium">{row.priceText}</p>
                      <p className="text-xs text-muted-foreground">{row.format}</p>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      No Whatnot products found for your parent seller.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </StaffModuleGate>
  )
}