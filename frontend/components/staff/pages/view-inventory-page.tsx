"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { ImagePlus, Loader2, Plus } from "lucide-react"

import { StaffLiveSyncBanner } from "@/components/staff/staff-live-sync-banner"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import { useStaffModules } from "@/components/staff/staff-modules-context"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  createStaffPendingInventory,
  getClerkErrorMessage,
  getWhatnotInventoryCreateFormOptions,
  getWhatnotInventoryLive,
  type WhatnotInventoryLiveResponse,
  waitForSessionToken,
} from "@/lib/auth"

type InventoryRow = {
  id: string
  title: string
  subtitle: string
  category: string
  quantity: number
  priceText: string
  format: string
}

type CreateInventoryForm = {
  subcategoryId: string
  title: string
  description: string
  quantity: string
  priceUsd: string
  shippingProfileId: string
  hazardousMaterials: string
}

type SubcategoryOption = {
  id: string
  label: string
}

type ShippingProfileOption = {
  id: string
  name: string
}

const HAZARDOUS_MATERIAL_OPTIONS = [
  { label: "No Hazardous Materials", value: "NOT_HAZMAT" },
  { label: "Contains Hazardous Materials", value: "HAZMAT" },
  { label: "Contains Lithium Batteries", value: "LITHIUM_ION_BATTERIES" },
]

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

function toInventoryRows(payload: WhatnotInventoryLiveResponse | null): InventoryRow[] {
  const edges = payload?.responsePayload?.data?.me?.inventory?.edges || []

  return edges
    .map((edge) => {
      const node = edge?.node
      if (!node || !node.id) {
        return null
      }

      const normalizedId = String(node.id)
      const trimmedTitle = typeof node.title === "string" && node.title.trim() ? node.title.trim() : "Untitled product"
      const subtitle =
        typeof node.subtitle === "string" && node.subtitle.trim()
          ? node.subtitle.trim()
          : typeof node.description === "string" && node.description.trim()
            ? node.description.trim()
            : "No description"
      const stock = typeof node.quantity === "number" && Number.isFinite(node.quantity) ? Math.max(0, Math.floor(node.quantity)) : 0
      const category =
        typeof node.product?.category?.label === "string" && node.product.category.label.trim()
          ? node.product.category.label.trim()
          : "Uncategorized"
      const rawAmount = typeof node.price?.amount === "number" && Number.isFinite(node.price.amount) ? node.price.amount : null
      const currency = typeof node.price?.currency === "string" && node.price.currency.trim() ? node.price.currency.trim() : "USD"
      const amount = rawAmount === null ? 0 : rawAmount / 100
      const priceText = `${currency} ${amount.toFixed(2)}`
      const format = typeof node.transactionType === "string" && node.transactionType.trim() ? node.transactionType.trim() : "BUY_IT_NOW"

      return {
        id: normalizedId,
        title: trimmedTitle,
        subtitle,
        category,
        quantity: stock,
        priceText,
        format,
      }
    })
    .filter((row): row is InventoryRow => row !== null)
}

export function ViewInventoryPage() {
  const router = useRouter()
  const { marketplaceHub } = useStaffModules()
  const { getToken, isLoaded } = useAuth()
  const getTokenRef = useRef(getToken)

  useEffect(() => {
    if (marketplaceHub === "tiktok") {
      router.replace("/staff/modules/tiktok_inventory")
    }
  }, [marketplaceHub, router])
  const hasLoadedInventoryRef = useRef(false)
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createFormError, setCreateFormError] = useState("")
  const [subcategoryOptions, setSubcategoryOptions] = useState<SubcategoryOption[]>([])
  const [shippingProfileOptions, setShippingProfileOptions] = useState<ShippingProfileOption[]>([])
  const [categorySearchValue, setCategorySearchValue] = useState("")
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState("")
  const [isCreatingPendingInventory, setIsCreatingPendingInventory] = useState(false)
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
    getTokenRef.current = getToken
  }, [getToken])

  const loadInventory = useCallback(
    async (isManualRefresh: boolean) => {
      try {
        if (isManualRefresh) {
          setIsRefreshing(true)
        } else {
          setIsLoading(true)
        }

        setError(null)
        const token = await waitForSessionToken(getTokenRef.current)
        const result = await getWhatnotInventoryLive(token, "ACTIVE")
        setRows(toInventoryRows(result))
        setLastUpdated(result.syncedAt ? new Date(result.syncedAt) : null)
      } catch (loadError) {
        setError(getClerkErrorMessage(loadError))
        setRows([])
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!isLoaded || hasLoadedInventoryRef.current) {
      return
    }
    hasLoadedInventoryRef.current = true
    void loadInventory(false)
  }, [isLoaded, loadInventory])

  useEffect(() => {
    return () => {
      if (selectedImagePreviewUrl) {
        URL.revokeObjectURL(selectedImagePreviewUrl)
      }
    }
  }, [selectedImagePreviewUrl])

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

  const totalProducts = useMemo(() => rows.length, [rows])
  const filteredSubcategoryOptions = useMemo(() => {
    const query = categorySearchValue.trim().toLowerCase()
    if (!query) {
      return subcategoryOptions
    }
    return subcategoryOptions.filter((item) => item.label.toLowerCase().includes(query))
  }, [categorySearchValue, subcategoryOptions])

  const canCreatePendingInventory = useMemo(() => {
    return Boolean(
      selectedImage &&
        createForm.subcategoryId.trim() &&
        createForm.title.trim() &&
        createForm.description.trim() &&
        createForm.quantity.trim() &&
        createForm.priceUsd.trim() &&
        createForm.shippingProfileId.trim() &&
        createForm.hazardousMaterials.trim(),
    )
  }, [createForm, selectedImage])

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
    if (selectedImagePreviewUrl) {
      URL.revokeObjectURL(selectedImagePreviewUrl)
    }
    setSelectedImagePreviewUrl("")
    setIsCreatingPendingInventory(false)
    setCreateFormError("")
  }

  function openCreateDialog() {
    resetCreateForm()
    setCreateDialogOpen(true)
  }

  async function handleCreatePendingInventory() {
    if (!canCreatePendingInventory || !selectedImage) {
      setCreateFormError("Please fill all required fields.")
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

    try {
      setIsCreatingPendingInventory(true)
      setCreateFormError("")
      const token = await waitForSessionToken(getToken)
      const fileBase64 = await readFileAsBase64(selectedImage)
      const mediaId = crypto.randomUUID()
      const extension = getImageExtension(selectedImage)
      await createStaffPendingInventory(token, {
        subcategoryId: createForm.subcategoryId,
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        quantity: quantityValue,
        priceUsd: priceValue,
        shippingProfileId: createForm.shippingProfileId,
        hazmatType: createForm.hazardousMaterials,
        imageId: "",
        imagePayload: {
          media: [{ id: mediaId, extension }],
          fileBase64,
          fileContentType: selectedImage.type || "application/octet-stream",
        },
      })
      setCreateDialogOpen(false)
      resetCreateForm()
    } catch (submitError) {
      setCreateFormError(getClerkErrorMessage(submitError))
    } finally {
      setIsCreatingPendingInventory(false)
    }
  }

  return (
    <StaffModuleGate
      moduleId="view_inventory"
      title="View Inventory"
      description="Read-only Whatnot inventory for your parent seller workspace."
    >
      <StaffLiveSyncBanner
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRefresh={() => void loadInventory(true)}
      />

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading parent seller inventory…</CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Whatnot inventory overview</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Only products synced under your parent seller are visible here. Other sellers&apos; products are excluded.
                </p>
              </div>
              <Button className="gap-2" onClick={openCreateDialog}>
                <Plus className="h-4 w-4" />
                Create Product
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Total products: {totalProducts}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Price &amp; Format</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium">{row.title}</p>
                      <p className="text-xs text-muted-foreground">{row.subtitle}</p>
                    </TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
                    <TableCell>
                      <p className="font-medium">{row.priceText}</p>
                      <p className="text-xs text-muted-foreground">{row.format}</p>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      No Whatnot products found for your parent seller.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Create Inventory</DialogTitle>
            <DialogDescription>All fields below are required before creating pending inventory.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="staff-inventory-media">Media *</Label>
              <label
                htmlFor="staff-inventory-media"
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
                <p className="text-sm font-medium">Click to upload or drag and drop your media</p>
                <p className="text-xs text-muted-foreground">Choose your product&apos;s main photo first.</p>
                <Input
                  id="staff-inventory-media"
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
                  }}
                />
              </label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="staff-inventory-category">Category *</Label>
              <div className="relative">
                <Input
                  id="staff-inventory-category"
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
              <Label htmlFor="staff-inventory-title">Title *</Label>
              <Input
                id="staff-inventory-title"
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
              <Label htmlFor="staff-inventory-description">Description *</Label>
              <Textarea
                id="staff-inventory-description"
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
                <Label htmlFor="staff-inventory-quantity">Quantity *</Label>
                <Input
                  id="staff-inventory-quantity"
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
                <Label htmlFor="staff-inventory-price-usd">Price (USD) *</Label>
                <Input
                  id="staff-inventory-price-usd"
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
              <Label htmlFor="staff-inventory-shipping-profile">Shipping Profile *</Label>
              <Select
                value={createForm.shippingProfileId}
                onValueChange={(value) => {
                  setCreateForm((current) => ({ ...current, shippingProfileId: value }))
                  setCreateFormError("")
                }}
              >
                <SelectTrigger id="staff-inventory-shipping-profile" className="h-14 w-full text-base">
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
              <Label htmlFor="staff-inventory-hazardous-materials">Hazardous Materials *</Label>
              <Select
                value={createForm.hazardousMaterials}
                onValueChange={(value) => {
                  setCreateForm((current) => ({ ...current, hazardousMaterials: value }))
                  setCreateFormError("")
                }}
              >
                <SelectTrigger id="staff-inventory-hazardous-materials" className="h-14 w-full text-base">
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
            <Button
              type="button"
              onClick={handleCreatePendingInventory}
              disabled={!canCreatePendingInventory || isCreatingPendingInventory}
            >
              {isCreatingPendingInventory ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                "Create Inventory"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffModuleGate>
  )
}