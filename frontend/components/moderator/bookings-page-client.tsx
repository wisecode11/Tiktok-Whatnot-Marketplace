"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { CheckCircle2, Loader2, MessageSquare, Star } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  markBookingTaskCompleted,
  listModeratorBookings,
  type ModeratorBookingItem,
} from "@/lib/booking-payment"

function paymentBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const normalized = String(status || "").toLowerCase()
  if (normalized === "paid") return "default"
  if (normalized === "failed" || normalized === "refunded") return "destructive"
  if (normalized === "pending") return "secondary"
  return "outline"
}

function formatSlot(startAt: string | null, endAt: string | null): string {
  if (!startAt || !endAt) return "Schedule not set"

  const start = new Date(startAt)
  const end = new Date(endAt)

  const dateLabel = start.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  const timeLabel = `${start.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })} - ${end.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`

  return `${dateLabel} | ${timeLabel}`
}

export default function ModeratorBookingsPageClient() {
  const { getToken } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null)
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

  const hasBookings = useMemo(() => bookings.length > 0, [bookings])

  async function handleMarkCompleted(bookingId: string) {
    try {
      setIsActionLoading(bookingId)
      setError(null)
      const token = await getToken()

      if (!token) {
        throw new Error("Authentication required.")
      }

      await markBookingTaskCompleted(token, bookingId)
      const result = await listModeratorBookings(token)
      setBookings(result.bookings || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to mark task completed."
      setError(message)
    } finally {
      setIsActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Bookings assigned to your moderator account"
      />

      {isLoading && (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading bookings...
          </CardContent>
        </Card>
      )}

      {!isLoading && error && (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!isLoading && !error && !hasBookings && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You currently have no assigned bookings.
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && hasBookings && (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <Card key={booking.bookingId} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-base font-semibold">{booking.streamerUsername}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{formatSlot(booking.scheduledStartAt, booking.scheduledEndAt)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Order status: <span className="font-medium capitalize text-foreground">{booking.orderStatus}</span></p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">Payment Status</span>
                    <Badge variant={paymentBadgeVariant(booking.paymentStatus)}>
                      {booking.paymentStatus || "unknown"}
                    </Badge>
                  </div>
                </div>

                {booking.review ? (
                  <div className="mt-3 rounded-md border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Streamer review</p>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      <span className="font-semibold">{booking.review.rating}/5</span>
                    </div>
                    {booking.review.reviewText ? <p className="mt-1 text-sm">{booking.review.reviewText}</p> : null}
                  </div>
                ) : null}

                <div className="mt-4 flex justify-end">
                  <div className="flex gap-2">
                    {booking.canMarkCompleted ? (
                      <Button
                        type="button"
                        className="gap-2"
                        disabled={isActionLoading === booking.bookingId}
                        onClick={() => void handleMarkCompleted(booking.bookingId)}
                      >
                        {isActionLoading === booking.bookingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Mark Completed
                      </Button>
                    ) : null}

                    {booking.streamerUserId ? (
                      <Button asChild type="button" variant="outline" className="gap-2">
                        <Link href={`/moderator/chat?peer=${encodeURIComponent(booking.streamerUserId)}`}>
                          <MessageSquare className="h-4 w-4" />
                          Message
                        </Link>
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" className="gap-2" disabled>
                        <MessageSquare className="h-4 w-4" />
                        Message
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
