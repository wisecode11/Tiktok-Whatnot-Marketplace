"use client"

import { useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Sparkles } from "lucide-react"

import { StaffLiveSyncBanner } from "@/components/staff/staff-live-sync-banner"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import { PlatformSyncBadge } from "@/components/staff/pages/staff-sync-badges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useSimulatedFetch } from "@/lib/staff/use-simulated-fetch"
import { cloneProducts, MOCK_PRODUCTS, type MockProduct, type SyncState } from "@/lib/staff/mock-workspace-data"

function simulateListingPush(product: MockProduct): MockProduct {
  return {
    ...product,
    tiktokSync: "pending" as SyncState,
    whatnotSync: "pending" as SyncState,
    lastPushedAt: new Date().toISOString(),
  }
}

function simulateListingSettled(product: MockProduct): MockProduct {
  return {
    ...product,
    tiktokSync: "synced",
    whatnotSync: Math.random() > 0.12 ? "synced" : "pending",
    lastPushedAt: new Date().toISOString(),
  }
}

export function ProductManagementPage() {
  const { toast } = useToast()
  const fetch = useSimulatedFetch<MockProduct[]>(
    "staff-product-management",
    () => cloneProducts(MOCK_PRODUCTS),
    { minDelay: 520, pollInterval: 22_000, refreshDelay: 360 },
  )

  const [rows, setRows] = useState<MockProduct[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MockProduct | null>(null)
  const [form, setForm] = useState({
    sku: "",
    title: "",
    priceUsd: "",
    hubStock: "",
    notes: "",
  })

  useEffect(() => {
    if (fetch.data) {
      setRows(fetch.data)
    }
  }, [fetch.data])

  const openCreate = () => {
    setEditing(null)
    setForm({ sku: "", title: "", priceUsd: "", hubStock: "", notes: "" })
    setDialogOpen(true)
  }

  const openEdit = (product: MockProduct) => {
    setEditing(product)
    setForm({
      sku: product.sku,
      title: product.title,
      priceUsd: String(product.priceUsd),
      hubStock: String(product.hubStock),
      notes: "",
    })
    setDialogOpen(true)
  }

  const canSubmit = useMemo(() => {
    return Boolean(form.sku.trim() && form.title.trim() && form.priceUsd && form.hubStock)
  }, [form.hubStock, form.priceUsd, form.sku, form.title])

  function scheduleSync(productId: string) {
    window.setTimeout(() => {
      setRows((current) => current.map((row) => (row.id === productId ? simulateListingSettled(row) : row)))
    }, 900)
  }

  function handleSubmit() {
    if (!canSubmit) {
      return
    }

    const sku = form.sku.trim()
    if (!editing && rows.some((row) => row.sku.toLowerCase() === sku.toLowerCase())) {
      toast({
        title: "Duplicate SKU",
        description: "That SKU already exists in the catalog. Choose a unique SKU.",
        variant: "destructive",
      })
      return
    }

    const price = Number(form.priceUsd)
    const hub = Number(form.hubStock)
    if (Number.isNaN(price) || Number.isNaN(hub)) {
      toast({ title: "Invalid numbers", description: "Price and hub stock must be numeric.", variant: "destructive" })
      return
    }

    if (editing) {
      const updated: MockProduct = {
        ...editing,
        sku,
        title: form.title.trim(),
        priceUsd: price,
        hubStock: hub,
        tiktokStock: Math.max(0, hub - 1),
        whatnotStock: Math.max(0, hub - 2),
      }
      const pushed = simulateListingPush(updated)
      setRows((current) => current.map((row) => (row.id === editing.id ? pushed : row)))
      scheduleSync(editing.id)
      toast({
        title: "Listing update queued",
        description: "Changes are propagating to TikTok Shop and Whatnot (simulated).",
      })
    } else {
      const id = `p-local-${Date.now()}`
      const created: MockProduct = simulateListingPush({
        id,
        sku,
        title: form.title.trim(),
        priceUsd: price,
        hubStock: hub,
        tiktokStock: hub,
        whatnotStock: hub,
        reservedUnits: 0,
        tiktokSync: "pending",
        whatnotSync: "pending",
        lastPushedAt: new Date().toISOString(),
      })
      setRows((current) => [created, ...current])
      scheduleSync(id)
      toast({
        title: "Draft listing created",
        description: "SKU is now visible in hub and queued for marketplace sync (simulated).",
      })
    }

    setDialogOpen(false)
  }

  return (
    <StaffModuleGate
      moduleId="add_edit_products"
      title="Product management"
      description="Create and manage listings as if they sync in real time with TikTok Shop and Whatnot."
    >
      <StaffLiveSyncBanner
        lastUpdated={fetch.lastUpdated}
        isRefreshing={fetch.isRefreshing}
        onRefresh={() => void fetch.refetch()}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="font-normal">
            <Sparkles className="mr-1 size-3" />
            Listing quality checks (simulated)
          </Badge>
          <Badge variant="outline" className="font-normal">
            Duplicate SKU guard · on
          </Badge>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          New product
        </Button>
      </div>

      {fetch.isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading catalog…</CardContent>
        </Card>
      ) : fetch.error ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-sm text-destructive">{fetch.error}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
            <p className="text-sm text-muted-foreground">
              Edit listings, adjust pricing, and watch marketplace sync states update like production telemetry.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Hub stock</TableHead>
                  <TableHead>Marketplaces</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.title}</TableCell>
                    <TableCell className="text-right tabular-nums">${product.priceUsd.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{product.hubStock}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <PlatformSyncBadge state={product.tiktokSync} label="TikTok" />
                        <PlatformSyncBadge state={product.whatnotSync} label="Whatnot" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(product)}>
                        <Pencil className="mr-1.5 size-3.5" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit listing" : "Create listing"}</DialogTitle>
            <DialogDescription>
              This form mimics a production listing editor. Saving triggers a simulated dual-marketplace sync job.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
                placeholder="SKU-NEW-01"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Product title"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input
                  id="price"
                  inputMode="decimal"
                  value={form.priceUsd}
                  onChange={(event) => setForm((current) => ({ ...current, priceUsd: event.target.value }))}
                  placeholder="29.99"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hub">Hub starting stock</Label>
                <Input
                  id="hub"
                  inputMode="numeric"
                  value={form.hubStock}
                  onChange={(event) => setForm((current) => ({ ...current, hubStock: event.target.value }))}
                  placeholder="40"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Internal notes (optional)</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Show schedule, bundle rules, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              Save & sync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffModuleGate>
  )
}
