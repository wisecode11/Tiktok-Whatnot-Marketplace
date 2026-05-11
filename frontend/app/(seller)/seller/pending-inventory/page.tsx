"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getClerkErrorMessage,
  getSellerPendingInventory,
  type SellerPendingInventoryItem,
  syncSellerPendingInventoryItem,
  waitForSessionToken,
} from "@/lib/auth"

function getStatusClasses(status: string) {
  const normalized = String(status || "").toUpperCase()
  if (normalized === "SYNCED") {
    return "bg-emerald-500/15 text-emerald-700"
  }
  if (normalized === "FAILED") {
    return "bg-destructive/10 text-destructive"
  }
  return "bg-amber-500/15 text-amber-700"
}

export default function SellerPendingInventoryPage() {
  const { getToken, isLoaded } = useAuth()
  const [items, setItems] = useState<SellerPendingInventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null)

  const loadPendingInventory = useCallback(
    async (isManualRefresh: boolean) => {
      try {
        if (isManualRefresh) {
          setIsRefreshing(true)
        } else {
          setIsLoading(true)
        }
        setErrorMessage("")
        const token = await waitForSessionToken(getToken)
        const result = await getSellerPendingInventory(token)
        setItems(Array.isArray(result.items) ? result.items : [])
      } catch (loadError) {
        setItems([])
        setErrorMessage(getClerkErrorMessage(loadError))
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [getToken],
  )

  useEffect(() => {
    if (!isLoaded) return
    void loadPendingInventory(false)
  }, [isLoaded, loadPendingInventory])

  async function handleSyncProduct(itemId: string) {
    try {
      setSyncingItemId(itemId)
      setErrorMessage("")
      const token = await waitForSessionToken(getToken)
      await syncSellerPendingInventoryItem(token, itemId)
      await loadPendingInventory(true)
    } catch (syncError) {
      setErrorMessage(getClerkErrorMessage(syncError))
    } finally {
      setSyncingItemId(null)
    }
  }

  const pendingCount = useMemo(
    () => items.filter((item) => String(item.status || "").toUpperCase() === "PENDING").length,
    [items],
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Staff Listings" description="Products created by staff and waiting to be synced to Whatnot.">
        <Button variant="outline" onClick={() => void loadPendingInventory(true)} disabled={isRefreshing}>
          {isRefreshing ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing...
            </span>
          ) : (
            "Refresh"
          )}
        </Button>
      </PageHeader>

      <Card className="border-border/50 bg-card/50">
        <CardContent className="space-y-4 p-4 md:p-5">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Total items: {items.length}</span>
            <span>Pending sync: {pendingCount}</span>
          </div>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

          <div className="overflow-hidden rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Product</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price (USD)</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[120px]">Sync Error</TableHead>
                  <TableHead className="w-[170px]">Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading pending inventory...
                      </span>
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map((item) => {
                    const status = String(item.status || "PENDING").toUpperCase()
                    const isSyncable = status === "PENDING" || status === "FAILED"
                    const isSyncing = syncingItemId === item.id
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium">{item.title || "Untitled inventory"}</p>
                          <p className="text-xs text-muted-foreground">{item.description || "-"}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{item.createdByName || "-"}</p>
                          <p className="text-xs text-muted-foreground">{item.createdByEmail || "-"}</p>
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{Number(item.priceUsd).toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(status)}`}>
                            {status}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">
                          {item.syncError || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.createdByName || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={() => void handleSyncProduct(item.id)}
                            disabled={!isSyncable || isSyncing}
                          >
                            {isSyncing ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Syncing...
                              </span>
                            ) : (
                              "Sync"
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No pending inventory created by staff yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
