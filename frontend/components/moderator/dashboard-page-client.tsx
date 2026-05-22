"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useAuthenticatedUser } from "@/components/auth/authenticated-user-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  listModeratorBookings,
  type ModeratorBookingItem,
} from "@/lib/booking-payment"
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DollarSign,
  BadgeCheck,
  Loader2,
} from "lucide-react"

function isSameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function isScheduledToday(booking: ModeratorBookingItem, now = new Date()): boolean {
  if (!booking.scheduledStartAt) return false
  return isSameCalendarDay(new Date(booking.scheduledStartAt), now)
}

function isPendingRequest(booking: ModeratorBookingItem): boolean {
  return String(booking.bookingStatus || "").toLowerCase() === "requested"
}

function isActiveTodaySession(booking: ModeratorBookingItem): boolean {
  const status = String(booking.bookingStatus || "").toLowerCase()
  return !["cancelled", "refunded", "disputed", "completed"].includes(status)
}

function scheduleStatusLabel(booking: ModeratorBookingItem): "confirmed" | "pending" {
  const status = String(booking.bookingStatus || "").toLowerCase()
  if (status === "accepted" || status === "in_progress") return "confirmed"
  return "pending"
}

function formatPayout(cents: number | null | undefined): string | null {
  if (cents == null || !Number.isFinite(cents)) return null
  return `$${(cents / 100).toFixed(0)}`
}

function formatTimeRange(startAt: string | null, endAt: string | null): string {
  if (!startAt || !endAt) return "Schedule not set"

  const start = new Date(startAt)
  const end = new Date(endAt)

  return `${start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`
}

function formatRequestedFor(startAt: string | null, endAt: string | null): string {
  if (!startAt || !endAt) return "Schedule not set"

  const start = new Date(startAt)
  const end = new Date(endAt)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  let dayLabel: string
  if (isSameCalendarDay(start, now)) {
    dayLabel = "Today"
  } else if (isSameCalendarDay(start, tomorrow)) {
    dayLabel = "Tomorrow"
  } else {
    dayLabel = start.toLocaleDateString("en-US", { weekday: "short" })
  }

  return `${dayLabel}, ${formatTimeRange(startAt, endAt)}`
}

function paymentStatusLabel(paymentStatus: string): string {
  const normalized = String(paymentStatus || "").toLowerCase()
  if (!normalized) return "Booking"
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export default function ModeratorDashboard() {
  const { getToken } = useAuth()
  const authenticatedUser = useAuthenticatedUser()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bookings, setBookings] = useState<ModeratorBookingItem[]>([])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setIsLoading(true)
        setError(null)

        const token = await getToken()
        if (!token) {
          throw new Error("Authentication required.")
        }

        const result = await listModeratorBookings(token)
        if (!active) return
        setBookings(result.bookings || [])
      } catch (err) {
        if (!active) return
        const message = err instanceof Error ? err.message : "Unable to load bookings."
        setError(message)
      } finally {
        if (active) setIsLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [getToken])

  const pendingRequests = useMemo(
    () => bookings.filter(isPendingRequest),
    [bookings],
  )

  const todayBookings = useMemo(
    () => bookings.filter((booking) => isScheduledToday(booking) && isActiveTodaySession(booking)),
    [bookings],
  )

  const displayName = authenticatedUser
    ? authenticatedUser.firstName || authenticatedUser.lastName
      ? [authenticatedUser.firstName, authenticatedUser.lastName].filter(Boolean).join(" ")
      : authenticatedUser.email
    : "Moderator"

  const firstName = displayName.split(" ")[0] || "Moderator"

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-slate-50 via-white to-sky-50 p-5 dark:from-slate-950/40 dark:via-background dark:to-sky-950/20">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Hi {firstName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Focus only on what needs action right now.
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/moderator/bookings">
              <CalendarClock className="h-4 w-4" />
              Open Bookings
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-border/60 bg-card/70">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/60 bg-card/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending Requests</p>
            <p className="mt-2 text-2xl font-semibold">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : pendingRequests.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Needs accept or decline</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Today Sessions</p>
            <p className="mt-2 text-2xl font-semibold">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : todayBookings.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Confirmed and pending</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-border/60 bg-card/70 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-primary" />
              Today Schedule
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/moderator/bookings">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading schedule...
              </div>
            ) : todayBookings.length === 0 ? (
              <p className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                No sessions scheduled for today.
              </p>
            ) : (
              todayBookings.map((job) => {
                const status = scheduleStatusLabel(job)
                const payout = formatPayout(job.moderatorPayoutCents)

                return (
                  <div
                    key={job.bookingId}
                    className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/70 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {job.streamerUsername.charAt(0)}
                        </AvatarFallback>
                      </Avatar>

                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{job.streamerUsername}</p>
                          <StatusBadge variant={status === "confirmed" ? "success" : "warning"}>
                            {status}
                          </StatusBadge>
                        </div>
                        <p className="text-sm text-muted-foreground">{paymentStatusLabel(job.paymentStatus)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock3 className="h-4 w-4" />
                        {formatTimeRange(job.scheduledStartAt, job.scheduledEndAt)}
                      </div>
                      {payout ? (
                        <div className="flex items-center gap-1.5 font-medium text-primary">
                          <DollarSign className="h-4 w-4" />
                          {payout}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Action Required
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading requests...
              </div>
            ) : pendingRequests.length === 0 ? (
              <p className="rounded-xl border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground">
                No pending requests right now.
              </p>
            ) : (
              pendingRequests.map((request) => {
                const payout = formatPayout(request.moderatorPayoutCents)

                return (
                  <div key={request.bookingId} className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{request.streamerUsername}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {paymentStatusLabel(request.paymentStatus)}
                        </p>
                      </div>
                      {payout ? <span className="text-sm font-semibold text-primary">{payout}</span> : null}
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatRequestedFor(request.scheduledStartAt, request.scheduledEndAt)}
                    </p>

                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" asChild>
                        <Link href="/moderator/bookings">Decline</Link>
                      </Button>
                      <Button size="sm" className="flex-1" asChild>
                        <Link href="/moderator/bookings">Accept</Link>
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/70">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Quick Actions</p>
            <p className="text-sm text-muted-foreground">Go directly to the screens you use most.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/moderator/availability">Update Availability</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/moderator/public-profile">
                <BadgeCheck className="mr-1 h-4 w-4" />
                Public Profile
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/moderator/bookings">
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Manage Bookings
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
