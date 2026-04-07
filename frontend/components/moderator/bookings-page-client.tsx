"use client"

import { useMemo, useState } from "react"
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  List,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import { useToast } from "@/hooks/use-toast"

type BookingStatus = "new-request" | "pending" | "confirmed" | "completed" | "declined"

type BookingItem = {
  id: string
  streamerName: string
  streamerAvatar: string
  orderCode: string
  platform: string
  title: string
  date: string // YYYY-MM-DD
  startTime: string
  endTime: string
  requestedAt: string
  status: BookingStatus
  payoutLabel: string
  notes: string
}

const staticBookings: BookingItem[] = [
  {
    id: "bk-001",
    streamerName: "TechStyle Live",
    streamerAvatar: "",
    orderCode: "ORD-8421",
    platform: "TikTok Shop",
    title: "Flash Gadgets Evening Sale",
    date: "2026-04-08",
    startTime: "18:00",
    endTime: "21:00",
    requestedAt: "2026-04-06T07:20:00Z",
    status: "new-request",
    payoutLabel: "$90",
    notes: "Need quick chat moderation and product pin updates.",
  },
  {
    id: "bk-002",
    streamerName: "Fashion Forward",
    streamerAvatar: "",
    orderCode: "ORD-8422",
    platform: "Whatnot",
    title: "Spring Closet Auction",
    date: "2026-04-09",
    startTime: "14:00",
    endTime: "17:00",
    requestedAt: "2026-04-05T15:10:00Z",
    status: "pending",
    payoutLabel: "$105",
    notes: "Audience is mostly US-East; keep moderation strict.",
  },
  {
    id: "bk-003",
    streamerName: "Beauty Boss",
    streamerAvatar: "",
    orderCode: "ORD-8423",
    platform: "TikTok Shop",
    title: "Skincare Product Launch",
    date: "2026-04-10",
    startTime: "11:00",
    endTime: "13:00",
    requestedAt: "2026-04-03T11:45:00Z",
    status: "confirmed",
    payoutLabel: "$60",
    notes: "Use pre-approved FAQ snippets for repetitive questions.",
  },
  
]

const statusLabel: Record<BookingStatus, string> = {
  "new-request": "New Request",
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  declined: "Declined",
}

function statusVariant(status: BookingStatus): "info" | "warning" | "success" | "danger" {
  if (status === "new-request") return "info"
  if (status === "pending") return "warning"
  if (status === "confirmed") return "success"
  if (status === "declined") return "danger"
  return "success"
}

function statusRingClass(status: BookingStatus) {
  if (status === "new-request") return "ring-blue-500/35"
  if (status === "pending") return "ring-amber-500/35"
  if (status === "confirmed") return "ring-emerald-500/35"
  if (status === "declined") return "ring-rose-500/35"
  return "ring-border"
}

function formatTimeRange(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number)
  const [endHour, endMinute] = endTime.split(":").map(Number)

  const startDate = new Date(Date.UTC(2026, 0, 1, startHour, startMinute))
  const endDate = new Date(Date.UTC(2026, 0, 1, endHour, endMinute))

  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  })

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`
}

function formatDateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`)
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function normalizeDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function amountFromLabel(label: string) {
  const numeric = Number(label.replace(/[^0-9.]/g, ""))
  return Number.isFinite(numeric) ? numeric : 0
}

export default function ModeratorBookingsPage() {
  const { toast } = useToast()

  const [viewMode, setViewMode] = useState<"list" | "calendar">("list")
  const [statusFilter, setStatusFilter] = useState<"all" | BookingStatus>("all")
  const [searchText, setSearchText] = useState("")
  const [bookings, setBookings] = useState<BookingItem[]>(staticBookings)
  const [responseDraft, setResponseDraft] = useState<Record<string, string>>({})
  const [selectedDateKey, setSelectedDateKey] = useState("2026-04-08")

  const filteredBookings = useMemo(() => {
    const needle = searchText.trim().toLowerCase()

    return bookings
      .filter((booking) => (statusFilter === "all" ? true : booking.status === statusFilter))
      .filter((booking) => {
        if (!needle) return true
        return [booking.streamerName, booking.orderCode, booking.platform, booking.title]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      })
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
  }, [bookings, searchText, statusFilter])

  const counts = useMemo(() => {
    const upcoming = bookings.filter((item) => ["new-request", "pending", "confirmed"].includes(item.status)).length
    const newRequests = bookings.filter((item) => item.status === "new-request").length
    const pending = bookings.filter((item) => item.status === "pending").length
    const confirmed = bookings.filter((item) => item.status === "confirmed").length
    const revenue = bookings
      .filter((item) => item.status !== "declined")
      .reduce((sum, item) => sum + amountFromLabel(item.payoutLabel), 0)

    return { upcoming, newRequests, pending, confirmed, revenue }
  }, [bookings])

  const calendarMeta = useMemo(() => {
    const baseDate = new Date("2026-04-01T00:00:00Z")
    const year = baseDate.getUTCFullYear()
    const month = baseDate.getUTCMonth()

    const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay()
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

    const leadingBlanks = Array.from({ length: firstWeekday }, () => null)
    const monthDays = Array.from({ length: daysInMonth }, (_, idx) => idx + 1)

    return {
      label: baseDate.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      cells: [...leadingBlanks, ...monthDays],
      year,
      month,
    }
  }, [])

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, BookingItem[]>()

    for (const booking of filteredBookings) {
      const key = booking.date
      const existing = map.get(key) || []
      existing.push(booking)
      map.set(key, existing)
    }

    return map
  }, [filteredBookings])

  const selectedDateBookings = useMemo(() => {
    return bookingsByDay.get(selectedDateKey) || []
  }, [bookingsByDay, selectedDateKey])

  function setBookingStatus(id: string, nextStatus: BookingStatus) {
    setBookings((previous) => previous.map((booking) => (booking.id === id ? { ...booking, status: nextStatus } : booking)))
  }

  function acceptRequest(booking: BookingItem) {
    setBookingStatus(booking.id, "confirmed")
    toast({
      title: "Booking accepted",
      description: `${booking.streamerName} request moved to confirmed.`,
    })
  }

  function declineRequest(booking: BookingItem) {
    setBookingStatus(booking.id, "declined")
    toast({
      title: "Booking declined",
      description: `${booking.streamerName} request was declined.`,
      variant: "destructive",
    })
  }

  function markCompleted(booking: BookingItem) {
    setBookingStatus(booking.id, "completed")
    toast({
      title: "Booking completed",
      description: `${booking.orderCode} marked as completed.`,
    })
  }

  function sendResponse(booking: BookingItem) {
    const message = (responseDraft[booking.id] || "").trim()

    if (!message) {
      toast({
        title: "Message required",
        description: "Write a response before sending.",
        variant: "destructive",
      })
      return
    }

    setResponseDraft((previous) => ({ ...previous, [booking.id]: "" }))

    toast({
      title: "Response sent",
      description: `Your reply to ${booking.streamerName} has been sent (static demo).`,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        // description="Incoming requests, upcoming sessions, and schedule operations in one command center."
      />

      {/* <Card className="relative overflow-hidden border-border/50 bg-card/70 backdrop-blur-sm">
        <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -bottom-16 h-56 w-56 rounded-full bg-orange-500/15 blur-3xl" />
        <CardContent className="relative grid gap-5 p-6 lg:grid-cols-[1.1fr_auto] lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Marketplace Operations
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Run your bookings like a pro desk</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Review new requests quickly, move bookings across statuses, and keep your upcoming calendar clean.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-1">
            <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-3">
              <div className="text-xs text-muted-foreground">Total Pipeline Value</div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                <Wallet className="h-4 w-4 text-primary" />
                ${counts.revenue.toFixed(0)}
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-3">
              <div className="text-xs text-muted-foreground">Conversion Ready</div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                {counts.newRequests + counts.pending} open
              </div>
            </div>
          </div>
        </CardContent>
      </Card> */}

      {/* <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/50 bg-card/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Upcoming Orders</p>
            <p className="mt-2 text-3xl font-semibold">{counts.upcoming}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/25 bg-blue-500/5">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-blue-400">New Requests</p>
            <p className="mt-2 text-3xl font-semibold text-blue-300">{counts.newRequests}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/25 bg-emerald-500/5">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-400">Confirmed</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-300">{counts.confirmed}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Current View</p>
            <p className="mt-2 text-3xl font-semibold">{viewMode === "list" ? "List" : "Calendar"}</p>
          </CardContent>
        </Card>
      </div> */}

      <Card className="border-border/50 bg-card/70">
        <CardHeader className="gap-4 border-b border-border/50 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Booking Queue
            </CardTitle>
            {/* <CardDescription>
              Static module for now. API integration will be connected after streamer booking flow.
            </CardDescription> */}
          </div>
          <div className="inline-flex rounded-xl border border-border/60 bg-muted/40 p-1">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="gap-1.5"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              className="gap-1.5"
              onClick={() => setViewMode("calendar")}
            >
              <CalendarDays className="h-4 w-4" />
              Calendar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search streamer, order code, platform, title"
              className="h-11"
            />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | BookingStatus)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="new-request">New Request</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {viewMode === "list" ? (
            <div className="space-y-4">
              {filteredBookings.map((booking) => (
                <Card
                  key={booking.id}
                  className={`border-border/60 bg-background/40 ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-background/70 ${statusRingClass(booking.status)}`}
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-12 w-12 ring-2 ring-border">
                            <AvatarImage src={booking.streamerAvatar} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {booking.streamerName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-semibold">{booking.streamerName}</h3>
                              <StatusBadge variant={statusVariant(booking.status)}>{statusLabel[booking.status]}</StatusBadge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{booking.title}</p>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                              <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1">{booking.orderCode}</span>
                              <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1">{booking.platform}</span>
                              <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1">{formatDateLabel(booking.date)}</span>
                              <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1">{formatTimeRange(booking.startTime, booking.endTime)}</span>
                            </div>

                            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{booking.notes}</p>
                          </div>
                        </div>
                      </div>

                      <div className="w-full space-y-2 xl:w-[280px]">
                        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Payout</span>
                            <span className="font-semibold text-primary">{booking.payoutLabel}</span>
                          </div>
                        </div>

                        {(booking.status === "new-request" || booking.status === "pending") && (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => declineRequest(booking)}>
                              <XCircle className="h-4 w-4" />
                              Decline
                            </Button>
                            <Button size="sm" className="flex-1 gap-1.5" onClick={() => acceptRequest(booking)}>
                              <CheckCircle2 className="h-4 w-4" />
                              Accept
                            </Button>
                          </div>
                        )}

                        {booking.status === "confirmed" && (
                          <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => markCompleted(booking)}>
                            <Clock3 className="h-4 w-4" />
                            Mark Completed
                          </Button>
                        )}

                        {/* {(booking.status === "new-request" || booking.status === "pending") && (
                          <div className="space-y-2">
                            <Input
                              value={responseDraft[booking.id] || ""}
                              onChange={(event) =>
                                setResponseDraft((previous) => ({
                                  ...previous,
                                  [booking.id]: event.target.value,
                                }))
                              }
                              placeholder="Write a quick response to streamer"
                            />
                            <Button size="sm" variant="secondary" className="w-full gap-1.5" onClick={() => sendResponse(booking)}>
                              <MessageSquare className="h-4 w-4" />
                              Send Response
                            </Button>
                          </div>
                        )} */}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredBookings.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                  No bookings found for selected filters.
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">{calendarMeta.label}</h3>
                  <div className="text-xs text-muted-foreground">Click a day to inspect details</div>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
                  <div>Sun</div>
                  <div>Mon</div>
                  <div>Tue</div>
                  <div>Wed</div>
                  <div>Thu</div>
                  <div>Fri</div>
                  <div>Sat</div>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarMeta.cells.map((day, index) => {
                    if (day === null) {
                      return <div key={`empty-${index}`} className="min-h-[122px] rounded-xl border border-dashed border-border/40" />
                    }

                    const dayDate = new Date(Date.UTC(calendarMeta.year, calendarMeta.month, day))
                    const key = normalizeDateKey(dayDate)
                    const dayBookings = bookingsByDay.get(key) || []
                    const isSelected = selectedDateKey === key

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedDateKey(key)}
                        className={`min-h-[122px] rounded-xl border p-2 text-left transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(99,102,241,0.35)]"
                            : "border-border/60 bg-background/30 hover:border-primary/35 hover:bg-background/60"
                        }`}
                      >
                        <div className="mb-2 text-xs font-semibold">{day}</div>
                        <div className="space-y-1">
                          {dayBookings.slice(0, 2).map((booking) => (
                            <div key={booking.id} className="rounded-md bg-muted/70 px-1.5 py-1 text-[11px]">
                              <div className="truncate font-medium">{booking.streamerName}</div>
                              <div className="truncate text-muted-foreground">{booking.startTime}</div>
                            </div>
                          ))}
                          {dayBookings.length > 2 && <div className="text-[11px] text-muted-foreground">+{dayBookings.length - 2} more</div>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <Card className="border-border/60 bg-background/40">
                <CardHeader>
                  <CardTitle className="text-base">Agenda for {formatDateLabel(selectedDateKey)}</CardTitle>
                  <CardDescription>
                    {selectedDateBookings.length} booking{selectedDateBookings.length === 1 ? "" : "s"} on selected day
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedDateBookings.map((booking) => (
                    <div key={booking.id} className="rounded-lg border border-border/60 bg-muted/25 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{booking.streamerName}</span>
                        <StatusBadge variant={statusVariant(booking.status)}>{statusLabel[booking.status]}</StatusBadge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{booking.title}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{formatTimeRange(booking.startTime, booking.endTime)}</p>
                    </div>
                  ))}

                  {selectedDateBookings.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No bookings on this date.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
