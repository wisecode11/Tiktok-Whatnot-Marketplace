"use client"

import { useAuth } from "@clerk/nextjs"
import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  formatTiktokProductListPrice,
  sumTiktokProductInventoryQuantity,
} from "@/lib/tiktok-global-product-utils"
import {
  getClerkErrorMessage,
  searchTikTokGlobalProducts,
  waitForSessionToken,
  type TikTokGlobalProduct,
} from "@/lib/auth"

type TikTokGlobalProductsPanelProps = {
  /** Hide create product (staff view). */
  readOnly?: boolean
}

export function TikTokGlobalProductsPanel({ readOnly = false }: TikTokGlobalProductsPanelProps) {
  const { getToken, isLoaded } = useAuth()
  const [tiktokGlobalLoading, setTiktokGlobalLoading] = useState(false)
  const [tiktokGlobalLoadingMore, setTiktokGlobalLoadingMore] = useState(false)
  const [tiktokGlobalError, setTiktokGlobalError] = useState("")
  const [tiktokGlobalProducts, setTiktokGlobalProducts] = useState<TikTokGlobalProduct[]>([])
  const [tiktokGlobalNextPage, setTiktokGlobalNextPage] = useState<string | null>(null)

  const fetchTiktokGlobalProductsFirstPage = useCallback(async () => {
    const token = await waitForSessionToken(getToken)
    return searchTikTokGlobalProducts(token, {
      page_size: 100,
      status: "ALL",
      category_version: "v1",
    })
  }, [getToken])

  useEffect(() => {
    if (!isLoaded) {
      return
    }
    let cancelled = false

    async function load() {
      try {
        setTiktokGlobalLoading(true)
        setTiktokGlobalError("")
        const res = await fetchTiktokGlobalProductsFirstPage()
        if (cancelled) return
        if (res.code !== 0) {
          setTiktokGlobalError(res.message || `TikTok Shop returned code ${res.code}.`)
          setTiktokGlobalProducts([])
          setTiktokGlobalNextPage(null)
          return
        }
        setTiktokGlobalProducts(res.data?.products ?? [])
        const next = res.data?.next_page_token
        setTiktokGlobalNextPage(typeof next === "string" && next.trim() ? next.trim() : null)
      } catch (error) {
        if (!cancelled) {
          setTiktokGlobalError(getClerkErrorMessage(error))
          setTiktokGlobalProducts([])
          setTiktokGlobalNextPage(null)
        }
      } finally {
        if (!cancelled) {
          setTiktokGlobalLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [fetchTiktokGlobalProductsFirstPage, isLoaded])

  async function handleTiktokGlobalRefresh() {
    if (!isLoaded) return
    try {
      setTiktokGlobalLoading(true)
      setTiktokGlobalError("")
      const res = await fetchTiktokGlobalProductsFirstPage()
      if (res.code !== 0) {
        setTiktokGlobalError(res.message || `TikTok Shop returned code ${res.code}.`)
        return
      }
      setTiktokGlobalProducts(res.data?.products ?? [])
      const next = res.data?.next_page_token
      setTiktokGlobalNextPage(typeof next === "string" && next.trim() ? next.trim() : null)
    } catch (error) {
      setTiktokGlobalError(getClerkErrorMessage(error))
    } finally {
      setTiktokGlobalLoading(false)
    }
  }

  async function handleTiktokGlobalLoadMore() {
    if (!tiktokGlobalNextPage || tiktokGlobalLoadingMore) return
    try {
      setTiktokGlobalLoadingMore(true)
      setTiktokGlobalError("")
      const token = await waitForSessionToken(getToken)
      const res = await searchTikTokGlobalProducts(token, {
        page_size: 100,
        page_token: tiktokGlobalNextPage,
        status: "ALL",
        category_version: "v1",
      })
      if (res.code !== 0) {
        setTiktokGlobalError(res.message || `TikTok Shop returned code ${res.code}.`)
        return
      }
      setTiktokGlobalProducts((prev) => [...prev, ...(res.data?.products ?? [])])
      const next = res.data?.next_page_token
      setTiktokGlobalNextPage(typeof next === "string" && next.trim() ? next.trim() : null)
    } catch (error) {
      setTiktokGlobalError(getClerkErrorMessage(error))
    } finally {
      setTiktokGlobalLoadingMore(false)
    }
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">TikTok Shop global products</h2>
            <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
              Responses mirror{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">
                POST /product/202309/global_products/search
              </code>{" "}
              (Partner API). Until seller{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">shop_cipher</code> + access token are
              configured on the server, you see mock data with the same fields as TikTok production.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-2"
              disabled={tiktokGlobalLoading}
              onClick={() => void handleTiktokGlobalRefresh()}
            >
              {tiktokGlobalLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              Refresh
            </Button>
            {!readOnly ? (
              <Button type="button" size="sm" className="shrink-0 gap-2">
                <Plus className="h-4 w-4" aria-hidden />
                Create Product
              </Button>
            ) : null}
          </div>
        </div>

        {tiktokGlobalError ? <p className="text-destructive text-sm">{tiktokGlobalError}</p> : null}

        <div className="overflow-hidden rounded-xl border border-border/60">
          {tiktokGlobalLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-14 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading TikTok global products…
            </div>
          ) : tiktokGlobalProducts.length ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="min-w-[160px]">Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sales regions</TableHead>
                  <TableHead className="pr-10 text-right">Quantity</TableHead>
                  <TableHead className="min-w-[140px] pl-6">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiktokGlobalProducts.map((product, idx) => {
                  const rowKey = product.id ? String(product.id) : `product-${idx}`
                  const qty = sumTiktokProductInventoryQuantity(product)
                  return (
                    <TableRow key={rowKey}>
                      <TableCell className="max-w-[280px] font-medium">
                        {product.title || "—"}
                        {product.id ? (
                          <span className="text-muted-foreground mt-0.5 block font-mono text-xs font-normal">
                            {product.id}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {product.status ? (
                          <Badge variant="secondary" className="font-mono text-xs">
                            {product.status}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {product.sales_regions?.length ? product.sales_regions.join(", ") : "—"}
                      </TableCell>
                      <TableCell className="pr-10 text-right font-mono text-sm">{qty}</TableCell>
                      <TableCell className="pl-6 font-mono text-sm">
                        {formatTiktokProductListPrice(product)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-muted-foreground py-14 text-center text-sm">
              {tiktokGlobalError ? "Fix the error above and refresh." : "No products in this page."}
            </div>
          )}
        </div>

        {tiktokGlobalNextPage ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={tiktokGlobalLoadingMore}
              onClick={() => void handleTiktokGlobalLoadMore()}
            >
              {tiktokGlobalLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Load next page (mock token)
            </Button>
          </div>
        ) : null}

        <p className="text-muted-foreground text-xs">
          Showing {tiktokGlobalProducts.length} product(s) loaded here. Use{" "}
          <span className="font-medium text-foreground">Load next page</span> for more if available.
        </p>
      </CardContent>
    </Card>
  )
}
