"use client"

import { useAuth } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import { Clock3, ExternalLink, Radio } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
  getWhatnotInventoryCreateFormOptions,
  waitForSessionToken,
  type WhatnotLiveShowItem,
} from "@/lib/auth"

type FilterType = "All" | "Live" | "Upcoming" | "Past"

const FILTERS: FilterType[] = ["All", "Live", "Upcoming", "Past"]
const REPEAT_OPTIONS = ["Does not repeat", "Daily", "Weekly", "Monthly"] as const
const LANGUAGE_OPTIONS = ["English", "Netherlands", "Francais", "Deutsch", "Chienese"] as const

interface ShowCategoryOption {
  id: string
  label: string
  categoryId: string | null
}

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
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterType>("All")
  const [openScheduleDialog, setOpenScheduleDialog] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState<ShowCategoryOption[]>([])
  const [categorySearchValue, setCategorySearchValue] = useState("")
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const [scheduleError, setScheduleError] = useState("")
  const [scheduleNotice, setScheduleNotice] = useState("")
  const [scheduleForm, setScheduleForm] = useState({
    name: "",
    showDate: "",
    showTime: "",
    repeats: "Does not repeat",
    primaryCategoryId: "",
    subcategoryId: "",
    moderator: "",
    primaryLanguage: "English",
    showDiscovery: "public" as "public" | "private",
  })

  useEffect(() => {
    let cancelled = false

    async function loadShows() {
      if (!isLoaded) return
      setLoading(true)
      try {
        const token = await waitForSessionToken(getToken)
        if (cancelled) return
        const data = await fetchWhatnotShowTabData(token, 0)
        if (!cancelled) setShows(data.shows ?? [])
      } catch (_e) {
        // shows stays null → empty state shown
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadShows()
    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  useEffect(() => {
    let cancelled = false

    async function loadCategoryOptions() {
      if (!isLoaded) return
      try {
        const token = await waitForSessionToken(getToken)
        const response = await getWhatnotInventoryCreateFormOptions(token)
        if (cancelled) return
        const normalized = Array.isArray(response.subcategories)
          ? response.subcategories
              .filter((item) => item.id && item.label)
              .map((item) => ({
                id: item.id,
                label: item.label,
                categoryId: item.categoryId || null,
              }))
          : []
        setCategoryOptions(normalized)
      } catch (_error) {
        if (!cancelled) {
          setCategoryOptions([])
        }
      }
    }

    void loadCategoryOptions()
    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  function resetScheduleForm() {
    setScheduleError("")
    setScheduleNotice("")
    setCategorySearchValue("")
    setIsCategoryDropdownOpen(false)
    setScheduleForm({
      name: "",
      showDate: "",
      showTime: "",
      repeats: "Does not repeat",
      primaryCategoryId: "",
      subcategoryId: "",
      moderator: "",
      primaryLanguage: "English",
      showDiscovery: "public",
    })
  }

  function openScheduleModal() {
    resetScheduleForm()
    setOpenScheduleDialog(true)
  }

  function handleCategorySelect(subcategoryId: string) {
    const option = categoryOptions.find((item) => item.id === subcategoryId)
    setScheduleForm((current) => ({
      ...current,
      subcategoryId,
      primaryCategoryId: option?.categoryId || "",
    }))
    if (option) {
      setCategorySearchValue(option.label)
    }
    setIsCategoryDropdownOpen(false)
    setScheduleError("")
  }

  function handleScheduleSubmit() {
    if (
      !scheduleForm.name.trim() ||
      !scheduleForm.showDate ||
      !scheduleForm.showTime ||
      !scheduleForm.subcategoryId ||
      !scheduleForm.moderator.trim()
    ) {
      setScheduleError("Please fill all required fields before scheduling.")
      return
    }
    setScheduleError("")
    setScheduleNotice("Schedule details captured successfully.")
    setOpenScheduleDialog(false)
  }

  const rows = (shows ?? []).filter(
    (s) => activeFilter === "All" || s.showType === activeFilter,
  )
  const filteredCategoryOptions = categoryOptions.filter((option) =>
    option.label.toLowerCase().includes(categorySearchValue.trim().toLowerCase()),
  )

  const statusLabel = loading
    ? "Fetching shows from Whatnot…"
    : shows === null
      ? "Connect the extension to load shows."
      : `${shows.length} show${shows.length !== 1 ? "s" : ""} found.`

  return (
    <div className="space-y-6">
      <PageHeader title="Whatnot Show" description="Launch upcoming Whatnot sessions from one place.">
        <Button className="gap-2" onClick={openScheduleModal}>
          <Radio className="h-4 w-4" />
          Schedule a show
        </Button>
      </PageHeader>
      {scheduleNotice ? <p className="text-sm text-emerald-600">{scheduleNotice}</p> : null}

      <Card className="overflow-hidden border-border/60 bg-card">
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{statusLabel}</p>
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
                          <div className="ml-auto inline-flex rounded-lg border border-border bg-slate-50 p-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                if (show.link) window.open(show.link, "_blank", "noopener,noreferrer")
                              }}
                              disabled={!show.link}
                            >
                              Open show
                            </Button>
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
                      subcategoryId: "",
                      primaryCategoryId: "",
                    }))
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
                      filteredCategoryOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            handleCategorySelect(option.id)
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
              {scheduleForm.primaryCategoryId ? (
                <p className="text-xs text-muted-foreground">
                  Selected category id: {scheduleForm.primaryCategoryId}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="show-moderator">Moderator *</Label>
              <Input
                id="show-moderator"
                value={scheduleForm.moderator}
                onChange={(event) => {
                  setScheduleForm((current) => ({ ...current, moderator: event.target.value }))
                  setScheduleError("")
                }}
                placeholder="Enter moderator name"
                className="h-10 w-full"
              />
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
            <Button type="button" onClick={handleScheduleSubmit}>
              Schedule show
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
