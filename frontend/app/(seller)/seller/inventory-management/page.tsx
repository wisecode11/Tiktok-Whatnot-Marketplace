"use client"

import { useAuth } from "@clerk/nextjs"
import { useEffect, useMemo, useState } from "react"
import { Link2, Loader2, Plus, Search, SlidersHorizontal } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getClerkErrorMessage, syncWhatnotInventoryLive, waitForSessionToken } from "@/lib/auth"

type InventoryStatus = "ACTIVE" | "DRAFT" | "INACTIVE" | "SOLD_OUT"

interface InventoryItem {
  id: string
  name: string
  subtitle: string
  category: string
  quantity: number | null
  price: string
  format: string
  condition: string
  featuredIn: string
  status: string
}

function mapAmountToPrice(amount?: number | null, currency?: string | null) {
  if (amount == null || !Number.isFinite(Number(amount))) return "Not available"
  const code = currency || "USD"
  // Whatnot amount is cents-like integer in sample payload.
  return `${code} ${(Number(amount) / 100).toFixed(2)}`
}

export default function SellerInventoryManagementPage() {
  const { getToken, isLoaded } = useAuth()
  const [selectedTab, setSelectedTab] = useState<InventoryStatus>("ACTIVE")
  const [bulkEditEnabled, setBulkEditEnabled] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let cancelled = false

    async function syncInventory() {
      if (!isLoaded) return
      try {
        setIsLoading(true)
        setErrorMessage("")
        const token = await waitForSessionToken(getToken)
        const result = await syncWhatnotInventoryLive(token, selectedTab)

        const edges = result?.responsePayload?.data?.me?.inventory?.edges || []
        const mapped: InventoryItem[] = edges
          .map((edge) => edge?.node)
          .filter((node): node is NonNullable<typeof node> => Boolean(node?.id))
          .map((node) => ({
            id: String(node.id), // row id from node.id
            name: node.title || "Untitled listing",
            subtitle: node.subtitle || node.description || "-",
            category: node.product?.category?.label || "-",
            quantity: typeof node.quantity === "number" ? node.quantity : null,
            price: mapAmountToPrice(node.price?.amount, node.price?.currency),
            format: node.transactionType || "N/A",
            condition: node.publicStatus || node.status || "-",
            featuredIn: "-",
            status: node.publicStatus || node.status || "-",
          }))

        if (!cancelled) {
          setInventoryItems(mapped)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getClerkErrorMessage(error))
          setInventoryItems([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void syncInventory()
    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded, selectedTab])

  const filteredItems = useMemo(() => {
    return inventoryItems
      .filter((item) => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) return true
        return (
          item.name.toLowerCase().includes(query) ||
          item.subtitle.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
        )
      })
  }, [inventoryItems, searchQuery])

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Manage your product list and inventory visibility.">
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Product
        </Button>
      </PageHeader>

      <Card className="border-border/50 bg-card/50">
        <CardContent className="space-y-4 p-4 md:p-5">
          <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as InventoryStatus)}>
            <TabsList className="h-auto rounded-none bg-transparent p-0">
              <TabsTrigger value="ACTIVE" className="rounded-none border-b-2 border-transparent px-1 pb-2 pt-1 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                Active
              </TabsTrigger>
              <TabsTrigger value="DRAFT" className="rounded-none border-b-2 border-transparent px-1 pb-2 pt-1 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                Drafts
              </TabsTrigger>
              <TabsTrigger value="INACTIVE" className="rounded-none border-b-2 border-transparent px-1 pb-2 pt-1 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                Inactive
              </TabsTrigger>
              <TabsTrigger value="SOLD_OUT" className="rounded-none border-b-2 border-transparent px-1 pb-2 pt-1 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                Sold Out
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Button variant="outline" size="icon" aria-label="Filters">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>

            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Bulk edit</span>
                <Switch checked={bulkEditEnabled} onCheckedChange={setBulkEditEnabled} />
              </div>

              <div className="relative w-full md:w-72">
                <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search products"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[35%]">Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price &amp; Format</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Featured In</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading live Whatnot inventory...
                      </span>
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length ? (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="py-3">
                        <div className="space-y-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                        </div>
                      </TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>{item.quantity ?? "-"}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p>{item.price}</p>
                          <p className="text-xs text-muted-foreground">{item.format}</p>
                        </div>
                      </TableCell>
                      <TableCell>{item.condition}</TableCell>
                      <TableCell>{item.featuredIn}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" aria-label={`Copy link for ${item.name}`}>
                          <Link2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No products found for {selectedTab}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <p>Show 20</p>
            <p>
              Showing {filteredItems.length ? `1-${filteredItems.length}` : "0"} of {filteredItems.length}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
