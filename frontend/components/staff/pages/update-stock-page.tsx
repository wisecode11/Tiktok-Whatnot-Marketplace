"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Save } from "lucide-react"

import { StaffLiveSyncBanner } from "@/components/staff/staff-live-sync-banner"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { cloneProducts, MOCK_PRODUCTS, type MockProduct, type SyncState } from "@/lib/staff/mock-workspace-data"

export function UpdateStockPage() {
  const { toast } = useToast()
  const fetch = useSimulatedFetch<MockProduct[]>(
    "staff-update-stock",
    () => cloneProducts(MOCK_PRODUCTS),
    { minDelay: 480, refreshDelay: 380 },
  )

  const [rows, setRows] = useState<MockProduct[]>([])
  const [draft, setDraft] = useState<Record<string, number>>({})

  useEffect(() => {
    const snapshot = fetch.data
    if (!snapshot) {
      return
    }
    setRows(snapshot)
    setDraft((previous) => {
      const next: Record<string, number> = { ...previous }
      for (const product of snapshot) {
        if (typeof next[product.id] !== "number") {
          next[product.id] = product.hubStock
        }
      }
      return next
    })
  }, [fetch.data])

  const products = rows.length > 0 ? rows : fetch.data || []

  const oversellWarnings = useMemo(() => {
    return products
      .map((product) => {
        const value = draft[product.id]
        if (typeof value !== "number" || Number.isNaN(value)) {
          return null
        }
        const minSafe = product.reservedUnits
        if (value < minSafe) {
          return { id: product.id, sku: product.sku, minSafe }
        }
        return null
      })
      .filter(Boolean) as { id: string; sku: string; minSafe: number }[]
  }, [draft, products])

  function handleSave(product: MockProduct) {
    const nextHub = draft[product.id]
    if (typeof nextHub !== "number" || Number.isNaN(nextHub)) {
      toast({ title: "Invalid quantity", description: "Enter a numeric hub stock value.", variant: "destructive" })
      return
    }
    if (nextHub < product.reservedUnits) {
      toast({
        title: "Blocked to prevent overselling",
        description: `Hub stock cannot fall below reserved units (${product.reservedUnits}) for ${product.sku}.`,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Stock update queued",
      description: `${product.sku} → Hub ${nextHub}. TikTok Shop & Whatnot will mirror within seconds (simulated).`,
    })

    setRows((current) =>
      current.map((row) =>
        row.id === product.id
          ? {
              ...row,
              hubStock: nextHub,
              tiktokSync: "pending" as SyncState,
              whatnotSync: "pending" as SyncState,
              lastPushedAt: new Date().toISOString(),
            }
          : row,
      ),
    )

    setDraft((current) => ({
      ...current,
      [product.id]: nextHub,
    }))

    window.setTimeout(() => {
      setRows((current) =>
        current.map((row) =>
          row.id === product.id
            ? {
                ...row,
                tiktokStock: Math.max(0, nextHub - 1),
                whatnotStock: Math.max(0, nextHub - 2),
                tiktokSync: "synced",
                whatnotSync: Math.random() > 0.15 ? ("synced" as SyncState) : ("pending" as SyncState),
                lastPushedAt: new Date().toISOString(),
              }
            : row,
        ),
      )
    }, 850)
  }

  return (
    <StaffModuleGate
      moduleId="update_stock"
      title="Update Stock"
      description="Adjust hub quantities and push updates to connected marketplaces with instant feedback (simulated)."
    >
      <StaffLiveSyncBanner
        lastUpdated={fetch.lastUpdated}
        isRefreshing={fetch.isRefreshing}
        onRefresh={() => void fetch.refetch()}
      />

      {oversellWarnings.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Oversell guard</AlertTitle>
          <AlertDescription>
            Some rows are below reserved units committed to open orders. Saving is blocked until quantities are safe.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertTitle>Instant marketplace mirror</AlertTitle>
          <AlertDescription>
            When you save, we optimistically treat TikTok Shop and Whatnot as converging to the new hub quantity to
            prevent overselling during active shows (simulation).
          </AlertDescription>
        </Alert>
      )}

      {fetch.isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading stock editor…</CardContent>
        </Card>
      ) : fetch.error ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-sm text-destructive">{fetch.error}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Hub stock editor</CardTitle>
            <p className="text-sm text-muted-foreground">
              Edit hub on-hand counts. Platform columns are read-only here and reflect the last simulated sync.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">TikTok</TableHead>
                  <TableHead className="text-right">Whatnot</TableHead>
                  <TableHead className="w-[140px] text-right">Hub (editable)</TableHead>
                  <TableHead className="text-right">Save</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const hub = draft[product.id] ?? product.hubStock
                  const unsafe = hub < product.reservedUnits
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                      <TableCell className="font-medium">{product.title}</TableCell>
                      <TableCell className="text-right tabular-nums">{product.reservedUnits}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {product.tiktokStock}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {product.whatnotStock}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          className="ml-auto w-[120px] text-right tabular-nums"
                          inputMode="numeric"
                          value={String(hub)}
                          aria-invalid={unsafe}
                          onChange={(event) => {
                            const value = Number(event.target.value)
                            setDraft((current) => ({
                              ...current,
                              [product.id]: Number.isNaN(value) ? 0 : value,
                            }))
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" size="sm" variant="secondary" onClick={() => handleSave(product)}>
                          <Save className="mr-1.5 size-3.5" />
                          Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </StaffModuleGate>
  )
}
