"use client"

import { useMemo, useState } from "react"
import { History } from "lucide-react"

import { StaffLiveSyncBanner } from "@/components/staff/staff-live-sync-banner"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useSimulatedFetch } from "@/lib/staff/use-simulated-fetch"
import { listWorkspaceOrders, setWorkspaceOrderStatus } from "@/lib/staff/mock-order-workspace"
import type { MockOrder, OrderStatus } from "@/lib/staff/mock-workspace-data"

const ALL_STATUSES: OrderStatus[] = [
  "paid",
  "processing",
  "packing",
  "label_ready",
  "shipped",
  "delivered",
]

const STATUS_LABEL: Record<OrderStatus, string> = {
  paid: "Paid",
  processing: "Processing",
  packing: "Packing",
  label_ready: "Label ready",
  shipped: "Shipped",
  delivered: "Delivered",
}

export function OrderStatusPage() {
  const { toast } = useToast()
  const [draft, setDraft] = useState<Record<string, OrderStatus>>({})

  const fetch = useSimulatedFetch<MockOrder[]>(
    "staff-order-status",
    () => listWorkspaceOrders(),
    { minDelay: 440, pollInterval: 17_000, refreshDelay: 340 },
  )

  const orders = fetch.data || []

  const rows = useMemo(() => {
    return orders.map((order) => ({
      order,
      nextStatus: draft[order.id] ?? order.status,
    }))
  }, [draft, orders])

  function apply(order: MockOrder) {
    const next = draft[order.id] ?? order.status
    if (next === order.status) {
      toast({ title: "No change", description: "Select a different status before applying." })
      return
    }

    setWorkspaceOrderStatus(order.id, next)
    setDraft((current) => {
      const { [order.id]: _removed, ...rest } = current
      return rest
    })

    toast({
      title: "Status updated",
      description: `${order.orderNumber} is now ${STATUS_LABEL[next]}. Marketplaces and buyers are notified (simulated).`,
    })

    void fetch.refetch()
  }

  return (
    <StaffModuleGate
      moduleId="order_status_update"
      title="Order fulfillment · Status updates"
      description="Move orders through the operational lifecycle with guardrails and instant downstream notifications (simulated)."
    >
      <StaffLiveSyncBanner
        lastUpdated={fetch.lastUpdated}
        isRefreshing={fetch.isRefreshing}
        onRefresh={() => void fetch.refetch()}
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Order status console</CardTitle>
            <p className="text-sm text-muted-foreground">
              Changes here mimic webhook-driven updates to TikTok Shop and Whatnot order timelines.
            </p>
          </div>
          <Badge variant="outline" className="font-normal">
            <History className="mr-1 size-3" />
            Audit trail (simulated)
          </Badge>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {fetch.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading orders…</p>
          ) : fetch.error ? (
            <p className="py-10 text-center text-sm text-destructive">{fetch.error}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead className="min-w-[220px]">Next status</TableHead>
                  <TableHead className="text-right">Apply</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ order, nextStatus }) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs font-medium">{order.orderNumber}</TableCell>
                    <TableCell>{order.customer}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {STATUS_LABEL[order.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={nextStatus}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            [order.id]: value as OrderStatus,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose status" />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {STATUS_LABEL[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" onClick={() => apply(order)}>
                        Apply
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </StaffModuleGate>
  )
}
