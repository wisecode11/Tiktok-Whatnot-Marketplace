"use client"

import { useAuth } from "@clerk/nextjs"
import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronRight, Clock3, ExternalLink, Loader2, PackageSearch, Radio, RefreshCw, Trash2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  fetchWhatnotShowTabData,
  fetchWhatnotPrimaryShowFormatTags,
  getWhatnotLivestreamCategoryTree,
  cancelWhatnotShow,
  scheduleWhatnotShow,
  syncWhatnotReferenceCache,
  waitForSessionToken,
  withWhatnotAuthRetry,
  getClerkErrorMessage,
  type WhatnotLivestreamMainCategoryItem,
  type WhatnotLiveShowItem,
  type WhatnotPrimaryShowFormatTag,
} from "@/lib/auth"

type FilterType = "All" | "Live" | "Upcoming" | "Past"

const FILTERS: FilterType[] = ["All", "Live", "Upcoming", "Past"]
const REPEAT_OPTIONS = ["Does not repeat", "Daily", "Weekly", "Monthly"] as const
const LANGUAGE_OPTIONS = ["English", "Netherlands", "Francais", "Deutsch", "Chienese"] as const
function formatStartTime(startTime: number | null): { date: string; time: string } {
  if (!startTime) return { date: "—", time: "—" }
  const d = new Date(startTime)
  return {
    date: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  }
}

export default function SellerWhatnotShowPage() {
  const { getToken, isLoaded } = useAuth()
  const [shows, setShows] = useState<WhatnotLiveShowItem[] | null>(null)
  const [loadError, setLoadError] = useState("")
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterType>("All")
  const [openScheduleDialog, setOpenScheduleDialog] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState<WhatnotLivestreamMainCategoryItem[]>([])
  const [expandedMainCategoryIds, setExpandedMainCategoryIds] = useState<Set<string>>(new Set())
  const [categorySearchValue, setCategorySearchValue] = useState("")
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const [primaryShowFormatOptions, setPrimaryShowFormatOptions] = useState<WhatnotPrimaryShowFormatTag[]>([])
  const [isPrimaryShowFormatLoading, setIsPrimaryShowFormatLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState("")
  const [scheduleNotice, setScheduleNotice] = useState("")
  const [cancelTarget, setCancelTarget] = useState<WhatnotLiveShowItem | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelNotice, setCancelNotice] = useState("")
  const [referenceCacheSyncing, setReferenceCacheSyncing] = useState(false)
  const [referenceCacheNotice, setReferenceCacheNotice] = useState("")
  const [referenceCacheError, setReferenceCacheError] = useState("")
  const primaryShowFormatRequestIdRef = useRef(0)
  const [scheduleForm, setScheduleForm] = useState({
    name: "",
    showDate: "",
    showTime: "",
    repeats: "Does not repeat",
    primaryCategoryId: "",
    selectedCategoryId: "",
    selectedCategoryLabel: "",
    primarySellingFormat: "",
    primarySellingFormatId: "",
    primarySellingFormatName: "",
    primarySellingFormatLabel: "",
    primaryLanguage: "English",
    showDiscovery: "public" as "public" | "private",
  })

  useEffect(() => {
    let cancelled = false

    async function loadShows() {
      if (!isLoaded) return
      setLoading(true)
      setLoadError("")
      try {
        const token = await waitForSessionToken(getToken)
        if (cancelled) return
        const data = await fetchWhatnotShowTabData(token, 0, { forceRefresh: false })
        if (!cancelled) {
          setShows(data.shows ?? [])
          setLoadError("")
        }
      } catch (error) {
        if (!cancelled) {
          setShows(null)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load Whatnot shows. Connect the extension and try Refetch.",
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadShows()
    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  async function handleRefetchShows() {
    if (!isLoaded || refreshing) return
    setRefreshing(true)
    setLoadError("")
    try {
      const token = await waitForSessionToken(getToken)
      const data = await withWhatnotAuthRetry(() =>
        fetchWhatnotShowTabData(token, 0, { forceRefresh: true }),
      )
      setShows(data.shows ?? [])
      setLoadError("")
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Refetch failed. Keep Whatnot open, reconnect the extension, and try again.",
      )
    } finally {
      setRefreshing(false)
    }
  }

  const loadCategoryOptions = useCallback(async () => {
    const token = await waitForSessionToken(getToken)
    const response = await getWhatnotLivestreamCategoryTree(token)
    setCategoryOptions(Array.isArray(response.categories) ? response.categories : [])
  }, [getToken])

  useEffect(() => {
    let cancelled = false

    async function hydrateCategoryOptions() {
      if (!isLoaded) return
      try {
        const token = await waitForSessionToken(getToken)
        const response = await getWhatnotLivestreamCategoryTree(token)
        if (cancelled) return
        setCategoryOptions(Array.isArray(response.categories) ? response.categories : [])
      } catch (_error) {
        if (!cancelled) {
          setCategoryOptions([])
        }
      }
    }

    void hydrateCategoryOptions()
    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  async function handleReferenceCacheRefresh() {
    if (!isLoaded || referenceCacheSyncing) return

    try {
      setReferenceCacheSyncing(true)
      setReferenceCacheError("")
      setReferenceCacheNotice("")

      const token = await waitForSessionToken(getToken)
      const result = await withWhatnotAuthRetry(() => syncWhatnotReferenceCache(token))
      await loadCategoryOptions()

      if (Array.isArray(result.errors) && result.errors.length) {
        setReferenceCacheNotice(`Whatnot cache refreshed with warnings: ${result.errors[0]}`)
      } else {
        setReferenceCacheNotice("Whatnot cache refreshed from the extension.")
      }
    } catch (error) {
      setReferenceCacheError(
        error instanceof Error ? error.message : "Could not refresh the Whatnot reference cache.",
      )
    } finally {
      setReferenceCacheSyncing(false)
    }
  }

  function resetScheduleForm() {
    setScheduleError("")
    setScheduleNotice("")
    setCategorySearchValue("")
    setIsCategoryDropdownOpen(false)
    setPrimaryShowFormatOptions([])
    setIsPrimaryShowFormatLoading(false)
    setExpandedMainCategoryIds(new Set())
    setScheduleForm({
      name: "",
      showDate: "",
      showTime: "",
      repeats: "Does not repeat",
      primaryCategoryId: "",
      selectedCategoryId: "",
      selectedCategoryLabel: "",
      primarySellingFormat: "",
      primarySellingFormatId: "",
      primarySellingFormatName: "",
      primarySellingFormatLabel: "",
      primaryLanguage: "English",
      showDiscovery: "public",
    })
  }

  async function loadPrimaryShowFormatTags(categoryId: string) {
    const normalizedCategoryId = categoryId.trim()
    if (!normalizedCategoryId) {
      setPrimaryShowFormatOptions([])
      setIsPrimaryShowFormatLoading(false)
      setScheduleForm((current) => ({
        ...current,
        primarySellingFormat: "",
        primarySellingFormatId: "",
        primarySellingFormatName: "",
        primarySellingFormatLabel: "",
      }))
      return
    }

    const requestId = primaryShowFormatRequestIdRef.current + 1
    primaryShowFormatRequestIdRef.current = requestId
    setIsPrimaryShowFormatLoading(true)
    setPrimaryShowFormatOptions([])
    setScheduleForm((current) => ({
      ...current,
      primarySellingFormat: "",
      primarySellingFormatId: "",
      primarySellingFormatName: "",
      primarySellingFormatLabel: "",
    }))

    try {
      const token = await waitForSessionToken(getToken)
      const response = await fetchWhatnotPrimaryShowFormatTags(token, normalizedCategoryId)
      if (primaryShowFormatRequestIdRef.current !== requestId) {
        return
      }

      const nextOptions = Array.isArray(response.primaryShowFormatTags) ? response.primaryShowFormatTags : []
      setPrimaryShowFormatOptions(nextOptions)
      if (!nextOptions.length) {
        setScheduleError("No primary selling format options found for this category.")
      }
    } catch (_error) {
      if (primaryShowFormatRequestIdRef.current !== requestId) {
        return
      }
      setPrimaryShowFormatOptions([])
      setScheduleError("Failed to load primary selling formats for this category.")
    } finally {
      if (primaryShowFormatRequestIdRef.current === requestId) {
        setIsPrimaryShowFormatLoading(false)
      }
    }
  }

  function openScheduleModal() {
    resetScheduleForm()
    setOpenScheduleDialog(true)
  }

  function toggleMainCategory(mainCategoryId: string) {
    setExpandedMainCategoryIds((current) => {
      const next = new Set(current)
      if (next.has(mainCategoryId)) {
        next.delete(mainCategoryId)
      } else {
        next.add(mainCategoryId)
      }
      return next
    })
  }

  function handleMainCategorySelect(mainCategory: WhatnotLivestreamMainCategoryItem) {
    const hasRefinements = Array.isArray(mainCategory.refinements) && mainCategory.refinements.length > 0
    setScheduleForm((current) => ({
      ...current,
      primaryCategoryId: mainCategory.id,
      selectedCategoryId: hasRefinements ? "" : mainCategory.id,
      selectedCategoryLabel: mainCategory.label || mainCategory.name || "",
      primarySellingFormat: "",
      primarySellingFormatId: "",
      primarySellingFormatName: "",
      primarySellingFormatLabel: "",
    }))
    setCategorySearchValue(mainCategory.label || mainCategory.name || "")
    if (hasRefinements) {
      setExpandedMainCategoryIds((current) => new Set(current).add(mainCategory.id))
    } else {
      setIsCategoryDropdownOpen(false)
    }
    setScheduleError("")
    void loadPrimaryShowFormatTags(mainCategory.id)
  }

  function handleRefinementCategorySelect(
    mainCategory: WhatnotLivestreamMainCategoryItem,
    refinement: { id: string; label: string | null; name: string | null },
  ) {
    setScheduleForm((current) => ({
      ...current,
      primaryCategoryId: mainCategory.id,
      selectedCategoryId: refinement.id,
      selectedCategoryLabel: refinement.label || refinement.name || "",
      primarySellingFormat: "",
      primarySellingFormatId: "",
      primarySellingFormatName: "",
      primarySellingFormatLabel: "",
    }))
    setCategorySearchValue(refinement.label || refinement.name || "")
    setIsCategoryDropdownOpen(false)
    setScheduleError("")
    void loadPrimaryShowFormatTags(mainCategory.id)
  }

  async function handleScheduleSubmit() {
    if (
      !scheduleForm.name.trim() ||
      !scheduleForm.showDate ||
      !scheduleForm.showTime ||
      !scheduleForm.selectedCategoryId ||
      !scheduleForm.primarySellingFormatId
    ) {
      setScheduleError("Please fill all required fields before scheduling.")
      return
    }
    const schedulePayload = {
      name: scheduleForm.name.trim(),
      showDate: scheduleForm.showDate,
      showTime: scheduleForm.showTime,
      repeats: scheduleForm.repeats,
      primarySellingFormat: scheduleForm.primarySellingFormat,
      primarySellingFormatId: scheduleForm.primarySellingFormatId || null,
      primarySellingFormatName: scheduleForm.primarySellingFormatName || null,
      primarySellingFormatLabel: scheduleForm.primarySellingFormatLabel || null,
      primaryLanguage: scheduleForm.primaryLanguage,
      discovery: scheduleForm.showDiscovery,
      categoryId: scheduleForm.selectedCategoryId,
      mainCategoryId: scheduleForm.primaryCategoryId || null,
    }
    try {
      const token = await waitForSessionToken(getToken)
      await withWhatnotAuthRetry(() => scheduleWhatnotShow(token, schedulePayload))
      setScheduleError("")
      setScheduleNotice(`Schedule details captured successfully (category id: ${scheduleForm.selectedCategoryId}).`)
      setOpenScheduleDialog(false)
    } catch {
      setScheduleError("Failed to submit schedule payload. Please try again.")
    }
  }

  async function handleCancelShow() {
    if (!isLoaded || !cancelTarget?.id || cancelLoading) return

    const liveId = cancelTarget.id.trim()
    const title = cancelTarget.title?.trim() || "this show"

    try {
      setCancelLoading(true)
      setLoadError("")
      setCancelNotice("")

      const token = await waitForSessionToken(getToken)
      const result = await withWhatnotAuthRetry(() => cancelWhatnotShow(token, liveId))

      if (result.success === false) {
        throw new Error(result.message || "Whatnot show cancel failed.")
      }

      setShows((prev) => (prev ?? []).filter((row) => String(row.id ?? "").trim() !== liveId))
      setCancelNotice(`${title} cancelled successfully.`)
      setCancelTarget(null)
    } catch (error) {
      setLoadError(getClerkErrorMessage(error))
    } finally {
      setCancelLoading(false)
    }
  }

  const rows = (shows ?? []).filter(
    (s) => activeFilter === "All" || s.showType === activeFilter,
  )
  const filteredCategoryOptions = categoryOptions
    .map((mainCategory) => {
      const query = categorySearchValue.trim().toLowerCase()
      if (!query) {
        return mainCategory
      }
      const mainLabel = `${mainCategory.label || ""} ${mainCategory.name || ""}`.toLowerCase()
      const refinements = (mainCategory.refinements || []).filter((refinement) =>
        `${refinement.label || ""} ${refinement.name || ""}`.toLowerCase().includes(query),
      )
      if (mainLabel.includes(query) || refinements.length) {
        return {
          ...mainCategory,
          refinements: mainLabel.includes(query) ? mainCategory.refinements : refinements,
        }
      }
      return null
    })
    .filter((item): item is WhatnotLivestreamMainCategoryItem => Boolean(item))

  const statusLabel = loading
    ? "Fetching shows from Whatnot…"
    : shows === null
      ? "Connect the extension to load shows."
      : `${shows.length} show${shows.length !== 1 ? "s" : ""} found.`

  return (
    <div className="space-y-6">
      <PageHeader title="Whatnot Show" description="Launch upcoming Whatnot sessions from one place.">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => void handleReferenceCacheRefresh()}
            disabled={referenceCacheSyncing}
          >
            {referenceCacheSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PackageSearch className="h-4 w-4" />}
            Refetch Whatnot Cache
          </Button>
          <Button className="gap-2" onClick={openScheduleModal}>
            <Radio className="h-4 w-4" />
            Schedule a show
          </Button>
        </div>
      </PageHeader>
      {scheduleNotice ? <p className="text-sm text-emerald-600">{scheduleNotice}</p> : null}
      {cancelNotice ? <p className="text-sm text-emerald-600">{cancelNotice}</p> : null}
      {referenceCacheNotice ? <p className="text-sm text-emerald-600">{referenceCacheNotice}</p> : null}
      {referenceCacheError ? <p className="text-sm text-destructive">{referenceCacheError}</p> : null}
      {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}

      <Card className="overflow-hidden border-border/60 bg-card">
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{statusLabel}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void handleRefetchShows()} disabled={refreshing}>
                {refreshing ? "Refetching..." : "Refetch"}
              </Button>
              <div className="inline-flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={[
                      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                      activeFilter === f
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Show</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      Loading shows…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      {shows === null
                        ? "Open the Whatnot extension and connect to load shows."
                        : "No shows found for this filter."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((show) => {
                    const { date, time } = formatStartTime(show.startTime)
                    return (
                      <TableRow key={show.id ?? show.title}>
                        <TableCell>
                          <p className="font-medium text-foreground">{show.title ?? "Untitled"}</p>
                        </TableCell>
                        <TableCell>
                          <div className="inline-flex flex-col gap-1 text-sm text-foreground">
                            <span>{date}</span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock3 className="h-3.5 w-3.5" />
                              {time}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              show.showType === "Live"
                                ? "border-red-300 bg-red-50 text-red-700"
                                : show.showType === "Upcoming"
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : "border-slate-300 bg-slate-50 text-slate-500"
                            }
                          >
                            {show.showType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {show.link ? (
                            <a
                              href={show.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 hover:underline"
                            >
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                              {show.id ? `whatnot.com/live/${show.id.slice(0, 8)}…` : "open"}
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="ml-auto inline-flex flex-wrap items-center justify-end gap-2 rounded-lg border border-border bg-slate-50 p-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                if (show.link) window.open(show.link, "_blank", "noopener,noreferrer")
                              }}
                              disabled={!show.link}
                            >
                              Open show
                            </Button>
                            {show.showType === "Upcoming" && show.id ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="gap-1"
                                disabled={cancelLoading}
                                onClick={() => {
                                  setCancelNotice("")
                                  setCancelTarget(show)
                                }}
                              >
                                {cancelLoading && cancelTarget?.id === show.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                )}
                                Cancel show
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open && !cancelLoading) {
            setCancelTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel scheduled show?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget
                ? `This will cancel "${cancelTarget.title ?? "Untitled"}" on Whatnot. This action cannot be undone.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLoading}>Keep show</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelLoading}
              onClick={(event) => {
                event.preventDefault()
                void handleCancelShow()
              }}
            >
              {cancelLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Cancelling...
                </>
              ) : (
                "Cancel show"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={openScheduleDialog} onOpenChange={setOpenScheduleDialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Schedule a show</DialogTitle>
            <DialogDescription>Complete the details below to prepare your next Whatnot show.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid gap-2">
              <Label htmlFor="show-name">Name of show *</Label>
              <Input
                id="show-name"
                value={scheduleForm.name}
                onChange={(event) => {
                  setScheduleForm((current) => ({ ...current, name: event.target.value }))
                  setScheduleError("")
                }}
                placeholder="Enter show name"
                className="h-10 w-full"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="show-date">Show date *</Label>
                <Input
                  id="show-date"
                  type="date"
                  value={scheduleForm.showDate}
                  onChange={(event) => {
                    setScheduleForm((current) => ({ ...current, showDate: event.target.value }))
                    setScheduleError("")
                  }}
                  className="h-10 w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="show-time">Show time *</Label>
                <Input
                  id="show-time"
                  type="time"
                  value={scheduleForm.showTime}
                  onChange={(event) => {
                    setScheduleForm((current) => ({ ...current, showTime: event.target.value }))
                    setScheduleError("")
                  }}
                  className="h-10 w-full"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Repeats</Label>
                <Select
                  value={scheduleForm.repeats}
                  onValueChange={(value) => {
                    setScheduleForm((current) => ({ ...current, repeats: value }))
                  }}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Select repeat frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPEAT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Primary language</Label>
                <Select
                  value={scheduleForm.primaryLanguage}
                  onValueChange={(value) => setScheduleForm((current) => ({ ...current, primaryLanguage: value }))}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Primary category *</Label>
              <div className="relative">
                <Input
                  value={categorySearchValue}
                  onChange={(event) => {
                    setCategorySearchValue(event.target.value)
                    setScheduleForm((current) => ({
                      ...current,
                      selectedCategoryId: "",
                      selectedCategoryLabel: "",
                      primaryCategoryId: "",
                      primarySellingFormat: "",
                      primarySellingFormatId: "",
                      primarySellingFormatName: "",
                      primarySellingFormatLabel: "",
                    }))
                    setPrimaryShowFormatOptions([])
                    setIsCategoryDropdownOpen(true)
                    setScheduleError("")
                  }}
                  onFocus={() => setIsCategoryDropdownOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => setIsCategoryDropdownOpen(false), 120)
                  }}
                  placeholder="Type and select primary category"
                  className="h-10 w-full"
                />
                {isCategoryDropdownOpen ? (
                  <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
                    {filteredCategoryOptions.length ? (
                      filteredCategoryOptions.map((mainCategory) => {
                        const hasRefinements = Array.isArray(mainCategory.refinements) && mainCategory.refinements.length > 0
                        const isExpanded = expandedMainCategoryIds.has(mainCategory.id)
                        return (
                          <div key={mainCategory.id} className="rounded-sm">
                            <div className="flex items-center">
                              {hasRefinements ? (
                                <button
                                  type="button"
                                  className="mr-1 rounded-sm p-1 text-muted-foreground hover:bg-accent"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => toggleMainCategory(mainCategory.id)}
                                  aria-label={isExpanded ? "Collapse category" : "Expand category"}
                                >
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                              ) : (
                                <span className="mr-1 inline-block h-6 w-6" />
                              )}
                              <button
                                type="button"
                                className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => handleMainCategorySelect(mainCategory)}
                              >
                                {mainCategory.label || mainCategory.name || mainCategory.id}
                              </button>
                            </div>
                            {hasRefinements && isExpanded ? (
                              <div className="ml-8 space-y-1 pb-1">
                                {mainCategory.refinements.map((refinement) => (
                                  <button
                                    key={refinement.id}
                                    type="button"
                                    className="w-full rounded-sm px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => handleRefinementCategorySelect(mainCategory, refinement)}
                                  >
                                    {refinement.label || refinement.name || refinement.id}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )
                      })
                    ) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No category found.</p>
                    )}
                  </div>
                ) : null}
              </div>
              {scheduleForm.selectedCategoryId ? (
                <p className="text-xs text-muted-foreground">
                  Selected category id: {scheduleForm.selectedCategoryId}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Primary selling format *</Label>
              <Select
                value={scheduleForm.primarySellingFormatId}
                onValueChange={(value) => {
                  const selectedOption = primaryShowFormatOptions.find((option) => option.id === value)
                  setScheduleForm((current) => ({
                    ...current,
                    primarySellingFormatId: selectedOption?.id || "",
                    primarySellingFormatName: selectedOption?.name || "",
                    primarySellingFormatLabel: selectedOption?.label || "",
                    primarySellingFormat: selectedOption?.label || "",
                  }))
                  setScheduleError("")
                }}
              >
                <SelectTrigger className="h-10 w-full" disabled={!scheduleForm.primaryCategoryId || isPrimaryShowFormatLoading}>
                  <SelectValue placeholder="Select primary selling format" />
                </SelectTrigger>
                <SelectContent>
                  {primaryShowFormatOptions
                    .filter((option) => typeof option.id === "string" && option.id.trim().length > 0)
                    .map((option) => (
                    <SelectItem key={option.id || option.name || option.label || "unknown"} value={option.id || ""}>
                      <div className="space-y-0.5">
                        <p className="text-sm">{option.label || option.name || option.id || "Unknown format"}</p>
                        {option.description ? (
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        ) : null}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!scheduleForm.primaryCategoryId ? (
                <p className="text-xs text-muted-foreground">Select a primary category first.</p>
              ) : null}
              {isPrimaryShowFormatLoading ? (
                <p className="text-xs text-muted-foreground">Loading selling formats...</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Show discovery</Label>
              <div className="grid w-full gap-2 rounded-xl border border-border/60 bg-muted/20 p-2 sm:grid-cols-2">
                <button
                  type="button"
                  className={[
                    "flex w-full items-start justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                    scheduleForm.showDiscovery === "public"
                      ? "border-emerald-300 bg-emerald-50/80"
                      : "border-border bg-background hover:bg-accent/40",
                  ].join(" ")}
                  onClick={() => setScheduleForm((current) => ({ ...current, showDiscovery: "public" }))}
                >
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">Public</span>
                    <span className="block text-xs text-muted-foreground">
                      Visible to all users in Whatnot discovery.
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={[
                      "mt-0.5 inline-block h-4 w-4 rounded-full border",
                      scheduleForm.showDiscovery === "public"
                        ? "border-emerald-600 bg-emerald-600"
                        : "border-muted-foreground/40 bg-transparent",
                    ].join(" ")}
                  />
                </button>
                <button
                  type="button"
                  className={[
                    "flex w-full items-start justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                    scheduleForm.showDiscovery === "private"
                      ? "border-slate-400 bg-slate-100/80"
                      : "border-border bg-background hover:bg-accent/40",
                  ].join(" ")}
                  onClick={() => setScheduleForm((current) => ({ ...current, showDiscovery: "private" }))}
                >
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">Private</span>
                    <span className="block text-xs text-muted-foreground">
                      Hidden from public discovery feed.
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={[
                      "mt-0.5 inline-block h-4 w-4 rounded-full border",
                      scheduleForm.showDiscovery === "private"
                        ? "border-slate-700 bg-slate-700"
                        : "border-muted-foreground/40 bg-transparent",
                    ].join(" ")}
                  />
                </button>
              </div>
            </div>

            {scheduleError ? <p className="text-sm text-destructive">{scheduleError}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpenScheduleDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleScheduleSubmit()}>
              Schedule show
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
