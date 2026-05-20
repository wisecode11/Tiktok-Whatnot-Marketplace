"use client"

import { useAuth } from "@clerk/nextjs"
import { useEffect, useMemo, useState } from "react"
import { RefreshCw, Store } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  AuthApiError,
  getClerkErrorMessage,
  searchTikTokShopOrders,
  waitForSessionToken,
  type TikTokShopOrdersSearchResponse,
} from "@/lib/auth"
import {
  mapTikTokOrderRow,
  tiktokStatusVariant,
  type TikTokOrderRow,
} from "@/lib/tiktok-orders-display"

export function TikTokShopOrdersPanel() {
  const { getToken, isLoaded } = useAuth()
  const [tiktokShop, setTiktokShop] = useState<TikTokShopOrdersSearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<TikTokOrderRow | null>(null)

  async function loadOrders(isManualRefresh = false) {
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
      const result = await searchTikTokShopOrders(token, {
        pageSize: 50,
        sortOrder: "DESC",
        sortField: "create_time",
      })
      setTiktokShop(result)
    } catch (error) {
      const message =
        error instanceof AuthApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : getClerkErrorMessage(error)
      setErrorMessage(message)
      setTiktokShop(null)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    void loadOrders()
  }, [getToken, isLoaded])

  const tiktokRows = useMemo(
    () => (tiktokShop?.orders ?? []).map((order) => mapTikTokOrderRow(order as Record<string, unknown>)),
    [tiktokShop],
  )

  const tiktokAwaitingCount = useMemo(() => {
    return tiktokRows.filter((row) => /await|fulfill|ship/i.test(row.status)).length
  }, [tiktokRows])

  const tiktokBuyerCount = useMemo(() => {
    return new Set(tiktokRows.map((row) => row.buyer).filter((value) => value && value !== "N/A")).size
  }, [tiktokRows])

  const tiktokDemoMode = Boolean(tiktokShop?.isMockData)

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="h-4 w-4" />
        Loading TikTok orders…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isRefreshing}
          onClick={() => void loadOrders(true)}
        >
          {isRefreshing ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {errorMessage ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 bg-card/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Query matches</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {tiktokShop != null ? tiktokShop.totalCount : "-"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Total count returned by the active Partner API search.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Active queue</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{tiktokAwaitingCount}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Orders awaiting shipment or fulfillment on this page.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Buyers</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{tiktokBuyerCount}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Distinct buyers represented in the visible result page.
            </p>
          </CardContent>
        </Card>
      </div>

      {!errorMessage && tiktokShop != null && tiktokRows.length > 0 ? (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg">
                {tiktokDemoMode ? "Demo TikTok Shop order queue" : "TikTok Shop order queue"}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                A cleaner operational view over Partner API order search responses, with detail available per row.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Partner API</Badge>
              <Badge variant={tiktokDemoMode ? "secondary" : "default"}>
                {tiktokDemoMode ? "Mock Data" : "Live shop"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order ID</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Buyer</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Summary</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Fulfillment</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tiktokRows.map((order) => (
                    <tr
                      key={order.id}
                      className="border-t border-border/60 align-top transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-4 font-mono text-xs text-foreground">{order.id}</td>
                      <td className="px-4 py-4 text-muted-foreground">{order.createdAtLabel}</td>
                      <td className="px-4 py-4">{order.buyer}</td>
                      <td className="px-4 py-4">{order.lineCount}</td>
                      <td className="max-w-[240px] truncate px-4 py-4" title={order.itemSummary}>
                        {order.itemSummary}
                      </td>
                      <td className="px-4 py-4 font-medium">{order.totalLabel}</td>
                      <td className="px-4 py-4">
                        <StatusBadge variant={tiktokStatusVariant(order.status)}>{order.status}</StatusBadge>
                      </td>
                      <td className="px-4 py-4 text-xs uppercase tracking-wide text-muted-foreground">
                        {order.fulfillment}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => setSelectedOrder(order)}
                        >
                          View detail
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : !errorMessage && tiktokShop != null ? (
        <EmptyState
          icon={Store}
          title="No TikTok Shop orders on this page"
          description="The current Partner API query did not return any rows."
        />
      ) : null}

      <Dialog open={selectedOrder !== null} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span>TikTok Shop order {selectedOrder?.id ?? ""}</span>
              {tiktokDemoMode ? <Badge variant="secondary">Demo sample</Badge> : null}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border p-3">
                <div className="font-semibold">Buyer</div>
                <div>{selectedOrder.buyer}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="font-semibold">Summary</div>
                <div>{selectedOrder.itemSummary}</div>
                <div>Total: {selectedOrder.totalLabel}</div>
                <div>Status: {selectedOrder.status}</div>
                <div>Fulfillment: {selectedOrder.fulfillment}</div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
