"use client"

import { useAuth } from "@clerk/nextjs"
import { useEffect, useMemo, useState } from "react"
import { ImagePlus, Link2, Loader2, Plus, Search, SlidersHorizontal } from "lucide-react"

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  createWhatnotListing,
  getClerkErrorMessage,
  generateWhatnotMediaUploadUrls,
  getWhatnotInventoryCreateFormOptions,
  syncWhatnotInventoryLive,
  waitForSessionToken,
} from "@/lib/auth"

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

interface CreateInventoryForm {
  subcategoryId: string
  title: string
  description: string
  quantity: string
  priceUsd: string
  shippingProfileId: string
  hazardousMaterials: string
}

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

export default function SellerInventoryManagementPage() {
  const { getToken, isLoaded } = useAuth()
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
  const [createForm, setCreateForm] = useState<CreateInventoryForm>({
    subcategoryId: "",
    title: "",
    description: "",
    quantity: "",
    priceUsd: "",
    shippingProfileId: "",
    hazardousMaterials: "",
  })

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
    setCreateFormError("")
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
        <Button className="gap-2" onClick={openCreateDialog}>
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

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
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
                    setCreateForm((current) => ({ ...current, subcategoryId: "" }))
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
                            setCreateForm((current) => ({ ...current, subcategoryId: option.id }))
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
              <Label htmlFor="inventory-description">Description *</Label>
              <Textarea
                id="inventory-description"
                value={createForm.description}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, description: event.target.value }))
                  setCreateFormError("")
                }}
                placeholder="Enter description"
                className="h-14 text-base"
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
    </div>
  )
}
