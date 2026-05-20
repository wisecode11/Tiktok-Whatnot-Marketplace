import type { TikTokGlobalProduct } from "@/lib/auth"

export function sumTiktokProductInventoryQuantity(product: TikTokGlobalProduct): number {
  let total = 0
  for (const sku of product.skus ?? []) {
    for (const row of sku.inventory ?? []) {
      const q = row.quantity
      if (typeof q === "number" && Number.isFinite(q)) {
        total += q
      }
    }
  }
  return total
}

export function formatTiktokProductListPrice(product: TikTokGlobalProduct): string {
  const skus = product.skus ?? []
  if (!skus.length) return "—"
  const parts: string[] = []
  for (const sku of skus) {
    const p = sku.price
    if (!p) continue
    const cur = p.currency?.trim() || ""
    const sale = p.sale_price != null && String(p.sale_price).length ? String(p.sale_price) : null
    const taxEx =
      p.tax_exclusive_price != null && String(p.tax_exclusive_price).length
        ? String(p.tax_exclusive_price)
        : null
    if (sale) {
      parts.push(`${cur} ${sale}`.trim())
    } else if (taxEx) {
      parts.push(`${cur} ${taxEx}`.trim())
    }
  }
  if (!parts.length) return "—"
  const unique = [...new Set(parts)]
  return unique.length <= 2 ? unique.join(" · ") : `${unique[0]} · +${unique.length - 1} more`
}
