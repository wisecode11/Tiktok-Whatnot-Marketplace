"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Activity, Boxes, ExternalLink, PackageSearch, Printer, RefreshCw, Truck, Wallet } from "lucide-react"

import { MarketplacePlatformSwitch, type MarketplacePlatform } from "../../../../components/marketplace-platform-switch"
import { useMarketplaceHub } from "@/components/dashboard/marketplace-hub-context"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { StatusBadge } from "@/components/ui/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AuthApiError,
  fetchWhatnotMyLiveStats,
  fetchWhatnotShipmentsTable,
  getTikTokShopOrderDetail,
  getWhatnotShipmentsLivestreamsCurrentLiveId,
  searchTikTokShopOrders,
  syncWhatnotOrders,
  type TikTokShopOrdersSearchResponse,
  type WhatnotMyLiveStatistic,
  type WhatnotShipmentTableRow,
  waitForSessionToken,
} from "@/lib/auth"

const LIVE_ID_STORAGE_KEY = "seller_order_management_live_id"

type ShipmentNode = Record<string, unknown> & {
  id?: string
  buyer?: { username?: string }
  weight?: { amount?: number; scale?: string }
  dimensions?: { length?: number; width?: number; height?: number; scale?: string }
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
      status?: string
      livestream?: { title?: string | null }
    }
  }>
  totalItemQuantity?: number
  status?: string
  method?: string
  trackingCode?: string
  trackingUrl?: string
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
  fileUrl?: string
  bundledFileUrl?: string | null
}

/** Whatnot Money fields use minor units (e.g. 100 → US$1.00). */
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

function sumOrderSubtotalCents(shipment: ShipmentNode): number {
  const items = shipment.orderItems
  if (!Array.isArray(items)) {
    return 0
  }
  let sum = 0
  for (const item of items) {
    const amt = item?.order?.subtotal?.amount
    if (typeof amt === "number" && Number.isFinite(amt)) {
      sum += amt
    }
  }
  return sum
}

function firstOrderItemCreatedAt(shipment: ShipmentNode): string | null {
  const items = shipment.orderItems
  if (!Array.isArray(items) || !items.length) {
    return null
  }
  const raw = items[0]?.createdAt
  return typeof raw === "string" ? raw : null
}

function formatShipmentTableDate(value: string | null) {
  if (!value) {
    return "—"
  }
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
  if (!d) {
    return "—"
  }
  const { length: L, width: W, height: H, scale } = d
  if (
    typeof L !== "number" ||
    typeof W !== "number" ||
    typeof H !== "number" ||
    !Number.isFinite(L) ||
    !Number.isFinite(W) ||
    !Number.isFinite(H)
  ) {
    return "—"
  }
  const scaleLabel = typeof scale === "string" && scale.trim() ? scale : ""
  return scaleLabel ? `${L} × ${W} × ${H} ${scaleLabel}` : `${L} × ${W} × ${H}`
}

function humanizeMethod(method: string | undefined) {
  if (!method || typeof method !== "string") {
    return "—"
  }
  return method.replace(/_/g, " ")
}

function humanizeStatus(status: string | undefined) {
  if (!status || typeof status !== "string") {
    return "—"
  }
  return status.replace(/_/g, " ")
}

/** Relay-style GraphQL global id → tail after last ":" (e.g. order numeric id). */
function extractGlobalIdTail(globalId: unknown): string | null {
  if (typeof globalId !== "string") {
    return null
  }
  const trimmed = globalId.trim()
  if (!trimmed) {
    return null
  }
  try {
    const decoded = typeof atob !== "undefined" ? atob(trimmed) : ""
    if (!decoded) {
      return null
    }
    const colon = decoded.lastIndexOf(":")
    if (colon >= 0 && colon < decoded.length - 1) {
      const tail = decoded.slice(colon + 1).trim()
      return tail || null
    }
  } catch {
    /* not a Relay global id */
  }
  return null
}

function formatDetailDateDdMmYyyy(value: string | null): string | null {
  if (!value) {
    return null
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    return null
  }
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = String(d.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

function formatPackageWeightOzLabel(shipment: ShipmentNode): string | null {
  const w = shipment.weight
  if (!w || typeof w.amount !== "number" || !Number.isFinite(w.amount)) {
    return null
  }
  const scale = typeof w.scale === "string" ? w.scale.toUpperCase() : ""
  if (scale === "OUNCE" || scale === "OZ") {
    return `${w.amount} oz`
  }
  if (scale) {
    return `${w.amount} ${scale.toLowerCase()}`
  }
  return String(w.amount)
}

function formatPackageDimensionsInLabel(shipment: ShipmentNode): string | null {
  const d = shipment.dimensions
  if (!d) {
    return null
  }
  const { length: L, width: W, height: H, scale } = d
  if (
    typeof L !== "number" ||
    typeof W !== "number" ||
    typeof H !== "number" ||
    !Number.isFinite(L) ||
    !Number.isFinite(W) ||
    !Number.isFinite(H)
  ) {
    return null
  }
  const sc = typeof scale === "string" ? scale.toUpperCase() : ""
  if (sc === "INCH" || sc === "INCHES") {
    return `${L} x ${W} x ${H} in`
  }
  if (typeof scale === "string" && scale.trim()) {
    return `${L} x ${W} x ${H} ${scale.toLowerCase()}`
  }
  return `${L} x ${W} x ${H}`
}

function formatShipToMultiline(shipment: ShipmentNode): string | null {
  const lines: string[] = []
  if (typeof shipment.addressFullName === "string" && shipment.addressFullName.trim()) {
    lines.push(shipment.addressFullName.trim())
  }
  if (typeof shipment.addressLine1 === "string" && shipment.addressLine1.trim()) {
    lines.push(shipment.addressLine1.trim())
  }
  if (typeof shipment.addressLine2 === "string" && shipment.addressLine2.trim()) {
    lines.push(shipment.addressLine2.trim())
  }
  const cityParts: string[] = []
  if (typeof shipment.addressCity === "string" && shipment.addressCity.trim()) {
    cityParts.push(shipment.addressCity.trim())
  }
  if (typeof shipment.addressState === "string" && shipment.addressState.trim()) {
    cityParts.push(shipment.addressState.trim())
  }
  if (typeof shipment.addressPostalCode === "string" && shipment.addressPostalCode.trim()) {
    cityParts.push(shipment.addressPostalCode.trim())
  }
  if (cityParts.length) {
    lines.push(cityParts.join(" "))
  }
  if (typeof shipment.addressCountryCode === "string" && shipment.addressCountryCode.trim()) {
    lines.push(shipment.addressCountryCode.trim())
  }
  if (!lines.length) {
    return null
  }
  return lines.join("\n")
}

function hasPositiveInsurance(insuranceInfo: unknown): boolean {
  if (!insuranceInfo || typeof insuranceInfo !== "object") {
    return false
  }
  const rec = insuranceInfo as { insuranceAmount?: { amount?: number } }
  const amt = rec.insuranceAmount?.amount
  return typeof amt === "number" && Number.isFinite(amt) && amt > 0
}

function hazardousMaterialsYesNo(hazmatLabelType: unknown): "Yes" | "No" | null {
  if (typeof hazmatLabelType !== "string" || !hazmatLabelType.trim()) {
    return null
  }
  return hazmatLabelType.trim().toUpperCase() === "NOT_HAZMAT" ? "No" : "Yes"
}

function getFirstOrderItemNode(shipment: ShipmentNode) {
  const items = shipment.orderItems
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }
  return items[0]
}

function ShipmentDetailsPanel({ shipment }: { shipment: ShipmentNode }) {
  const first = getFirstOrderItemNode(shipment)
  const order = first?.order
  const listing = first?.listing
  const orderDisplayId = extractGlobalIdTail(order?.id)
  const shipmentDisplayId = extractGlobalIdTail(shipment.id)
  const qty =
    typeof shipment.totalItemQuantity === "number" && Number.isFinite(shipment.totalItemQuantity)
      ? shipment.totalItemQuantity
      : null
  const pretty = typeof order?.prettyStatus === "string" && order.prettyStatus.trim() ? order.prettyStatus.trim() : null
  const shipStatus = typeof shipment.status === "string" && shipment.status.trim() ? shipment.status.trim() : null
  const headerBadge = pretty ?? (shipStatus ? humanizeStatus(shipStatus) : null)

  const listingTitle = typeof listing?.title === "string" && listing.title.trim() ? listing.title.trim() : null
  const imageUrl =
    Array.isArray(listing?.images) &&
    listing.images[0] &&
    typeof listing.images[0]?.url === "string" &&
    listing.images[0].url.trim()
      ? listing.images[0].url.trim()
      : null

  const detailDateRaw = firstOrderItemCreatedAt(shipment)
  const detailDate = formatDetailDateDdMmYyyy(detailDateRaw)

  const buyer =
    shipment.buyer && typeof shipment.buyer.username === "string" && shipment.buyer.username.trim()
      ? shipment.buyer.username.trim()
      : null

  const sellerPaid =
    shipment.sellerPaidShippingCost &&
    typeof shipment.sellerPaidShippingCost.amount === "number" &&
    Number.isFinite(shipment.sellerPaidShippingCost.amount)
      ? formatMoney(shipment.sellerPaidShippingCost)
      : null

  const pkgWeight = formatPackageWeightOzLabel(shipment)
  const pkgDim = formatPackageDimensionsInLabel(shipment)
  const sig =
    typeof shipment.signatureRequired === "boolean" ? (shipment.signatureRequired ? "Yes" : "No") : null
  const insuranceAdded =
    Object.prototype.hasOwnProperty.call(shipment, "insuranceInfo")
      ? hasPositiveInsurance(shipment.insuranceInfo)
        ? "Yes"
        : "No"
      : null
  const hazardous = hazardousMaterialsYesNo(shipment.hazmatLabelType)

  const shipTo = formatShipToMultiline(shipment)
  const trackingCode =
    typeof shipment.trackingCode === "string" && shipment.trackingCode.trim()
      ? shipment.trackingCode.trim()
      : null
  const trackingUrl =
    typeof shipment.trackingUrl === "string" && shipment.trackingUrl.trim()
      ? shipment.trackingUrl.trim()
      : null
  const methodLine =
    typeof shipment.method === "string" && shipment.method.trim() ? humanizeMethod(shipment.method) : null
  const fileUrl = typeof shipment.fileUrl === "string" && shipment.fileUrl.trim() ? shipment.fileUrl.trim() : null
  const bundledFileUrl =
    typeof shipment.bundledFileUrl === "string" && shipment.bundledFileUrl.trim()
      ? shipment.bundledFileUrl.trim()
      : null

  const subtitleParts: string[] = []
  if (qty !== null) {
    subtitleParts.push(`${qty} item${qty === 1 ? "" : "s"}`)
  }
  if (shipmentDisplayId) {
    subtitleParts.push(`#${shipmentDisplayId}`)
  }
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" • ") : null

  const showProductCard =
    Boolean(listingTitle || imageUrl || orderDisplayId || pretty)

  const showShippingActions = Boolean(shipTo || trackingCode || fileUrl || bundledFileUrl)

  const hasDetailRows =
    Boolean(orderDisplayId) ||
    Boolean(detailDate) ||
    Boolean(buyer) ||
    Boolean(sellerPaid) ||
    Boolean(pkgWeight) ||
    Boolean(pkgDim) ||
    sig !== null ||
    insuranceAdded !== null ||
    hazardous !== null

  return (
    <div
      className="max-h-[min(72vh,640px)] min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pb-1 pr-1 [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar]:w-2"
      role="region"
      aria-label="Shipment information"
    >
      <div className="space-y-6 pr-2">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Shipment</h2>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {headerBadge ? (
            <StatusBadge variant="default" className="shrink-0 capitalize">
              {headerBadge}
            </StatusBadge>
          ) : null}
        </div>

        {showProductCard ? (
          <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
            <div className="flex gap-4">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-xl border border-border/60 bg-background object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1 space-y-2">
                {pretty ? (
                  <StatusBadge variant="default" className="text-xs capitalize">
                    {pretty}
                  </StatusBadge>
                ) : null}
                {listingTitle ? <p className="font-semibold leading-snug text-foreground">{listingTitle}</p> : null}
                {orderDisplayId ? (
                  <p className="text-sm text-muted-foreground">
                    Order{" "}
                    <span className="font-semibold text-primary underline decoration-primary/60 underline-offset-2">
                      #{orderDisplayId}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {showShippingActions ? (
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold tracking-tight">Shipping actions</h3>
            <div className="space-y-4 text-sm">
              {shipTo ? (
                <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6">
                  <span className="text-muted-foreground">Ship to</span>
                  <span className="whitespace-pre-line font-medium leading-relaxed text-foreground">{shipTo}</span>
                </div>
              ) : null}
              {trackingCode ? (
                <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6">
                  <span className="text-muted-foreground">Tracking #</span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {trackingUrl ? (
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary underline decoration-primary/60 underline-offset-2 hover:opacity-90"
                      >
                        {trackingCode}
                      </a>
                    ) : (
                      <span className="font-semibold">{trackingCode}</span>
                    )}
                    {methodLine ? (
                      <span className="text-muted-foreground capitalize">{methodLine}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {fileUrl || bundledFileUrl ? (
                <div className="flex w-full flex-col gap-2">
                  {fileUrl ? (
                    <Button variant="default" size="lg" className="h-11 w-full gap-2 rounded-xl font-semibold" asChild>
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                        <Printer className="h-4 w-4" aria-hidden />
                        Print shipping label
                      </a>
                    </Button>
                  ) : null}
                  {bundledFileUrl ? (
                    <Button variant="default" size="lg" className="h-11 w-full gap-2 rounded-xl font-semibold" asChild>
                      <a href={bundledFileUrl} target="_blank" rel="noopener noreferrer">
                        <Printer className="h-4 w-4" aria-hidden />
                        Print packing slip
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {hasDetailRows ? (
          <>
            {showShippingActions ? <Separator className="my-2" /> : null}
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <h3 className="mb-1 text-sm font-semibold tracking-tight">Shipment details</h3>
              <div className="divide-y divide-border/60">
                {orderDisplayId ? (
                  <div className="flex items-start justify-between gap-4 py-3 text-sm">
                    <span className="shrink-0 text-muted-foreground">Orders included</span>
                    <span className="text-right font-semibold text-primary underline decoration-primary/60 underline-offset-2">
                      {orderDisplayId}
                    </span>
                  </div>
                ) : null}
                {detailDate ? (
                  <div className="flex items-start justify-between gap-4 py-3 text-sm">
                    <span className="text-muted-foreground">Order date</span>
                    <span className="text-right font-medium tabular-nums">{detailDate}</span>
                  </div>
                ) : null}
                {buyer ? (
                  <div className="flex items-start justify-between gap-4 py-3 text-sm">
                    <span className="text-muted-foreground">Buyer</span>
                    <span className="text-right font-medium">{buyer}</span>
                  </div>
                ) : null}
                {sellerPaid ? (
                  <div className="flex items-start justify-between gap-4 py-3 text-sm">
                    <span className="text-muted-foreground">Seller paid for shipping</span>
                    <span className="text-right font-medium tabular-nums">{sellerPaid}</span>
                  </div>
                ) : null}
                {pkgWeight ? (
                  <div className="flex items-start justify-between gap-4 py-3 text-sm">
                    <span className="text-muted-foreground">Package weight</span>
                    <span className="text-right font-medium">{pkgWeight}</span>
                  </div>
                ) : null}
                {pkgDim ? (
                  <div className="flex items-start justify-between gap-4 py-3 text-sm">
                    <span className="text-muted-foreground">Package dimensions</span>
                    <span className="text-right font-medium">{pkgDim}</span>
                  </div>
                ) : null}
                {sig !== null ? (
                  <div className="flex items-start justify-between gap-4 py-3 text-sm">
                    <span className="text-muted-foreground">Signature required on delivery</span>
                    <span className="text-right font-medium">{sig}</span>
                  </div>
                ) : null}
                {insuranceAdded !== null ? (
                  <div className="flex items-start justify-between gap-4 py-3 text-sm">
                    <span className="text-muted-foreground">Insurance added</span>
                    <span className="text-right font-medium">{insuranceAdded}</span>
                  </div>
                ) : null}
                {hazardous !== null ? (
                  <div className="flex items-start justify-between gap-4 py-3 text-sm">
                    <span className="text-muted-foreground">Contains hazardous materials</span>
                    <span className="text-right font-medium">{hazardous}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function formatValueFromShipment(shipment: ShipmentNode) {
  const cents = sumOrderSubtotalCents(shipment)
  if (!cents) {
    return "—"
  }
  const items = shipment.orderItems
  const cur =
    Array.isArray(items) && items[0]?.order?.subtotal?.currency
      ? String(items[0].order.subtotal.currency)
      : "USD"
  return formatMoney({ amount: cents, currency: cur })
}

function formatUnixSeconds(seconds: unknown): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return "—"
  }
  const date = new Date(seconds * 1000)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
}

function displayText(value: unknown): string {
  if (value == null || value === "") {
    return "—"
  }
  if (typeof value === "string") {
    return value.trim() || "—"
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }
  return "—"
}

type TikTokManagementRow = {
  id: string
  status: string
  buyer: string
  createdAtLabel: string
  lineCount: number
  totalLabel: string
  fulfillment: string
  shippingType: string
  itemSummary: string
  raw: Record<string, unknown>
}

function mapTikTokManagementRow(order: Record<string, unknown>): TikTokManagementRow {
  const id = typeof order.id === "string" && order.id.trim() ? order.id : "—"
  const status = typeof order.status === "string" ? order.status : "unknown"
  const buyerNickname = typeof order.buyer_nickname === "string" ? order.buyer_nickname : ""
  const userId = typeof order.user_id === "string" ? order.user_id : ""
  const buyer = buyerNickname.trim() || userId || "N/A"
  const lineItems = Array.isArray(order.line_items) ? order.line_items : []
  const firstLine = lineItems[0] && typeof lineItems[0] === "object" ? (lineItems[0] as Record<string, unknown>) : {}
  const payment = order.payment && typeof order.payment === "object" ? (order.payment as Record<string, unknown>) : {}
  const totalRaw = payment.total_amount
  const totalNum = typeof totalRaw === "string" || typeof totalRaw === "number" ? Number(totalRaw) : NaN
  const currency = typeof payment.currency === "string" && payment.currency.trim() ? payment.currency.trim() : "USD"

  return {
    id,
    status,
    buyer,
    createdAtLabel: formatUnixSeconds(order.create_time),
    lineCount: lineItems.length || 0,
    totalLabel: Number.isFinite(totalNum) ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(totalNum) : "—",
    fulfillment:
      typeof order.fulfillment_type === "string" ? order.fulfillment_type.replace(/_/g, " ") : "—",
    shippingType: typeof order.shipping_type === "string" ? order.shipping_type : "—",
    itemSummary:
      (typeof firstLine.product_name === "string" && firstLine.product_name.trim()) ||
      (typeof firstLine.sku_name === "string" && firstLine.sku_name.trim()) ||
      (lineItems.length > 1 ? `${lineItems.length} items` : "—"),
    raw: order,
  }
}

function tiktokStatusVariant(status: string) {
  const normalized = status.trim().toLowerCase()
  if (normalized.includes("deliver") || normalized.includes("complete")) {
    return "success" as const
  }
  if (normalized.includes("cancel") || normalized.includes("return")) {
    return "danger" as const
  }
  if (normalized.includes("await") || normalized.includes("fulfill") || normalized.includes("ship")) {
    return "warning" as const
  }
  return "info" as const
}

function whatnotShipmentVariant(status: string | undefined) {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : ""
  if (normalized.includes("deliver")) {
    return "success" as const
  }
  if (normalized.includes("cancel") || normalized.includes("return")) {
    return "danger" as const
  }
  if (normalized.includes("ship") || normalized.includes("label") || normalized.includes("process")) {
    return "warning" as const
  }
  return "default" as const
}

function ManagementMetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  icon: typeof Activity
}) {
  return (
    <Card className="border-border/60 bg-card/85 shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/90 p-2.5 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border/60 py-2 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium break-words">{value}</span>
    </div>
  )
}

function TikTokOrderManagementDetailBody({ order }: { order: Record<string, unknown> }) {
  const lineItems = Array.isArray(order.line_items) ? order.line_items : []
  const payment = order.payment && typeof order.payment === "object" ? (order.payment as Record<string, unknown>) : null

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Order overview</p>
            <p className="mt-1 text-lg font-semibold">{displayText(order.id)}</p>
          </div>
          <StatusBadge variant={tiktokStatusVariant(displayText(order.status))}>{displayText(order.status)}</StatusBadge>
        </div>
        <DetailRow label="Buyer" value={displayText(order.buyer_nickname) || displayText(order.user_id)} />
        <DetailRow label="Created" value={formatUnixSeconds(order.create_time)} />
        <DetailRow label="Updated" value={formatUnixSeconds(order.update_time)} />
        <DetailRow label="Fulfillment" value={displayText(order.fulfillment_type).replace(/_/g, " ")} />
        <DetailRow label="Shipping type" value={displayText(order.shipping_type)} />
        <DetailRow label="Tracking" value={displayText(order.tracking_number)} />
      </div>

      {payment ? (
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Payment</p>
          <DetailRow label="Currency" value={displayText(payment.currency)} />
          <DetailRow label="Total" value={displayText(payment.total_amount)} />
          <DetailRow label="Subtotal" value={displayText(payment.sub_total)} />
          <DetailRow label="Shipping fee" value={displayText(payment.shipping_fee)} />
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
                <div key={`${displayText(row.id)}-${index}`} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <p className="font-medium">{displayText(row.product_name)}</p>
                  <p className="text-xs text-muted-foreground">{displayText(row.sku_name)}</p>
                  <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                    <span>Seller SKU: {displayText(row.seller_sku)}</span>
                    <span>Quantity: {displayText(row.quantity)}</span>
                    <span>Sale price: {displayText(row.sale_price)}</span>
                    <span>Package status: {displayText(row.package_status)}</span>
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

export default function SellerOrderManagementPage() {
  const { getToken, isLoaded } = useAuth()
  const marketplaceHub = useMarketplaceHub()
  const [activePlatform, setActivePlatform] = useState<"whatnot" | "tiktok">("whatnot")
  const [liveId, setLiveId] = useState("")
  const [statistic, setStatistic] = useState<WhatnotMyLiveStatistic | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [shipmentRows, setShipmentRows] = useState<WhatnotShipmentTableRow[]>([])
  const [shipmentsHint, setShipmentsHint] = useState<string | null>(null)
  const [shipmentsError, setShipmentsError] = useState<string | null>(null)
  const [isShipmentsLoading, setIsShipmentsLoading] = useState(false)
  const [isShipmentsRefreshing, setIsShipmentsRefreshing] = useState(false)
  const [selectedShipment, setSelectedShipment] = useState<ShipmentNode | null>(null)
  const [tiktokShop, setTiktokShop] = useState<TikTokShopOrdersSearchResponse | null>(null)
  const [isTikTokLoading, setIsTikTokLoading] = useState(false)
  const [isTikTokRefreshing, setIsTikTokRefreshing] = useState(false)
  const [tiktokErrorMessage, setTiktokErrorMessage] = useState<string | null>(null)
  const [selectedTikTokOrder, setSelectedTikTokOrder] = useState<Record<string, unknown> | null>(null)
  const [selectedTikTokOrderDetail, setSelectedTikTokOrderDetail] = useState<Record<string, unknown> | null>(null)
  const [isTikTokDetailLoading, setIsTikTokDetailLoading] = useState(false)
  /** After auto Live ID from GetShipmentsLivestreams, hide the ID field unless the seller chooses to edit. */
  const [liveIdEditorOpen, setLiveIdEditorOpen] = useState(true)

  useEffect(() => {
    const forcedPlatform = marketplaceHub?.hub === "whatnot" || marketplaceHub?.hub === "tiktok" ? marketplaceHub.hub : null
    if (forcedPlatform) {
      setActivePlatform(forcedPlatform)
    }
  }, [marketplaceHub?.hub])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const storedLive = window.sessionStorage.getItem(LIVE_ID_STORAGE_KEY)
    if (storedLive) {
      setLiveId(storedLive)
    }
  }, [])

  const loadStats = useCallback(
    async (
      isManualRefresh: boolean,
      liveIdOverride?: string,
    ): Promise<{ statistic: WhatnotMyLiveStatistic | null } | null> => {
      if (!isLoaded) {
        return null
      }

      const trimmed = String(liveIdOverride !== undefined ? liveIdOverride : liveId).trim()
      if (!trimmed) {
        setErrorMessage(
          "Enter a live show ID (liveId). You can copy it from the Whatnot shipments URL or network payload.",
        )
        setStatistic(null)
        return null
      }

      if (isManualRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      setErrorMessage(null)

      try {
        const token = await waitForSessionToken(getToken)
        const result = await fetchWhatnotMyLiveStats(token, trimmed)
        setStatistic(result.statistic)
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(LIVE_ID_STORAGE_KEY, trimmed)
        }
        return { statistic: result.statistic }
      } catch (error) {
        const message =
          error instanceof AuthApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to load live stats."
        setErrorMessage(message)
        setStatistic(null)
        return null
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [getToken, isLoaded, liveId],
  )

  const loadShipments = useCallback(
    async (isManualRefresh: boolean, manifestUrlsOverride?: string[], liveIdOverride?: string) => {
      if (!isLoaded) {
        return
      }

      if (isManualRefresh) {
        setIsShipmentsRefreshing(true)
      } else {
        setIsShipmentsLoading(true)
      }
      setShipmentsError(null)
      setShipmentsHint(null)

      try {
        const token = await waitForSessionToken(getToken)
        if (isManualRefresh) {
          await syncWhatnotOrders(token).catch(() => null)
        }

        const body: { liveId?: string; manifestUrls?: string[]; forceRefresh?: boolean } = {
          forceRefresh: isManualRefresh,
        }
        const fromOverride =
          liveIdOverride !== undefined && liveIdOverride !== null ? String(liveIdOverride).trim() : null
        const trimmedLive =
          fromOverride !== null && fromOverride !== "" ? fromOverride : liveId.trim()
        if (trimmedLive) {
          body.liveId = trimmedLive
        }
        const urls =
          manifestUrlsOverride !== undefined
            ? manifestUrlsOverride
            : Array.isArray(statistic?.manifestUrls)
              ? statistic.manifestUrls
              : undefined
        if (Array.isArray(urls) && urls.length) {
          body.manifestUrls = urls
        }

        const result = await fetchWhatnotShipmentsTable(token, body)
        setShipmentRows(result.rows || [])
        if (result.hint) {
          setShipmentsHint(result.hint)
        } else if (!isManualRefresh && result.fromCache) {
          setShipmentsHint("Showing cached shipments. Click Refresh shipments to fetch latest Whatnot data.")
        }
      } catch (error) {
        const message =
          error instanceof AuthApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to load shipments."
        setShipmentsError(message)
        setShipmentRows([])
      } finally {
        setIsShipmentsLoading(false)
        setIsShipmentsRefreshing(false)
      }
    },
    [getToken, isLoaded, liveId, statistic],
  )

  const loadTikTokOrders = useCallback(
    async (isManualRefresh: boolean) => {
      if (!isLoaded) {
        return
      }

      if (isManualRefresh) {
        setIsTikTokRefreshing(true)
      } else {
        setIsTikTokLoading(true)
      }

      try {
        setTiktokErrorMessage(null)
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
              : "Unable to load TikTok Shop operations."
        setTiktokErrorMessage(message)
        setTiktokShop(null)
      } finally {
        setIsTikTokLoading(false)
        setIsTikTokRefreshing(false)
      }
    },
    [getToken, isLoaded],
  )

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    let cancelled = false

    async function resolveLiveIdAndLoadStats() {
      try {
        const token = await waitForSessionToken(getToken)
        const resolved = await getWhatnotShipmentsLivestreamsCurrentLiveId(token)
        const id = typeof resolved.liveId === "string" ? resolved.liveId.trim() : ""
        if (!id || cancelled) {
          return
        }
        setLiveId(id)
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(LIVE_ID_STORAGE_KEY, id)
        }
        const statsOutcome = await loadStats(false, id)
        if (!cancelled) {
          setLiveIdEditorOpen(false)
        }
        const manifestUrls =
          statsOutcome?.statistic && Array.isArray(statsOutcome.statistic.manifestUrls)
            ? statsOutcome.statistic.manifestUrls
            : undefined
        if (!cancelled) {
          await loadShipments(false, manifestUrls, id)
        }
      } catch {
        /* Extension offline / not connected — seller can paste Live ID and use Load stats */
      }
    }

    void resolveLiveIdAndLoadStats()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on session ready; avoid re-running when loadStats/loadShipments identities change
  }, [isLoaded, getToken])

  useEffect(() => {
    if (!isLoaded || !liveId.trim()) {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadStats(true).then((out) =>
        void loadShipments(false, out?.statistic?.manifestUrls),
      )
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [isLoaded, liveId, loadStats, loadShipments])

  useEffect(() => {
    if (!isLoaded || marketplaceHub?.hub === "whatnot" || activePlatform !== "tiktok") {
      return
    }

    void loadTikTokOrders(false)

    const intervalId = window.setInterval(() => {
      void loadTikTokOrders(true)
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [activePlatform, isLoaded, loadTikTokOrders, marketplaceHub?.hub])

  const cards = useMemo(() => {
    if (!statistic) {
      return []
    }

    return [
      { label: "Sales", value: formatMoney(statistic.totalSales) },
      { label: "Estimated earnings", value: formatMoney(statistic.totalEarnings) },
      { label: "Completed earnings", value: formatMoney(statistic.totalEarned) },
      { label: "Shipping spend", value: formatMoney(statistic.totalShippingSpend) },
      {
        label: "Items sold",
        value:
          typeof statistic.totalCount === "number" && Number.isFinite(statistic.totalCount)
            ? String(statistic.totalCount)
            : "—",
      },
      {
        label: "Pending delivery",
        value:
          typeof statistic.pendingShipments === "number" && Number.isFinite(statistic.pendingShipments)
            ? String(statistic.pendingShipments)
            : "—",
      },
      {
        label: "Total delivered",
        value:
          typeof statistic.deliveredShipments === "number" && Number.isFinite(statistic.deliveredShipments)
            ? String(statistic.deliveredShipments)
            : "—",
      },
    ]
  }, [statistic])

  const tiktokRows = useMemo(() => (tiktokShop?.orders ?? []).map(mapTikTokManagementRow), [tiktokShop])

  const tiktokPageTotal = useMemo(() => {
    let sum = 0
    let currency = ""
    for (const row of tiktokRows) {
      const payment =
        row.raw.payment && typeof row.raw.payment === "object"
          ? (row.raw.payment as Record<string, unknown>)
          : {}
      const totalRaw = payment.total_amount
      const nextCurrency = typeof payment.currency === "string" ? payment.currency.trim() : ""
      const parsed = typeof totalRaw === "string" || typeof totalRaw === "number" ? Number(totalRaw) : NaN
      if (!Number.isFinite(parsed)) {
        continue
      }
      if (!currency) {
        currency = nextCurrency || "USD"
      }
      if (nextCurrency && currency && nextCurrency !== currency) {
        return { amount: null as number | null, currency: "" }
      }
      sum += parsed
    }
    return { amount: tiktokRows.length ? sum : null, currency: currency || "USD" }
  }, [tiktokRows])

  const tiktokQueueCount = useMemo(() => {
    return tiktokRows.filter((row) => /await|fulfill|ship/i.test(row.status)).length
  }, [tiktokRows])

  const tiktokBuyerCount = useMemo(() => {
    return new Set(tiktokRows.map((row) => row.buyer).filter((value) => value && value !== "N/A")).size
  }, [tiktokRows])

  const tiktokDemoMode = Boolean(tiktokShop?.isMockData)

  useEffect(() => {
    let cancelled = false

    async function loadTikTokDetail() {
      if (!selectedTikTokOrder || !tiktokShop || tiktokShop.isMockData) {
        setSelectedTikTokOrderDetail(null)
        setIsTikTokDetailLoading(false)
        return
      }

      try {
        setIsTikTokDetailLoading(true)
        const token = await waitForSessionToken(getToken)
        const detail = await getTikTokShopOrderDetail(token, displayText(selectedTikTokOrder.id))
        if (!cancelled) {
          setSelectedTikTokOrderDetail(detail.order && typeof detail.order === "object" ? detail.order as Record<string, unknown> : null)
        }
      } catch {
        if (!cancelled) {
          setSelectedTikTokOrderDetail(null)
        }
      } finally {
        if (!cancelled) {
          setIsTikTokDetailLoading(false)
        }
      }
    }

    void loadTikTokDetail()

    return () => {
      cancelled = true
    }
  }, [getToken, selectedTikTokOrder, tiktokShop])

  if (!isLoaded) {
    return null
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order Management"
        // description="Operational management for marketplace orders. Switch platforms to work shipments, monitor live sales, or review TikTok Shop order queues."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={activePlatform === "whatnot" ? isRefreshing || !liveId.trim() : isTikTokRefreshing}
            onClick={() => {
              if (activePlatform === "whatnot") {
                void loadStats(true).then((out) =>
                  void loadShipments(false, out?.statistic?.manifestUrls),
                )
                return
              }
              void loadTikTokOrders(true)
            }}
          >
            <RefreshCw className={`h-4 w-4 ${(activePlatform === "whatnot" ? isRefreshing : isTikTokRefreshing) ? "animate-spin" : ""}`} />
            {activePlatform === "whatnot" ? "Refresh stats" : "Refresh TikTok"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={isShipmentsRefreshing || !liveId.trim()}
            onClick={() => void loadShipments(true)}
          >
            <RefreshCw className={`h-4 w-4 ${isShipmentsRefreshing ? "animate-spin" : ""}`} />
            Refresh shipments
          </Button>
        </div>
      </PageHeader>

            <div className="space-y-5">
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Platform workspaces</h3>
                  <p className="text-sm text-muted-foreground">Use the same marketplace switch from inventory management to focus this workspace on Whatnot or TikTok.</p>
          </div>
                <MarketplacePlatformSwitch
                  value={activePlatform}
                  onValueChange={(value: MarketplacePlatform) => setActivePlatform(value as "whatnot" | "tiktok")}
                  ariaLabel="Order management platform"
                  whatnotLabel="Whatnot Management"
                  tiktokLabel="TikTok Management"
                  idPrefix="order-management-platform"
                  className={marketplaceHub?.hub === "whatnot" || marketplaceHub?.hub === "tiktok" ? "hidden" : undefined}
                />
        </div>

              {activePlatform === "whatnot" ? (
                <div className="space-y-5">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-lg">Whatnot live show context</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">This section powers shipment operations using extension-fed live stats and shipment payloads.</p>
              </div>
              <Badge variant="secondary" className="w-fit bg-sky-100 text-sky-900 hover:bg-sky-100">Extension workflow</Badge>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {!liveIdEditorOpen && liveId.trim() ? (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Resolved live id</p>
                  <p className="mt-2 font-mono text-sm text-foreground">{liveId}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Filled automatically from the Whatnot extension and reused for stats and shipment matching.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                  When the extension is connected, the Live ID is resolved automatically. If it is unavailable, you can re-enable the manual input flow later without changing this dashboard layout.
                </div>
              )}

              {errorMessage ? (
                <Card className="border-destructive/30 bg-destructive/10">
                  <CardContent className="p-4 text-sm text-destructive">{errorMessage}</CardContent>
                </Card>
              ) : null}

              {isLoading && !statistic ? (
                <div className="flex min-h-[16vh] items-center justify-center text-sm text-muted-foreground">
                  <Spinner className="mr-2 h-4 w-4" />
                  Loading Whatnot live stats…
                </div>
              ) : null}

              {cards.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {cards.map((card) => (
                    <Card key={card.label} className="border-border/60 shadow-none">
                      <CardContent className="p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{card.label}</p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight">{card.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-lg">Whatnot shipments</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Packaging, labels, and tracking information aligned to the current live show.</p>
              </div>
              <Badge variant="outline">Shipment table</Badge>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground">
                Shipments sync automatically from synced orders and Whatnot shipment data via the extension. Use refresh shipments to pull the latest snapshot.
              </p>

              {isShipmentsLoading && shipmentRows.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-4 w-4" />
                  Loading shipments…
                </div>
              ) : null}

              {shipmentsError ? <p className="text-sm text-destructive">{shipmentsError}</p> : null}
              {shipmentsHint ? <p className="text-sm text-muted-foreground">{shipmentsHint}</p> : null}

              {shipmentRows.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="px-4 py-3">Recipient</TableHead>
                        <TableHead className="px-4 py-3">Order date</TableHead>
                        <TableHead className="px-4 py-3">Items</TableHead>
                        <TableHead className="px-4 py-3">Value</TableHead>
                        <TableHead className="px-4 py-3">Weight</TableHead>
                        <TableHead className="px-4 py-3">Dimensions</TableHead>
                        <TableHead className="px-4 py-3">Status</TableHead>
                        <TableHead className="px-4 py-3">Tracking</TableHead>
                        <TableHead className="px-4 py-3 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shipmentRows.map((row) => {
                        if (row.error || !row.shipment) {
                          return (
                            <TableRow key={row.shipmentId}>
                              <TableCell colSpan={9} className="px-4 py-3 text-sm text-destructive">
                                {row.shipmentId}: {row.error || "No data"}
                              </TableCell>
                            </TableRow>
                          )
                        }

                        const shipment = row.shipment as ShipmentNode
                        const username = shipment.buyer && typeof shipment.buyer.username === "string" ? shipment.buyer.username : "—"
                        const trackingUrl = typeof shipment.trackingUrl === "string" ? shipment.trackingUrl : ""
                        const code = typeof shipment.trackingCode === "string" ? shipment.trackingCode : ""
                        const shortCode = code.length > 12 ? `${code.slice(0, 5)}…${code.slice(-4)}` : code

                        return (
                          <TableRow key={row.shipmentId}>
                            <TableCell className="px-4 py-4 font-medium">{username}</TableCell>
                            <TableCell className="px-4 py-4">{formatShipmentTableDate(firstOrderItemCreatedAt(shipment))}</TableCell>
                            <TableCell className="px-4 py-4">{typeof shipment.totalItemQuantity === "number" ? shipment.totalItemQuantity : "—"}</TableCell>
                            <TableCell className="px-4 py-4">{formatValueFromShipment(shipment)}</TableCell>
                            <TableCell className="px-4 py-4">{formatWeight(shipment)}</TableCell>
                            <TableCell className="px-4 py-4">{formatDimensions(shipment)}</TableCell>
                            <TableCell className="px-4 py-4">
                              <StatusBadge variant={whatnotShipmentVariant(shipment.status)}>{humanizeStatus(shipment.status)}</StatusBadge>
                            </TableCell>
                            <TableCell className="px-4 py-4">
                              <div className="flex flex-col gap-0.5 text-sm">
                                <span className="text-muted-foreground">{humanizeMethod(shipment.method)}</span>
                                {trackingUrl && code ? (
                                  <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                    {shortCode}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span>{code || "—"}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-4 text-right">
                              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setSelectedShipment(shipment)}>
                                Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              {!isLoading && !errorMessage && liveId.trim() && !statistic ? (
                <p className="text-sm text-muted-foreground">No statistic returned for this liveId.</p>
              ) : null}
            </CardContent>
          </Card>
          </div>
        ) : null}

        {activePlatform === "tiktok" ? (
          <div className="space-y-5">
        

          {tiktokErrorMessage ? (
            <Card className="border-destructive/30 bg-destructive/10">
              <CardContent className="p-4 text-sm text-destructive">{tiktokErrorMessage}</CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60 shadow-sm"><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Matches</p><p className="mt-3 text-3xl font-semibold tracking-tight">{tiktokShop ? tiktokShop.totalCount : "—"}</p><p className="mt-2 text-sm text-muted-foreground">Partner API search results in the active queue.</p></CardContent></Card>
            <Card className="border-border/60 shadow-sm"><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Fulfillment queue</p><p className="mt-3 text-3xl font-semibold tracking-tight">{tiktokQueueCount}</p><p className="mt-2 text-sm text-muted-foreground">Orders still moving through shipment workflow.</p></CardContent></Card>
            <Card className="border-border/60 shadow-sm"><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Buyers</p><p className="mt-3 text-3xl font-semibold tracking-tight">{tiktokBuyerCount}</p><p className="mt-2 text-sm text-muted-foreground">Distinct buyers in the visible TikTok queue.</p></CardContent></Card>
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-lg">TikTok Shop queue</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">A platform-specific operational table for Partner API orders, separated from the Whatnot shipment flow.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Partner API</Badge>
                <Badge variant={tiktokDemoMode ? "secondary" : "default"}>{tiktokDemoMode ? "Mock Data" : "Live shop"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {isTikTokLoading && tiktokRows.length === 0 ? (
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
                          <TableCell className="max-w-[240px] truncate px-4 py-4" title={row.itemSummary}>{row.itemSummary}</TableCell>
                          <TableCell className="px-4 py-4">{row.totalLabel}</TableCell>
                          <TableCell className="px-4 py-4"><StatusBadge variant={tiktokStatusVariant(row.status)}>{row.status}</StatusBadge></TableCell>
                          <TableCell className="px-4 py-4 text-xs uppercase tracking-wide text-muted-foreground">{row.shippingType}</TableCell>
                          <TableCell className="px-4 py-4 text-right">
                            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setSelectedTikTokOrder(row.raw)}>
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </CardContent>
          </Card>
          </div>
        ) : null}
      </div>

      <Dialog open={selectedShipment !== null} onOpenChange={(open) => !open && setSelectedShipment(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden border-border/80 p-0 sm:max-w-[520px]">
          <DialogHeader className="sr-only">
            <DialogTitle>Shipment details</DialogTitle>
          </DialogHeader>
          {selectedShipment ? (
            <div className="min-h-0 flex-1 px-6 pb-6 pt-5">
              <ShipmentDetailsPanel shipment={selectedShipment} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedTikTokOrder !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTikTokOrder(null)
            setSelectedTikTokOrderDetail(null)
            setIsTikTokDetailLoading(false)
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span>TikTok Shop order {displayText(selectedTikTokOrder?.id)}</span>
              {tiktokDemoMode ? <Badge variant="secondary">Demo sample</Badge> : null}
            </DialogTitle>
          </DialogHeader>

          {isTikTokDetailLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" />
              Loading full order payload…
            </div>
          ) : null}

          {selectedTikTokOrder ? (
            <TikTokOrderManagementDetailBody order={(selectedTikTokOrderDetail ?? selectedTikTokOrder) as Record<string, unknown>} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
