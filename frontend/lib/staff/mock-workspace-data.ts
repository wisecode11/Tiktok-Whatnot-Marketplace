export type PlatformKey = "hub" | "tiktok" | "whatnot"

export type SyncState = "synced" | "pending" | "error"

export type MockProduct = {
  id: string
  sku: string
  title: string
  priceUsd: number
  hubStock: number
  tiktokStock: number
  whatnotStock: number
  reservedUnits: number
  tiktokSync: SyncState
  whatnotSync: SyncState
  lastPushedAt: string
}

export type OrderStatus =
  | "paid"
  | "processing"
  | "packing"
  | "label_ready"
  | "shipped"
  | "delivered"

export type MockOrderLine = { sku: string; title: string; qty: number }

export type MockOrder = {
  id: string
  orderNumber: string
  customer: string
  placedAt: string
  carrier: string
  status: OrderStatus
  lines: MockOrderLine[]
  tracking?: string
  labelUrl?: string
}

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: "p-aurora",
    sku: "SKU-AUR-01",
    title: "Aurora LED Desk Lamp",
    priceUsd: 48.99,
    hubStock: 120,
    tiktokStock: 118,
    whatnotStock: 119,
    reservedUnits: 6,
    tiktokSync: "synced",
    whatnotSync: "pending",
    lastPushedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  },
  {
    id: "p-vinyl",
    sku: "SKU-VNY-44",
    title: "Vintage Vinyl Mystery Pack",
    priceUsd: 34.5,
    hubStock: 64,
    tiktokStock: 62,
    whatnotStock: 63,
    reservedUnits: 10,
    tiktokSync: "synced",
    whatnotSync: "synced",
    lastPushedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: "p-cable",
    sku: "SKU-CBL-09",
    title: "Braided USB-C Cable 2m",
    priceUsd: 14.25,
    hubStock: 18,
    tiktokStock: 17,
    whatnotStock: 18,
    reservedUnits: 4,
    tiktokSync: "error",
    whatnotSync: "synced",
    lastPushedAt: new Date(Date.now() - 1000 * 60 * 52).toISOString(),
  },
]

export const MOCK_ORDERS: MockOrder[] = [
  {
    id: "o-10021",
    orderNumber: "MH-10021",
    customer: "Jamie Chen",
    placedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    carrier: "USPS Priority",
    status: "packing",
    lines: [
      { sku: "SKU-AUR-01", title: "Aurora LED Desk Lamp", qty: 1 },
      { sku: "SKU-CBL-09", title: "Braided USB-C Cable 2m", qty: 2 },
    ],
  },
  {
    id: "o-10022",
    orderNumber: "MH-10022",
    customer: "Riley Ortiz",
    placedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    carrier: "UPS Ground",
    status: "label_ready",
    lines: [{ sku: "SKU-VNY-44", title: "Vintage Vinyl Mystery Pack", qty: 1 }],
  },
  {
    id: "o-10023",
    orderNumber: "MH-10023",
    customer: "Taylor Brooks",
    placedAt: new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString(),
    carrier: "FedEx Home",
    status: "processing",
    lines: [{ sku: "SKU-AUR-01", title: "Aurora LED Desk Lamp", qty: 2 }],
  },
  {
    id: "o-10024",
    orderNumber: "MH-10024",
    customer: "Morgan Lee",
    placedAt: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
    carrier: "USPS Priority",
    status: "shipped",
    tracking: "9400111899223344556677",
    lines: [{ sku: "SKU-VNY-44", title: "Vintage Vinyl Mystery Pack", qty: 3 }],
  },
]

export function cloneProducts(products: MockProduct[]) {
  return products.map((product) => ({ ...product }))
}

export function cloneOrders(orders: MockOrder[]) {
  return orders.map((order) => ({
    ...order,
    lines: order.lines.map((line) => ({ ...line })),
  }))
}

/** Tiny variance to mimic live marketplace counters without drifting forever */
export function jitterPlatformStock(value: number, seed: number) {
  const delta = ((seed % 5) - 2) as -2 | -1 | 0 | 1 | 2
  return Math.max(0, value + delta)
}
