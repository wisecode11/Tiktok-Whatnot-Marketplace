export function formatUnixSeconds(seconds: unknown): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return "N/A"
  }
  const date = new Date(seconds * 1000)
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString()
}

export function toOrderCurrency(amount: number | null, currency = "USD") {
  if (amount == null || !Number.isFinite(amount)) {
    return "N/A"
  }
  const code = currency || "USD"
  return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(amount)
}

export type TikTokOrderRow = {
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

export function mapTikTokOrderRow(order: Record<string, unknown>): TikTokOrderRow {
  const id = typeof order.id === "string" && order.id.trim() ? order.id : "—"
  const status = typeof order.status === "string" ? order.status : "unknown"
  const buyerNickname = typeof order.buyer_nickname === "string" ? order.buyer_nickname : ""
  const userId = typeof order.user_id === "string" ? order.user_id : ""
  const buyer = buyerNickname.trim() || userId || "N/A"

  const lineItems = Array.isArray(order.line_items) ? order.line_items : []
  const firstLine =
    lineItems[0] && typeof lineItems[0] === "object" ? (lineItems[0] as Record<string, unknown>) : {}
  const itemSummary =
    (typeof firstLine.product_name === "string" && firstLine.product_name.trim() && firstLine.product_name) ||
    (typeof firstLine.sku_name === "string" && firstLine.sku_name.trim() && firstLine.sku_name) ||
    (lineItems.length > 1 ? `${lineItems.length} items` : "—")

  const payment = order.payment && typeof order.payment === "object" ? (order.payment as Record<string, unknown>) : {}
  const totalRaw = payment.total_amount
  const currencyRaw = payment.currency
  const totalNum = typeof totalRaw === "string" || typeof totalRaw === "number" ? Number(totalRaw) : NaN
  const currency = typeof currencyRaw === "string" && currencyRaw.trim() ? currencyRaw.trim() : "USD"
  const totalLabel = Number.isFinite(totalNum) ? toOrderCurrency(totalNum, currency) : "N/A"

  const fulfillment =
    typeof order.fulfillment_type === "string" ? order.fulfillment_type.replace(/_/g, " ") : "—"
  const shippingType = typeof order.shipping_type === "string" ? order.shipping_type : "—"

  return {
    id,
    status,
    createdAtLabel: formatUnixSeconds(order.create_time),
    buyer,
    itemSummary,
    lineCount: lineItems.length || 0,
    totalLabel,
    fulfillment,
    shippingType,
    raw: order,
  }
}

export type TikTokManagementRow = {
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

export function displayTikTokField(value: unknown): string {
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

export function mapTikTokManagementRow(order: Record<string, unknown>): TikTokManagementRow {
  const id = typeof order.id === "string" && order.id.trim() ? order.id : "—"
  const status = typeof order.status === "string" ? order.status : "unknown"
  const buyerNickname = typeof order.buyer_nickname === "string" ? order.buyer_nickname : ""
  const userId = typeof order.user_id === "string" ? order.user_id : ""
  const buyer = buyerNickname.trim() || userId || "N/A"
  const lineItems = Array.isArray(order.line_items) ? order.line_items : []
  const firstLine =
    lineItems[0] && typeof lineItems[0] === "object" ? (lineItems[0] as Record<string, unknown>) : {}
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
    totalLabel: Number.isFinite(totalNum) ? toOrderCurrency(totalNum, currency) : "—",
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

export function tiktokStatusVariant(status: string): "success" | "danger" | "warning" | "info" | "default" {
  const normalized = status.trim().toLowerCase()
  if (normalized.includes("deliver") || normalized.includes("completed")) {
    return "success"
  }
  if (normalized.includes("cancel") || normalized.includes("return")) {
    return "danger"
  }
  if (normalized.includes("await") || normalized.includes("fulfill") || normalized.includes("ship")) {
    return "warning"
  }
  return "info"
}
