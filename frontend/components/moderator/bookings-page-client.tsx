"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Loader2, MessageSquare } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
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
  const { toast } = useToast()
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

  const hasBookings = useMemo(() => bookings.length > 0, [bookings])

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
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">Payment Status</span>
                    <Badge variant={paymentBadgeVariant(booking.paymentStatus)}>
                      {booking.paymentStatus || "unknown"}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      toast({
                        title: "Messaging",
                        description: `Start chat with ${booking.streamerUsername} (coming soon).`,
                      })
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
