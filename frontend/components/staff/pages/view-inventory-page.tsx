"use client"

import { StaffLiveSyncBanner } from "@/components/staff/staff-live-sync-banner"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSimulatedFetch } from "@/lib/staff/use-simulated-fetch"
import {
  cloneProducts,
  jitterPlatformStock,
  MOCK_PRODUCTS,
  type MockProduct,
} from "@/lib/staff/mock-workspace-data"

function isLowStock(product: MockProduct) {
  return product.hubStock <= 24
}

export function ViewInventoryPage() {
  const fetch = useSimulatedFetch<MockProduct[]>(
    "staff-view-inventory",
    () => {
      const seed = Date.now()
      return cloneProducts(MOCK_PRODUCTS).map((product, index) => ({
        ...product,
        tiktokStock: jitterPlatformStock(product.tiktokStock, seed + index * 11),
        whatnotStock: jitterPlatformStock(product.whatnotStock, seed + index * 17),
      }))
    },
    { minDelay: 500, pollInterval: 14_000, refreshDelay: 400 },
  )

  return (
    <StaffModuleGate
      moduleId="view_inventory"
      title="View Inventory"
      description="Read-only snapshot of hub inventory with marketplace mirrors (simulated live counters)."
    >
      <StaffLiveSyncBanner
        lastUpdated={fetch.lastUpdated}
        isRefreshing={fetch.isRefreshing}
        onRefresh={() => void fetch.refetch()}
      />

      {fetch.isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading inventory…</CardContent>
        </Card>
      ) : fetch.error ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-sm text-destructive">{fetch.error}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle>Inventory overview</CardTitle>
              <p className="text-sm text-muted-foreground">
                Hub is the source of truth. TikTok Shop and Whatnot quantities update as if synced in real time.
              </p>
            </div>
            <Badge variant="outline" className="font-normal">
              Read-only
            </Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Hub</TableHead>
                  <TableHead className="text-right">TikTok</TableHead>
                  <TableHead className="text-right">Whatnot</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead>Alert</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(fetch.data || []).map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.title}</TableCell>
                    <TableCell className="text-right tabular-nums">{product.hubStock}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {product.tiktokStock}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {product.whatnotStock}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{product.reservedUnits}</TableCell>
                    <TableCell>
                      {isLowStock(product) ? (
                        <Badge variant="destructive" className="font-normal">
                          Low stock
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">OK</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </StaffModuleGate>
  )
}
