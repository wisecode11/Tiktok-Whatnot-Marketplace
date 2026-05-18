"use client"

import { useState } from "react"
import { ExternalLink, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/ui/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export type WhatnotShipmentNode = Record<string, unknown> & {
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

function sumOrderSubtotalCents(shipment: WhatnotShipmentNode): number {
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

function firstOrderItemCreatedAt(shipment: WhatnotShipmentNode): string | null {
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

function formatWeight(shipment: WhatnotShipmentNode) {
  const w = shipment.weight
  if (!w || typeof w.amount !== "number" || !Number.isFinite(w.amount)) {
    return "—"
  }
  const scale = typeof w.scale === "string" && w.scale.trim() ? w.scale : ""
  return scale ? `${w.amount} ${scale}` : String(w.amount)
}

function formatDimensions(shipment: WhatnotShipmentNode) {
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

function formatPackageWeightOzLabel(shipment: WhatnotShipmentNode): string | null {
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

function formatPackageDimensionsInLabel(shipment: WhatnotShipmentNode): string | null {
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

function formatShipToMultiline(shipment: WhatnotShipmentNode): string | null {
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

function getFirstOrderItemNode(shipment: WhatnotShipmentNode) {
  const items = shipment.orderItems
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }
  return items[0]
}

function getShipmentHeaderMeta(shipment: WhatnotShipmentNode) {
  const first = getFirstOrderItemNode(shipment)
  const order = first?.order
  const shipmentDisplayId = extractGlobalIdTail(shipment.id)
  const qty =
    typeof shipment.totalItemQuantity === "number" && Number.isFinite(shipment.totalItemQuantity)
      ? shipment.totalItemQuantity
      : null
  const pretty = typeof order?.prettyStatus === "string" && order.prettyStatus.trim() ? order.prettyStatus.trim() : null
  const shipStatus = typeof shipment.status === "string" && shipment.status.trim() ? shipment.status.trim() : null
  const headerBadge = pretty ?? (shipStatus ? humanizeStatus(shipStatus) : null)
  const subtitleParts: string[] = []
  if (qty !== null) {
    subtitleParts.push(`${qty} item${qty === 1 ? "" : "s"}`)
  }
  if (shipmentDisplayId) {
    subtitleParts.push(`#${shipmentDisplayId}`)
  }
  return {
    first,
    order,
    listing: first?.listing,
    orderDisplayId: extractGlobalIdTail(order?.id),
    shipmentDisplayId,
    qty,
    pretty,
    shipStatus,
    headerBadge,
    subtitle: subtitleParts.length > 0 ? subtitleParts.join(" • ") : null,
    detailDate: formatDetailDateDdMmYyyy(firstOrderItemCreatedAt(shipment)),
    buyer:
      shipment.buyer && typeof shipment.buyer.username === "string" && shipment.buyer.username.trim()
        ? shipment.buyer.username.trim()
        : null,
  }
}

function ShipmentPanelScroll({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="max-h-[min(72vh,640px)] min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pb-1 pr-1 [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-2"
      role="region"
    >
      <div className="space-y-6 pr-2">{children}</div>
    </div>
  )
}

function ShipmentPanelHeader({
  title,
  subtitle,
  headerBadge,
}: {
  title: string
  subtitle: string | null
  headerBadge: string | null
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {headerBadge ? (
        <StatusBadge variant="default" className="shrink-0 capitalize">
          {headerBadge}
        </StatusBadge>
      ) : null}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

export function WhatnotShipmentPackingPanel({ shipment }: { shipment: WhatnotShipmentNode }) {
  const meta = getShipmentHeaderMeta(shipment)
  const listingTitle =
    typeof meta.listing?.title === "string" && meta.listing.title.trim() ? meta.listing.title.trim() : null
  const imageUrl =
    Array.isArray(meta.listing?.images) &&
    meta.listing.images[0] &&
    typeof meta.listing.images[0]?.url === "string" &&
    meta.listing.images[0].url.trim()
      ? meta.listing.images[0].url.trim()
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
  const sellerPaid =
    shipment.sellerPaidShippingCost &&
    typeof shipment.sellerPaidShippingCost.amount === "number" &&
    Number.isFinite(shipment.sellerPaidShippingCost.amount)
      ? formatMoney(shipment.sellerPaidShippingCost)
      : null

  const orderItems = Array.isArray(shipment.orderItems) ? shipment.orderItems : []

  return (
    <ShipmentPanelScroll>
      <ShipmentPanelHeader title="Packing details" subtitle={meta.subtitle} headerBadge={meta.headerBadge} />

      {listingTitle || imageUrl || meta.orderDisplayId ? (
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
              {listingTitle ? <p className="font-semibold leading-snug text-foreground">{listingTitle}</p> : null}
              {meta.orderDisplayId ? (
                <p className="text-sm text-muted-foreground">
                  Order{" "}
                  <span className="font-semibold text-primary">#{meta.orderDisplayId}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {orderItems.length > 0 ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold tracking-tight">Items to pack</h3>
          <ul className="divide-y divide-border/60 text-sm">
            {orderItems.map((item, index) => {
              const title =
                typeof item?.listing?.title === "string" && item.listing.title.trim()
                  ? item.listing.title.trim()
                  : "Untitled item"
              const itemQty = typeof item?.quantity === "number" ? item.quantity : 1
              return (
                <li key={`${title}-${index}`} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="font-medium">{title}</span>
                  <span className="tabular-nums text-muted-foreground">×{itemQty}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold tracking-tight">Package information</h3>
        <div className="divide-y divide-border/60">
          {meta.orderDisplayId ? (
            <DetailRow label="Order" value={`#${meta.orderDisplayId}`} />
          ) : null}
          {meta.detailDate ? <DetailRow label="Order date" value={meta.detailDate} /> : null}
          {meta.buyer ? <DetailRow label="Buyer" value={meta.buyer} /> : null}
          {pkgWeight ? <DetailRow label="Package weight" value={pkgWeight} /> : null}
          {pkgDim ? <DetailRow label="Package dimensions" value={pkgDim} /> : null}
          {sig !== null ? <DetailRow label="Signature required" value={sig} /> : null}
          {insuranceAdded !== null ? <DetailRow label="Insurance added" value={insuranceAdded} /> : null}
          {hazardous !== null ? <DetailRow label="Hazardous materials" value={hazardous} /> : null}
          {sellerPaid ? <DetailRow label="Seller paid shipping" value={sellerPaid} /> : null}
          {meta.qty !== null ? <DetailRow label="Total items" value={String(meta.qty)} /> : null}
        </div>
      </div>
    </ShipmentPanelScroll>
  )
}

export function WhatnotShipmentLabellingPanel({ shipment }: { shipment: WhatnotShipmentNode }) {
  const meta = getShipmentHeaderMeta(shipment)
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
  const courier =
    typeof (shipment as { courier?: string }).courier === "string" &&
    (shipment as { courier?: string }).courier?.trim()
      ? String((shipment as { courier?: string }).courier).trim()
      : null
  const fileUrl = typeof shipment.fileUrl === "string" && shipment.fileUrl.trim() ? shipment.fileUrl.trim() : null
  const bundledFileUrl =
    typeof shipment.bundledFileUrl === "string" && shipment.bundledFileUrl.trim()
      ? shipment.bundledFileUrl.trim()
      : null
  const canGenerateLabel =
    typeof (shipment as { canGenerateLabel?: boolean }).canGenerateLabel === "boolean"
      ? (shipment as { canGenerateLabel?: boolean }).canGenerateLabel
      : null

  const labelStatus = meta.pretty ?? (meta.shipStatus ? humanizeStatus(meta.shipStatus) : null)

  return (
    <ShipmentPanelScroll>
      <ShipmentPanelHeader title="Labelling details" subtitle={meta.subtitle} headerBadge={labelStatus} />

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold tracking-tight">Shipping &amp; label</h3>
        <div className="divide-y divide-border/60 text-sm">
          {labelStatus ? <DetailRow label="Label status" value={labelStatus} /> : null}
          {courier ? <DetailRow label="Carrier" value={courier} /> : null}
          {methodLine && methodLine !== "—" ? <DetailRow label="Shipping method" value={methodLine} /> : null}
          {canGenerateLabel !== null ? (
            <DetailRow label="Can generate label" value={canGenerateLabel ? "Yes" : "No"} />
          ) : null}
          {meta.buyer ? <DetailRow label="Buyer" value={meta.buyer} /> : null}
        </div>
      </div>

      {shipTo || trackingCode || fileUrl || bundledFileUrl ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold tracking-tight">Ship to &amp; tracking</h3>
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
                      className="font-semibold text-primary underline decoration-primary/60 underline-offset-2"
                    >
                      {trackingCode}
                    </a>
                  ) : (
                    <span className="font-semibold">{trackingCode}</span>
                  )}
                </div>
              </div>
            ) : null}
            {fileUrl || bundledFileUrl ? (
              <div className="flex w-full flex-col gap-2 pt-1">
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
    </ShipmentPanelScroll>
  )
}

function ShipmentDetailsPanel({ shipment }: { shipment: WhatnotShipmentNode }) {
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
function formatValueFromShipment(shipment: WhatnotShipmentNode) {
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

export type WhatnotShipmentTableRow = {
  rowKey: string
  shipment: WhatnotShipmentNode | null
  error?: string | null
}

export type WhatnotShipmentsTableVariant = "full" | "packing" | "labelling"

function getLabelStatusForTable(shipment: WhatnotShipmentNode) {
  const meta = getShipmentHeaderMeta(shipment)
  return meta.pretty ?? (meta.shipStatus ? humanizeStatus(meta.shipStatus) : "—")
}

export function WhatnotShipmentDetailsPanel({ shipment }: { shipment: WhatnotShipmentNode }) {
  return <ShipmentDetailsPanel shipment={shipment} />
}

export function WhatnotShipmentsTableSection({
  rows,
  emptyMessage = "No shipments found.",
  variant = "full",
}: {
  rows: WhatnotShipmentTableRow[]
  emptyMessage?: string
  variant?: WhatnotShipmentsTableVariant
}) {
  const [selectedShipment, setSelectedShipment] = useState<WhatnotShipmentNode | null>(null)
  const columnCount = variant === "full" ? 9 : 8
  const dialogTitle =
    variant === "packing" ? "Packing details" : variant === "labelling" ? "Labelling details" : "Shipment details"

  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-4 py-3">Recipient</TableHead>
              <TableHead className="px-4 py-3">Order date</TableHead>
              <TableHead className="px-4 py-3">Items</TableHead>
              <TableHead className="px-4 py-3">Value</TableHead>
              {variant === "packing" || variant === "full" ? (
                <>
                  <TableHead className="px-4 py-3">Weight</TableHead>
                  <TableHead className="px-4 py-3">Dimensions</TableHead>
                </>
              ) : null}
              {variant === "labelling" ? (
                <>
                  <TableHead className="px-4 py-3">Label status</TableHead>
                  <TableHead className="px-4 py-3">Carrier</TableHead>
                </>
              ) : null}
              {variant === "full" ? (
                <>
                  <TableHead className="px-4 py-3">Status</TableHead>
                  <TableHead className="px-4 py-3">Tracking</TableHead>
                </>
              ) : null}
              {variant === "packing" ? <TableHead className="px-4 py-3">Pack status</TableHead> : null}
              {variant === "labelling" ? <TableHead className="px-4 py-3">Tracking</TableHead> : null}
              <TableHead className="px-4 py-3 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              if (row.error || !row.shipment) {
                return (
                  <TableRow key={row.rowKey}>
                    <TableCell colSpan={columnCount} className="px-4 py-3 text-sm text-destructive">
                      {row.rowKey}: {row.error || "No data"}
                    </TableCell>
                  </TableRow>
                )
              }

              const shipment = row.shipment
              const username =
                shipment.buyer && typeof shipment.buyer.username === "string" ? shipment.buyer.username : "—"
              const trackingUrl = typeof shipment.trackingUrl === "string" ? shipment.trackingUrl : ""
              const code = typeof shipment.trackingCode === "string" ? shipment.trackingCode : ""
              const shortCode = code.length > 12 ? `${code.slice(0, 5)}…${code.slice(-4)}` : code
              const courier =
                typeof (shipment as { courier?: string }).courier === "string" &&
                (shipment as { courier?: string }).courier?.trim()
                  ? String((shipment as { courier?: string }).courier).trim()
                  : "—"
              const actionLabel =
                variant === "packing" ? "Packing" : variant === "labelling" ? "Labels" : "Details"

              return (
                <TableRow key={row.rowKey}>
                  <TableCell className="px-4 py-4 font-medium">{username}</TableCell>
                  <TableCell className="px-4 py-4">{formatShipmentTableDate(firstOrderItemCreatedAt(shipment))}</TableCell>
                  <TableCell className="px-4 py-4">
                    {typeof shipment.totalItemQuantity === "number" ? shipment.totalItemQuantity : "—"}
                  </TableCell>
                  <TableCell className="px-4 py-4">{formatValueFromShipment(shipment)}</TableCell>
                  {variant === "packing" || variant === "full" ? (
                    <>
                      <TableCell className="px-4 py-4">{formatWeight(shipment)}</TableCell>
                      <TableCell className="px-4 py-4">{formatDimensions(shipment)}</TableCell>
                    </>
                  ) : null}
                  {variant === "labelling" ? (
                    <>
                      <TableCell className="px-4 py-4">
                        <StatusBadge variant={whatnotShipmentVariant(shipment.status)} className="capitalize">
                          {getLabelStatusForTable(shipment)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="px-4 py-4 capitalize">{courier}</TableCell>
                    </>
                  ) : null}
                  {variant === "full" ? (
                    <>
                      <TableCell className="px-4 py-4">
                        <StatusBadge variant={whatnotShipmentVariant(shipment.status)}>
                          {humanizeStatus(shipment.status)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="flex flex-col gap-0.5 text-sm">
                          <span className="text-muted-foreground">{humanizeMethod(shipment.method)}</span>
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
                    </>
                  ) : null}
                  {variant === "packing" ? (
                    <TableCell className="px-4 py-4">
                      <StatusBadge variant={whatnotShipmentVariant(shipment.status)} className="capitalize">
                        {humanizeStatus(shipment.status)}
                      </StatusBadge>
                    </TableCell>
                  ) : null}
                  {variant === "labelling" ? (
                    <TableCell className="px-4 py-4">
                      <div className="flex flex-col gap-0.5 text-sm">
                        <span className="text-muted-foreground">{humanizeMethod(shipment.method)}</span>
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
                  ) : null}
                  <TableCell className="px-4 py-4 text-right">
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setSelectedShipment(shipment)}>
                      {actionLabel}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={selectedShipment !== null} onOpenChange={(open) => !open && setSelectedShipment(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden border-border/80 p-0 sm:max-w-[520px]">
          <DialogHeader className="sr-only">
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          {selectedShipment ? (
            <div className="min-h-0 flex-1 px-6 pb-6 pt-5">
              {variant === "packing" ? (
                <WhatnotShipmentPackingPanel shipment={selectedShipment} />
              ) : variant === "labelling" ? (
                <WhatnotShipmentLabellingPanel shipment={selectedShipment} />
              ) : (
                <WhatnotShipmentDetailsPanel shipment={selectedShipment} />
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
