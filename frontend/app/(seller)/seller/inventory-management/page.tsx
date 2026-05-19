"use client"

import { useAuth } from "@clerk/nextjs"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Download,
  ImageIcon,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Pencil,
  Trash2,
  Sparkles,
} from "lucide-react"

import { MarketplacePlatformSwitch, type MarketplacePlatform } from "../../../../components/marketplace-platform-switch"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useMarketplaceHub } from "@/components/dashboard/marketplace-hub-context"
import {
  createWhatnotListing,
  getClerkErrorMessage,
  generateWhatnotMediaUploadUrls,
  getWhatnotInventoryCreateFormOptions,
  searchTikTokGlobalProducts,
  createTikTokGlobalProduct,
  deleteTikTokGlobalProducts,
  getTikTokGlobalProduct,
  updateTikTokGlobalProduct202509,
  syncWhatnotInventoryLive,
  waitForSessionToken,
  type TikTokGlobalProduct,
  type TikTokGlobalProductGetResponse,
  type TikTokGlobalProductsCreateResponse,
  type TikTokGlobalProductUpdate202509Response,
  type TikTokGlobalProductsDeleteResponse,
} from "@/lib/auth"
import {
  emptyTiktokProductEditForm,
  hydrateTiktokEditFormFromDetailData,
  buildTiktok202509UpdatePayload,
  type TiktokProductEditFormState,
} from "@/lib/tiktok-product-edit-payload"
import { cn } from "@/lib/utils"
import { aiApi } from "@/lib/ai"

type InventoryStatus = "ACTIVE" | "DRAFT" | "INACTIVE" | "SOLD_OUT"
type InventoryPlatformTab = "whatnot" | "tiktok"

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

interface CreateInventoryForm {
  subcategoryId: string
  title: string
  description: string
  quantity: string
  priceUsd: string
  shippingProfileId: string
  hazardousMaterials: string
}

interface TikTokCreateProductForm {
  title: string
  descriptionHtml: string
  categoryId: string
  brandId: string
  mainImageUri: string
  sellerSku: string

  warehouseId: string
  quantity: string
  backorderQuantity: string
  handlingTimeDays: string

  currency: string
  salePrice: string
  taxExclusivePrice: string
  listPriceAmount: string
  externalListSource: string
  externalListAmount: string

  isNotForSale: boolean
}

function emptyTiktokCreateForm(): TikTokCreateProductForm {
  return {
    title: "",
    descriptionHtml: "",
    categoryId: "",
    brandId: "",
    mainImageUri: "",
    sellerSku: "",
    warehouseId: "",
    quantity: "",
    backorderQuantity: "",
    handlingTimeDays: "",
    currency: "",
    salePrice: "",
    taxExclusivePrice: "",
    listPriceAmount: "",
    externalListSource: "",
    externalListAmount: "",
    isNotForSale: false,
  }
}

/** Set to `true` when TikTok Partner create should call the real API. */
const TIKTOK_GLOBAL_PRODUCT_CREATE_API_ENABLED = false

interface SubcategoryOption {
  id: string
  label: string
}

interface ShippingProfileOption {
  id: string
  name: string
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      const comma = result.indexOf(",")
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error("Failed to read image file."))
    reader.readAsDataURL(file)
  })
}

function getImageExtension(file: File) {
  const byMime = file.type.split("/")[1]
  if (byMime) {
    return byMime.replace("jpeg", "jpg").toLowerCase()
  }

  const lastDot = file.name.lastIndexOf(".")
  if (lastDot === -1) {
    return "png"
  }
  return file.name.slice(lastDot + 1).trim().toLowerCase() || "png"
}

const HAZARDOUS_MATERIAL_OPTIONS = [
  { label: "No Hazardous Materials", value: "NOT_HAZMAT" },
  { label: "Contains Hazardous Materials", value: "HAZMAT" },
  { label: "Contains Lithium Batteries", value: "LITHIUM_ION_BATTERIES" },
]

function mapAmountToPrice(amount?: number | null, currency?: string | null) {
  if (amount == null || !Number.isFinite(Number(amount))) return "Not available"
  const code = currency || "USD"
  // Whatnot amount is cents-like integer in sample payload.
  return `${code} ${(Number(amount) / 100).toFixed(2)}`
}

function sumTiktokProductInventoryQuantity(product: TikTokGlobalProduct): number {
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

function asTiktokDataRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function collectTiktokDetailImageUrls(data: Record<string, unknown> | null | undefined): string[] {
  if (!data) return []
  const urls: string[] = []
  const pushFromImg = (img: unknown) => {
    if (!img || typeof img !== "object") return
    const o = img as Record<string, unknown>
    const u = o.urls
    if (Array.isArray(u)) {
      for (const x of u) {
        if (typeof x === "string" && x.startsWith("http")) urls.push(x)
      }
    }
    const t = o.thumb_urls
    if (Array.isArray(t)) {
      for (const x of t) {
        if (typeof x === "string" && x.startsWith("http")) urls.push(x)
      }
    }
  }
  const mains = data.main_images
  if (Array.isArray(mains)) mains.forEach(pushFromImg)
  const video = data.video
  if (video && typeof video === "object") {
    const c = (video as Record<string, unknown>).cover_url
    if (typeof c === "string" && c.startsWith("http")) urls.push(c)
  }
  return [...new Set(urls)]
}

function collectSellerCatalogImageUrls(data: Record<string, unknown>): string[] {
  const urls = new Set(collectTiktokDetailImageUrls(data))
  const skus = data.skus
  if (!Array.isArray(skus)) return [...urls]
  for (const skuRaw of skus) {
    const sku = asTiktokDataRecord(skuRaw)
    if (!sku) continue
    const attrs = sku.sales_attributes
    if (!Array.isArray(attrs)) continue
    for (const attr of attrs) {
      const a = asTiktokDataRecord(attr)
      if (!a) continue
      const pushImg = (imgRaw: unknown) => {
        const img = asTiktokDataRecord(imgRaw)
        if (!img) return
        for (const key of ["urls", "thumb_urls"] as const) {
          const arr = img[key]
          if (!Array.isArray(arr)) continue
          for (const x of arr) {
            if (typeof x === "string" && x.startsWith("http")) urls.add(x)
          }
        }
      }
      pushImg(a.sku_img)
      const supp = a.supplementary_sku_images
      if (Array.isArray(supp)) {
        for (const s of supp) pushImg(s)
      }
    }
  }
  return [...urls]
}

function formatTiktokProductListPrice(product: TikTokGlobalProduct): string {
  const skus = product.skus ?? []
  if (!skus.length) return "—"
  const parts: string[] = []
  for (const sku of skus) {
    const p = sku.price
    if (!p) continue
    const cur = p.currency?.trim() || ""
    const sale = p.sale_price != null && String(p.sale_price).length ? String(p.sale_price) : null
    const taxEx = p.tax_exclusive_price != null && String(p.tax_exclusive_price).length ? String(p.tax_exclusive_price) : null
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

export default function SellerInventoryManagementPage() {
  const { getToken, isLoaded } = useAuth()
  const marketplaceHub = useMarketplaceHub()
  const [inventoryPlatformTab, setInventoryPlatformTab] = useState<InventoryPlatformTab>("whatnot")
  const [selectedTab, setSelectedTab] = useState<InventoryStatus>("ACTIVE")
  const [bulkEditEnabled, setBulkEditEnabled] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createFormError, setCreateFormError] = useState("")
  const [subcategoryOptions, setSubcategoryOptions] = useState<SubcategoryOption[]>([])
  const [shippingProfileOptions, setShippingProfileOptions] = useState<ShippingProfileOption[]>([])
  const [categorySearchValue, setCategorySearchValue] = useState("")
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState("")
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [isMediaUploaded, setIsMediaUploaded] = useState(false)
  const [uploadedImageId, setUploadedImageId] = useState("")
  const [isPublishingInventory, setIsPublishingInventory] = useState(false)
  const [isGeneratingListingAi, setIsGeneratingListingAi] = useState(false)
  const [aiThumbnailModalOpen, setAiThumbnailModalOpen] = useState(false)
  const [aiThumbnailLoading, setAiThumbnailLoading] = useState(false)
  const [aiThumbnailImageUrl, setAiThumbnailImageUrl] = useState("")
  const [aiThumbnailError, setAiThumbnailError] = useState("")
  const [createForm, setCreateForm] = useState<CreateInventoryForm>({
    subcategoryId: "",
    title: "",
    description: "",
    quantity: "",
    priceUsd: "",
    shippingProfileId: "",
    hazardousMaterials: "",
  })

  const [tiktokGlobalLoading, setTiktokGlobalLoading] = useState(false)
  const [tiktokGlobalLoadingMore, setTiktokGlobalLoadingMore] = useState(false)
  const [tiktokGlobalError, setTiktokGlobalError] = useState("")
  const [tiktokGlobalProducts, setTiktokGlobalProducts] = useState<TikTokGlobalProduct[]>([])
  const [tiktokGlobalNextPage, setTiktokGlobalNextPage] = useState<string | null>(null)
  const [tiktokDeleteLoadingProductId, setTiktokDeleteLoadingProductId] = useState<string | null>(null)
  const [tiktokDeleteNotice, setTiktokDeleteNotice] = useState("")
  const [tiktokDetailProduct, setTiktokDetailProduct] = useState<TikTokGlobalProduct | null>(null)
  const [tiktokDetailEnvelope, setTiktokDetailEnvelope] = useState<TikTokGlobalProductGetResponse | null>(null)
  const [tiktokDetailLoading, setTiktokDetailLoading] = useState(false)
  const [tiktokDetailError, setTiktokDetailError] = useState("")

  const [tiktokCreateOpen, setTiktokCreateOpen] = useState(false)
  const [tiktokCreateLoading, setTiktokCreateLoading] = useState(false)
  const [tiktokCreateError, setTiktokCreateError] = useState("")
  const [tiktokCreateSuccess, setTiktokCreateSuccess] = useState<TikTokGlobalProductsCreateResponse | null>(null)
  const [tiktokCreateForm, setTiktokCreateForm] = useState<TikTokCreateProductForm>(() => emptyTiktokCreateForm())
  const [tiktokCreateMainImageFile, setTiktokCreateMainImageFile] = useState<File | null>(null)
  const [tiktokCreateMainImagePreviewUrl, setTiktokCreateMainImagePreviewUrl] = useState("")
  const [tiktokCreateImageFieldKey, setTiktokCreateImageFieldKey] = useState(0)

  useEffect(() => {
    const forcedTab = marketplaceHub?.hub === "whatnot" || marketplaceHub?.hub === "tiktok" ? marketplaceHub.hub : null
    if (forcedTab) {
      setInventoryPlatformTab(forcedTab)
    }
  }, [marketplaceHub?.hub])

  const [tiktokEditOpen, setTiktokEditOpen] = useState(false)
  const [tiktokEditProduct, setTiktokEditProduct] = useState<TikTokGlobalProduct | null>(null)
  const [tiktokEditDetail, setTiktokEditDetail] = useState<Record<string, unknown> | null>(null)
  const [tiktokEditForm, setTiktokEditForm] = useState<TiktokProductEditFormState>(() => emptyTiktokProductEditForm())
  const [tiktokEditLoadLoading, setTiktokEditLoadLoading] = useState(false)
  const [tiktokEditLoadError, setTiktokEditLoadError] = useState("")
  const [tiktokEditSaveLoading, setTiktokEditSaveLoading] = useState(false)
  const [tiktokEditError, setTiktokEditError] = useState("")
  const [tiktokEditSuccess, setTiktokEditSuccess] = useState<TikTokGlobalProductUpdate202509Response | null>(null)

  useEffect(() => {
    return () => {
      if (selectedImagePreviewUrl) {
        URL.revokeObjectURL(selectedImagePreviewUrl)
      }
    }
  }, [selectedImagePreviewUrl])

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

  useEffect(() => {
    let cancelled = false

    async function loadCreateFormOptions() {
      if (!isLoaded) return
      try {
        const token = await waitForSessionToken(getToken)
        const result = await getWhatnotInventoryCreateFormOptions(token)
        if (cancelled) return
        setSubcategoryOptions(
          Array.isArray(result.subcategories)
            ? result.subcategories.filter((item) => item.id && item.label)
            : [],
        )
        setShippingProfileOptions(
          Array.isArray(result.shippingProfiles)
            ? result.shippingProfiles.filter((item) => item.id && item.name)
            : [],
        )
      } catch (_error) {
        if (!cancelled) {
          setSubcategoryOptions([])
          setShippingProfileOptions([])
        }
      }
    }

    void loadCreateFormOptions()
    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  const fetchTiktokGlobalProductsFirstPage = useCallback(async () => {
    const token = await waitForSessionToken(getToken)
    return searchTikTokGlobalProducts(token, {
      page_size: 100,
      status: "ALL",
      category_version: "v1",
    })
  }, [getToken])

  useEffect(() => {
    if (!isLoaded || inventoryPlatformTab !== "tiktok") {
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
  }, [fetchTiktokGlobalProductsFirstPage, inventoryPlatformTab, isLoaded])

  useEffect(() => {
    const id = tiktokDetailProduct?.id ? String(tiktokDetailProduct.id).trim() : ""
    if (!id || !isLoaded) {
      return
    }
    let cancelled = false

    ;(async () => {
      try {
        setTiktokDetailLoading(true)
        setTiktokDetailError("")
        setTiktokDetailEnvelope(null)
        const token = await waitForSessionToken(getToken)
        const res = await getTikTokGlobalProduct(token, id)
        if (cancelled) return
        setTiktokDetailEnvelope(res)
      } catch (error) {
        if (!cancelled) {
          setTiktokDetailError(getClerkErrorMessage(error))
          setTiktokDetailEnvelope(null)
        }
      } finally {
        if (!cancelled) {
          setTiktokDetailLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tiktokDetailProduct?.id, isLoaded, getToken])

  useEffect(() => {
    if (!tiktokEditOpen || !isLoaded) return
    const id = tiktokEditProduct?.id ? String(tiktokEditProduct.id).trim() : ""
    if (!id) return
    let cancelled = false

    ;(async () => {
      try {
        setTiktokEditLoadLoading(true)
        setTiktokEditLoadError("")
        setTiktokEditDetail(null)
        const token = await waitForSessionToken(getToken)
        const res = await getTikTokGlobalProduct(token, id)
        if (cancelled) return
        if (res.code !== 0 || !res.data || typeof res.data !== "object") {
          setTiktokEditLoadError(res.message || "Could not load this product for editing.")
          return
        }
        const d = res.data as Record<string, unknown>
        setTiktokEditDetail(d)
        setTiktokEditForm(hydrateTiktokEditFormFromDetailData(d))
      } catch (error) {
        if (!cancelled) {
          setTiktokEditLoadError(getClerkErrorMessage(error))
          setTiktokEditDetail(null)
        }
      } finally {
        if (!cancelled) {
          setTiktokEditLoadLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tiktokEditOpen, tiktokEditProduct?.id, isLoaded, getToken])

  async function handleTiktokGlobalRefresh() {
    if (!isLoaded || inventoryPlatformTab !== "tiktok") return
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

  async function handleTiktokDeleteProduct(product: TikTokGlobalProduct) {
    if (!isLoaded) return

    const id = typeof product.id === "string" ? product.id.trim() : String(product.id ?? "").trim()
    if (!id) return

    const title = typeof product.title === "string" && product.title.trim() ? product.title.trim() : `Product ${id}`

    if (!window.confirm(`Delete \"${title}\"?`)) {
      return
    }

    try {
      setTiktokDeleteLoadingProductId(id)
      setTiktokGlobalError("")
      setTiktokDeleteNotice("")

      const token = await waitForSessionToken(getToken)
      const result = (await deleteTikTokGlobalProducts(token, [id])) as TikTokGlobalProductsDeleteResponse

      const apiErrors = Array.isArray(result.data?.errors) ? result.data?.errors : []
      const blockingError =
        apiErrors.find((entry) => {
          const targetId = entry?.detail?.product_id
          return typeof targetId === "string" && targetId.trim() === id
        }) || apiErrors[0]

      if (blockingError?.message) {
        throw new Error(blockingError.message)
      }

      setTiktokGlobalProducts((prev) =>
        prev.filter((row) => String(row.id ?? "").trim() !== id),
      )

      if (String(tiktokDetailProduct?.id ?? "").trim() === id) {
        setTiktokDetailProduct(null)
        setTiktokDetailEnvelope(null)
        setTiktokDetailError("")
        setTiktokDetailLoading(false)
      }

      if (String(tiktokEditProduct?.id ?? "").trim() === id) {
        setTiktokEditOpen(false)
        setTiktokEditProduct(null)
        setTiktokEditDetail(null)
        setTiktokEditForm(emptyTiktokProductEditForm())
        setTiktokEditLoadError("")
        setTiktokEditError("")
        setTiktokEditSuccess(null)
        setTiktokEditLoadLoading(false)
        setTiktokEditSaveLoading(false)
      }

      setTiktokDeleteNotice(`${title} deleted successfully.`)
    } catch (error) {
      setTiktokGlobalError(getClerkErrorMessage(error))
    } finally {
      setTiktokDeleteLoadingProductId(null)
    }
  }

  async function handleTiktokEditSave() {
    if (!isLoaded || !tiktokEditProduct?.id || !tiktokEditDetail) return
    const id = String(tiktokEditProduct.id).trim()
    if (!id) return
    try {
      setTiktokEditSaveLoading(true)
      setTiktokEditError("")
      setTiktokEditSuccess(null)
      if (!tiktokEditForm.title.trim()) throw new Error("Product title is required.")
      if (!tiktokEditForm.categoryId.trim()) throw new Error("Category ID is required.")
      if (!tiktokEditForm.brandId.trim()) throw new Error("Brand ID is required.")
      const token = await waitForSessionToken(getToken)
      const body = buildTiktok202509UpdatePayload(tiktokEditForm, tiktokEditDetail)
      const res = await updateTikTokGlobalProduct202509(token, id, body)
      setTiktokEditSuccess(res)
      if (res.code === 0) {
        await handleTiktokGlobalRefresh()
      }
    } catch (error) {
      setTiktokEditError(getClerkErrorMessage(error))
    } finally {
      setTiktokEditSaveLoading(false)
    }
  }

  async function handleTiktokCreateProduct() {
    if (!isLoaded) return
    try {
      setTiktokCreateLoading(true)
      setTiktokCreateError("")
      setTiktokCreateSuccess(null)

      // Validate required fields before submit (preview or live API).
      if (!tiktokCreateForm.title.trim()) throw new Error("Title is required.")
      if (!tiktokCreateForm.descriptionHtml.trim()) throw new Error("Description is required.")
      if (!tiktokCreateForm.categoryId.trim()) throw new Error("category_id is required.")
      if (!tiktokCreateForm.brandId.trim()) throw new Error("brand_id is required.")
      if (!tiktokCreateMainImageFile) throw new Error("Please upload a main product image.")
      if (!tiktokCreateForm.sellerSku.trim()) throw new Error("seller_sku is required.")
      if (!tiktokCreateForm.warehouseId.trim()) throw new Error("warehouse_id is required.")
      if (!tiktokCreateForm.quantity.trim()) throw new Error("quantity is required.")
      if (!tiktokCreateForm.backorderQuantity.trim()) throw new Error("backorder_quantity is required.")
      if (!tiktokCreateForm.handlingTimeDays.trim()) throw new Error("handling_time (days) is required.")
      if (!tiktokCreateForm.salePrice.trim()) throw new Error("sale_price is required.")
      if (!tiktokCreateForm.taxExclusivePrice.trim()) throw new Error("tax_exclusive_price is required.")
      if (!tiktokCreateForm.currency.trim()) throw new Error("currency is required.")
      if (!tiktokCreateForm.listPriceAmount.trim()) throw new Error("list_price amount is required.")
      if (!tiktokCreateForm.externalListSource.trim()) throw new Error("external_list_prices[0].source is required.")
      if (!tiktokCreateForm.externalListAmount.trim()) throw new Error("external_list_prices[0].amount is required.")

      if (!TIKTOK_GLOBAL_PRODUCT_CREATE_API_ENABLED) {
        setTiktokCreateSuccess({
          code: 0,
          message: "Success (preview). Form is valid; TikTok create will run here once API access is enabled.",
          request_id: "local-preview",
          data: {
            warnings: [
              {
                message: "No product was sent to TikTok yet — this is a temporary success for UI testing.",
              },
            ],
          },
        })
        return
      }

      const token = await waitForSessionToken(getToken)

      // Build a Partner-shaped payload using a template and seller-provided values.
      // Until approval, server returns mock response but we keep the same contract.
      const payload = {
        save_mode: "LISTING",
        title: tiktokCreateForm.title.trim(),
        description: tiktokCreateForm.descriptionHtml,
        category_id: tiktokCreateForm.categoryId.trim(),
        brand_id: tiktokCreateForm.brandId.trim(),
        main_images: [{ uri: tiktokCreateForm.mainImageUri.trim() }],
        locale: "en-US",
        auto_translate_enabled: false,
        is_cod_allowed: false,
        category_version: "v1",
        listing_platforms: ["TIKTOK_SHOP"],
        shipping_insurance_requirement: "REQUIRED",
        minimum_order_quantity: 1,
        is_pre_owned: false,
        scheduled_sale: {
          is_enabled_scheduled_sale: false,
          schedule_sale_time: 1768899145000,
        },
        shipping_template_id: "7552764259994699538",
        idempotency_key: `create_${crypto.randomUUID()}`,
        // Product attributes / rich metadata (kept from dev template)
        certifications: [
          {
            id: "7182427311584347905",
            images: [{ uri: tiktokCreateForm.mainImageUri.trim() }],
            files: [],
            expiration_date: 1741234626,
          },
        ],
        package_dimensions: { length: "10", width: "10", height: "10", unit: "CENTIMETER" },
        product_attributes: [
          {
            id: "100392",
            values: [{ id: "1001533", name: "Birthday" }],
          },
        ],
        package_weight: { value: "1.32", unit: "KILOGRAM" },
        video: { id: "v09e40f40000cfu0ovhc77ub7fl97k4w" },
        external_product_id: "172959296971220002",
        delivery_option_ids: ["1729592969712203232"],
        size_chart: {
          image: { uri: tiktokCreateForm.mainImageUri.trim() },
          template: { id: "7267563252536723205" },
        },
        primary_combined_product_id: "1729582718312380123",
        is_not_for_sale: tiktokCreateForm.isNotForSale,
        manufacturer_ids: ["172959296971220002"],
        responsible_person_ids: ["172959296971220003"],
        search_terms: ["sneakers", "running shoes", "athletic"],
        key_product_features: ["Breathable mesh upper", "Cushioned foam midsole"],

        skus: [
          {
            seller_sku: tiktokCreateForm.sellerSku.trim(),
            external_sku_id: String(Date.now()),
            sales_attributes: [
              {
                id: "100089",
                value_id: "1729592969712207000",
                value_name: "Red",
                sku_img: { uri: tiktokCreateForm.mainImageUri.trim() },
                name: "Color",
                supplementary_sku_images: [{ uri: tiktokCreateForm.mainImageUri.trim() }],
              },
            ],
            price: {
              amount: tiktokCreateForm.taxExclusivePrice.trim(),
              currency: tiktokCreateForm.currency.trim() || "USD",
              sale_price: tiktokCreateForm.salePrice.trim(),
              tax_exclusive_price: tiktokCreateForm.taxExclusivePrice.trim(),
            },
            inventory: [
              {
                warehouse_id: tiktokCreateForm.warehouseId.trim(),
                quantity: Number(tiktokCreateForm.quantity),
                backorder_quantity: Number(tiktokCreateForm.backorderQuantity || "0"),
                handling_time: Number(tiktokCreateForm.handlingTimeDays || "0"),
              },
            ],
            identifier_code: {
              code: "10000000000000",
              type: "GTIN",
            },
            combined_skus: [
              {
                product_id: "1729582718312380123",
                sku_id: "2729382476852921560",
                sku_count: 1,
              },
            ],
            sku_unit_count: "100.00",
            external_urls: [],
            extra_identifier_codes: [],
            pre_sale: {
              type: "PRE_ORDER",
              fulfillment_type: {
                handling_duration_days: 7,
                release_date: 1619611761,
              },
            },
            list_price: { amount: tiktokCreateForm.listPriceAmount.trim(), currency: tiktokCreateForm.currency.trim() || "USD" },
            external_list_prices: [
              {
                source: tiktokCreateForm.externalListSource.trim(),
                amount: tiktokCreateForm.externalListAmount.trim(),
                currency: tiktokCreateForm.currency.trim() || "USD",
              },
            ],
            fees: [
              {
                type: "PFAND",
                amount: "1.01",
                additional_attribute: "SINGLE_USE",
              },
            ],
          },
        ],
      }

      const res = await createTikTokGlobalProduct(token, payload as unknown as Record<string, unknown>)
      if (res.code !== 0) {
        setTiktokCreateError(res.message || `Create failed with code ${res.code}`)
        return
      }

      setTiktokCreateSuccess(res)
      // Refresh list so seller sees the newly-created draft/status.
      await handleTiktokGlobalRefresh()
    } catch (error) {
      setTiktokCreateError(getClerkErrorMessage(error))
    } finally {
      setTiktokCreateLoading(false)
    }
  }

  function syncTiktokCreateMainImage(file: File | null) {
    setTiktokCreateMainImagePreviewUrl((prevUrl) => {
      if (prevUrl) URL.revokeObjectURL(prevUrl)
      return file ? URL.createObjectURL(file) : ""
    })
    setTiktokCreateMainImageFile(file)
    if (file) {
      const safeName = file.name.replace(/[^\w.\-]/g, "_")
      setTiktokCreateForm((p) => ({ ...p, mainImageUri: `local_upload:${safeName}` }))
    } else {
      setTiktokCreateForm((p) => ({ ...p, mainImageUri: "" }))
    }
    setTiktokCreateError("")
  }

  function resetTiktokCreateMainImageVisualOnly() {
    setTiktokCreateMainImagePreviewUrl((prevUrl) => {
      if (prevUrl) URL.revokeObjectURL(prevUrl)
      return ""
    })
    setTiktokCreateMainImageFile(null)
  }

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

  const canCreateInventory = useMemo(() => {
    return Boolean(
      selectedImage &&
        isMediaUploaded &&
      createForm.subcategoryId.trim() &&
        createForm.title.trim() &&
        createForm.description.trim() &&
        createForm.quantity.trim() &&
        createForm.priceUsd.trim() &&
        createForm.shippingProfileId.trim() &&
        createForm.hazardousMaterials.trim() &&
        uploadedImageId.trim() &&
        !isUploadingMedia,
    )
  }, [createForm, isMediaUploaded, isUploadingMedia, selectedImage, uploadedImageId])

  const filteredSubcategoryOptions = useMemo(() => {
    const query = categorySearchValue.trim().toLowerCase()
    if (!query) {
      return subcategoryOptions
    }
    return subcategoryOptions.filter((item) => item.label.toLowerCase().includes(query))
  }, [categorySearchValue, subcategoryOptions])

  function resetCreateForm() {
    setCreateForm({
      subcategoryId: "",
      title: "",
      description: "",
      quantity: "",
      priceUsd: "",
      shippingProfileId: "",
      hazardousMaterials: "",
    })
    setCategorySearchValue("")
    setIsCategoryDropdownOpen(false)
    setSelectedImage(null)
    setSelectedImagePreviewUrl("")
    setIsUploadingMedia(false)
    setIsMediaUploaded(false)
    setUploadedImageId("")
    setIsPublishingInventory(false)
    setIsGeneratingListingAi(false)
    setAiThumbnailModalOpen(false)
    setAiThumbnailLoading(false)
    setAiThumbnailImageUrl("")
    setAiThumbnailError("")
    setCreateFormError("")
  }

  async function handleGenerateAiThumbnail() {
    const title = createForm.title.trim()
    if (!title) {
      setCreateFormError("Enter a product title before generating an AI thumbnail.")
      return
    }

    setAiThumbnailModalOpen(true)
    setAiThumbnailLoading(true)
    setAiThumbnailError("")
    setAiThumbnailImageUrl("")

    try {
      const token = await waitForSessionToken(getToken)
      const result = await aiApi.generateInventoryThumbnail(
        token,
        title,
        createForm.description,
        categorySearchValue.trim() || undefined,
      )
      setAiThumbnailImageUrl(result.imageUrl)
    } catch (error) {
      setAiThumbnailError(getClerkErrorMessage(error))
    } finally {
      setAiThumbnailLoading(false)
    }
  }

  async function handleDownloadAiThumbnail() {
    if (!aiThumbnailImageUrl) {
      return
    }

    const safeName =
      createForm.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) || "ai-thumbnail"

    if (aiThumbnailImageUrl.startsWith("data:")) {
      const link = document.createElement("a")
      link.href = aiThumbnailImageUrl
      link.download = `${safeName}-225x225.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      return
    }

    try {
      const response = await fetch(aiThumbnailImageUrl)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `${safeName}-225x225.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(blobUrl)
    } catch {
      const link = document.createElement("a")
      link.href = aiThumbnailImageUrl
      link.download = `${safeName}-225x225.png`
      link.target = "_blank"
      link.rel = "noopener noreferrer"
      document.body.appendChild(link)
      link.click()
      link.remove()
    }
  }

  function openAiThumbnailModal() {
    void handleGenerateAiThumbnail()
  }

  async function handleAiInventoryListing() {
    const categoryLabel = categorySearchValue.trim()
    if (!createForm.subcategoryId || !categoryLabel) {
      setCreateFormError("Select a category before using AI auto fill.")
      return
    }

    setIsGeneratingListingAi(true)
    setCreateFormError("")
    try {
      const token = await waitForSessionToken(getToken)
      const userTitle = createForm.title.trim()
      const listing = await aiApi.generateInventoryListing(
        token,
        categoryLabel,
        userTitle || undefined,
      )
      setCreateForm((current) => ({
        ...current,
        title: listing.title,
        description: listing.description,
      }))
    } catch (error) {
      setCreateFormError(getClerkErrorMessage(error))
    } finally {
      setIsGeneratingListingAi(false)
    }
  }

  function openCreateDialog() {
    resetCreateForm()
    setCreateDialogOpen(true)
  }

  async function handleCreateInventory() {
    if (!canCreateInventory) {
      setCreateFormError("Please fill all required fields.")
      return
    }
    if (!selectedImage) {
      setCreateFormError("Please upload a product image first.")
      return
    }

    const quantityValue = Number(createForm.quantity)
    const priceValue = Number(createForm.priceUsd)
    if (!Number.isFinite(quantityValue) || quantityValue <= 0 || !Number.isInteger(quantityValue)) {
      setCreateFormError("Quantity must be a whole number greater than 0.")
      return
    }
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      setCreateFormError("Price (USD) must be greater than 0.")
      return
    }

    if (!uploadedImageId.trim()) {
      setCreateFormError("Missing uploaded image id. Please upload the image again.")
      return
    }

    try {
      setIsPublishingInventory(true)
      setCreateFormError("")
      const token = await waitForSessionToken(getToken)
      await createWhatnotListing(token, {
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        quantity: quantityValue,
        priceUsd: priceValue,
        subcategoryId: createForm.subcategoryId,
        shippingProfileId: createForm.shippingProfileId,
        hazmatType: createForm.hazardousMaterials.trim(),
        imageId: uploadedImageId.trim(),
      })

      const refreshed = await syncWhatnotInventoryLive(token, selectedTab)
      const edges = refreshed?.responsePayload?.data?.me?.inventory?.edges || []
      const mapped: InventoryItem[] = edges
        .map((edge) => edge?.node)
        .filter((node): node is NonNullable<typeof node> => Boolean(node?.id))
        .map((node) => ({
          id: String(node.id),
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

      setInventoryItems(mapped)
      setCreateDialogOpen(false)
      resetCreateForm()
    } catch (error) {
      setCreateFormError(getClerkErrorMessage(error))
    } finally {
      setIsPublishingInventory(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Manage your product list and inventory visibility.">
        {inventoryPlatformTab === "whatnot" ? (
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Create Product
          </Button>
        ) : null}
      </PageHeader>

      <MarketplacePlatformSwitch
        value={inventoryPlatformTab}
        onValueChange={(value: MarketplacePlatform) => setInventoryPlatformTab(value as InventoryPlatformTab)}
        ariaLabel="Inventory source"
        whatnotLabel="Whatnot Inventory"
        tiktokLabel="TikTok Inventory"
        idPrefix="inventory-tab"
        className={marketplaceHub?.hub === "whatnot" || marketplaceHub?.hub === "tiktok" ? "hidden" : undefined}
      />

      {inventoryPlatformTab === "tiktok" ? (
        <>
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
                    {tiktokGlobalLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Refresh
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 gap-2"
                    onClick={() => setTiktokCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Create Product
                  </Button>
                </div>
              </div>

              {tiktokGlobalError ? <p className="text-destructive text-sm">{tiktokGlobalError}</p> : null}
              {tiktokDeleteNotice ? <p className="text-emerald-600 text-sm">{tiktokDeleteNotice}</p> : null}

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
                        <TableHead className="text-right pr-10">Quantity</TableHead>
                        <TableHead className="min-w-[140px] pl-6">Price</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
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
                            <TableCell className="text-right font-mono text-sm pr-10">{qty}</TableCell>
                            <TableCell className="font-mono text-sm pl-6">{formatTiktokProductListPrice(product)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setTiktokDetailProduct(product)
                                  }}
                                >
                                  Details
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="gap-1"
                                  disabled={!product.id || tiktokDeleteLoadingProductId === rowKey}
                                  onClick={() => {
                                    if (!product.id) return
                                    setTiktokEditProduct(product)
                                    setTiktokEditOpen(true)
                                    setTiktokEditDetail(null)
                                    setTiktokEditForm(emptyTiktokProductEditForm())
                                    setTiktokEditLoadError("")
                                    setTiktokEditError("")
                                    setTiktokEditSuccess(null)
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={!product.id || tiktokDeleteLoadingProductId === rowKey}
                                  onClick={() => void handleTiktokDeleteProduct(product)}
                                  aria-label={`Delete ${product.title || "product"}`}
                                >
                                  {tiktokDeleteLoadingProductId === rowKey ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                  )}
                                </Button>
                              </div>
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

          <Dialog
            open={tiktokDetailProduct != null}
            onOpenChange={(open) => {
              if (!open) {
                setTiktokDetailProduct(null)
                setTiktokDetailEnvelope(null)
                setTiktokDetailError("")
                setTiktokDetailLoading(false)
              }
            }}
          >
            <DialogContent className="flex max-h-[min(92vh,52rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
              <DialogHeader className="border-border shrink-0 border-b px-6 py-4">
                <DialogTitle className="pr-8 text-left">
                  {(() => {
                    const d =
                      tiktokDetailEnvelope?.code === 0 &&
                      tiktokDetailEnvelope.data &&
                      typeof tiktokDetailEnvelope.data === "object"
                        ? (tiktokDetailEnvelope.data as Record<string, unknown>)
                        : null
                    const t = (typeof d?.title === "string" && d.title) || tiktokDetailProduct?.title
                    return t || "Product details"
                  })()}
                </DialogTitle>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {(() => {
                    const d =
                      tiktokDetailEnvelope?.code === 0 &&
                      tiktokDetailEnvelope.data &&
                      typeof tiktokDetailEnvelope.data === "object"
                        ? (tiktokDetailEnvelope.data as Record<string, unknown>)
                        : null
                    const status =
                      (typeof d?.status === "string" && d.status) || tiktokDetailProduct?.status || ""
                    const notForSale =
                      typeof d?.is_not_for_sale === "boolean" ? d.is_not_for_sale : tiktokDetailProduct?.is_not_for_sale
                    const statusUpper = String(status).toUpperCase()
                    const audit = d ? asTiktokDataRecord(d.audit) : null
                    const auditStatus = typeof audit?.status === "string" ? audit.status : ""
                    const quality =
                      d && typeof d.listing_quality_tier === "string" ? d.listing_quality_tier : ""
                    return (
                      <>
                        <Badge
                          variant={statusUpper === "ACTIVATE" ? "secondary" : "destructive"}
                          className="text-xs font-medium"
                        >
                          {statusUpper === "ACTIVATE" ? "Active listing" : status ? String(status).replace(/_/g, " ") : "—"}
                        </Badge>
                        {auditStatus ? (
                          <Badge variant="outline" className="text-xs font-medium">
                            Review: {auditStatus.replace(/_/g, " ")}
                          </Badge>
                        ) : null}
                        {quality ? (
                          <Badge variant="outline" className="text-xs font-medium">
                            Quality: {quality.replace(/_/g, " ")}
                          </Badge>
                        ) : null}
                        {notForSale ? (
                          <Badge variant="destructive" className="text-xs font-medium">
                            Not for sale
                          </Badge>
                        ) : null}
                      </>
                    )
                  })()}
                </div>
                <DialogDescription className="text-left text-sm text-muted-foreground">
                  Overview, photos, and prices—written for sellers, not developers.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
                {tiktokDetailProduct ? (
                  <>
                    {tiktokDetailLoading ? (
                      <div className="text-muted-foreground flex items-center gap-2 py-2 text-sm">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        Loading product details…
                      </div>
                    ) : null}
                    {tiktokDetailError ? <p className="text-destructive text-sm">{tiktokDetailError}</p> : null}
                    {!tiktokDetailLoading &&
                    tiktokDetailEnvelope &&
                    tiktokDetailEnvelope.code === 0 &&
                    tiktokDetailEnvelope.data &&
                    typeof tiktokDetailEnvelope.data === "object" ? (
                      <>
                        {(() => {
                          const data = tiktokDetailEnvelope.data as Record<string, unknown>
                          const imageUrls = collectSellerCatalogImageUrls(data)
                          const brand = asTiktokDataRecord(data.brand)
                          const brandName = typeof brand?.name === "string" ? brand.name : ""
                          const chains = Array.isArray(data.category_chains) ? data.category_chains : []
                          const firstChain = asTiktokDataRecord(chains[0])
                          const categoryName =
                            typeof firstChain?.local_name === "string"
                              ? firstChain.local_name
                              : typeof firstChain?.name === "string"
                                ? (firstChain.name as string)
                                : ""
                          const audit = asTiktokDataRecord(data.audit)
                          const auditStatus = typeof audit?.status === "string" ? audit.status : ""
                          const quality =
                            typeof data.listing_quality_tier === "string" ? data.listing_quality_tier : ""
                          const cod =
                            typeof data.is_cod_allowed === "boolean"
                              ? data.is_cod_allowed
                                ? "Yes"
                                : "No"
                              : ""
                          const minOrder =
                            typeof data.minimum_order_quantity === "number" &&
                            Number.isFinite(data.minimum_order_quantity)
                              ? String(data.minimum_order_quantity)
                              : ""
                          const pkgDim = asTiktokDataRecord(data.package_dimensions)
                          const pkgWt = asTiktokDataRecord(data.package_weight)
                          const pkgLine =
                            pkgDim && pkgWt
                              ? `${pkgDim.length ?? "?"}×${pkgDim.width ?? "?"}×${pkgDim.height ?? "?"} ${String(pkgDim.unit || "").toLowerCase() || "cm"} · ${pkgWt.value ?? "?"} ${String(pkgWt.unit || "").toLowerCase()}`
                              : ""
                          const features = Array.isArray(data.key_product_features)
                            ? (data.key_product_features as unknown[]).filter((x): x is string => typeof x === "string")
                            : []
                          const terms = Array.isArray(data.search_terms)
                            ? (data.search_terms as unknown[]).filter((x): x is string => typeof x === "string")
                            : []
                          const skus = Array.isArray(data.skus) ? data.skus : []

                          const summaryRows: [string, string][] = []
                          if (typeof data.id === "string" && data.id) summaryRows.push(["Listing ID", data.id])
                          if (brandName) summaryRows.push(["Brand", brandName])
                          if (categoryName) summaryRows.push(["Category", categoryName])
                          if (auditStatus) summaryRows.push(["Review status", auditStatus.replace(/_/g, " ")])
                          if (quality) summaryRows.push(["Listing quality", quality.replace(/_/g, " ")])
                          if (cod) summaryRows.push(["Cash on delivery", cod])
                          if (minOrder) summaryRows.push(["Minimum order quantity", minOrder])
                          if (pkgLine) summaryRows.push(["Package size & weight", pkgLine])

                          return (
                            <>
                              {summaryRows.length ? (
                                <section className="space-y-2">
                                  <h3 className="text-sm font-semibold text-foreground">Summary</h3>
                                  <dl className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card/40">
                                    {summaryRows.map(([label, val]) => (
                                      <div
                                        key={label}
                                        className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(10rem,34%)_1fr] sm:gap-4"
                                      >
                                        <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
                                        <dd className="text-sm leading-relaxed text-foreground">{val}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </section>
                              ) : null}

                              {imageUrls.length ? (
                                <section className="space-y-2">
                                  <h3 className="text-sm font-semibold text-foreground">Product photos</h3>
                                  <p className="text-xs text-muted-foreground">
                                    Click a photo to open the full image in a new tab. Image links are not listed as
                                    text.
                                  </p>
                                  <div className="flex flex-wrap gap-3">
                                    {imageUrls.slice(0, 20).map((src) => (
                                      <a
                                        key={src}
                                        href={src}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block overflow-hidden rounded-lg border border-border/60 shadow-sm transition hover:opacity-90"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={src}
                                          alt="Product"
                                          className="h-32 w-32 object-cover sm:h-36 sm:w-36"
                                        />
                                      </a>
                                    ))}
                                  </div>
                                </section>
                              ) : null}

                              {skus.length ? (
                                <section className="space-y-3">
                                  <h3 className="text-sm font-semibold text-foreground">Variants & pricing</h3>
                                  <div className="space-y-3">
                                    {skus.map((skuRaw, idx) => {
                                      const sku = asTiktokDataRecord(skuRaw)
                                      if (!sku) return null
                                      const price = asTiktokDataRecord(sku.price)
                                      const cur = typeof price?.currency === "string" ? price.currency : "USD"
                                      const sale = price?.sale_price != null ? String(price.sale_price) : ""
                                      const taxEx =
                                        price?.tax_exclusive_price != null ? String(price.tax_exclusive_price) : ""
                                      const skuLabel =
                                        typeof sku.seller_sku === "string" && sku.seller_sku
                                          ? sku.seller_sku
                                          : `Variant ${idx + 1}`
                                      let qty = 0
                                      if (Array.isArray(sku.inventory)) {
                                        for (const row of sku.inventory) {
                                          const r = asTiktokDataRecord(row)
                                          const q = r?.quantity
                                          if (typeof q === "number" && Number.isFinite(q)) qty += q
                                        }
                                      }
                                      const attrs = Array.isArray(sku.sales_attributes) ? sku.sales_attributes : []
                                      const firstAttr = asTiktokDataRecord(attrs[0])
                                      const varName =
                                        typeof firstAttr?.name === "string" &&
                                        typeof firstAttr?.value_name === "string"
                                          ? `${firstAttr.name}: ${firstAttr.value_name}`
                                          : typeof firstAttr?.value_name === "string"
                                            ? firstAttr.value_name
                                            : ""

                                      return (
                                        <div
                                          key={typeof sku.id === "string" ? sku.id : `sku-${idx}`}
                                          className="rounded-lg border border-border/60 bg-card/50 p-4"
                                        >
                                          <p className="font-medium text-foreground">{skuLabel}</p>
                                          {varName ? (
                                            <p className="mt-1 text-sm text-muted-foreground">{varName}</p>
                                          ) : null}
                                          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                                            <div>
                                              <p className="text-xs font-medium text-muted-foreground">Sale price</p>
                                              <p className="mt-0.5 text-foreground">{sale ? `${cur} ${sale}` : "—"}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs font-medium text-muted-foreground">
                                                Price before tax
                                              </p>
                                              <p className="mt-0.5 text-foreground">
                                                {taxEx ? `${cur} ${taxEx}` : "—"}
                                              </p>
                                            </div>
                                            <div className="sm:col-span-2">
                                              <p className="text-xs font-medium text-muted-foreground">Stock on hand</p>
                                              <p className="mt-0.5 font-medium text-foreground">{qty}</p>
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </section>
                              ) : null}

                              {features.length ? (
                                <section className="space-y-2">
                                  <h3 className="text-sm font-semibold text-foreground">Highlights</h3>
                                  <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                                    {features.map((f) => (
                                      <li key={f}>{f}</li>
                                    ))}
                                  </ul>
                                </section>
                              ) : null}

                              {terms.length ? (
                                <section className="space-y-2">
                                  <h3 className="text-sm font-semibold text-foreground">Search keywords</h3>
                                  <p className="text-sm leading-relaxed text-muted-foreground">{terms.join(", ")}</p>
                                </section>
                              ) : null}
                            </>
                          )
                        })()}
                      </>
                    ) : !tiktokDetailLoading && tiktokDetailEnvelope && tiktokDetailEnvelope.code !== 0 ? (
                      <p className="text-destructive text-sm">
                        Could not load product details.{" "}
                        {tiktokDetailEnvelope.message ? (
                          <span className="block pt-1 text-muted-foreground">{tiktokDetailEnvelope.message}</span>
                        ) : (
                          <span className="block pt-1 text-muted-foreground">Please close and try again.</span>
                        )}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
              <DialogFooter className="border-border shrink-0 border-t px-6 py-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setTiktokDetailProduct(null)
                    setTiktokDetailEnvelope(null)
                    setTiktokDetailError("")
                    setTiktokDetailLoading(false)
                  }}
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={tiktokEditOpen}
            onOpenChange={(open) => {
              if (!open) {
                setTiktokEditProduct(null)
                setTiktokEditDetail(null)
                setTiktokEditForm(emptyTiktokProductEditForm())
                setTiktokEditLoadError("")
                setTiktokEditError("")
                setTiktokEditSuccess(null)
                setTiktokEditLoadLoading(false)
                setTiktokEditSaveLoading(false)
              }
              setTiktokEditOpen(open)
            }}
          >
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>Edit TikTok product</DialogTitle>
                <DialogDescription>
                  {tiktokEditProduct?.title ? (
                    <span className="text-foreground">{tiktokEditProduct.title}</span>
                  ) : (
                    "Load a product from the table, then adjust fields and save."
                  )}{" "}
                  Updates are sent to TikTok Shop when your integration is connected; otherwise you get a safe preview
                  response.
                </DialogDescription>
              </DialogHeader>

              {tiktokEditLoadLoading ? (
                <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                  Loading current product…
                </div>
              ) : null}
              {tiktokEditLoadError ? <p className="text-destructive text-sm">{tiktokEditLoadError}</p> : null}

              {!tiktokEditLoadLoading && tiktokEditDetail ? (
                <div className="grid gap-6 py-2">
                  <div className="rounded-lg border border-border/50 bg-muted/15 p-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Product basics
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="tte-title">Title</Label>
                        <Input
                          id="tte-title"
                          value={tiktokEditForm.title}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, title: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="tte-desc">Description</Label>
                        <Textarea
                          id="tte-desc"
                          rows={5}
                          value={tiktokEditForm.descriptionHtml}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, descriptionHtml: e.target.value }))}
                          className="font-mono text-xs sm:text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tte-cat">Category ID</Label>
                        <Input
                          id="tte-cat"
                          value={tiktokEditForm.categoryId}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, categoryId: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tte-brand">Brand ID</Label>
                        <Input
                          id="tte-brand"
                          value={tiktokEditForm.brandId}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, brandId: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tte-catver">Category version</Label>
                        <Input
                          id="tte-catver"
                          value={tiktokEditForm.categoryVersion}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, categoryVersion: e.target.value }))}
                          placeholder="v1"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <Switch
                          id="tte-cod"
                          checked={tiktokEditForm.isCodAllowed}
                          onCheckedChange={(c) => setTiktokEditForm((p) => ({ ...p, isCodAllowed: Boolean(c) }))}
                        />
                        <Label htmlFor="tte-cod" className="cursor-pointer">
                          Cash on delivery allowed
                        </Label>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tte-moq">Minimum order quantity</Label>
                        <Input
                          id="tte-moq"
                          inputMode="numeric"
                          value={tiktokEditForm.minimumOrderQuantity}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, minimumOrderQuantity: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tte-inv-mode">Inventory mode</Label>
                        <Input
                          id="tte-inv-mode"
                          value={tiktokEditForm.inventoryMode}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, inventoryMode: e.target.value }))}
                          placeholder="SHARED"
                        />
                      </div>
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <Switch
                          id="tte-autotr"
                          checked={tiktokEditForm.autoTranslateEnabled}
                          onCheckedChange={(c) =>
                            setTiktokEditForm((p) => ({ ...p, autoTranslateEnabled: Boolean(c) }))
                          }
                        />
                        <Label htmlFor="tte-autotr" className="cursor-pointer">
                          Auto-translate enabled
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/15 p-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Main image (TikTok file reference)
                    </p>
                    <p className="text-muted-foreground mb-2 text-xs">
                      Use the image URI from TikTok upload (not a public web URL). Thumbnail preview uses your catalog
                      image when available.
                    </p>
                    <div className="flex flex-wrap items-start gap-4">
                      {tiktokEditForm.mainImageUri ? (
                        <div className="border-border/60 overflow-hidden rounded-md border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              collectTiktokDetailImageUrls(tiktokEditDetail)[0] ||
                              `https://placehold.co/120x120/e2e8f0/64748b?text=URI`
                            }
                            alt=""
                            className="h-24 w-24 object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="min-w-[12rem] flex-1 space-y-1">
                        <Label htmlFor="tte-main-uri">Main image URI</Label>
                        <Input
                          id="tte-main-uri"
                          value={tiktokEditForm.mainImageUri}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, mainImageUri: e.target.value }))}
                          className="font-mono text-xs"
                          placeholder="tos-maliva-…"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/15 p-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Package & logistics IDs
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="tte-pw">Package weight</Label>
                        <Input
                          id="tte-pw"
                          value={tiktokEditForm.packageWeightValue}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, packageWeightValue: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tte-pwu">Weight unit</Label>
                        <Input
                          id="tte-pwu"
                          value={tiktokEditForm.packageWeightUnit}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, packageWeightUnit: e.target.value }))}
                          placeholder="KILOGRAM"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tte-ship-tpl">Shipping template ID</Label>
                        <Input
                          id="tte-ship-tpl"
                          value={tiktokEditForm.shippingTemplateId}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, shippingTemplateId: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tte-l">Length</Label>
                        <Input
                          id="tte-l"
                          value={tiktokEditForm.pkgLen}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, pkgLen: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tte-w">Width</Label>
                        <Input
                          id="tte-w"
                          value={tiktokEditForm.pkgWid}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, pkgWid: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tte-h">Height</Label>
                        <Input
                          id="tte-h"
                          value={tiktokEditForm.pkgHt}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, pkgHt: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-3">
                        <Label htmlFor="tte-pkg-u">Dimension unit</Label>
                        <Input
                          id="tte-pkg-u"
                          value={tiktokEditForm.pkgUnit}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, pkgUnit: e.target.value }))}
                          placeholder="CENTIMETER"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-3">
                        <Label htmlFor="tte-ext-pid">External product ID (optional)</Label>
                        <Input
                          id="tte-ext-pid"
                          value={tiktokEditForm.externalProductId}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, externalProductId: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-3">
                        <Label htmlFor="tte-vid">Video ID (optional)</Label>
                        <Input
                          id="tte-vid"
                          value={tiktokEditForm.videoId}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, videoId: e.target.value }))}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/15 p-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Size chart</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="tte-sc-uri">Size chart image URI</Label>
                        <Input
                          id="tte-sc-uri"
                          value={tiktokEditForm.sizeChartImageUri}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, sizeChartImageUri: e.target.value }))}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tte-sc-tpl">Size chart template ID</Label>
                        <Input
                          id="tte-sc-tpl"
                          value={tiktokEditForm.sizeChartTemplateId}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, sizeChartTemplateId: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/15 p-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Discoverability</p>
                    <div className="grid gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="tte-terms">Search keywords (comma-separated)</Label>
                        <Input
                          id="tte-terms"
                          value={tiktokEditForm.searchTermsLine}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, searchTermsLine: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tte-features">Key product features (one per line)</Label>
                        <Textarea
                          id="tte-features"
                          rows={3}
                          value={tiktokEditForm.keyFeaturesLines}
                          onChange={(e) => setTiktokEditForm((p) => ({ ...p, keyFeaturesLines: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/15 p-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Variants (SKUs)
                    </p>
                    <div className="space-y-4">
                      {tiktokEditForm.skuRows.map((row, idx) => (
                        <div key={row.id || `sku-${idx}`} className="space-y-3 rounded-md border border-border/40 p-3">
                          <p className="text-xs font-medium text-muted-foreground">Variant {idx + 1}</p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-1">
                              <Label className="text-xs">SKU ID (from TikTok)</Label>
                              <Input
                                className="font-mono text-xs"
                                value={row.id}
                                onChange={(e) =>
                                  setTiktokEditForm((p) => ({
                                    ...p,
                                    skuRows: p.skuRows.map((r, i) => (i === idx ? { ...r, id: e.target.value } : r)),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <Label className="text-xs">Seller SKU</Label>
                              <Input
                                value={row.sellerSku}
                                onChange={(e) =>
                                  setTiktokEditForm((p) => ({
                                    ...p,
                                    skuRows: p.skuRows.map((r, i) =>
                                      i === idx ? { ...r, sellerSku: e.target.value } : r,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Attribute ID</Label>
                              <Input
                                className="font-mono text-xs"
                                value={row.attrId}
                                onChange={(e) =>
                                  setTiktokEditForm((p) => ({
                                    ...p,
                                    skuRows: p.skuRows.map((r, i) =>
                                      i === idx ? { ...r, attrId: e.target.value } : r,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Attribute name</Label>
                              <Input
                                value={row.attrName}
                                onChange={(e) =>
                                  setTiktokEditForm((p) => ({
                                    ...p,
                                    skuRows: p.skuRows.map((r, i) =>
                                      i === idx ? { ...r, attrName: e.target.value } : r,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Value ID</Label>
                              <Input
                                className="font-mono text-xs"
                                value={row.valueId}
                                onChange={(e) =>
                                  setTiktokEditForm((p) => ({
                                    ...p,
                                    skuRows: p.skuRows.map((r, i) =>
                                      i === idx ? { ...r, valueId: e.target.value } : r,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Value label</Label>
                              <Input
                                value={row.valueName}
                                onChange={(e) =>
                                  setTiktokEditForm((p) => ({
                                    ...p,
                                    skuRows: p.skuRows.map((r, i) =>
                                      i === idx ? { ...r, valueName: e.target.value } : r,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Currency</Label>
                              <Input
                                value={row.currency}
                                onChange={(e) =>
                                  setTiktokEditForm((p) => ({
                                    ...p,
                                    skuRows: p.skuRows.map((r, i) =>
                                      i === idx ? { ...r, currency: e.target.value } : r,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Sale price</Label>
                              <Input
                                value={row.salePrice}
                                onChange={(e) =>
                                  setTiktokEditForm((p) => ({
                                    ...p,
                                    skuRows: p.skuRows.map((r, i) =>
                                      i === idx ? { ...r, salePrice: e.target.value } : r,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">List / compare amount</Label>
                              <Input
                                value={row.amount}
                                onChange={(e) =>
                                  setTiktokEditForm((p) => ({
                                    ...p,
                                    skuRows: p.skuRows.map((r, i) =>
                                      i === idx ? { ...r, amount: e.target.value } : r,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Warehouse ID</Label>
                              <Input
                                className="font-mono text-xs"
                                value={row.warehouseId}
                                onChange={(e) =>
                                  setTiktokEditForm((p) => ({
                                    ...p,
                                    skuRows: p.skuRows.map((r, i) =>
                                      i === idx ? { ...r, warehouseId: e.target.value } : r,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Stock quantity</Label>
                              <Input
                                inputMode="numeric"
                                value={row.quantity}
                                onChange={(e) =>
                                  setTiktokEditForm((p) => ({
                                    ...p,
                                    skuRows: p.skuRows.map((r, i) =>
                                      i === idx ? { ...r, quantity: e.target.value } : r,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Backorder qty</Label>
                              <Input
                                inputMode="numeric"
                                value={row.backorderQuantity}
                                onChange={(e) =>
                                  setTiktokEditForm((p) => ({
                                    ...p,
                                    skuRows: p.skuRows.map((r, i) =>
                                      i === idx ? { ...r, backorderQuantity: e.target.value } : r,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Handling time (days)</Label>
                              <Input
                                inputMode="numeric"
                                value={row.handlingTime}
                                onChange={(e) =>
                                  setTiktokEditForm((p) => ({
                                    ...p,
                                    skuRows: p.skuRows.map((r, i) =>
                                      i === idx ? { ...r, handlingTime: e.target.value } : r,
                                    ),
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {tiktokEditError ? <p className="text-destructive text-sm">{tiktokEditError}</p> : null}
                  {tiktokEditSuccess?.code === 0 ? (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                      <p className="font-medium text-emerald-800 dark:text-emerald-200">Saved successfully.</p>
                      {tiktokEditSuccess.data?.audit?.status ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          Review status: {tiktokEditSuccess.data.audit.status}
                        </p>
                      ) : null}
                      {tiktokEditSuccess.data?.warnings?.length ? (
                        <ul className="mt-2 list-disc pl-5 text-xs text-amber-900 dark:text-amber-100">
                          {tiktokEditSuccess.data.warnings.map((w, i) => (
                            <li key={i}>{w.message || "Warning"}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setTiktokEditOpen(false)}
                  disabled={tiktokEditSaveLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={tiktokEditSaveLoading || tiktokEditLoadLoading || !tiktokEditDetail}
                  className="gap-2"
                  onClick={() => void handleTiktokEditSave()}
                >
                  {tiktokEditSaveLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Save changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={tiktokCreateOpen}
            onOpenChange={(open) => {
              if (open) {
                resetTiktokCreateMainImageVisualOnly()
                setTiktokCreateForm(emptyTiktokCreateForm())
                setTiktokCreateImageFieldKey((k) => k + 1)
                setTiktokCreateError("")
                setTiktokCreateSuccess(null)
                setTiktokCreateLoading(false)
              } else {
                syncTiktokCreateMainImage(null)
                setTiktokCreateLoading(false)
                setTiktokCreateError("")
                setTiktokCreateSuccess(null)
              }
              setTiktokCreateOpen(open)
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>Create TikTok Product</DialogTitle>
                <DialogDescription>
                  All fields are required. Upload a main product image and fill the rest; product create will call TikTok
                  once API access is enabled. Until then, submit shows a preview success only.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-3">
                <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Basics</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="tt-title">Product title</Label>
                      <Input
                        id="tt-title"
                        value={tiktokCreateForm.title}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, title: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tt-category">category_id</Label>
                      <Input
                        id="tt-category"
                        value={tiktokCreateForm.categoryId}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, categoryId: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tt-brand">brand_id</Label>
                      <Input
                        id="tt-brand"
                        value={tiktokCreateForm.brandId}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, brandId: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="tt-main-image">Main product image</Label>
                      <label
                        htmlFor="tt-main-image"
                        className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 px-4 py-4 text-center"
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const file = e.dataTransfer.files?.[0] ?? null
                          if (!file || !file.type.startsWith("image/")) {
                            setTiktokCreateError("Please drop an image file (JPEG, PNG, or WebP).")
                            return
                          }
                          syncTiktokCreateMainImage(file)
                          setTiktokCreateImageFieldKey((k) => k + 1)
                        }}
                      >
                        {tiktokCreateMainImagePreviewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={tiktokCreateMainImagePreviewUrl}
                            alt="Main product preview"
                            className="max-h-32 max-w-full rounded-md object-contain"
                          />
                        ) : (
                          <ImagePlus className="h-7 w-7 text-muted-foreground" aria-hidden />
                        )}
                        <p className="text-sm font-medium">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground">
                          JPEG, PNG, or WebP. This becomes main_images[0] once TikTok image upload is wired; for now a
                          placeholder URI is sent with the create payload.
                        </p>
                        <Input
                          key={tiktokCreateImageFieldKey}
                          id="tt-main-image"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null
                            syncTiktokCreateMainImage(file)
                          }}
                        />
                      </label>
                      {tiktokCreateMainImageFile ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-muted-foreground truncate text-xs">
                            Selected: <span className="font-medium text-foreground">{tiktokCreateMainImageFile.name}</span>
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              syncTiktokCreateMainImage(null)
                              setTiktokCreateImageFieldKey((k) => k + 1)
                            }}
                          >
                            Remove image
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="tt-description">description (HTML)</Label>
                      <Textarea
                        id="tt-description"
                        value={tiktokCreateForm.descriptionHtml}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, descriptionHtml: e.target.value }))}
                        rows={4}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">SKU + Inventory</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="tt-seller-sku">seller_sku</Label>
                      <Input
                        id="tt-seller-sku"
                        value={tiktokCreateForm.sellerSku}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, sellerSku: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tt-warehouse">warehouse_id</Label>
                      <Input
                        id="tt-warehouse"
                        value={tiktokCreateForm.warehouseId}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, warehouseId: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tt-qty">quantity</Label>
                      <Input
                        id="tt-qty"
                        value={tiktokCreateForm.quantity}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, quantity: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tt-backorder">backorder_quantity</Label>
                      <Input
                        id="tt-backorder"
                        value={tiktokCreateForm.backorderQuantity}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, backorderQuantity: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tt-handling">handling_time (days)</Label>
                      <Input
                        id="tt-handling"
                        value={tiktokCreateForm.handlingTimeDays}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, handlingTimeDays: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:col-span-2">
                      <Label htmlFor="tt-not-for-sale">Not for sale</Label>
                      <Switch
                        id="tt-not-for-sale"
                        checked={tiktokCreateForm.isNotForSale}
                        onCheckedChange={(checked) =>
                          setTiktokCreateForm((p) => ({ ...p, isNotForSale: checked === true }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Pricing</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="tt-currency">currency</Label>
                      <Input
                        id="tt-currency"
                        value={tiktokCreateForm.currency}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, currency: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tt-sale-price">sale_price</Label>
                      <Input
                        id="tt-sale-price"
                        value={tiktokCreateForm.salePrice}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, salePrice: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tt-tax-ex">tax_exclusive_price</Label>
                      <Input
                        id="tt-tax-ex"
                        value={tiktokCreateForm.taxExclusivePrice}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, taxExclusivePrice: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tt-list-price">list_price amount</Label>
                      <Input
                        id="tt-list-price"
                        value={tiktokCreateForm.listPriceAmount}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, listPriceAmount: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="tt-external-source">external_list_prices[0].source</Label>
                      <Input
                        id="tt-external-source"
                        value={tiktokCreateForm.externalListSource}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, externalListSource: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tt-external-amount">external_list_prices[0].amount</Label>
                      <Input
                        id="tt-external-amount"
                        value={tiktokCreateForm.externalListAmount}
                        onChange={(e) => setTiktokCreateForm((p) => ({ ...p, externalListAmount: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="invisible" htmlFor="tt-empty">
                        .
                      </Label>
                      <div />
                    </div>
                  </div>
                </div>

                {tiktokCreateError ? <p className="text-sm text-destructive">{tiktokCreateError}</p> : null}

                {tiktokCreateSuccess ? (
                  <div className="rounded-lg border border-border/50 bg-background p-4">
                    <p className="text-sm font-medium">Create success</p>
                    {tiktokCreateSuccess.message ? (
                      <p className="mt-1 text-sm text-muted-foreground">{tiktokCreateSuccess.message}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      product_id: <span className="font-mono">{tiktokCreateSuccess.data?.product_id ?? "—"}</span>
                    </p>
                    {Array.isArray(tiktokCreateSuccess.data?.warnings) && tiktokCreateSuccess.data?.warnings.length ? (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Warnings</p>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {tiktokCreateSuccess.data.warnings.slice(0, 5).map((w, idx) => (
                            <li key={`${idx}-${w.message ?? "warn"}`}>{w.message ?? "—"}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {tiktokCreateSuccess.request_id ? (
                      <p className="mt-3 text-xs text-muted-foreground font-mono">request_id: {tiktokCreateSuccess.request_id}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <DialogFooter className="border-border shrink-0 border-t px-6 py-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTiktokCreateOpen(false)}
                  disabled={tiktokCreateLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void handleTiktokCreateProduct()}
                  disabled={tiktokCreateLoading}
                >
                  {tiktokCreateLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Create on TikTok
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}

      {inventoryPlatformTab === "whatnot" ? (
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
      ) : null}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Inventory</DialogTitle>
            <DialogDescription>All fields below are required before saving inventory.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="inventory-media">Media *</Label>
              <label
                htmlFor="inventory-media"
                className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 px-4 text-center"
              >
                {selectedImagePreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedImagePreviewUrl}
                    alt="Selected product"
                    className="max-h-28 rounded-md object-cover"
                  />
                ) : (
                  <ImagePlus className="h-7 w-7 text-muted-foreground" />
                )}
                <p className="text-sm font-medium">
                  Click to upload or drag and drop your media
                </p>
                <p className="text-xs text-muted-foreground">
                  Choose your product&apos;s main photo first.
                </p>
                {isUploadingMedia ? (
                  <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sending image payload to backend and Whatnot...
                  </p>
                ) : null}
                <Input
                  id="inventory-media"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null
                    if (selectedImagePreviewUrl) {
                      URL.revokeObjectURL(selectedImagePreviewUrl)
                    }
                    setSelectedImage(file)
                    setSelectedImagePreviewUrl(file ? URL.createObjectURL(file) : "")
                    setCreateFormError("")
                    setIsMediaUploaded(false)
                    setUploadedImageId("")
                    if (!file) {
                      return
                    }

                    void (async () => {
                      try {
                        setIsUploadingMedia(true)
                        const token = await waitForSessionToken(getToken)
                        const mediaPayload = [
                          {
                            extension: getImageExtension(file),
                            id: crypto.randomUUID(),
                          },
                        ]
                        const fileBase64 = await readFileAsBase64(file)
                        const mediaResponse = await generateWhatnotMediaUploadUrls(token, mediaPayload, {
                          fileBase64,
                          fileContentType: file.type || "application/octet-stream",
                        })
                        const nextImageId =
                          mediaResponse?.data?.addListingPhoto?.image?.id &&
                          typeof mediaResponse.data.addListingPhoto.image.id === "string"
                            ? mediaResponse.data.addListingPhoto.image.id.trim()
                            : ""
                        if (!nextImageId) {
                          throw new Error("Whatnot did not return image.id from AddListingPhoto.")
                        }
                        setUploadedImageId(nextImageId)
                        setIsMediaUploaded(true)
                      } catch (error) {
                        setIsMediaUploaded(false)
                        setUploadedImageId("")
                        setCreateFormError(getClerkErrorMessage(error))
                      } finally {
                        setIsUploadingMedia(false)
                      }
                    })()
                  }}
                />
              </label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="inventory-category">Category *</Label>
              <div className="relative">
                <Input
                  id="inventory-category"
                  value={categorySearchValue}
                  onChange={(event) => {
                    setCategorySearchValue(event.target.value)
                    setCreateForm((current) => ({
                      ...current,
                      subcategoryId: "",
                      title: "",
                      description: "",
                    }))
                    setCreateFormError("")
                    setIsCategoryDropdownOpen(true)
                  }}
                  onFocus={() => setIsCategoryDropdownOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => setIsCategoryDropdownOpen(false), 120)
                  }}
                  placeholder="Type and select category"
                  className="h-14 text-base"
                  required
                />
                {isCategoryDropdownOpen ? (
                  <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
                    {filteredSubcategoryOptions.length ? (
                      filteredSubcategoryOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            setCreateForm((current) => ({
                              ...current,
                              subcategoryId: option.id,
                              title: "",
                              description: "",
                            }))
                            setCategorySearchValue(option.label)
                            setCreateFormError("")
                            setIsCategoryDropdownOpen(false)
                          }}
                        >
                          {option.label}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No category found.</p>
                    )}
                  </div>
                ) : null}
              </div>
              {createForm.subcategoryId ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    disabled={isGeneratingListingAi}
                    onClick={() => void handleAiInventoryListing()}
                  >
                    {isGeneratingListingAi ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    AI Auto Fill
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={isGeneratingListingAi}
                    onClick={() => void handleAiInventoryListing()}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={!createForm.title.trim() || aiThumbnailLoading || isGeneratingListingAi}
                    onClick={openAiThumbnailModal}
                  >
                    {aiThumbnailLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                    AI Thumbnail
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="inventory-title">Title *</Label>
              <Input
                id="inventory-title"
                value={createForm.title}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, title: event.target.value }))
                  setCreateFormError("")
                }}
                placeholder="Enter title"
                  className="h-14 text-base"
                required
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="inventory-description">Description *</Label>
                <span className="text-xs text-muted-foreground">
                  {createForm.description.length}/120 (aim 80–120)
                </span>
              </div>
              <Textarea
                id="inventory-description"
                value={createForm.description}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, description: event.target.value }))
                  setCreateFormError("")
                }}
                placeholder="Enter description"
                className="min-h-20 text-base"
                maxLength={120}
                required
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="inventory-quantity">Quantity *</Label>
                <Input
                  id="inventory-quantity"
                  inputMode="numeric"
                  value={createForm.quantity}
                  onChange={(event) => {
                    setCreateForm((current) => ({ ...current, quantity: event.target.value }))
                    setCreateFormError("")
                  }}
                  placeholder="0"
                  className="h-14 text-base"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inventory-price-usd">Price (USD) *</Label>
                <Input
                  id="inventory-price-usd"
                  inputMode="decimal"
                  value={createForm.priceUsd}
                  onChange={(event) => {
                    setCreateForm((current) => ({ ...current, priceUsd: event.target.value }))
                    setCreateFormError("")
                  }}
                  placeholder="0.00"
                  className="h-14 text-base"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="inventory-shipping-profile">Shipping Profile *</Label>
              <Select
                value={createForm.shippingProfileId}
                onValueChange={(value) => {
                  setCreateForm((current) => ({ ...current, shippingProfileId: value }))
                  setCreateFormError("")
                }}
              >
                <SelectTrigger id="inventory-shipping-profile" className="h-14 w-full text-base">
                  <SelectValue placeholder="Select shipping profile" />
                </SelectTrigger>
                <SelectContent>
                  {shippingProfileOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="inventory-hazardous-materials">Hazardous Materials *</Label>
              <Select
                value={createForm.hazardousMaterials}
                onValueChange={(value) => {
                  setCreateForm((current) => ({ ...current, hazardousMaterials: value }))
                  setCreateFormError("")
                }}
              >
                <SelectTrigger id="inventory-hazardous-materials" className="h-14 w-full text-base">
                  <SelectValue placeholder="Select hazardous material option" />
                </SelectTrigger>
                <SelectContent>
                  {HAZARDOUS_MATERIAL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {createFormError ? <p className="text-sm text-destructive">{createFormError}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateInventory} disabled={!canCreateInventory || isPublishingInventory}>
              {isPublishingInventory ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publishing...
                </span>
              ) : (
                "Publish Inventory"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={aiThumbnailModalOpen}
        onOpenChange={(open) => {
          setAiThumbnailModalOpen(open)
          if (!open) {
            setAiThumbnailError("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>AI Thumbnail</DialogTitle>
            {/* <DialogDescription>
              Suggested thumbnail for your listing (225 × 225). Download or regenerate a new version.
            </DialogDescription> */}
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex h-[225px] w-[225px] items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
              {aiThumbnailLoading ? (
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span>Generating thumbnail...</span>
                </div>
              ) : aiThumbnailImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={aiThumbnailImageUrl}
                  alt={`AI thumbnail for ${createForm.title}`}
                  width={225}
                  height={225}
                  className="h-[225px] w-[225px] object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 px-4 text-center text-sm text-muted-foreground">
                  <ImageIcon className="h-8 w-8 opacity-50" />
                  <span>{aiThumbnailError || "No thumbnail yet."}</span>
                </div>
              )}
            </div>

            {aiThumbnailError && !aiThumbnailLoading ? (
              <p className="text-center text-sm text-destructive">{aiThumbnailError}</p>
            ) : null}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={aiThumbnailLoading}
              onClick={() => void handleGenerateAiThumbnail()}
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </Button>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAiThumbnailModalOpen(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                className="gap-2"
                disabled={!aiThumbnailImageUrl || aiThumbnailLoading}
                onClick={() => void handleDownloadAiThumbnail()}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
