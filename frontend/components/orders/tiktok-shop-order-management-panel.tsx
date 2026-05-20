"use client"

import { useAuth } from "@clerk/nextjs"
import { useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { StatusBadge } from "@/components/ui/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AuthApiError,
  getClerkErrorMessage,
  searchTikTokShopOrders,
  waitForSessionToken,
  type TikTokShopOrdersSearchResponse,
} from "@/lib/auth"
import {
  displayTikTokField,
  formatUnixSeconds,
  mapTikTokManagementRow,
  tiktokStatusVariant,
} from "@/lib/tiktok-orders-display"

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border/60 py-2 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words font-medium">{value}</span>
    </div>
  )
}

function TikTokOrderManagementDetailBody({ order }: { order: Record<string, unknown> }) {
  const lineItems = Array.isArray(order.line_items) ? order.line_items : []
  const payment =
    order.payment && typeof order.payment === "object" ? (order.payment as Record<string, unknown>) : null

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Order overview</p>
            <p className="mt-1 text-lg font-semibold">{displayTikTokField(order.id)}</p>
          </div>
          <StatusBadge variant={tiktokStatusVariant(displayTikTokField(order.status))}>
            {displayTikTokField(order.status)}
          </StatusBadge>
        </div>
        <DetailRow
          label="Buyer"
          value={displayTikTokField(order.buyer_nickname) || displayTikTokField(order.user_id)}
        />
        <DetailRow label="Created" value={formatUnixSeconds(order.create_time)} />
        <DetailRow label="Updated" value={formatUnixSeconds(order.update_time)} />
        <DetailRow
          label="Fulfillment"
          value={displayTikTokField(order.fulfillment_type).replace(/_/g, " ")}
        />
        <DetailRow label="Shipping type" value={displayTikTokField(order.shipping_type)} />
        <DetailRow label="Tracking" value={displayTikTokField(order.tracking_number)} />
      </div>

      {payment ? (
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Payment</p>
          <DetailRow label="Currency" value={displayTikTokField(payment.currency)} />
          <DetailRow label="Total" value={displayTikTokField(payment.total_amount)} />
          <DetailRow label="Subtotal" value={displayTikTokField(payment.sub_total)} />
          <DetailRow label="Shipping fee" value={displayTikTokField(payment.shipping_fee)} />
        </div>
      ) : null}

      {lineItems.length > 0 ? (
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Line items</p>
          <div className="space-y-3">
            {lineItems.map((item, index) => {
              if (!item || typeof item !== "object") {
                return null
              }
              const row = item as Record<string, unknown>
              return (
                <div
                  key={`${displayTikTokField(row.id)}-${index}`}
                  className="rounded-xl border border-border/60 bg-muted/20 p-3"
                >
                  <p className="font-medium">{displayTikTokField(row.product_name)}</p>
                  <p className="text-xs text-muted-foreground">{displayTikTokField(row.sku_name)}</p>
                  <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                    <span>Seller SKU: {displayTikTokField(row.seller_sku)}</span>
                    <span>Quantity: {displayTikTokField(row.quantity)}</span>
                    <span>Sale price: {displayTikTokField(row.sale_price)}</span>
                    <span>Package status: {displayTikTokField(row.package_status)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function TikTokShopOrderManagementPanel() {
  const { getToken, isLoaded } = useAuth()
  const [tiktokShop, setTiktokShop] = useState<TikTokShopOrdersSearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Record<string, unknown> | null>(null)

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
    () => (tiktokShop?.orders ?? []).map((order) => mapTikTokManagementRow(order as Record<string, unknown>)),
    [tiktokShop],
  )

  const tiktokQueueCount = useMemo(() => {
    return tiktokRows.filter((row) => /await|fulfill|ship/i.test(row.status)).length
  }, [tiktokRows])

  const tiktokBuyerCount = useMemo(() => {
    return new Set(tiktokRows.map((row) => row.buyer).filter((value) => value && value !== "N/A")).size
  }, [tiktokRows])

  const tiktokDemoMode = Boolean(tiktokShop?.isMockData)

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isRefreshing}
          onClick={() => void loadOrders(true)}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh TikTok
        </Button>
      </div>

      {errorMessage ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Matches</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {tiktokShop ? tiktokShop.totalCount : "—"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Partner API search results in the active queue.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Fulfillment queue
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{tiktokQueueCount}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Orders still moving through shipment workflow.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Buyers</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{tiktokBuyerCount}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Distinct buyers in the visible TikTok queue.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-lg">TikTok Shop queue</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              A platform-specific operational table for Partner API orders, separated from the Whatnot shipment
              flow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Partner API</Badge>
            <Badge variant={tiktokDemoMode ? "secondary" : "default"}>
              {tiktokDemoMode ? "Mock Data" : "Live shop"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          {isLoading && tiktokRows.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" />
              Loading TikTok order queue…
            </div>
          ) : null}

          {tiktokRows.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="px-4 py-3">Order ID</TableHead>
                    <TableHead className="px-4 py-3">Created</TableHead>
                    <TableHead className="px-4 py-3">Buyer</TableHead>
                    <TableHead className="px-4 py-3">Items</TableHead>
                    <TableHead className="px-4 py-3">Summary</TableHead>
                    <TableHead className="px-4 py-3">Total</TableHead>
                    <TableHead className="px-4 py-3">Status</TableHead>
                    <TableHead className="px-4 py-3">Shipping type</TableHead>
                    <TableHead className="px-4 py-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiktokRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="px-4 py-4 font-mono text-xs">{row.id}</TableCell>
                      <TableCell className="px-4 py-4">{row.createdAtLabel}</TableCell>
                      <TableCell className="px-4 py-4 font-medium">{row.buyer}</TableCell>
                      <TableCell className="px-4 py-4">{row.lineCount}</TableCell>
                      <TableCell className="max-w-[240px] truncate px-4 py-4" title={row.itemSummary}>
                        {row.itemSummary}
                      </TableCell>
                      <TableCell className="px-4 py-4">{row.totalLabel}</TableCell>
                      <TableCell className="px-4 py-4">
                        <StatusBadge variant={tiktokStatusVariant(row.status)}>{row.status}</StatusBadge>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-xs uppercase tracking-wide text-muted-foreground">
                        {row.shippingType}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => setSelectedOrder(row.raw)}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : !isLoading && !errorMessage ? (
            <p className="text-sm text-muted-foreground">No TikTok orders in this queue.</p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={selectedOrder !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null)
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span>TikTok Shop order {displayTikTokField(selectedOrder?.id)}</span>
              {tiktokDemoMode ? <Badge variant="secondary">Demo sample</Badge> : null}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder ? <TikTokOrderManagementDetailBody order={selectedOrder} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
