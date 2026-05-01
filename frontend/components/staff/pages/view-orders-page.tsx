"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"

import { StaffLiveSyncBanner } from "@/components/staff/staff-live-sync-banner"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getClerkErrorMessage, getWhatnotOrders, type WhatnotOrderItem, waitForSessionToken } from "@/lib/auth"

type RawOrderPayload = {
  createdAt?: string
  salesChannel?: string
  prettyStatus?: string
  buyer?: { username?: string }
  subtotal?: { amount?: number | string; currency?: string }
  items?: {
    edges?: Array<{
      node?: {
        quantity?: number
        listing?: { title?: string }
        sellerReceipt?: {
          earningsStatus?: { badgeLabel?: string }
          netEarnings?: { amount?: string }
          netEarning?: { amount?: string }
        }
      }
    }>
  }
}

type OrderDetailRow = {
  id: string
  title: string
  createdAt: string | null
  customer: string
  quantity: number
  salesChannel: string
  prettyStatus: string
  earningStatus: string
  priceLabel: string
  netEarning: string
}

function statusVariant(status: string | null) {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : ""
  if (normalized.includes("cancel") || normalized.includes("refund")) {
    return "destructive" as const
  }
  if (normalized.includes("deliver") || normalized.includes("complete")) {
    return "secondary" as const
  }
  if (normalized.includes("ship") || normalized.includes("process")) {
    return "default" as const
  }
  return "outline" as const
}

function formatDate(value: string | null) {
  if (!value) {
    return "N/A"
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString()
}

function toCurrency(amount: number | null, currency = "USD") {
  if (amount == null || !Number.isFinite(amount)) {
    return "N/A"
  }
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(amount)
}

function resolveDisplayPrice(order: WhatnotOrderItem) {
  const raw = (order.rawPayload || {}) as RawOrderPayload
  const subtotalAmountRaw = raw?.subtotal?.amount
  const subtotalCurrency = raw?.subtotal?.currency || order.priceCurrency || "USD"

  if (typeof subtotalAmountRaw === "number" && Number.isFinite(subtotalAmountRaw)) {
    return toCurrency(subtotalAmountRaw / 100, subtotalCurrency)
  }

  if (typeof subtotalAmountRaw === "string" && subtotalAmountRaw.trim()) {
    const parsed = Number(subtotalAmountRaw)
    if (Number.isFinite(parsed)) {
      return toCurrency(parsed / 100, subtotalCurrency)
    }
  }

  return toCurrency(
    typeof order.priceAmount === "number" && Number.isFinite(order.priceAmount) ? order.priceAmount : null,
    order.priceCurrency || "USD",
  )
}

export function ViewOrdersPage() {
  const { getToken, isLoaded } = useAuth()
  const [rows, setRows] = useState<WhatnotOrderItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<OrderDetailRow | null>(null)

  const loadOrders = useCallback(
    async (isManualRefresh: boolean) => {
      try {
        if (isManualRefresh) {
          setIsRefreshing(true)
        } else {
          setIsLoading(true)
        }
        setError(null)

        const token = await waitForSessionToken(getToken)
        const result = await getWhatnotOrders(token, { limit: 100 })
        setRows(result.orders || [])
        setLastUpdated(new Date())
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
    void loadOrders(false)
  }, [isLoaded, loadOrders])

  const totalRevenueLabel = useMemo(() => {
    const total = rows.reduce((sum, order) => {
      const raw = (order.rawPayload || {}) as RawOrderPayload
      const subtotalAmountRaw = raw?.subtotal?.amount
      if (typeof subtotalAmountRaw === "number" && Number.isFinite(subtotalAmountRaw)) {
        return sum + subtotalAmountRaw / 100
      }
      if (typeof subtotalAmountRaw === "string" && subtotalAmountRaw.trim()) {
        const parsed = Number(subtotalAmountRaw)
        if (Number.isFinite(parsed)) {
          return sum + parsed / 100
        }
      }
      return sum + (typeof order.priceAmount === "number" && Number.isFinite(order.priceAmount) ? order.priceAmount : 0)
    }, 0)
    return `USD ${total.toFixed(2)}`
  }, [rows])

  return (
    <StaffModuleGate
      moduleId="view_orders"
      title="View Orders"
      description="Whatnot orders for your parent seller workspace."
    >
      <StaffLiveSyncBanner
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRefresh={() => void loadOrders(true)}
      />

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading orders…</CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Whatnot Orders</CardTitle>
            <p className="text-sm text-muted-foreground">
              Only orders synced under your parent seller are visible here.
            </p>
            <p className="text-xs text-muted-foreground">Total orders: {rows.length} · Approx revenue: {totalRevenueLabel}</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Sales Channel</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Order Status</TableHead>
                  <TableHead>Earning Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((order) => (
                  (() => {
                    const raw = (order.rawPayload || {}) as RawOrderPayload
                    const itemEdges = Array.isArray(raw.items?.edges) ? raw.items.edges : []
                    const firstItemNode = itemEdges[0]?.node || null
                    const itemsCount = itemEdges.reduce((total, edge) => total + (edge?.node?.quantity || 0), 0) || 1
                    const title = firstItemNode?.listing?.title || order.listingTitle || order.orderNumber || order.whatnotOrderId || "Untitled order"
                    const salesChannel = raw.salesChannel || "N/A"
                    const prettyStatus = raw.prettyStatus || order.status || "Unknown"
                    const earningStatus = firstItemNode?.sellerReceipt?.earningsStatus?.badgeLabel || "N/A"
                    const netEarning =
                      firstItemNode?.sellerReceipt?.netEarnings?.amount
                      || firstItemNode?.sellerReceipt?.netEarning?.amount
                      || "N/A"
                    const priceLabel = resolveDisplayPrice(order)
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{title}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(raw.createdAt || order.orderedAt || null)}</TableCell>
                        <TableCell>{raw.buyer?.username || order.buyerUsername || order.buyerName || "N/A"}</TableCell>
                        <TableCell>{itemsCount}</TableCell>
                        <TableCell>{salesChannel}</TableCell>
                        <TableCell>{resolveDisplayPrice(order)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(prettyStatus)} className="font-normal">
                            {prettyStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>{earningStatus}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setSelectedOrder({
                                id: order.id,
                                title,
                                createdAt: raw.createdAt || order.orderedAt || null,
                                customer: raw.buyer?.username || order.buyerUsername || order.buyerName || "N/A",
                                quantity: itemsCount,
                                salesChannel,
                                prettyStatus,
                                earningStatus,
                                priceLabel,
                                netEarning,
                              })
                            }
                          >
                            View Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })()
                ))}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      No Whatnot orders found for your parent seller.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={selectedOrder !== null} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedOrder?.title || "Order Detail"}</DialogTitle>
          </DialogHeader>

          {selectedOrder ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border p-3">
                <div className="mb-2 font-semibold">Order details</div>
                <div>Order date/time: {formatDate(selectedOrder.createdAt)}</div>
                <div>Buyer: {selectedOrder.customer}</div>
                <div>Quantity: {selectedOrder.quantity}</div>
                <div>Sales channel: {selectedOrder.salesChannel}</div>
                <div>Status: {selectedOrder.prettyStatus}</div>
                <div>Earning status: {selectedOrder.earningStatus}</div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-2 font-semibold">Buyer paid</div>
                <div>Order total: {selectedOrder.priceLabel}</div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-2 font-semibold">Your earning</div>
                <div>Net earning: {selectedOrder.netEarning}</div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </StaffModuleGate>
  )
}
