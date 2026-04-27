"use client"

import { Printer, Ticket } from "lucide-react"

import { StaffLiveSyncBanner } from "@/components/staff/staff-live-sync-banner"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { useSimulatedFetch } from "@/lib/staff/use-simulated-fetch"
import { listWorkspaceOrders, updateWorkspaceOrder } from "@/lib/staff/mock-order-workspace"
import type { MockOrder } from "@/lib/staff/mock-workspace-data"

function buildMockTracking() {
  const suffix = Math.floor(Math.random() * 1_000_000_000_000)
    .toString()
    .padStart(12, "0")
  return `940011189922${suffix}`
}

export function LabellingPage() {
  const { toast } = useToast()
  const fetch = useSimulatedFetch<MockOrder[]>(
    "staff-labelling",
    () => listWorkspaceOrders().filter((order) => order.status === "label_ready"),
    { minDelay: 430, pollInterval: 19_000, refreshDelay: 340 },
  )

  const labelOrders = fetch.data || []

  function handleGenerateLabel(order: MockOrder) {
    const tracking = buildMockTracking()
    const labelUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"

    updateWorkspaceOrder(order.id, {
      status: "shipped",
      tracking,
      labelUrl,
    })

    toast({
      title: "Label generated",
      description: `${order.orderNumber} is now marked shipped with tracking ${tracking} (simulated).`,
    })

    void fetch.refetch()
  }

  return (
    <StaffModuleGate
      moduleId="labelling"
      title="Order fulfillment · Labelling"
      description="Generate carrier-compliant labels and push tracking back to marketplaces (simulated)."
    >
      <StaffLiveSyncBanner
        lastUpdated={fetch.lastUpdated}
        isRefreshing={fetch.isRefreshing}
        onRefresh={() => void fetch.refetch()}
      />

      {fetch.isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading label queue…</CardContent>
        </Card>
      ) : fetch.error ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-sm text-destructive">{fetch.error}</CardContent>
        </Card>
      ) : labelOrders.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No labels pending</CardTitle>
            <CardDescription>
              When packing marks an order as packed, it appears here for label generation and scan verification.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {labelOrders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Ticket className="size-5 text-primary" />
                    <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="font-normal">
                    {order.carrier}
                  </Badge>
                </div>
                <CardDescription>{order.customer}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="font-medium">Shipment contents</p>
                  <Separator className="my-2" />
                  <ul className="space-y-2">
                    {order.lines.map((line) => (
                      <li key={`${order.id}-${line.sku}`} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{line.title}</span>
                        <span className="tabular-nums font-medium">×{line.qty}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground">
                  Scan pack verification + weight capture would run here in production. This build simulates a
                  successful carrier handshake.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => handleGenerateLabel(order)}>
                    <Printer className="mr-2 size-4" />
                    Generate label & mark shipped
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <a href="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" target="_blank" rel="noreferrer">
                      Preview sample PDF
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </StaffModuleGate>
  )
}
