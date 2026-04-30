"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { PackageSearch, RefreshCw } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AuthApiError, getWhatnotOrders, syncWhatnotOrders, type WhatnotOrderItem, waitForSessionToken } from "@/lib/auth"

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

  const code = currency || "USD"
  return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(amount)
}

type OrderRow = {
  id: string
  title: string
  createdAt: string | null
  customer: string
  quantity: number
  salesChannel: string
  subtotalAmount: number | null
  subtotalCurrency: string
  prettyStatus: string
  earningStatus: string
  netEarning: string
}

type RawOrderPayload = {
  createdAt?: string
  salesChannel?: string
  prettyStatus?: string
  buyer?: { username?: string }
  subtotal?: { amount?: number; currency?: string }
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

function mapOrderRow(order: WhatnotOrderItem): OrderRow {
  const raw = (order.rawPayload || {}) as RawOrderPayload
  const itemEdges = Array.isArray(raw.items?.edges) ? raw.items.edges : []
  const firstItemNode = itemEdges[0]?.node || null
  const title = firstItemNode?.listing?.title || order.listingTitle || order.orderNumber || order.whatnotOrderId || "Untitled order"
  const quantity = itemEdges.reduce((total, edge) => total + (edge?.node?.quantity || 0), 0) || 1
  const subtotalRaw = raw.subtotal
  const subtotalAmount = typeof subtotalRaw?.amount === "number" ? subtotalRaw.amount / 100 : null
  const subtotalCurrency = subtotalRaw?.currency || order.priceCurrency || "USD"
  const buyerUsername = raw.buyer?.username || order.buyerUsername || order.buyerName || "N/A"
  const salesChannel = (raw.salesChannel || "N/A").toString()
  const prettyStatus = (raw.prettyStatus || order.status || "unknown").toString()
  const earningStatusBadge = firstItemNode?.sellerReceipt?.earningsStatus?.badgeLabel || "N/A"
  const netEarning = firstItemNode?.sellerReceipt?.netEarnings?.amount
    || firstItemNode?.sellerReceipt?.netEarning?.amount
    || "N/A"

  return {
    id: order.id,
    title,
    createdAt: (raw.createdAt || order.orderedAt || null) as string | null,
    customer: buyerUsername,
    quantity,
    salesChannel,
    subtotalAmount,
    subtotalCurrency,
    prettyStatus,
    earningStatus: earningStatusBadge,
    netEarning,
  }
}

export default function SellerOrdersPage() {
  const { getToken, isLoaded } = useAuth()
  const [orders, setOrders] = useState<WhatnotOrderItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null)

  const loadOrders = async (isManualRefresh = false) => {
    if (!isLoaded) {
      return
    }

    if (isManualRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      setErrorMessage(null)
      const token = await waitForSessionToken(getToken)
      await syncWhatnotOrders(token).catch(() => null)
      const result = await getWhatnotOrders(token, { limit: 100 })
      setOrders(result.orders)
    } catch (error) {
      const message = error instanceof AuthApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unable to load Whatnot orders."
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (cancelled) {
        return
      }
      await loadOrders()
    }

    void run()
    const intervalId = window.setInterval(() => {
      void loadOrders(true)
    }, 10000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [getToken, isLoaded])

  const orderRows = useMemo(() => orders.map(mapOrderRow), [orders])

  const totalSales = useMemo(() => {
    return orderRows.reduce((total, row) => total + (row.subtotalAmount || 0), 0)
  }, [orderRows])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" />
          Loading Whatnot orders...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Orders</h1>
          <p className="text-sm text-muted-foreground">Live Whatnot orders synced through extension into your marketplace DB.</p>
        </div>
        <Button variant="outline" onClick={() => void loadOrders(true)} disabled={isRefreshing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total Orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{orderRows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Approx Revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">${totalSales.toFixed(2)}</CardContent>
        </Card>
      </div>

      {errorMessage ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

      {orderRows.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No orders synced yet"
          description="Orders sync automatically when this tab opens. Keep Whatnot extension connected."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Whatnot Orders</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Items</th>
                  <th className="px-3 py-2 font-medium">Sales Channel</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Order Status</th>
                  <th className="px-3 py-2 font-medium">Earning Status</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orderRows.map((order) => (
                  <tr key={order.id} className="border-b last:border-b-0">
                    <td className="px-3 py-3">
                      <div className="font-medium">{order.title}</div>
                    </td>
                    <td className="px-3 py-3">{formatDate(order.createdAt)}</td>
                    <td className="px-3 py-3">{order.customer}</td>
                    <td className="px-3 py-3">{order.quantity}</td>
                    <td className="px-3 py-3">{order.salesChannel}</td>
                    <td className="px-3 py-3">{toCurrency(order.subtotalAmount, order.subtotalCurrency)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge variant="warning">{order.prettyStatus}</StatusBadge>
                    </td>
                    <td className="px-3 py-3">{order.earningStatus}</td>
                    <td className="px-3 py-3">
                      <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                        View Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-2 font-semibold">Buyer paid</div>
                <div>Order total: {toCurrency(selectedOrder.subtotalAmount, selectedOrder.subtotalCurrency)}</div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-2 font-semibold">Your earning</div>
                <div>Net earning: {selectedOrder.netEarning}</div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
