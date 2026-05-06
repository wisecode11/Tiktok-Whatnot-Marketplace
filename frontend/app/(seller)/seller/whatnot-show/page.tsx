"use client"

import { useAuth } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import { Clock3, ExternalLink, Radio } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  waitForSessionToken,
  type WhatnotLiveShowItem,
} from "@/lib/auth"

type FilterType = "All" | "Live" | "Upcoming" | "Past"

const FILTERS: FilterType[] = ["All", "Live", "Upcoming", "Past"]

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

  const rows = (shows ?? []).filter(
    (s) => activeFilter === "All" || s.showType === activeFilter,
  )

  const statusLabel = loading
    ? "Fetching shows from Whatnot…"
    : shows === null
      ? "Connect the extension to load shows."
      : `${shows.length} show${shows.length !== 1 ? "s" : ""} found.`

  return (
    <div className="space-y-6">
      <PageHeader title="Whatnot Show" description="Launch upcoming Whatnot sessions from one place.">
        <Button className="gap-2">
          <Radio className="h-4 w-4" />
          Schedule a show
        </Button>
      </PageHeader>

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
    </div>
  )
}
