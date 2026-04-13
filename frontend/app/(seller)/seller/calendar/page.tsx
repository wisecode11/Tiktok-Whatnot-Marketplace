"use client"

import { useAuth } from "@clerk/nextjs"
import { Loader2, RefreshCw, CalendarDays, CalendarRange, ListFilter } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { listHiredModerators, type HiredModeratorBooking } from "@/lib/booking-payment"
import { getConnectedAccounts, waitForSessionToken, type ConnectedAccountResponse } from "@/lib/auth"

type CalendarView = "calendar" | "list"
type CalendarScale = "month" | "week"
type PlatformFilter = "all" | "tiktok" | "whatnot"
type StatusFilter = "all" | "upcoming" | "live" | "completed"
type SupportedPlatform = "tiktok" | "whatnot"

type CalendarEventStatus = "upcoming" | "live" | "completed"

interface CalendarEvent {
  id: string
  bookingId: string
  streamTitle: string
  platform: SupportedPlatform
  startAt: Date
  endAt: Date
  status: CalendarEventStatus
}

function toDateKey(value: Date) {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, "0")
  const day = `${value.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDays(value: Date, days: number) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days)
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  )
}

function startOfWeek(value: Date) {
  const copy = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const day = copy.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return addDays(copy, mondayOffset)
}

function endOfWeek(value: Date) {
  return addDays(startOfWeek(value), 6)
}

function getEventStatus(startAt: Date, endAt: Date): CalendarEventStatus {
  const now = Date.now()

  if (now < startAt.getTime()) {
    return "upcoming"
  }

  if (now <= endAt.getTime()) {
    return "live"
  }

  return "completed"
}

function getConnectedPlatforms(accounts: ConnectedAccountResponse["accounts"]): SupportedPlatform[] {
  const connected = accounts
    .filter((account) => account.connected)
    .map((account) => account.platform)
    .filter((platform): platform is SupportedPlatform => platform === "tiktok" || platform === "whatnot")

  if (connected.length > 0) {
    return connected
  }

  return ["tiktok"]
}

function normalizeEvents(
  bookings: HiredModeratorBooking[],
  connectedPlatforms: SupportedPlatform[],
): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (const booking of bookings) {
    if (!booking.scheduledStartAt || !booking.scheduledEndAt) {
      continue
    }

    const startAt = new Date(booking.scheduledStartAt)
    const endAt = new Date(booking.scheduledEndAt)

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      continue
    }

    for (const platform of connectedPlatforms) {
      events.push({
        id: `${booking.bookingId}:${platform}`,
        bookingId: booking.bookingId,
        streamTitle: `${booking.moderatorName || "Moderator"} stream session`,
        platform,
        startAt,
        endAt,
        status: getEventStatus(startAt, endAt),
      })
    }
  }

  return events.sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
}

function formatTimeRange(startAt: Date, endAt: Date) {
  const start = startAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const end = endAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return `${start} - ${end}`
}

function formatPlatformLabel(platform: SupportedPlatform) {
  if (platform === "tiktok") {
    return "TikTok"
  }

  return "Whatnot"
}

function getStatusBadgeVariant(status: CalendarEventStatus): "default" | "secondary" | "outline" {
  if (status === "live") {
    return "default"
  }

  if (status === "upcoming") {
    return "secondary"
  }

  return "outline"
}

function getPlatformBadgeClassName(platform: SupportedPlatform) {
  if (platform === "tiktok") {
    return "border-pink-300 bg-pink-50 text-pink-700"
  }

  return "border-cyan-300 bg-cyan-50 text-cyan-700"
}

export default function SellerCalendarPage() {
  const { getToken, isLoaded } = useAuth()

  const [view, setView] = useState<CalendarView>("calendar")
  const [scale, setScale] = useState<CalendarScale>("month")
  const [focusDate, setFocusDate] = useState<Date>(new Date())
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [startDateFilter, setStartDateFilter] = useState("")
  const [endDateFilter, setEndDateFilter] = useState("")

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccountResponse["accounts"]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const loadCalendarData = useCallback(async (isManualRefresh: boolean) => {
    if (!isLoaded) {
      return
    }

    if (isManualRefresh) {
      setIsRefreshing(true)
    }

    setErrorMessage(null)

    try {
      const token = await waitForSessionToken(getToken)
      const [accountsResult, bookingsResult] = await Promise.all([
        getConnectedAccounts(token),
        listHiredModerators(token),
      ])

      const activePlatforms = getConnectedPlatforms(accountsResult.accounts)
      const normalized = normalizeEvents(bookingsResult.bookings || [], activePlatforms)

      setConnectedAccounts(accountsResult.accounts)
      setEvents(normalized)
      setLastUpdatedAt(new Date())
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load calendar events.")
      setEvents([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [getToken, isLoaded])

  useEffect(() => {
    void loadCalendarData(false)
  }, [loadCalendarData])

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    const interval = window.setInterval(() => {
      void loadCalendarData(false)
    }, 20000)

    return () => {
      window.clearInterval(interval)
    }
  }, [isLoaded, loadCalendarData])

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (platformFilter !== "all" && event.platform !== platformFilter) {
        return false
      }

      if (statusFilter !== "all" && event.status !== statusFilter) {
        return false
      }

      if (startDateFilter) {
        const startBoundary = new Date(`${startDateFilter}T00:00:00`)
        if (event.startAt < startBoundary) {
          return false
        }
      }

      if (endDateFilter) {
        const endBoundary = new Date(`${endDateFilter}T23:59:59`)
        if (event.startAt > endBoundary) {
          return false
        }
      }

      return true
    })
  }, [endDateFilter, events, platformFilter, startDateFilter, statusFilter])

  const monthStart = useMemo(() => new Date(focusDate.getFullYear(), focusDate.getMonth(), 1), [focusDate])
  const monthEnd = useMemo(() => new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0), [focusDate])
  const monthGridStart = useMemo(() => startOfWeek(monthStart), [monthStart])
  const monthGridEnd = useMemo(() => endOfWeek(monthEnd), [monthEnd])

  const monthDays = useMemo(() => {
    const dates: Date[] = []
    let pointer = monthGridStart

    while (pointer.getTime() <= monthGridEnd.getTime()) {
      dates.push(pointer)
      pointer = addDays(pointer, 1)
    }

    return dates
  }, [monthGridEnd, monthGridStart])

  const weeklyDays = useMemo(() => {
    const start = startOfWeek(focusDate)
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }, [focusDate])

  const eventsByDateKey = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()

    for (const event of filteredEvents) {
      const key = toDateKey(event.startAt)
      const items = map.get(key) || []
      items.push(event)
      map.set(key, items)
    }

    for (const [, dateEvents] of map) {
      dateEvents.sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    }

    return map
  }, [filteredEvents])

  const activeConnections = connectedAccounts.filter((account) => account.connected)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="View and schedule your stream bookings across TikTok and Whatnot in calendar or list mode."
      />

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={view === "calendar" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("calendar")}
                className="gap-1.5"
              >
                <CalendarDays className="h-4 w-4" />
                Calendar View
              </Button>
              <Button
                variant={view === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("list")}
                className="gap-1.5"
              >
                <ListFilter className="h-4 w-4" />
                List View
              </Button>

              {view === "calendar" ? (
                <>
                  <Button
                    variant={scale === "month" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setScale("month")}
                    className="gap-1.5"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Monthly
                  </Button>
                  <Button
                    variant={scale === "week" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setScale("week")}
                    className="gap-1.5"
                  >
                    <CalendarRange className="h-4 w-4" />
                    Weekly
                  </Button>
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                Last update: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : "Waiting for first sync"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadCalendarData(true)}
                disabled={isRefreshing || isLoading}
                className="gap-1.5"
              >
                {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <Select value={platformFilter} onValueChange={(value) => setPlatformFilter(value as PlatformFilter)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="whatnot">Whatnot</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Input type="date" value={startDateFilter} onChange={(event) => setStartDateFilter(event.target.value)} />
            <Input type="date" value={endDateFilter} onChange={(event) => setEndDateFilter(event.target.value)} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">Connected platforms: {activeConnections.length}</Badge>
            {activeConnections.map((account) => (
              <Badge
                key={account.id}
                variant="outline"
                className={getPlatformBadgeClassName(account.platform === "whatnot" ? "whatnot" : "tiktok")}
              >
                {formatPlatformLabel(account.platform === "whatnot" ? "whatnot" : "tiktok")}
              </Badge>
            ))}
            <Badge variant="outline">Events: {filteredEvents.length}</Badge>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : null}

          {!isLoading && errorMessage ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          {!isLoading && !errorMessage && filteredEvents.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No scheduled events found with the current filters.
            </div>
          ) : null}

          {!isLoading && !errorMessage && filteredEvents.length > 0 && view === "calendar" && scale === "month" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setFocusDate(new Date(focusDate.getFullYear(), focusDate.getMonth() - 1, 1))}>
                  Previous
                </Button>
                <h2 className="text-lg font-semibold">{focusDate.toLocaleDateString([], { month: "long", year: "numeric" })}</h2>
                <Button variant="outline" size="sm" onClick={() => setFocusDate(new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 1))}>
                  Next
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-xs font-medium text-muted-foreground">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div key={day} className="px-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                {monthDays.map((day) => {
                  const dayEvents = eventsByDateKey.get(toDateKey(day)) || []
                  const isCurrentMonth = day.getMonth() === focusDate.getMonth()

                  return (
                    <div
                      key={toDateKey(day)}
                      className="min-h-[120px] rounded-lg border bg-card p-2"
                    >
                      <p className={`mb-2 text-xs ${isCurrentMonth ? "text-foreground" : "text-muted-foreground"}`}>
                        {day.getDate()}
                      </p>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div key={event.id} className="rounded border border-border/70 bg-muted/20 p-1.5 text-[11px]">
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate font-medium">{event.streamTitle}</span>
                              <Badge variant={getStatusBadgeVariant(event.status)} className="h-5 px-1.5 text-[10px] uppercase">
                                {event.status}
                              </Badge>
                            </div>
                            <p className="truncate text-muted-foreground">{formatPlatformLabel(event.platform)} • {formatTimeRange(event.startAt, event.endAt)}</p>
                          </div>
                        ))}
                        {dayEvents.length > 3 ? <p className="text-[11px] text-muted-foreground">+{dayEvents.length - 3} more</p> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {!isLoading && !errorMessage && filteredEvents.length > 0 && view === "calendar" && scale === "week" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setFocusDate(addDays(focusDate, -7))}>
                  Previous Week
                </Button>
                <h2 className="text-lg font-semibold">
                  {weeklyDays[0]?.toLocaleDateString([], { month: "short", day: "numeric" })} - {weeklyDays[6]?.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                </h2>
                <Button variant="outline" size="sm" onClick={() => setFocusDate(addDays(focusDate, 7))}>
                  Next Week
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-7">
                {weeklyDays.map((day) => {
                  const dayEvents = eventsByDateKey.get(toDateKey(day)) || []

                  return (
                    <div key={toDateKey(day)} className="rounded-lg border bg-card p-2">
                      <p className={`mb-2 text-sm font-medium ${isSameDay(day, new Date()) ? "text-primary" : "text-foreground"}`}>
                        {day.toLocaleDateString([], { weekday: "short", day: "numeric" })}
                      </p>

                      <div className="space-y-2">
                        {dayEvents.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No events</p>
                        ) : (
                          dayEvents.map((event) => (
                            <div key={event.id} className="rounded border border-border/70 bg-muted/20 p-2 text-xs">
                              <p className="font-medium">{event.streamTitle}</p>
                              <p className="text-muted-foreground">{formatPlatformLabel(event.platform)}</p>
                              <p className="text-muted-foreground">{formatTimeRange(event.startAt, event.endAt)}</p>
                              <Badge variant={getStatusBadgeVariant(event.status)} className="mt-1 uppercase">
                                {event.status}
                              </Badge>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {!isLoading && !errorMessage && filteredEvents.length > 0 && view === "list" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stream title</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.streamTitle}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getPlatformBadgeClassName(event.platform)}>
                        {formatPlatformLabel(event.platform)}
                      </Badge>
                    </TableCell>
                    <TableCell>{event.startAt.toLocaleDateString()}</TableCell>
                    <TableCell>{formatTimeRange(event.startAt, event.endAt)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(event.status)} className="uppercase">
                        {event.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
