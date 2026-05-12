"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useAuth } from "@clerk/nextjs"
import { Activity, Info, PackageSearch, RefreshCw, ShoppingBag, Store, Truck, Wallet } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AuthApiError,
  getTikTokShopOrderDetail,
  getWhatnotOrders,
  searchTikTokShopOrders,
  syncWhatnotOrders,
  type TikTokShopOrdersSearchResponse,
  type WhatnotOrderItem,
  waitForSessionToken,
} from "@/lib/auth"

function formatDate(value: string | null) {
  if (!value) {
    return "N/A"
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString()
}

function formatUnixSeconds(seconds: unknown): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return "N/A"
  }
  const date = new Date(seconds * 1000)
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString()
}

function toCurrency(amount: number | null, currency = "USD") {
  if (amount == null || !Number.isFinite(amount)) {
    return "N/A"
  }

  const code = currency || "USD"
  return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(amount)
}

function displayText(v: unknown): string {
  if (v == null || v === "") {
    return "—"
  }
  if (typeof v === "string") {
    return v.trim() || "—"
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(v)
  }
  if (typeof v === "boolean") {
    return v ? "Yes" : "No"
  }
  return "—"
}

function humanizeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function DetailLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-border/50 py-2 last:border-b-0 sm:grid-cols-[minmax(7.5rem,10rem)_1fr] sm:gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0 break-words font-medium">{children}</div>
    </div>
  )
}

const TIKTOK_PAYMENT_MONEY_KEYS = new Set([
  "total_amount",
  "sub_total",
  "original_total_product_price",
  "shipping_fee",
  "original_shipping_fee",
  "tax",
  "product_tax",
  "shipping_fee_tax",
  "seller_discount",
  "platform_discount",
  "payment_platform_discount",
  "payment_discount_service_fee",
  "small_order_fee",
  "handling_fee",
  "buyer_service_fee",
  "shipping_insurance_fee",
  "item_insurance_fee",
  "item_insurance_tax",
  "distance_shipping_fee",
  "distance_fee",
  "retail_delivery_fee",
  "shipping_fee_seller_discount",
  "shipping_fee_platform_discount",
  "shipping_fee_cofunded_discount",
  "pfand_fee",
])

const TIKTOK_PAYMENT_FIELD_ORDER = [
  "currency",
  "total_amount",
  "sub_total",
  "original_total_product_price",
  "shipping_fee",
  "original_shipping_fee",
  "tax",
  "product_tax",
  "shipping_fee_tax",
  "seller_discount",
  "platform_discount",
  "payment_platform_discount",
  "payment_discount_service_fee",
  "small_order_fee",
  "handling_fee",
  "buyer_service_fee",
  "shipping_insurance_fee",
  "item_insurance_fee",
  "item_insurance_tax",
  "distance_shipping_fee",
  "distance_fee",
  "retail_delivery_fee",
  "shipping_fee_seller_discount",
  "shipping_fee_platform_discount",
  "shipping_fee_cofunded_discount",
] as const

function TiktokPaymentBreakdown({ payment }: { payment: Record<string, unknown> }) {
  const currency =
    typeof payment.currency === "string" && payment.currency.trim() ? payment.currency.trim() : "USD"

  const lines: { label: string; value: string; key: string }[] = []

  for (const key of TIKTOK_PAYMENT_FIELD_ORDER) {
    if (key === "currency") {
      continue
    }
    if (!Object.prototype.hasOwnProperty.call(payment, key)) {
      continue
    }
    const raw = payment[key]
    if (TIKTOK_PAYMENT_MONEY_KEYS.has(key)) {
      const n = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN
      lines.push({
        key,
        label: humanizeKey(key),
        value: Number.isFinite(n) ? toCurrency(n, currency) : displayText(raw),
      })
    } else {
      lines.push({ key, label: humanizeKey(key), value: displayText(raw) })
    }
  }

  const used = new Set(lines.map((l) => l.key))
  for (const key of Object.keys(payment)) {
    if (key === "currency" || used.has(key)) {
      continue
    }
    const raw = payment[key]
    if (raw != null && (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean")) {
      const n = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN
      const isMoney = TIKTOK_PAYMENT_MONEY_KEYS.has(key) && Number.isFinite(n)
      lines.push({
        key,
        label: humanizeKey(key),
        value: isMoney ? toCurrency(n, currency) : displayText(raw),
      })
    }
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 font-semibold">Payment</div>
      <DetailLine label="Currency">{currency}</DetailLine>
      {lines.map((line) => (
        <DetailLine key={line.key} label={line.label}>
          {line.value}
        </DetailLine>
      ))}
    </div>
  )
}

function TiktokRecipientBlock({ address }: { address: Record<string, unknown> }) {
  const districtList = Array.isArray(address.district_info) ? address.district_info : []
  const deliveryPrefs =
    address.delivery_preferences && typeof address.delivery_preferences === "object"
      ? (address.delivery_preferences as Record<string, unknown>)
      : null

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 font-semibold">Ship to</div>
      <DetailLine label="Name">{displayText(address.name)}</DetailLine>
      <DetailLine label="Phone">{displayText(address.phone_number)}</DetailLine>
      <DetailLine label="Address">{displayText(address.full_address)}</DetailLine>
      <DetailLine label="Line 1">{displayText(address.address_line1)}</DetailLine>
      {displayText(address.address_line2) !== "—" ? (
        <DetailLine label="Line 2">{displayText(address.address_line2)}</DetailLine>
      ) : null}
      <DetailLine label="Detail">{displayText(address.address_detail)}</DetailLine>
      <DetailLine label="City / town">{displayText(address.post_town)}</DetailLine>
      <DetailLine label="Postal code">{displayText(address.postal_code)}</DetailLine>
      <DetailLine label="Region">{displayText(address.region_code)}</DetailLine>
      {deliveryPrefs && displayText(deliveryPrefs.drop_off_location) !== "—" ? (
        <DetailLine label="Delivery preference">{displayText(deliveryPrefs.drop_off_location)}</DetailLine>
      ) : null}
      {districtList.length > 0 ? (
        <div className="mt-2 border-t border-border/50 pt-2">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">District</div>
          <ul className="list-inside list-disc space-y-0.5 text-sm">
            {districtList.map((d, i) => {
              if (!d || typeof d !== "object") {
                return null
              }
              const row = d as Record<string, unknown>
              const parts = [
                displayText(row.address_level_name),
                displayText(row.address_name),
                displayText(row.iso_code),
              ].filter((p) => p !== "—")
              const rowKey =
                `${displayText(row.iso_code)}-${displayText(row.address_level)}-${displayText(row.address_name)}-${i}`
              return <li key={rowKey}>{parts.join(" · ") || "—"}</li>
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function TiktokLineItemCard({ item, index }: { item: Record<string, unknown>; index: number }) {
  const sku = displayText(item.seller_sku)
  const qty =
    typeof item.quantity === "number" && Number.isFinite(item.quantity)
      ? String(item.quantity)
      : displayText(item.quantity)
  const lineCurrency =
    typeof item.currency === "string" && item.currency.trim() ? item.currency.trim() : ""

  const sale = typeof item.sale_price === "string" || typeof item.sale_price === "number" ? Number(item.sale_price) : NaN
  const currency = lineCurrency || "USD"

  return (
    <div className="rounded-md border border-border/70 bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium leading-snug">{displayText(item.product_name)}</p>
          <p className="text-xs text-muted-foreground">{displayText(item.sku_name)}</p>
        </div>
        <span className="text-xs text-muted-foreground">#{index + 1}</span>
      </div>
      <div className="grid gap-1 text-xs sm:grid-cols-2">
        <div>
          <span className="text-muted-foreground">Seller SKU: </span>
          <span>{sku}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Quantity: </span>
          <span>{qty}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Sale price: </span>
          <span>{Number.isFinite(sale) ? toCurrency(sale, currency) : displayText(item.sale_price)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Package status: </span>
          <span>{displayText(item.package_status)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Display status: </span>
          <span>{displayText(item.display_status)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Tracking: </span>
          <span>{displayText(item.tracking_number)}</span>
        </div>
      </div>
    </div>
  )
}

function TiktokShopOrderDetailBody({ order }: { order: Record<string, unknown> }) {
  const payment = order.payment && typeof order.payment === "object" ? (order.payment as Record<string, unknown>) : null
  const recipient =
    order.recipient_address && typeof order.recipient_address === "object"
      ? (order.recipient_address as Record<string, unknown>)
      : null
  const lineItems = Array.isArray(order.line_items) ? order.line_items : []

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border p-3">
        <div className="mb-2 font-semibold">Order overview</div>
        <DetailLine label="Order ID">
          <span className="font-mono text-xs">{displayText(order.id)}</span>
        </DetailLine>
        <DetailLine label="Status">
          <StatusBadge variant="info">{displayText(order.status)}</StatusBadge>
        </DetailLine>
        <DetailLine label="Created">{formatUnixSeconds(order.create_time)}</DetailLine>
        <DetailLine label="Updated">{formatUnixSeconds(order.update_time)}</DetailLine>
        <DetailLine label="Paid">{formatUnixSeconds(order.paid_time)}</DetailLine>
        <DetailLine label="Fulfillment">
          {typeof order.fulfillment_type === "string"
            ? order.fulfillment_type.replace(/_/g, " ")
            : "—"}
        </DetailLine>
        <DetailLine label="Shipping type">{displayText(order.shipping_type)}</DetailLine>
        <DetailLine label="Delivery">{displayText(order.delivery_type)}</DetailLine>
        <DetailLine label="Commerce platform">{displayText(order.commerce_platform)}</DetailLine>
        <DetailLine label="Order type">{displayText(order.order_type)}</DetailLine>
        <DetailLine label="Warehouse">{displayText(order.warehouse_id)}</DetailLine>
        <DetailLine label="Payment method">{displayText(order.payment_method_name)}</DetailLine>
        <DetailLine label="Tracking number">{displayText(order.tracking_number)}</DetailLine>
      </div>

      <div className="rounded-lg border p-3">
        <div className="mb-2 font-semibold">Buyer</div>
        <DetailLine label="Nickname">{displayText(order.buyer_nickname)}</DetailLine>
        <DetailLine label="Buyer email">{displayText(order.buyer_email)}</DetailLine>
        <DetailLine label="Buyer message">{displayText(order.buyer_message)}</DetailLine>
        <DetailLine label="Seller note">{displayText(order.seller_note)}</DetailLine>
      </div>

      {payment ? <TiktokPaymentBreakdown payment={payment} /> : null}

      {recipient ? <TiktokRecipientBlock address={recipient} /> : null}

      {lineItems.length > 0 ? (
        <div className="rounded-lg border p-3">
          <div className="mb-3 font-semibold">Line items ({lineItems.length})</div>
          <div className="space-y-3">
            {lineItems.map((raw, idx) =>
              raw && typeof raw === "object" ? (
                <TiktokLineItemCard key={displayText((raw as Record<string, unknown>).id) || `line-${idx}`} item={raw as Record<string, unknown>} index={idx} />
              ) : null,
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
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

type TikTokOrderRow = {
  id: string
  status: string
  createdAtLabel: string
  buyer: string
  itemSummary: string
  lineCount: number
  totalLabel: string
  fulfillment: string
  shippingType: string
  raw: Record<string, unknown>
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
  const title =
    firstItemNode?.listing?.title || order.listingTitle || order.orderNumber || order.whatnotOrderId || "Untitled order"
  const quantity = itemEdges.reduce((total, edge) => total + (edge?.node?.quantity || 0), 0) || 1
  const subtotalRaw = raw.subtotal
  const subtotalAmount = typeof subtotalRaw?.amount === "number" ? subtotalRaw.amount / 100 : null
  const subtotalCurrency = subtotalRaw?.currency || order.priceCurrency || "USD"
  const buyerUsername = raw.buyer?.username || order.buyerUsername || order.buyerName || "N/A"
  const salesChannel = (raw.salesChannel || "N/A").toString()
  const prettyStatus = (raw.prettyStatus || order.status || "unknown").toString()
  const earningStatusBadge = firstItemNode?.sellerReceipt?.earningsStatus?.badgeLabel || "N/A"
  const netEarning =
    firstItemNode?.sellerReceipt?.netEarnings?.amount
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

function mapTikTokOrderRow(order: Record<string, unknown>): TikTokOrderRow {
  const id = typeof order.id === "string" && order.id.trim() ? order.id : "—"
  const status = typeof order.status === "string" ? order.status : "unknown"
  const createTime = order.create_time
  const buyerNickname = typeof order.buyer_nickname === "string" ? order.buyer_nickname : ""
  const userId = typeof order.user_id === "string" ? order.user_id : ""
  const buyer = buyerNickname.trim() || userId || "N/A"

  const lineItems = Array.isArray(order.line_items) ? order.line_items : []
  const firstLine = lineItems[0] && typeof lineItems[0] === "object" ? (lineItems[0] as Record<string, unknown>) : {}
  const itemSummary =
    (typeof firstLine.product_name === "string" && firstLine.product_name.trim() && firstLine.product_name)
    || (typeof firstLine.sku_name === "string" && firstLine.sku_name.trim() && firstLine.sku_name)
    || (lineItems.length > 1 ? `${lineItems.length} items` : "—")

  const payment = order.payment && typeof order.payment === "object" ? (order.payment as Record<string, unknown>) : {}
  const totalRaw = payment.total_amount
  const currencyRaw = payment.currency
  const totalNum = typeof totalRaw === "string" || typeof totalRaw === "number" ? Number(totalRaw) : NaN
  const currency = typeof currencyRaw === "string" && currencyRaw.trim() ? currencyRaw.trim() : "USD"
  const totalLabel = Number.isFinite(totalNum) ? toCurrency(totalNum, currency) : "N/A"

  const fulfillment = typeof order.fulfillment_type === "string" ? order.fulfillment_type.replace(/_/g, " ") : "—"
  const shippingType = typeof order.shipping_type === "string" ? order.shipping_type : "—"

  return {
    id,
    status,
    createdAtLabel: formatUnixSeconds(createTime),
    buyer,
    itemSummary,
    lineCount: lineItems.length || 0,
    totalLabel,
    fulfillment,
    shippingType,
    raw: order,
  }
}

function tiktokConnectHint(reason: string | null) {
  if (reason === "missing_partner_app") {
    return "Set TIKTOK_SHOP_APP_KEY and TIKTOK_SHOP_APP_SECRET on the backend for your Partner application."
  }
  return "Add TIKTOK_SHOP_ACCESS_TOKEN and TIKTOK_SHOP_SHOP_CIPHER from TikTok Shop Partner authorization, or set metadata_json.tiktok_shop (access_token, shop_cipher) on the seller’s TikTok ConnectedAccount record."
}

function whatnotStatusVariant(status: string) {
  const normalized = status.trim().toLowerCase()
  if (normalized.includes("deliver") || normalized.includes("complete")) {
    return "success" as const
  }
  if (normalized.includes("cancel") || normalized.includes("refund")) {
    return "danger" as const
  }
  if (normalized.includes("ship") || normalized.includes("label") || normalized.includes("process")) {
    return "warning" as const
  }
  return "default" as const
}

function tiktokStatusVariant(status: string) {
  const normalized = status.trim().toLowerCase()
  if (normalized.includes("deliver") || normalized.includes("completed")) {
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

function OrdersMetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  icon: typeof ShoppingBag
}) {
  return (
    <Card className="border-border/60 bg-card/80 shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/90 p-2.5 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function SellerOrdersPage() {
  const { getToken, isLoaded } = useAuth()
  const [orders, setOrders] = useState<WhatnotOrderItem[]>([])
  const [tiktokShop, setTiktokShop] = useState<TikTokShopOrdersSearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [tiktokErrorMessage, setTiktokErrorMessage] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null)
  const [selectedTikTokOrder, setSelectedTikTokOrder] = useState<TikTokOrderRow | null>(null)
  const [tiktokLiveDetailRaw, setTiktokLiveDetailRaw] = useState<Record<string, unknown> | null>(null)
  const [tiktokLiveDetailLoading, setTiktokLiveDetailLoading] = useState(false)
  const [tiktokLiveDetailError, setTiktokLiveDetailError] = useState<string | null>(null)

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
      setTiktokErrorMessage(null)
      const token = await waitForSessionToken(getToken)
      await syncWhatnotOrders(token).catch(() => null)

      const whatnotPromise = getWhatnotOrders(token, { limit: 100 }).catch((error) => ({ error }))
      const tiktokPromise = searchTikTokShopOrders(token, {
        pageSize: 50,
        sortOrder: "DESC",
        sortField: "create_time",
      }).catch((error) => ({ error }))

      const [whatnotOutcome, tiktokOutcome] = await Promise.all([whatnotPromise, tiktokPromise])

      if ("error" in whatnotOutcome) {
        const error = whatnotOutcome.error
        const message =
          error instanceof AuthApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to load Whatnot orders."
        setErrorMessage(message)
        setOrders([])
      } else {
        setOrders(whatnotOutcome.orders)
      }

      if ("error" in tiktokOutcome) {
        const error = tiktokOutcome.error
        const message =
          error instanceof AuthApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to load TikTok Shop orders."
        setTiktokErrorMessage(message)
        setTiktokShop(null)
      } else {
        setTiktokShop(tiktokOutcome)
      }
    } catch (error) {
      const message =
        error instanceof AuthApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to load orders."
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
  const tiktokRows = useMemo(() => (tiktokShop?.orders ?? []).map(mapTikTokOrderRow), [tiktokShop])

  const mergedTiktokRaw = useMemo(() => {
    if (!selectedTikTokOrder) {
      return null
    }
    return (tiktokLiveDetailRaw ?? selectedTikTokOrder.raw) as Record<string, unknown>
  }, [tiktokLiveDetailRaw, selectedTikTokOrder])

  useEffect(() => {
    let cancelled = false

    async function loadDetail() {
      if (!selectedTikTokOrder) {
        setTiktokLiveDetailRaw(null)
        setTiktokLiveDetailError(null)
        setTiktokLiveDetailLoading(false)
        return
      }

      if (!tiktokShop || tiktokShop.isMockData) {
        setTiktokLiveDetailRaw(null)
        setTiktokLiveDetailError(null)
        setTiktokLiveDetailLoading(false)
        return
      }

      setTiktokLiveDetailLoading(true)
      setTiktokLiveDetailError(null)

      try {
        const token = await waitForSessionToken(getToken)
        const detail = await getTikTokShopOrderDetail(token, selectedTikTokOrder.id)
        if (cancelled) {
          return
        }

        const orderObj = detail.order
        setTiktokLiveDetailRaw(
          orderObj && typeof orderObj === "object"
            ? (orderObj as Record<string, unknown>)
            : null,
        )
      } catch (error) {
        if (!cancelled) {
          setTiktokLiveDetailRaw(null)
          setTiktokLiveDetailError(
            error instanceof AuthApiError ? error.message : "Could not fetch TikTok order detail.",
          )
        }
      } finally {
        if (!cancelled) {
          setTiktokLiveDetailLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [selectedTikTokOrder, tiktokShop, getToken])

  const totalWhatnotSales = useMemo(() => {
    return orderRows.reduce((total, row) => total + (row.subtotalAmount || 0), 0)
  }, [orderRows])

  const uniqueWhatnotCustomers = useMemo(() => {
    return new Set(orderRows.map((row) => row.customer).filter((value) => value && value !== "N/A")).size
  }, [orderRows])

  const tiktokPageTotal = useMemo(() => {
    let sum = 0
    let currency = ""
    for (const row of tiktokRows) {
      const payment =
        row.raw.payment && typeof row.raw.payment === "object"
          ? (row.raw.payment as Record<string, unknown>)
          : {}
      const totalRaw = payment.total_amount
      const c = typeof payment.currency === "string" ? payment.currency.trim() : ""
      const n = typeof totalRaw === "string" || typeof totalRaw === "number" ? Number(totalRaw) : NaN
      if (!Number.isFinite(n)) {
        continue
      }
      if (!currency) {
        currency = c || "USD"
      }
      if (c && currency && c !== currency) {
        return { amount: null as number | null, currency: "" }
      }
      sum += n
    }
    return { amount: tiktokRows.length ? sum : null, currency: currency || "USD" }
  }, [tiktokRows])

  const tiktokAwaitingCount = useMemo(() => {
    return tiktokRows.filter((row) => /await|fulfill|ship/i.test(row.status)).length
  }, [tiktokRows])

  const tiktokBuyerCount = useMemo(() => {
    return new Set(tiktokRows.map((row) => row.buyer).filter((value) => value && value !== "N/A")).size
  }, [tiktokRows])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" />
          Loading orders…
        </div>
      </div>
    )
  }

  const tiktokDemoMode = Boolean(tiktokShop?.isMockData)
  const tiktokShopLiveConnected = Boolean(
    tiktokShop && (tiktokShop.shopConnected ?? tiktokShop.configured),
  )
  const platformMixLabel =
    tiktokShop == null
      ? "Waiting"
      : tiktokPageTotal.amount != null && tiktokPageTotal.currency
        ? tiktokPageTotal.currency
        : tiktokRows.length > 0
          ? "Mixed"
          : "None"

  return (
    <div className="space-y-6">
     

      

      {(errorMessage || tiktokErrorMessage) && (
        <div className="grid gap-3 md:grid-cols-2">
          {errorMessage ? (
            <Card className="border-destructive/30 bg-destructive/10">
              <CardContent className="p-4 text-sm text-destructive">
                <span className="font-medium">Whatnot: </span>
                {errorMessage}
              </CardContent>
            </Card>
          ) : null}
          {tiktokErrorMessage ? (
            <Card className="border-destructive/30 bg-destructive/10">
              <CardContent className="p-4 text-sm text-destructive">
                <span className="font-medium">TikTok Shop: </span>
                {tiktokErrorMessage}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      <Tabs defaultValue="whatnot" className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Platform order streams</h3>
            <p className="text-sm text-muted-foreground">Use the tabs to switch between Whatnot and TikTok data without changing pages.</p>
          </div>
          <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/70 p-1 lg:w-[22rem]">
            <TabsTrigger value="whatnot" className="rounded-xl">
              <PackageSearch className="h-4 w-4" />
              Whatnot
            </TabsTrigger>
            <TabsTrigger value="tiktok" className="rounded-xl">
              <Store className="h-4 w-4" />
              TikTok Shop
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="whatnot" className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Synced orders</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{orderRows.length}</p>
                <p className="mt-2 text-sm text-muted-foreground">Recent Whatnot orders available to seller tools.</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Customers</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{uniqueWhatnotCustomers}</p>
                <p className="mt-2 text-sm text-muted-foreground">Distinct buyers in the current sync snapshot.</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Revenue</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">${totalWhatnotSales.toFixed(2)}</p>
                <p className="mt-2 text-sm text-muted-foreground">Subtotal value across visible Whatnot rows.</p>
              </CardContent>
            </Card>
          </div>

          {orderRows.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No Whatnot orders synced yet"
              description="Orders sync when this tab opens. Keep the Whatnot extension connected to your seller session."
            />
          ) : (
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-lg">Whatnot order stream</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">The latest extension-synced orders, laid out for fast scanning and detail drill-in.</p>
                </div>
                <Badge variant="secondary" className="w-fit bg-amber-100 text-amber-900 hover:bg-amber-100">
                  Extension powered
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Order</th>
                        <th className="px-4 py-3 font-medium">Placed</th>
                        <th className="px-4 py-3 font-medium">Buyer</th>
                        <th className="px-4 py-3 font-medium">Items</th>
                        <th className="px-4 py-3 font-medium">Channel</th>
                        <th className="px-4 py-3 font-medium">Value</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Earnings</th>
                        <th className="px-4 py-3 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderRows.map((order) => (
                        <tr key={order.id} className="border-t border-border/60 align-top transition-colors hover:bg-muted/30">
                          <td className="px-4 py-4">
                            <div className="space-y-1">
                              <div className="font-medium text-foreground">{order.title}</div>
                              <div className="text-xs text-muted-foreground">{order.id}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">{formatDate(order.createdAt)}</td>
                          <td className="px-4 py-4">{order.customer}</td>
                          <td className="px-4 py-4">{order.quantity}</td>
                          <td className="px-4 py-4">{order.salesChannel}</td>
                          <td className="px-4 py-4 font-medium">{toCurrency(order.subtotalAmount, order.subtotalCurrency)}</td>
                          <td className="px-4 py-4">
                            <StatusBadge variant={whatnotStatusVariant(order.prettyStatus)}>{order.prettyStatus}</StatusBadge>
                          </td>
                          <td className="px-4 py-4">{order.earningStatus}</td>
                          <td className="px-4 py-4 text-right">
                            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setSelectedOrder(order)}>
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
          )}
        </TabsContent>

        <TabsContent value="tiktok" className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Query matches</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{tiktokShop != null ? tiktokShop.totalCount : "-"}</p>
                <p className="mt-2 text-sm text-muted-foreground">Total count returned by the active Partner API search.</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Active queue</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{tiktokAwaitingCount}</p>
                <p className="mt-2 text-sm text-muted-foreground">Orders awaiting shipment or fulfillment on this page.</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Buyers</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{tiktokBuyerCount}</p>
                <p className="mt-2 text-sm text-muted-foreground">Distinct buyers represented in the visible result page.</p>
              </CardContent>
            </Card>
          </div>

          {/* {tiktokDemoMode && !tiktokErrorMessage ? (
            <Alert className="border-amber-300/60 bg-amber-50/80 text-amber-950">
              <Info className="h-4 w-4" />
              <AlertTitle>You are viewing TikTok Shop mock data</AlertTitle>
              <AlertDescription>
                {tiktokShop?.note ?? "Connect your seller credentials to replace this tab with production data."} {tiktokConnectHint(tiktokShop?.reason ?? null)}
              </AlertDescription>
            </Alert>
          ) : null} */}

          {!tiktokDemoMode && tiktokShopLiveConnected && !tiktokErrorMessage && tiktokRows.length === 0 ? (
            <EmptyState
              icon={Store}
              title="No TikTok Shop orders on this page"
              description="This view is live and ready, but the current Partner API query did not return any rows."
            />
          ) : null}

          {!tiktokErrorMessage && tiktokShop != null && tiktokRows.length > 0 ? (
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-lg">{tiktokDemoMode ? "Demo TikTok Shop order queue" : "TikTok Shop order queue"}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">A cleaner operational view over Partner API order search responses, with live detail available per row.</p>
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
                        <tr key={order.id} className="border-t border-border/60 align-top transition-colors hover:bg-muted/30">
                          <td className="px-4 py-4 font-mono text-xs text-foreground">{order.id}</td>
                          <td className="px-4 py-4 text-muted-foreground">{order.createdAtLabel}</td>
                          <td className="px-4 py-4">{order.buyer}</td>
                          <td className="px-4 py-4">{order.lineCount}</td>
                          <td className="max-w-[240px] truncate px-4 py-4" title={order.itemSummary}>{order.itemSummary}</td>
                          <td className="px-4 py-4 font-medium">{order.totalLabel}</td>
                          <td className="px-4 py-4">
                            <StatusBadge variant={tiktokStatusVariant(order.status)}>{order.status}</StatusBadge>
                          </td>
                          <td className="px-4 py-4 text-xs uppercase tracking-wide text-muted-foreground">{order.fulfillment}</td>
                          <td className="px-4 py-4 text-right">
                            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setSelectedTikTokOrder(order)}>
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
          ) : null}
        </TabsContent>
      </Tabs>

      <Dialog open={selectedOrder !== null} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedOrder?.title || "Order detail"}</DialogTitle>
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

      <Dialog
        open={selectedTikTokOrder !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTikTokOrder(null)
            setTiktokLiveDetailRaw(null)
            setTiktokLiveDetailError(null)
            setTiktokLiveDetailLoading(false)
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span>TikTok Shop order {selectedTikTokOrder?.id ?? ""}</span>
              {tiktokDemoMode ? <Badge variant="secondary">Demo sample</Badge> : null}
            </DialogTitle>
          </DialogHeader>

          {selectedTikTokOrder && mergedTiktokRaw ? (
            <div className="space-y-4">
              {tiktokLiveDetailLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner className="h-3.5 w-3.5" />
                  Loading full order payload from TikTok Partner API…
                </div>
              ) : null}
              {tiktokLiveDetailError ? (
                <p className="text-xs text-destructive">{tiktokLiveDetailError}</p>
              ) : null}
              <TiktokShopOrderDetailBody order={mergedTiktokRaw} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
