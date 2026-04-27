"use client"

import { useMemo, useState } from "react"

import { StaffLiveSyncBanner } from "@/components/staff/staff-live-sync-banner"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSimulatedFetch } from "@/lib/staff/use-simulated-fetch"
import { listWorkspaceOrders } from "@/lib/staff/mock-order-workspace"
import type { MockOrder, OrderStatus } from "@/lib/staff/mock-workspace-data"

const STATUS_LABEL: Record<OrderStatus, string> = {
  paid: "Paid",
  processing: "Processing",
  packing: "Packing",
  label_ready: "Label ready",
  shipped: "Shipped",
  delivered: "Delivered",
}

function statusVariant(status: OrderStatus) {
  if (status === "shipped" || status === "delivered") {
    return "secondary" as const
  }
  if (status === "packing" || status === "label_ready") {
    return "default" as const
  }
  return "outline" as const
}

export function ViewOrdersPage() {
  const [selected, setSelected] = useState<MockOrder | null>(null)
  const [filter, setFilter] = useState<"all" | OrderStatus>("all")

  const fetch = useSimulatedFetch<MockOrder[]>(
    "staff-view-orders",
    () => listWorkspaceOrders(),
    { minDelay: 460, pollInterval: 16_000, refreshDelay: 360 },
  )

  const rows = useMemo(() => {
    const orders = fetch.data || []
    if (filter === "all") {
      return orders
    }
    return orders.filter((order) => order.status === filter)
  }, [fetch.data, filter])

  return (
    <StaffModuleGate
      moduleId="view_orders"
      title="Order fulfillment · Orders"
      description="Operational queue with live refresh (simulated) across packing, labelling, and carrier updates."
    >
      <StaffLiveSyncBanner
        lastUpdated={fetch.lastUpdated}
        isRefreshing={fetch.isRefreshing}
        onRefresh={() => void fetch.refetch()}
      />

      <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="processing">Processing</TabsTrigger>
          <TabsTrigger value="packing">Packing</TabsTrigger>
          <TabsTrigger value="label_ready">Label ready</TabsTrigger>
          <TabsTrigger value="shipped">Shipped</TabsTrigger>
        </TabsList>
      </Tabs>

      {fetch.isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading orders…</CardContent>
        </Card>
      ) : fetch.error ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-sm text-destructive">{fetch.error}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <p className="text-sm text-muted-foreground">
              Click a row to inspect line items, carrier selection, and simulated marketplace order IDs.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Placed</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(order)}
                  >
                    <TableCell className="font-mono text-xs font-medium">{order.orderNumber}</TableCell>
                    <TableCell>{order.customer}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
                        new Date(order.placedAt),
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{order.carrier}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(order.status)} className="font-normal">
                        {STATUS_LABEL[order.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{order.lines.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selected?.orderNumber}</SheetTitle>
            <SheetDescription>Order detail snapshot (simulated).</SheetDescription>
          </SheetHeader>
          {selected ? (
            <ScrollArea className="mt-4 h-[calc(100vh-8rem)] pr-4">
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(selected.status)}>{STATUS_LABEL[selected.status]}</Badge>
                  <Badge variant="outline" className="font-mono text-xs">
                    TT-{selected.id.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs">
                    WN-{selected.orderNumber.replace("MH-", "")}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{selected.customer}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Carrier</p>
                  <p className="font-medium">{selected.carrier}</p>
                </div>
                {selected.tracking ? (
                  <div>
                    <p className="text-muted-foreground">Tracking</p>
                    <p className="font-mono text-xs">{selected.tracking}</p>
                  </div>
                ) : null}
                <Separator />
                <p className="font-medium">Line items</p>
                <div className="space-y-2">
                  {selected.lines.map((line) => (
                    <div key={`${selected.id}-${line.sku}`} className="rounded-md border border-border/70 p-3">
                      <p className="font-medium">{line.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.sku} · qty {line.qty}
                      </p>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>
            </ScrollArea>
          ) : null}
        </SheetContent>
      </Sheet>
    </StaffModuleGate>
  )
}
