"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { ExternalLink, Printer } from "lucide-react"

import { StaffLiveSyncBanner } from "@/components/staff/staff-live-sync-banner"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  getClerkErrorMessage,
  getStaffOrderManagementSnapshot,
  type WhatnotMyLiveStatistic,
  type StaffOrderManagementShipmentRow,
  waitForSessionToken,
} from "@/lib/auth"

type ShipmentNode = Record<string, unknown> & {
  id?: string
  buyer?: { username?: string }
  weight?: { amount?: number; scale?: string }
  dimensions?: { length?: number; width?: number; height?: number; scale?: string }
  totalItemQuantity?: number
  status?: string
  method?: string
  trackingCode?: string
  trackingUrl?: string
  fileUrl?: string
  bundledFileUrl?: string | null
  sellerPaidShippingCost?: { amount?: number; currency?: string }
  signatureRequired?: boolean
  insuranceInfo?: unknown
  hazmatLabelType?: string
  addressFullName?: string
  addressLine1?: string
  addressLine2?: string
  addressCity?: string
  addressState?: string
  addressPostalCode?: string
  addressCountryCode?: string
  orderItems?: Array<{
    createdAt?: string
    quantity?: number
    listing?: {
      title?: string
      images?: Array<{ url?: string | null } | null | undefined>
    }
    order?: {
      id?: string
      subtotal?: { amount?: number; currency?: string }
      prettyStatus?: string
    }
  }>
}

function formatMoney(money: { amount?: number; currency?: string } | null | undefined) {
  if (!money || typeof money.amount !== "number" || !Number.isFinite(money.amount)) {
    return "—"
  }
  const code = typeof money.currency === "string" && money.currency.trim() ? money.currency : "USD"
  const major = money.amount / 100
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(major)
  } catch {
    return `${code} ${major.toFixed(2)}`
  }
}

function formatStatus(value: string | undefined) {
  if (!value) return "—"
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function firstOrderItemCreatedAt(shipment: ShipmentNode): string | null {
  const items = shipment.orderItems
  if (!Array.isArray(items) || !items.length) {
    return null
  }
  const raw = items[0]?.createdAt
  return typeof raw === "string" ? raw : null
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { dateStyle: "medium" })
}

function formatWeight(shipment: ShipmentNode) {
  const w = shipment.weight
  if (!w || typeof w.amount !== "number" || !Number.isFinite(w.amount)) {
    return "—"
  }
  const scale = typeof w.scale === "string" && w.scale.trim() ? w.scale : ""
  return scale ? `${w.amount} ${scale}` : String(w.amount)
}

function formatDimensions(shipment: ShipmentNode) {
  const d = shipment.dimensions
  if (!d) return "—"
  const values = [d.length, d.width, d.height]
  if (!values.every((v) => typeof v === "number" && Number.isFinite(v))) {
    return "—"
  }
  const scale = typeof d.scale === "string" && d.scale.trim() ? d.scale : ""
  return `${values[0]} x ${values[1]} x ${values[2]} ${scale}`.trim()
}

function formatOrderValue(shipment: ShipmentNode) {
  const items = shipment.orderItems
  if (!Array.isArray(items) || !items.length) {
    return "—"
  }
  let cents = 0
  let currency = "USD"
  for (const item of items) {
    const amount = item?.order?.subtotal?.amount
    if (typeof amount === "number" && Number.isFinite(amount)) {
      cents += amount
      if (typeof item?.order?.subtotal?.currency === "string" && item.order.subtotal.currency.trim()) {
        currency = item.order.subtotal.currency.trim()
      }
    }
  }
  if (!cents) {
    return "—"
  }
  return formatMoney({ amount: cents, currency })
}

function formatAddress(shipment: ShipmentNode) {
  const lines = [
    shipment.addressFullName,
    shipment.addressLine1,
    shipment.addressLine2,
    [shipment.addressCity, shipment.addressState, shipment.addressPostalCode].filter(Boolean).join(" "),
    shipment.addressCountryCode,
  ]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
  return lines.length ? lines.join("\n") : "—"
}

function hasPositiveInsurance(info: unknown) {
  if (!info || typeof info !== "object") {
    return false
  }
  const amount = (info as { insuranceAmount?: { amount?: number } }).insuranceAmount?.amount
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0
}

function extractGlobalIdTail(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : ""
  if (!raw) return null
  try {
    const decoded = atob(raw)
    const idx = decoded.lastIndexOf(":")
    return idx >= 0 ? decoded.slice(idx + 1) : decoded
  } catch {
    return raw
  }
}

export function StaffOrderManagementPage() {
  const { getToken, isLoaded } = useAuth()
  const [statistic, setStatistic] = useState<WhatnotMyLiveStatistic | null>(null)
  const [shipments, setShipments] = useState<StaffOrderManagementShipmentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedShipment, setSelectedShipment] = useState<ShipmentNode | null>(null)

  const load = useCallback(
    async (manual: boolean) => {
      try {
        if (manual) {
          setIsRefreshing(true)
        } else {
          setIsLoading(true)
        }
        setError(null)
        const token = await waitForSessionToken(getToken)
        const result = await getStaffOrderManagementSnapshot(token, { limit: 120 })
        setStatistic(result.stats?.statistic || null)
        setShipments(result.shipments || [])
        setLastUpdated(
          result.stats?.updatedAt
            ? new Date(result.stats.updatedAt)
            : result.shipments[0]?.updatedAt
              ? new Date(result.shipments[0].updatedAt)
              : new Date(),
        )
      } catch (loadError) {
        setError(getClerkErrorMessage(loadError))
        setStatistic(null)
        setShipments([])
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [getToken],
  )

  useEffect(() => {
    if (!isLoaded) return
    void load(false)
  }, [isLoaded, load])

  const cards = useMemo(() => {
    if (!statistic) return []
    return [
      { label: "Sales", value: formatMoney(statistic.totalSales) },
      { label: "Estimated earnings", value: formatMoney(statistic.totalEarnings) },
      { label: "Completed earnings", value: formatMoney(statistic.totalEarned) },
      { label: "Shipping spend", value: formatMoney(statistic.totalShippingSpend) },
      { label: "Items sold", value: statistic.totalCount != null ? String(statistic.totalCount) : "—" },
      { label: "Pending delivery", value: statistic.pendingShipments != null ? String(statistic.pendingShipments) : "—" },
      { label: "Total delivered", value: statistic.deliveredShipments != null ? String(statistic.deliveredShipments) : "—" },
    ]
  }, [statistic])

  return (
    <StaffModuleGate
      moduleId="order_management"
      title="Order Management"
      description="Stats and shipment details from seller database snapshots."
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
              Loading order management snapshot…
            </span>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && cards.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          {cards.map((card) => (
            <Card key={card.label} className="flex h-full min-h-0 flex-col border-border/60 shadow-none">
              <CardHeader className="min-h-[66px] px-4 pb-0 pt-4">
                <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-2">
                <p className="text-3xl font-semibold tracking-tight">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!isLoading ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Shipments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {shipments.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Order date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Dimensions</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tracking</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipments.map((row, idx) => {
                      const s = (row.shipment || null) as ShipmentNode | null
                      if (!s) {
                        return (
                          <TableRow key={row.shipmentKey || row.shipmentGlobalId || row.shipmentIdInput || `shipment-row-${idx}`}>
                            <TableCell colSpan={9} className="text-sm text-muted-foreground">
                              Missing shipment payload in snapshot.
                            </TableCell>
                          </TableRow>
                        )
                      }
                      const username =
                        s.buyer && typeof s.buyer.username === "string" && s.buyer.username.trim()
                          ? s.buyer.username.trim()
                          : "—"
                      const trackingUrl = typeof s.trackingUrl === "string" ? s.trackingUrl : ""
                      const code = typeof s.trackingCode === "string" ? s.trackingCode : ""
                      const shortCode = code.length > 12 ? `${code.slice(0, 5)}…${code.slice(-4)}` : code
                      const value = formatOrderValue(s)

                      return (
                        <TableRow
                          key={
                            row.shipmentKey ||
                            row.shipmentGlobalId ||
                            row.shipmentIdInput ||
                            extractGlobalIdTail(s.id) ||
                            `shipment-row-${idx}`
                          }
                        >
                          <TableCell className="font-medium">{username}</TableCell>
                          <TableCell>{formatDate(firstOrderItemCreatedAt(s))}</TableCell>
                          <TableCell>{typeof s.totalItemQuantity === "number" ? s.totalItemQuantity : "—"}</TableCell>
                          <TableCell>{value}</TableCell>
                          <TableCell>{formatWeight(s)}</TableCell>
                          <TableCell>{formatDimensions(s)}</TableCell>
                          <TableCell className="capitalize">{formatStatus(s.status)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5 text-sm">
                              <span className="text-muted-foreground">{formatStatus(s.method)}</span>
                              {trackingUrl && code ? (
                                <a
                                  href={trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline"
                                >
                                  {shortCode}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span>{code || "—"}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => setSelectedShipment(s)}>
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No shipment snapshots saved yet for this seller.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={selectedShipment !== null} onOpenChange={(open) => !open && setSelectedShipment(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden border-border/80 p-0 sm:max-w-[520px]">
          <DialogHeader className="sr-only">
            <DialogTitle>Shipment details</DialogTitle>
          </DialogHeader>
          {selectedShipment ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">
              <div className="space-y-4 text-sm">
                <div className="rounded-xl border border-border/70 bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Shipping actions</h3>
                  <div className="space-y-2">
                    <p className="whitespace-pre-line">{formatAddress(selectedShipment)}</p>
                    {selectedShipment.trackingCode ? (
                      <p>
                        Tracking:{" "}
                        {selectedShipment.trackingUrl ? (
                          <a href={selectedShipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            {selectedShipment.trackingCode}
                          </a>
                        ) : (
                          selectedShipment.trackingCode
                        )}
                      </p>
                    ) : null}
                    {selectedShipment.fileUrl ? (
                      <Button variant="default" size="lg" className="h-11 w-full gap-2 rounded-xl font-semibold" asChild>
                        <a href={selectedShipment.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Printer className="h-4 w-4" aria-hidden />
                          Print shipping label
                        </a>
                      </Button>
                    ) : null}
                    {selectedShipment.bundledFileUrl ? (
                      <Button variant="default" size="lg" className="h-11 w-full gap-2 rounded-xl font-semibold" asChild>
                        <a href={selectedShipment.bundledFileUrl} target="_blank" rel="noopener noreferrer">
                          <Printer className="h-4 w-4" aria-hidden />
                          Print packing slip
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Shipment details</h3>
                  <div className="space-y-2">
                    <p>Status: {formatStatus(selectedShipment.status)}</p>
                    <p>Weight: {formatWeight(selectedShipment)}</p>
                    <p>Dimensions: {formatDimensions(selectedShipment)}</p>
                    <p>Seller paid shipping: {formatMoney(selectedShipment.sellerPaidShippingCost)}</p>
                    <p>Signature required: {typeof selectedShipment.signatureRequired === "boolean" ? (selectedShipment.signatureRequired ? "Yes" : "No") : "—"}</p>
                    <p>Insurance added: {hasPositiveInsurance(selectedShipment.insuranceInfo) ? "Yes" : "No"}</p>
                    <p>Contains hazardous materials: {selectedShipment.hazmatLabelType === "NOT_HAZMAT" ? "No" : selectedShipment.hazmatLabelType ? "Yes" : "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </StaffModuleGate>
  )
}
