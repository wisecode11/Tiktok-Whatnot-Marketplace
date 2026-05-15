"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { EllipsisVertical, PackageOpen, PackageCheck, Truck, Boxes, ClipboardList, BadgeCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  createTikTokShopPackage,
  searchTikTokShopOrders,
  searchTikTokShopPackages,
  shipTikTokPackage,
  splitTikTokShopOrder,
  waitForSessionToken,
  type CreatePackagePayload,
  type CreatePackageResponse,
  type ShipPackagePayload,
  type ShipPackageResponse,
  type SplitOrderPayload,
  type SplitOrderResponse,
  type TikTokShopPackage,
  type TikTokShopPackagesSearchResponse,
  type TikTokShopOrdersSearchResponse,
} from "@/lib/auth"
import { mockTikTokOrdersResponse } from "@/lib/mockTikTokOrdersData"

type FulfillmentTab = "orders" | "packages" | "shipments"
type PackageStatus = "Unfulfilled" | "Created" | "Ready to Ship" | "Shipped"
type ShipmentStatus = "Pending" | "In Transit" | "Delivered"

type OrderItem = {
  name: string
  quantity: number
}

type MockOrder = {
  orderId: string
  productName: string
  customerName: string
  buyerNickname: string
  quantity: number
  price: number
  currency: string
  status: string
  createdDate: string
  items: OrderItem[]
  rawLineItems: Array<{ id: string; product_name: string; quantity: number; sku_id?: string }>
}

type MockPackage = {
  packageId: string
  linkedOrderId: string
  itemsCount: number
  shippingMethod: string
  status: string
  courier: string
  trackingNumber: string
  updatedDate: string
}

type MockShipment = {
  shipmentId: string
  packageId: string
  carrierName: string
  trackingNumber: string
  deliveryStatus: ShipmentStatus
  estimatedDeliveryDate: string
  lastUpdated: string
  timeline: Array<{
    label: string
    timestamp: string
    done: boolean
  }>
}

type SplitOrderTarget = {
  orderId: string
  buyerNickname: string
  customerName: string
  status: string
  items: OrderItem[]
  rawLineItems: Array<{ id: string; product_name: string; quantity: number; sku_id?: string }>
}

const mockOrders: MockOrder[] = [
  {
    orderId: "ORD-88021",
    productName: "Wireless Earbuds",
    customerName: "Sarah Khan",
    buyerNickname: "sarah_khan",
    quantity: 1,
    price: 49.99,
    currency: "USD",
    status: "Unfulfilled",
    createdDate: "2026-05-10",
    items: [
      { name: "Wireless Earbuds", quantity: 1 },
      { name: "Charging Cable", quantity: 1 },
    ],
    rawLineItems: [],
  },
  {
    orderId: "ORD-88022",
    productName: "Desk Lamp",
    customerName: "Amir Raza",
    buyerNickname: "amir_raza",
    quantity: 3,
    price: 89.5,
    currency: "USD",
    status: "Unfulfilled",
    createdDate: "2026-05-11",
    items: [
      { name: "Desk Lamp", quantity: 1 },
      { name: "Cable Set", quantity: 2 },
    ],
    rawLineItems: [],
  },
  {
    orderId: "ORD-88023",
    productName: "Smart Watch",
    customerName: "Hina Ali",
    buyerNickname: "hina_ali",
    quantity: 1,
    price: 129.0,
    currency: "USD",
    status: "Unfulfilled",
    createdDate: "2026-05-11",
    items: [{ name: "Smart Watch", quantity: 1 }],
    rawLineItems: [],
  },
  {
    orderId: "ORD-88024",
    productName: "Gaming Mouse",
    customerName: "Bilal Ahmed",
    buyerNickname: "bilal_ahmed",
    quantity: 1,
    price: 39.0,
    currency: "USD",
    status: "Unfulfilled",
    createdDate: "2026-05-09",
    items: [{ name: "Gaming Mouse", quantity: 1 }],
    rawLineItems: [],
  },
]

const mockPackages: MockPackage[] = [
  {
    packageId: "PKG-30011",
    linkedOrderId: "ORD-88021",
    itemsCount: 2,
    shippingMethod: "Express",
    status: "Created",
    courier: "DHL",
    trackingNumber: "",
    updatedDate: "2026-05-11",
  },
  {
    packageId: "PKG-30012",
    linkedOrderId: "ORD-88022",
    itemsCount: 3,
    shippingMethod: "Standard",
    status: "Ready to Ship",
    courier: "FedEx",
    trackingNumber: "",
    updatedDate: "2026-05-11",
  },
  {
    packageId: "PKG-30013",
    linkedOrderId: "ORD-88023",
    itemsCount: 1,
    shippingMethod: "Express",
    status: "Created",
    courier: "UPS",
    trackingNumber: "",
    updatedDate: "2026-05-10",
  },
]

const mockShipments: MockShipment[] = [
  {
    shipmentId: "SHP-70011",
    packageId: "PKG-30012",
    carrierName: "FedEx",
    trackingNumber: "FDX-77881234",
    deliveryStatus: "In Transit",
    estimatedDeliveryDate: "2026-05-15",
    lastUpdated: "2026-05-12",
    timeline: [
      { label: "Ordered", timestamp: "2026-05-10 08:20", done: true },
      { label: "Packed", timestamp: "2026-05-10 12:40", done: true },
      { label: "Shipped", timestamp: "2026-05-11 09:05", done: true },
      { label: "In Transit", timestamp: "2026-05-12 15:30", done: true },
      { label: "Delivered", timestamp: "Pending", done: false },
    ],
  },
  {
    shipmentId: "SHP-70012",
    packageId: "PKG-30013",
    carrierName: "UPS",
    trackingNumber: "UPS-44990018",
    deliveryStatus: "Pending",
    estimatedDeliveryDate: "2026-05-16",
    lastUpdated: "2026-05-11",
    timeline: [
      { label: "Ordered", timestamp: "2026-05-09 10:20", done: true },
      { label: "Packed", timestamp: "2026-05-10 12:00", done: true },
      { label: "Shipped", timestamp: "Pending", done: false },
      { label: "In Transit", timestamp: "Pending", done: false },
      { label: "Delivered", timestamp: "Pending", done: false },
    ],
  },
]

const fulfillmentTimeline = ["Ordered", "Packed", "Shipped", "In Transit", "Delivered"]

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)
}

function mapTikTokPackageToRow(pkg: TikTokShopPackage, index: number): MockPackage {
  const firstOrder = Array.isArray(pkg.orders) ? pkg.orders[0] : undefined
  const linkedOrderId = firstOrder?.id || "-"
  const itemsCount = (Array.isArray(pkg.orders) ? pkg.orders : []).reduce((sum, order) => {
    const skuQty = (Array.isArray(order.skus) ? order.skus : []).reduce(
      (skuSum, sku) => skuSum + (Number(sku.quantity) || 0),
      0,
    )
    return sum + skuQty
  }, 0)

  return {
    packageId: pkg.id || `package-${index}`,
    linkedOrderId,
    itemsCount,
    shippingMethod: pkg.shipping_provider_id || "TikTok Fulfillment",
    status: pkg.status || "UNKNOWN",
    courier: pkg.shipping_provider_name || "-",
    trackingNumber: pkg.tracking_number || "",
    updatedDate:
      typeof pkg.update_time === "number"
        ? new Date(pkg.update_time * 1000).toLocaleDateString()
        : "-",
  }
}

function orderStatusVariant(status: string): "success" | "warning" | "danger" | "info" | "default" | "pending" | "active" | "inactive" {
  const s = status.toUpperCase()
  if (s === "UNPAID") return "warning"
  if (s === "AWAITING_SHIPMENT" || s === "ON_HOLD") return "pending"
  if (s === "IN_TRANSIT" || s === "SHIPPED" || s === "PARTIALLY_SHIPPED") return "info"
  if (s === "DELIVERED" || s === "COMPLETED") return "success"
  if (s === "CANCELLED") return "danger"
  if (s === "UNFULFILLED") return "default"
  if (s === "READY TO SHIP") return "warning"
  if (s === "CREATED") return "pending"
  return "default"
}

function packageStatusVariant(status: string) {
  return orderStatusVariant(status)
}

function shipmentStatusVariant(status: ShipmentStatus) {
  if (status === "Delivered") return "success"
  if (status === "In Transit") return "info"
  return "pending"
}

function packageActions(status: string) {
  const s = status.toUpperCase()
  if (s === "UNPAID" || s === "AWAITING_SHIPMENT" || s === "ON_HOLD" || s === "UNFULFILLED") {
    return ["Create Package", "Split Order",] as const
  }
  if (
    s === "CREATED"
    || s === "READY TO SHIP"
    || s === "AWAITING_COLLECTION"
    || s === "PROCESSING"
    || s === "FULFILLING"
  ) {
    return ["Ship Package"] as const
  }
  if (s === "COMPLETED" || s === "CANCELLED") {
    return ["View Package Details"] as const
  }
  return [] as const
}

function RowActionsMenu({
  label,
  actions,
  onAction,
}: {
  label: string
  actions: readonly string[]
  onAction: (action: string) => void
}) {
  if (!actions.length) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={`Open actions for ${label}`}
          onClick={(event) => event.stopPropagation()}
        >
          <EllipsisVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action}
            onClick={(event) => {
              event.stopPropagation()
              onAction(action)
            }}
          >
            {action}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function orderTimeline(status: PackageStatus) {
  const completed = status === "Unfulfilled" ? 1 : status === "Created" ? 2 : status === "Ready to Ship" ? 3 : 4
  return fulfillmentTimeline.map((step, index) => ({ step, done: index <= completed }))
}

function OrderTable({
  rows,
  onCreatePackage,
  onSplitOrder,
  onShipOrder,
}: {
  rows: MockOrder[]
  onCreatePackage: (row: MockOrder) => void
  onSplitOrder: (orderId: string) => void
  onShipOrder: (orderId: string) => void
}) {
  if (!rows.length) {
    return <EmptyState title="No unfulfilled orders" description="Orders waiting for fulfillment will appear here." />
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Product Name</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Order Status</TableHead>
            <TableHead>Created Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${row.orderId}-${index}`}>
              <TableCell className="font-mono text-xs">{row.orderId}</TableCell>
              <TableCell>{row.productName}</TableCell>
              <TableCell>
                <div>
                  <p className="font-medium text-sm">{row.buyerNickname}</p>
                  {row.customerName && row.customerName !== row.buyerNickname ? (
                    <p className="text-xs text-muted-foreground">{row.customerName}</p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{row.quantity}</TableCell>
              <TableCell>
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: row.currency || "USD",
                  maximumFractionDigits: 2,
                }).format(row.price)}
              </TableCell>
              <TableCell>
                <StatusBadge variant={orderStatusVariant(row.status)}>
                  {row.status.replace(/_/g, " ")}
                </StatusBadge>
              </TableCell>
              <TableCell>{row.createdDate}</TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <RowActionsMenu
                    label={row.orderId}
                    actions={packageActions(row.status)}
                    onAction={(action) => {
                      if (action === "Create Package") {
                        onCreatePackage(row)
                        return
                      }
                      if (action === "Split Order") {
                        onSplitOrder(row.orderId)
                        return
                      }
                      if (action === "Ship Order") {
                        onShipOrder(row.orderId)
                      }
                    }}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function PackageTable({
  rows,
  onAction,
}: {
  rows: MockPackage[]
  onAction: (action: string, packageRow: MockPackage) => void
}) {
  if (!rows.length) {
    return <EmptyState title="No packages created" description="Created packages will appear here." />
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Package ID</TableHead>
            <TableHead>Linked Order ID</TableHead>
            <TableHead>Items Count</TableHead>
            <TableHead>Shipping Method</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Courier</TableHead>
            <TableHead>Tracking Number</TableHead>
            <TableHead>Updated Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${row.packageId}-${index}`}>
              <TableCell className="font-mono text-xs">{row.packageId}</TableCell>
              <TableCell className="font-mono text-xs">{row.linkedOrderId}</TableCell>
              <TableCell>{row.itemsCount}</TableCell>
              <TableCell>{row.shippingMethod}</TableCell>
              <TableCell>
                <StatusBadge variant={packageStatusVariant(row.status)}>{row.status.replace(/_/g, " ")}</StatusBadge>
              </TableCell>
              <TableCell>{row.courier}</TableCell>
              <TableCell className="font-mono text-xs">{row.trackingNumber || "-"}</TableCell>
              <TableCell>{row.updatedDate}</TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <RowActionsMenu
                    label={row.packageId}
                    actions={packageActions(row.status)}
                    onAction={(action) => onAction(action, row)}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ShipmentTable({
  rows,
  onTrackShipment,
}: {
  rows: MockShipment[]
  onTrackShipment: (row: MockShipment) => void
}) {
  if (!rows.length) {
    return <EmptyState title="No shipments found" description="Shipped orders will appear here." />
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shipment ID</TableHead>
            <TableHead>Package ID</TableHead>
            <TableHead>Carrier Name</TableHead>
            <TableHead>Tracking Number</TableHead>
            <TableHead>Delivery Status</TableHead>
            <TableHead>Estimated Delivery Date</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${row.shipmentId}-${index}`}>
              <TableCell className="font-mono text-xs">{row.shipmentId}</TableCell>
              <TableCell className="font-mono text-xs">{row.packageId}</TableCell>
              <TableCell>{row.carrierName}</TableCell>
              <TableCell className="font-mono text-xs">{row.trackingNumber}</TableCell>
              <TableCell>
                <StatusBadge variant={shipmentStatusVariant(row.deliveryStatus)}>{row.deliveryStatus}</StatusBadge>
              </TableCell>
              <TableCell>{row.estimatedDeliveryDate}</TableCell>
              <TableCell>
                <Button type="button" size="sm" variant="outline" onClick={() => onTrackShipment(row)}>
                  Track Shipment
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed bg-muted/30 p-8 text-center">
      <div className="max-w-sm space-y-2">
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export default function FulfillmentPage() {
  const { getToken, isLoaded } = useAuth()
  const [activeTab, setActiveTab] = useState<FulfillmentTab>("orders")
  const [createPackageOrder, setCreatePackageOrder] = useState<MockOrder | null>(null)
  const [splitOrderTarget, setSplitOrderTarget] = useState<SplitOrderTarget | null>(null)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [trackingShipment, setTrackingShipment] = useState<MockShipment | null>(null)
  const [orders, setOrders] = useState<MockOrder[]>([])
  const [packages, setPackages] = useState<MockPackage[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [packagesError, setPackagesError] = useState<string | null>(null)

  // Create Package form state
  const [packageForm, setPackageForm] = useState({
    shipType: "1",
    dimLength: "",
    dimWidth: "",
    dimHeight: "",
    dimUnit: "CM",
    weightValue: "",
    weightUnit: "GRAM",
    shippingServiceId: "",
  })
  const [packageLoading, setPackageLoading] = useState(false)
  const [packageError, setPackageError] = useState<string | null>(null)
  const [packageResult, setPackageResult] = useState<CreatePackageResponse | null>(null)

  // Split Order form state
  const [splitGroupId, setSplitGroupId] = useState("123")
  const [splitSelectedLineIds, setSplitSelectedLineIds] = useState<string[]>([])
  const [splitManualLineIds, setSplitManualLineIds] = useState("")
  const [splitLoading, setSplitLoading] = useState(false)
  const [splitError, setSplitError] = useState<string | null>(null)
  const [splitResult, setSplitResult] = useState<SplitOrderResponse | null>(null)

  // Ship Package form state
  const [shipPackageTarget, setShipPackageTarget] = useState<string | null>(null)
  const [shipHandoverMethod, setShipHandoverMethod] = useState<"PICKUP" | "DROP_OFF" | "">("")
  const [shipPickupStart, setShipPickupStart] = useState("")
  const [shipPickupEnd, setShipPickupEnd] = useState("")
  const [shipTrackingNumber, setShipTrackingNumber] = useState("")
  const [shipProviderId, setShipProviderId] = useState("")
  const [shipLoading, setShipLoading] = useState(false)
  const [shipError, setShipError] = useState<string | null>(null)
  const [shipResult, setShipResult] = useState<ShipPackageResponse | null>(null)

  // Fetch TikTok Shop orders on mount
  useEffect(() => {
    let cancelled = false

    const loadOrders = async () => {
      if (!isLoaded) {
        return
      }

      setOrdersLoading(true)
      setOrdersError(null)

      try {
        const token = await waitForSessionToken(getToken)
        const result = await searchTikTokShopOrders(token, {
          pageSize: 50,
          sortOrder: "DESC",
          sortField: "create_time",
        })

        if (cancelled) {
          return
        }

        // Use mock data structure directly if using mock (credentials not configured)
        let apiOrders = result.orders ?? []
        
        if (result.isMockData && apiOrders.length === 0) {
          // If API returned empty mock data, use our comprehensive mock data
          console.log("[Fulfillment] Using structured mock TikTok orders data")
          apiOrders = mockTikTokOrdersResponse.data.orders as unknown as Record<string, unknown>[]
        }

        // Map TikTok API orders to MockOrder type for display
        // Real API uses: id, status, buyer_nickname, recipient_address, line_items[].id
        const mappedOrders: MockOrder[] = apiOrders.map((tiktokOrder: any, index: number) => ({
          orderId: tiktokOrder.id || tiktokOrder.order_id || `order-${index}`,
          productName: tiktokOrder.line_items?.[0]?.product_name || "Unknown Product",
          buyerNickname: tiktokOrder.buyer_nickname || tiktokOrder.buyer_user_id || `buyer-${index}`,
          customerName: tiktokOrder.recipient_address?.name || tiktokOrder.shipping_address?.name || "",
          quantity: tiktokOrder.line_items?.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0) || 0,
          price: parseFloat(tiktokOrder.payment?.total_amount || "0"),
          currency: tiktokOrder.payment?.currency || "USD",
          status: tiktokOrder.status || tiktokOrder.order_status || "UNKNOWN",
          createdDate: new Date(
            typeof tiktokOrder.create_time === "number" ? tiktokOrder.create_time * 1000 : 0,
          ).toLocaleDateString(),
          items: (tiktokOrder.line_items ?? []).map((item: any, liIndex: number) => ({
            name: item.product_name || item.sku_name || `Item ${liIndex + 1}`,
            quantity: Number(item.quantity) || 0,
          })),
          rawLineItems: (tiktokOrder.line_items ?? []).map((item: any) => ({
            id: item.id || item.order_line_id || item.line_item_id || "",
            product_name: item.product_name || item.sku_name || "",
            quantity: Number(item.quantity) || 0,
            sku_id: item.sku_id || "",
          })),
        }))

        setOrders(mappedOrders)
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to load TikTok Shop orders."
          console.error("[Fulfillment] Error loading orders:", message)
          setOrdersError(message)
          
          // Fallback to mock data on error
          const mockMappedOrders: MockOrder[] = mockTikTokOrdersResponse.data.orders.map((tiktokOrder: any, index: number) => ({
            orderId: tiktokOrder.id || tiktokOrder.order_id || `order-${index}`,
            productName: tiktokOrder.line_items?.[0]?.product_name || "Unknown Product",
            buyerNickname: tiktokOrder.buyer_nickname || tiktokOrder.buyer_user_id || `buyer-${index}`,
            customerName: tiktokOrder.recipient_address?.name || tiktokOrder.shipping_address?.name || "",
            quantity: tiktokOrder.line_items?.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0) || 0,
            price: parseFloat(tiktokOrder.payment?.total_amount || "0"),
            currency: tiktokOrder.payment?.currency || "USD",
            status: tiktokOrder.status || tiktokOrder.order_status || "UNKNOWN",
            createdDate: new Date(
              typeof tiktokOrder.create_time === "number" ? tiktokOrder.create_time * 1000 : 0,
            ).toLocaleDateString(),
            items: (tiktokOrder.line_items ?? []).map((item: any, liIndex: number) => ({
              name: item.product_name || item.sku_name || `Item ${liIndex + 1}`,
              quantity: Number(item.quantity) || 0,
            })),
            rawLineItems: (tiktokOrder.line_items ?? []).map((item: any) => ({
              id: item.id || item.order_line_id || item.line_item_id || "",
              product_name: item.product_name || item.sku_name || "",
              quantity: Number(item.quantity) || 0,
              sku_id: item.sku_id || "",
            })),
          }))
          setOrders(mockMappedOrders)
        }
      } finally {
        if (!cancelled) {
          setOrdersLoading(false)
        }
      }
    }

    void loadOrders()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  // Fetch TikTok Shop packages on mount
  useEffect(() => {
    let cancelled = false

    const loadPackages = async () => {
      if (!isLoaded) {
        return
      }

      setPackagesLoading(true)
      setPackagesError(null)

      try {
        const token = await waitForSessionToken(getToken)
        const result: TikTokShopPackagesSearchResponse = await searchTikTokShopPackages(token, {
          pageSize: 20,
          sortOrder: "DESC",
          sortField: "create_time",
          filters: {
            package_status: "PROCESSING",
          },
        })

        if (cancelled) {
          return
        }

        const mappedPackages = (result.packages ?? []).map((pkg, index) => mapTikTokPackageToRow(pkg, index))
        setPackages(mappedPackages)
      } catch (error) {
        if (cancelled) {
          return
        }
        const message = error instanceof Error ? error.message : "Unable to load TikTok Shop packages."
        setPackagesError(message)
        setPackages(mockPackages)
      } finally {
        if (!cancelled) {
          setPackagesLoading(false)
        }
      }
    }

    void loadPackages()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  const shipments = useMemo(() => mockShipments, [])

  const shipmentRows = shipments
  // Show all non-cancelled, non-delivered orders in the Orders tab
  const unfulfilledOrders = orders.filter((row) => {
    const s = row.status.toUpperCase()
    return s !== "DELIVERED" && s !== "COMPLETED" && s !== "CANCELLED"
  })
  const createdPackages = packages
  const shippedOrders = shipments

  function openCreatePackageModal(order: MockOrder) {
    setCreatePackageOrder(order)
    setSelectedItems(order.items.map((item) => item.name))
    setPackageForm({
      shipType: "1",
      dimLength: "",
      dimWidth: "",
      dimHeight: "",
      dimUnit: "CM",
      weightValue: "",
      weightUnit: "GRAM",
      shippingServiceId: "",
    })
    setPackageResult(null)
    setPackageError(null)
  }

  function openSplitOrderModal(orderId: string) {
    const found = orders.find((row) => row.orderId === orderId)
    const target: SplitOrderTarget = found
      ? {
          orderId: found.orderId,
          buyerNickname: found.buyerNickname,
          customerName: found.customerName,
          status: found.status,
          items: found.items,
          rawLineItems: found.rawLineItems,
        }
      : {
          orderId,
          buyerNickname: "-",
          customerName: "-",
          status: "UNKNOWN",
          items: [],
          rawLineItems: [],
        }

    const defaultIds = target.rawLineItems.map((item) => item.id).filter(Boolean)
    setSplitOrderTarget(target)
    setSplitGroupId("123")
    setSplitSelectedLineIds(defaultIds)
    setSplitManualLineIds(defaultIds.join(","))
    setSplitResult(null)
    setSplitError(null)
  }

  function buildSplitPayload(): SplitOrderPayload | null {
    if (!splitOrderTarget) {
      return null
    }

    const manualIds = splitManualLineIds
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)

    const finalLineIds = splitSelectedLineIds.length > 0
      ? splitSelectedLineIds
      : manualIds.length > 0
        ? manualIds
        : [splitOrderTarget.orderId]

    const gid = splitGroupId.trim() || "123"

    return {
      splittable_groups: [
        {
          id: gid,
          order_line_item_ids: finalLineIds,
        },
      ],
      splittable_groups_v2: [
        {
          id: gid,
          order_line_list: finalLineIds.map((lineId) => ({
            order_line_id: lineId,
            sub_item_id: lineId,
          })),
        },
      ],
    }
  }

  function triggerUiAction(action: string, identifier: string) {
    console.log(`[Fulfillment UI] ${action} - ${identifier}`)
    window.alert(`${action} triggered for ${identifier} (UI only)`)
  }

  function openShipPackageModal(packageId: string) {
    setShipPackageTarget(packageId)
    setShipHandoverMethod("")
    setShipPickupStart("")
    setShipPickupEnd("")
    setShipTrackingNumber("")
    setShipProviderId("")
    setShipLoading(false)
    setShipError(null)
    setShipResult(null)
  }

  function buildShipPackagePayload(): ShipPackagePayload {
    const payload: ShipPackagePayload = {}
    if (shipHandoverMethod) payload.handover_method = shipHandoverMethod
    if (shipHandoverMethod === "PICKUP" && (shipPickupStart || shipPickupEnd)) {
      payload.pickup_slot = {
        start_time: Number(shipPickupStart) || 0,
        end_time: Number(shipPickupEnd) || 0,
      }
    }
    if (shipTrackingNumber || shipProviderId) {
      payload.self_shipment = {
        tracking_number: shipTrackingNumber,
        shipping_provider_id: shipProviderId,
      }
    }
    return payload
  }

  async function confirmShipPackage() {
    if (!shipPackageTarget) return
    const payload = buildShipPackagePayload()
    setShipLoading(true)
    setShipError(null)
    setShipResult(null)
    try {
      const token = await waitForSessionToken(getToken)
      const result = await shipTikTokPackage(token, shipPackageTarget, payload)
      setShipResult(result)
    } catch (error) {
      setShipError(error instanceof Error ? error.message : "Failed to ship package.")
    } finally {
      setShipLoading(false)
    }
  }

  async function confirmSplitOrder() {
    if (!splitOrderTarget) {
      return
    }
    const payload = buildSplitPayload()
    if (!payload) {
      return
    }

    setSplitLoading(true)
    setSplitError(null)
    setSplitResult(null)
    try {
      const token = await waitForSessionToken(getToken)
      const result = await splitTikTokShopOrder(token, splitOrderTarget.orderId, payload)
      setSplitResult(result)
    } catch (error) {
      setSplitError(error instanceof Error ? error.message : "Failed to split order.")
    } finally {
      setSplitLoading(false)
    }
  }

  async function confirmCreatePackage() {
    if (!createPackageOrder) return

    setPackageLoading(true)
    setPackageError(null)
    setPackageResult(null)

    try {
      const token = await waitForSessionToken(getToken)
      const payload: CreatePackagePayload = {
        ship_type: packageForm.shipType,
        order_id: createPackageOrder.orderId,
        order_line_item: createPackageOrder.rawLineItems.map((item) => ({
          order_line_id: item.id || createPackageOrder.orderId,
          sub_item_id: item.id || createPackageOrder.orderId,
        })),
        dimension: {
          length: packageForm.dimLength || "0",
          width: packageForm.dimWidth || "0",
          height: packageForm.dimHeight || "0",
          unit: packageForm.dimUnit,
        },
        weight: {
          value: packageForm.weightValue || "0",
          unit: packageForm.weightUnit,
        },
        ...(packageForm.shippingServiceId ? { shipping_service_id: packageForm.shippingServiceId } : {}),
      }
      const result = await createTikTokShopPackage(token, payload)
      setPackageResult(result)
    } catch (error) {
      setPackageError(error instanceof Error ? error.message : "Failed to create package.")
    } finally {
      setPackageLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
              TikTok Shop Fulfillment
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Fulfillment</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              TikTok Shop style fulfillment workflow for orders, packages, and shipments. Built as a frontend-only prototype with mock data so APIs can be connected later without changing the UI structure.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="min-w-[150px]">
              <CardContent className="flex items-center gap-3 p-4">
                <ClipboardList className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Orders</p>
                  <p className="text-lg font-semibold">{orders.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="min-w-[150px]">
              <CardContent className="flex items-center gap-3 p-4">
                <Boxes className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Packages</p>
                  <p className="text-lg font-semibold">{packages.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="min-w-[150px]">
              <CardContent className="flex items-center gap-3 p-4">
                <Truck className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Shipments</p>
                  <p className="text-lg font-semibold">{shipments.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FulfillmentTab)} className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-xl border bg-muted/60 p-2">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="packages">Packages</TabsTrigger>
          <TabsTrigger value="shipments">Shipments</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Unfulfilled Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersError ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed bg-muted/30 p-8 text-center">
                  <div className="max-w-sm space-y-2">
                    <p className="text-base font-semibold text-red-600">Error Loading Orders</p>
                    <p className="text-sm text-muted-foreground">{ordersError}</p>
                  </div>
                </div>
              ) : ordersLoading ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed bg-muted/30 p-8">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Loading orders...</p>
                  </div>
                </div>
              ) : (
                <OrderTable
                  rows={unfulfilledOrders}
                  onCreatePackage={openCreatePackageModal}
                  onSplitOrder={(orderId) => openSplitOrderModal(orderId)}
                  onShipOrder={(orderId) => triggerUiAction("Ship Order", orderId)}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Created Packages</CardTitle>
            </CardHeader>
            <CardContent>
              {packagesError ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed bg-muted/30 p-8 text-center">
                  <div className="max-w-sm space-y-2">
                    <p className="text-base font-semibold text-red-600">Error Loading Packages</p>
                    <p className="text-sm text-muted-foreground">{packagesError}</p>
                  </div>
                </div>
              ) : packagesLoading ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed bg-muted/30 p-8">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Loading packages...</p>
                  </div>
                </div>
              ) : (
                <PackageTable
                  rows={createdPackages}
                  onAction={(action, packageRow) => {
                    if (action === "Split Order") {
                      openSplitOrderModal(packageRow.linkedOrderId)
                      return
                    }
                    if (action === "Ship Package") {
                      openShipPackageModal(packageRow.packageId)
                      return
                    }
                    triggerUiAction(action, packageRow.packageId)
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipments" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Shipped Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <ShipmentTable rows={shippedOrders} onTrackShipment={(row) => setTrackingShipment(row)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(createPackageOrder)} onOpenChange={(open) => { if (!open && !packageLoading) { setCreatePackageOrder(null) } }}>
        <DialogContent className="max-h-[90vh] w-[98vw] max-w-6xl overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Create Package</DialogTitle>
          </DialogHeader>

          {createPackageOrder ? (
            <div className="space-y-5">
              {/* 1. Order Details */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Order Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Order ID</p>
                    <p className="font-mono text-sm font-medium">{createPackageOrder.orderId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Buyer</p>
                    <p className="font-medium text-sm">{createPackageOrder.buyerNickname}</p>
                    {createPackageOrder.customerName && createPackageOrder.customerName !== createPackageOrder.buyerNickname ? (
                      <p className="text-xs text-muted-foreground">{createPackageOrder.customerName}</p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <StatusBadge variant={orderStatusVariant(createPackageOrder.status)}>
                      {createPackageOrder.status.replace(/_/g, " ")}
                    </StatusBadge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Order Total</p>
                    <p className="font-medium text-sm">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: createPackageOrder.currency || "USD" }).format(createPackageOrder.price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm">{createPackageOrder.createdDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Quantity</p>
                    <p className="font-medium text-sm">{createPackageOrder.quantity}</p>
                  </div>
                </CardContent>
              </Card>

              {/* 2. Line Items */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Line Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Line Item ID</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {createPackageOrder.rawLineItems.length > 0
                          ? createPackageOrder.rawLineItems.map((item, idx) => (
                              <TableRow key={`${item.id}-${idx}`}>
                                <TableCell className="text-sm">{item.product_name || "Unknown"}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">{item.id || "(no id)"}</TableCell>
                                <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                              </TableRow>
                            ))
                          : createPackageOrder.items.map((item, idx) => (
                              <TableRow key={`${item.name}-${idx}`}>
                                <TableCell className="text-sm">{item.name}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">-</TableCell>
                                <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                              </TableRow>
                            ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* 3. Package Configuration */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Package Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Ship Type */}
                  <div className="space-y-1.5">
                    <Label htmlFor="ship-type">Ship Type</Label>
                    <Select
                      value={packageForm.shipType}
                      onValueChange={(value) => setPackageForm((prev) => ({ ...prev, shipType: value }))}
                    >
                      <SelectTrigger id="ship-type">
                        <SelectValue placeholder="Select ship type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 — Seller Ship</SelectItem>
                        <SelectItem value="2">2 — TikTok Ship</SelectItem>
                        <SelectItem value="3">3 — Seller Self Delivery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Dimensions */}
                  <div className="space-y-1.5">
                    <Label>Dimensions</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Length</p>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="1.2"
                          value={packageForm.dimLength}
                          onChange={(e) => setPackageForm((prev) => ({ ...prev, dimLength: e.target.value }))}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Width</p>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.2"
                          value={packageForm.dimWidth}
                          onChange={(e) => setPackageForm((prev) => ({ ...prev, dimWidth: e.target.value }))}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Height</p>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.03"
                          value={packageForm.dimHeight}
                          onChange={(e) => setPackageForm((prev) => ({ ...prev, dimHeight: e.target.value }))}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Unit</p>
                        <Select
                          value={packageForm.dimUnit}
                          onValueChange={(value) => setPackageForm((prev) => ({ ...prev, dimUnit: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CM">CM</SelectItem>
                            <SelectItem value="INCH">INCH</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Weight */}
                  <div className="space-y-1.5">
                    <Label>Weight</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Value</p>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="1.2"
                          value={packageForm.weightValue}
                          onChange={(e) => setPackageForm((prev) => ({ ...prev, weightValue: e.target.value }))}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Unit</p>
                        <Select
                          value={packageForm.weightUnit}
                          onValueChange={(value) => setPackageForm((prev) => ({ ...prev, weightUnit: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GRAM">GRAM</SelectItem>
                            <SelectItem value="KILOGRAM">KILOGRAM</SelectItem>
                            <SelectItem value="OUNCE">OUNCE</SelectItem>
                            <SelectItem value="POUND">POUND</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Shipping Service ID */}
                  <div className="space-y-1.5">
                    <Label htmlFor="shipping-service-id">Shipping Service ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input
                      id="shipping-service-id"
                      placeholder="e.g. 288233559123860015"
                      value={packageForm.shippingServiceId}
                      onChange={(e) => setPackageForm((prev) => ({ ...prev, shippingServiceId: e.target.value }))}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 4. Request Preview */}
              {/* <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    Request Preview
                    <span className="text-xs font-normal text-muted-foreground">POST /fulfillment/202512/packages</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
                    {JSON.stringify(
                      {
                        ship_type: packageForm.shipType,
                        order_id: createPackageOrder.orderId,
                        order_line_item: createPackageOrder.rawLineItems.length > 0
                          ? createPackageOrder.rawLineItems.map((item) => ({
                              order_line_id: item.id || createPackageOrder.orderId,
                              sub_item_id: item.id || createPackageOrder.orderId,
                            }))
                          : [{ order_line_id: "(line item id)", sub_item_id: "(line item id)" }],
                        dimension: {
                          length: packageForm.dimLength || "0",
                          width: packageForm.dimWidth || "0",
                          height: packageForm.dimHeight || "0",
                          unit: packageForm.dimUnit,
                        },
                        weight: {
                          value: packageForm.weightValue || "0",
                          unit: packageForm.weightUnit,
                        },
                        ...(packageForm.shippingServiceId
                          ? { shipping_service_id: packageForm.shippingServiceId }
                          : {}),
                      },
                      null,
                      2,
                    )}
                  </pre>
                </CardContent>
              </Card> */}

              {/* 5. Error */}
              {packageError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {packageError}
                </div>
              ) : null}

              {/* 6. API Response */}
              {packageResult ? (
                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-emerald-700 flex items-center gap-2">
                      <PackageCheck className="h-4 w-4" />
                      Package Created {packageResult.isMockData ? "" : ""}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Package ID</p>
                        <p className="font-mono text-sm font-semibold">{packageResult.package_id || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Created At</p>
                        <p className="text-sm">
                          {packageResult.create_time
                            ? new Date(packageResult.create_time * 1000).toLocaleString()
                            : "-"}
                        </p>
                      </div>
                      {packageResult.shipping_service_info ? (
                        <>
                          <div>
                            <p className="text-xs text-muted-foreground">Shipping Service</p>
                            <p className="text-sm font-medium">{packageResult.shipping_service_info.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Carrier</p>
                            <p className="text-sm">{packageResult.shipping_service_info.shipping_provider_name || "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Price</p>
                            <p className="text-sm">
                              {packageResult.shipping_service_info.price} {packageResult.shipping_service_info.currency}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Delivery Window</p>
                            <p className="text-sm">
                              {packageResult.shipping_service_info.earliest_delivery_days}–{packageResult.shipping_service_info.latest_delivery_days} days
                            </p>
                          </div>
                        </>
                      ) : null}
                    </div>
                    {packageResult.dimension || packageResult.weight ? (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Package Specs</p>
                        <p className="text-xs font-mono bg-muted rounded px-2 py-1 inline-block">
                          {packageResult.dimension
                            ? `${packageResult.dimension.length} × ${packageResult.dimension.width} × ${packageResult.dimension.height} ${packageResult.dimension.unit}`
                            : ""}
                          {packageResult.dimension && packageResult.weight ? "  |  " : ""}
                          {packageResult.weight
                            ? `${packageResult.weight.value} ${packageResult.weight.unit}`
                            : ""}
                        </p>
                      </div>
                    ) : null}
                    <details className="cursor-pointer">
                      <summary className="text-xs text-muted-foreground">View full response</summary>
                      <pre className="mt-2 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
                        {JSON.stringify(packageResult, null, 2)}
                      </pre>
                    </details>
                  </CardContent>
                </Card>
              ) : null}

              {/* 7. Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={packageLoading}
                  onClick={() => { setCreatePackageOrder(null) }}
                >
                  {packageResult ? "Close" : "Cancel"}
                </Button>
                {!packageResult ? (
                  <Button type="button" disabled={packageLoading} onClick={confirmCreatePackage}>
                    {packageLoading ? "Creating Package…" : "Create Package"}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(splitOrderTarget)}
        onOpenChange={(open) => {
          if (!open && !splitLoading) {
            setSplitOrderTarget(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-[98vw] max-w-5xl overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Split Order</DialogTitle>
          </DialogHeader>

          {splitOrderTarget ? (
            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Selected Order</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Order ID (Path Param)</p>
                    <p className="font-mono text-sm font-medium">{splitOrderTarget.orderId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Buyer</p>
                    <p className="text-sm font-medium">{splitOrderTarget.buyerNickname}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <StatusBadge variant={orderStatusVariant(splitOrderTarget.status)}>
                      {splitOrderTarget.status.replace(/_/g, " ")}
                    </StatusBadge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Endpoint</p>
                    <p className="font-mono text-xs">/fulfillment/202309/orders/{splitOrderTarget.orderId}/split</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Split Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="split-group-id">Splittable Group ID</Label>
                    <Input
                      id="split-group-id"
                      value={splitGroupId}
                      onChange={(event) => setSplitGroupId(event.target.value)}
                      placeholder="123"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Select Line Items to Split</Label>
                    {splitOrderTarget.rawLineItems.length > 0 ? (
                      <div className="space-y-2">
                        {splitOrderTarget.rawLineItems.map((item, idx) => (
                          <label key={`${item.id}-${idx}`} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                            <Checkbox
                              checked={splitSelectedLineIds.includes(item.id)}
                              onCheckedChange={(checked) => {
                                setSplitSelectedLineIds((prev) => {
                                  if (checked) {
                                    return prev.includes(item.id) ? prev : [...prev, item.id]
                                  }
                                  return prev.filter((lineId) => lineId !== item.id)
                                })
                              }}
                            />
                            <span className="flex-1">{item.product_name || `Item ${idx + 1}`}</span>
                            <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No line item IDs were available for this row. Enter manually below.</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="manual-line-ids">Manual Line Item IDs (comma separated)</Label>
                    <Input
                      id="manual-line-ids"
                      value={splitManualLineIds}
                      onChange={(event) => setSplitManualLineIds(event.target.value)}
                      placeholder="57646237751283022,576462377512830223"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Request Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
                    {JSON.stringify(buildSplitPayload(), null, 2)}
                  </pre>
                </CardContent>
              </Card> */}

              {splitError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {splitError}
                </div>
              ) : null}

              {splitResult ? (
                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-emerald-700">Split Order Response {splitResult.isMockData ? "" : ""}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">Packages Created</p>
                    <div className="space-y-2">
                      {splitResult.packages.map((pkg, idx) => (
                        <div key={`${pkg.id}-${idx}`} className="rounded-md border bg-white px-3 py-2 text-sm">
                          <p><span className="text-muted-foreground">splittable_group_id:</span> <span className="font-mono">{pkg.splittable_group_id}</span></p>
                          <p><span className="text-muted-foreground">id:</span> <span className="font-mono">{pkg.id}</span></p>
                        </div>
                      ))}
                    </div>
                    <details className="cursor-pointer">
                      <summary className="text-xs text-muted-foreground">View full response</summary>
                      <pre className="mt-2 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
                        {JSON.stringify(splitResult, null, 2)}
                      </pre>
                    </details>
                  </CardContent>
                </Card>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={splitLoading} onClick={() => setSplitOrderTarget(null)}>
                  {splitResult ? "Close" : "Cancel"}
                </Button>
                {!splitResult ? (
                  <Button type="button" disabled={splitLoading} onClick={confirmSplitOrder}>
                    {splitLoading ? "Splitting Order..." : "Confirm Split"}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Ship Package Modal */}
      <Dialog open={Boolean(shipPackageTarget)} onOpenChange={(open) => { if (!open && !shipLoading) setShipPackageTarget(null) }}>
        <DialogContent className="max-h-[90vh] w-[98vw] max-w-4xl overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Ship Package</DialogTitle>
          </DialogHeader>

          {shipPackageTarget ? (
            <div className="space-y-5">
              {/* Package Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Package</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Package ID</p>
                  <p className="font-mono text-sm font-semibold">{shipPackageTarget}</p>
                </CardContent>
              </Card>

              {/* Ship Configuration */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Ship Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label>Handover Method</Label>
                    <Select
                      value={shipHandoverMethod}
                      onValueChange={(v) => setShipHandoverMethod(v as "PICKUP" | "DROP_OFF")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select handover method..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PICKUP">PICKUP — Logistics carrier picks up from seller address</SelectItem>
                        <SelectItem value="DROP_OFF">DROP_OFF — Seller drops off at designated location</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {shipHandoverMethod === "PICKUP" && (
                    <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
                      <p className="col-span-full text-xs font-medium text-muted-foreground">Pickup Slot (Unix timestamps)</p>
                      <div className="space-y-1">
                        <Label>Start Time</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 1623812664"
                          value={shipPickupStart}
                          onChange={(e) => setShipPickupStart(e.target.value)}
                          disabled={shipLoading}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>End Time</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 1623812664"
                          value={shipPickupEnd}
                          onChange={(e) => setShipPickupEnd(e.target.value)}
                          disabled={shipLoading}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
                    <p className="col-span-full text-xs font-medium text-muted-foreground">Self-Shipment (optional — for merchant self-shipping)</p>
                    <div className="space-y-1">
                      <Label>Tracking Number</Label>
                      <Input
                        placeholder="e.g. JX12345"
                        value={shipTrackingNumber}
                        onChange={(e) => setShipTrackingNumber(e.target.value)}
                        disabled={shipLoading}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Shipping Provider ID</Label>
                      <Input
                        placeholder="e.g. 6617675021119438849"
                        value={shipProviderId}
                        onChange={(e) => setShipProviderId(e.target.value)}
                        disabled={shipLoading}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Request Preview */}
              {/* <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Request Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
                    {JSON.stringify(
                      {
                        package_id: shipPackageTarget,
                        body: buildShipPackagePayload(),
                      },
                      null,
                      2,
                    )}
                  </pre>
                </CardContent>
              </Card> */}

              {shipError && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {shipError}
                </p>
              )}

              {/* Response */}
              {shipResult ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-emerald-700">
                      Ship Package Response {shipResult?.isMockData ? "" : ""}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid gap-2 md:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Code</p>
                        <p className="font-semibold">{shipResult?.code}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Message</p>
                        <p className="font-semibold">{shipResult?.message}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Request ID</p>
                        <p className="break-all font-mono text-xs">{shipResult?.requestId ?? "—"}</p>
                      </div>
                    </div>
                    {shipResult?.isMockData && (
                      <p className="text-xs text-amber-600">
                        Shop not connected — mock response returned.
                        {shipResult?.reason ? ` Reason: ${shipResult.reason}` : ""}
                      </p>
                    )}
                    <details className="cursor-pointer">
                      <summary className="text-xs text-muted-foreground">View full response</summary>
                      <pre className="mt-2 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
                        {JSON.stringify(shipResult, null, 2)}
                      </pre>
                    </details>
                  </CardContent>
                </Card>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={shipLoading} onClick={() => setShipPackageTarget(null)}>
                  {shipResult ? "Close" : "Cancel"}
                </Button>
                {!shipResult ? (
                  <Button type="button" disabled={shipLoading} onClick={confirmShipPackage}>
                    {shipLoading ? "Shipping..." : "Confirm Ship"}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(trackingShipment)} onOpenChange={(open) => (!open ? setTrackingShipment(null) : null)}>
        <DialogContent className="max-h-[85vh] w-[95vw] max-w-3xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Tracking View</DialogTitle>
          </DialogHeader>

          {trackingShipment ? (
            <div className="space-y-4">
              <Card>
                <CardContent className="grid gap-3 p-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Shipment ID</p>
                    <p className="font-medium">{trackingShipment.shipmentId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Package ID</p>
                    <p className="font-medium">{trackingShipment.packageId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Carrier</p>
                    <p className="font-medium">{trackingShipment.carrierName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tracking Number</p>
                    <p className="font-medium">{trackingShipment.trackingNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Delivery Status</p>
                    <StatusBadge variant={shipmentStatusVariant(trackingShipment.deliveryStatus)}>{trackingShipment.deliveryStatus}</StatusBadge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated Delivery</p>
                    <p className="font-medium">{trackingShipment.estimatedDeliveryDate}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tracking Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {trackingShipment.timeline.map((step, stepIndex) => (
                    <div key={`${trackingShipment.shipmentId}-${step.label}-${stepIndex}`} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${step.done ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                        <span className={step.done ? "font-medium" : "text-muted-foreground"}>{step.label}</span>
                      </div>
                      <span className="text-muted-foreground">{step.timestamp}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
