"use client"

import { useState } from "react"
import { CheckCircle2, Package } from "lucide-react"

import { StaffLiveSyncBanner } from "@/components/staff/staff-live-sync-banner"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { useSimulatedFetch } from "@/lib/staff/use-simulated-fetch"
import { listWorkspaceOrders, setWorkspaceOrderStatus } from "@/lib/staff/mock-order-workspace"
import type { MockOrder } from "@/lib/staff/mock-workspace-data"

const DEFAULT_CHECKLIST = ["Verify pick list", "Bubble wrap fragile SKUs", "Include thank-you insert", "Weigh parcel"]

export function PackingPage() {
  const { toast } = useToast()
  const fetch = useSimulatedFetch<MockOrder[]>(
    "staff-packing",
    () => listWorkspaceOrders().filter((order) => order.status === "packing"),
    { minDelay: 420, pollInterval: 18_000, refreshDelay: 340 },
  )

  const [checklistState, setChecklistState] = useState<Record<string, Record<string, boolean>>>({})

  const packingOrders = fetch.data || []

  function getChecks(orderId: string) {
    const stored = checklistState[orderId] || {}
    const map: Record<string, boolean> = {}
    for (const item of DEFAULT_CHECKLIST) {
      map[item] = Boolean(stored[item])
    }
    return map
  }

  function toggleCheck(orderId: string, item: string, checked: boolean) {
    setChecklistState((current) => {
      const previous = current[orderId] || {}
      return {
        ...current,
        [orderId]: {
          ...previous,
          [item]: checked,
        },
      }
    })
  }

  function allChecked(order: MockOrder) {
    const map = getChecks(order.id)
    return DEFAULT_CHECKLIST.every((item) => map[item])
  }

  function handleMarkPacked(order: MockOrder) {
    if (!allChecked(order)) {
      toast({
        title: "Checklist incomplete",
        description: "Complete all packing checkpoints before marking packed (simulated warehouse rule).",
        variant: "destructive",
      })
      return
    }

    setWorkspaceOrderStatus(order.id, "label_ready")
    toast({
      title: "Packed successfully",
      description: `${order.orderNumber} moved to Label ready. Open Labelling to generate the shipping label.`,
    })
    void fetch.refetch()
  }

  return (
    <StaffModuleGate
      moduleId="packing"
      title="Order fulfillment · Packing"
      description="Guided packing workflow with guardrails so fragile SKUs and inserts are not missed (simulated)."
    >
      <StaffLiveSyncBanner
        lastUpdated={fetch.lastUpdated}
        isRefreshing={fetch.isRefreshing}
        onRefresh={() => void fetch.refetch()}
      />

      {fetch.isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading packing queue…</CardContent>
        </Card>
      ) : fetch.error ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-sm text-destructive">{fetch.error}</CardContent>
        </Card>
      ) : packingOrders.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No orders in packing</CardTitle>
            <CardDescription>Everything is either upstream (processing) or downstream (labels/shipped).</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {packingOrders.map((order) => {
            const map = getChecks(order.id)
            return (
              <Card key={order.id}>
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Package className="size-5 text-primary" />
                      <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                    </div>
                    <Badge variant="outline" className="font-normal">
                      {order.carrier}
                    </Badge>
                  </div>
                  <CardDescription>{order.customer}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Pick list</p>
                    <Separator className="my-2" />
                    <ul className="space-y-2 text-sm">
                      {order.lines.map((line) => (
                        <li key={`${order.id}-${line.sku}`} className="flex justify-between gap-3">
                          <span className="text-muted-foreground">{line.title}</span>
                          <span className="tabular-nums font-medium">×{line.qty}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Packing checklist</p>
                    <div className="mt-3 space-y-3">
                      {DEFAULT_CHECKLIST.map((item) => (
                        <label key={item} className="flex items-start gap-3 text-sm">
                          <Checkbox
                            checked={Boolean(map[item])}
                            onCheckedChange={(value) => toggleCheck(order.id, item, value === true)}
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button type="button" className="w-full" onClick={() => handleMarkPacked(order)}>
                    <CheckCircle2 className="mr-2 size-4" />
                    Mark packed → Label ready
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </StaffModuleGate>
  )
}
