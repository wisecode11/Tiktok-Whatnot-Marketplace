"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Loader2, MessageSquare, UserCheck } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { listHiredModerators, type HiredModeratorBooking } from "@/lib/booking-payment"

function getPaymentStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const normalized = String(status || "").toLowerCase()
  if (normalized === "paid") return "default"
  if (normalized === "pending") return "secondary"
  if (normalized === "failed" || normalized === "refunded") return "destructive"
  return "outline"
}

function formatSlot(booking: HiredModeratorBooking): string {
  if (!booking.scheduledStartAt || !booking.scheduledEndAt) return "No schedule"

  const start = new Date(booking.scheduledStartAt)
  const end = new Date(booking.scheduledEndAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "No schedule"

  return `${start.toLocaleDateString()} | ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
}

export default function SellerHiredModeratorsPage() {
  const { getToken } = useAuth()

  const [bookings, setBookings] = useState<HiredModeratorBooking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadBookings() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const token = await getToken()
        if (!token) {
          throw new Error("You must be signed in to view hired moderators.")
        }

        const result = await listHiredModerators(token)
        if (!cancelled) {
          setBookings(Array.isArray(result.bookings) ? result.bookings : [])
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load hired moderators.")
          setBookings([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadBookings()

    return () => {
      cancelled = true
    }
  }, [getToken])

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const first = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const second = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return second - first
    })
  }, [bookings])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hired Moderators"
        description="All moderator bookings created by your streamer account"
      />

      {isLoading ? (
        <div className="flex min-h-[220px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-6 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && sortedBookings.length === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-10 text-center">
            <UserCheck className="mx-auto mb-3 h-6 w-6 text-primary" />
            <p className="font-medium">No hired moderators yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Your moderator bookings will appear here.</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/seller/moderators">Find Moderators</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && sortedBookings.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedBookings.map((booking) => {
            const profileHref = `/seller/moderators/${booking.moderatorPublicSlug || `user-${booking.moderatorUserId || "unknown"}`}`
            const emailHref = booking.moderatorEmail
              ? `mailto:${booking.moderatorEmail}?subject=${encodeURIComponent("Regarding moderator booking")}`
              : null

            return (
              <Card key={booking.bookingId} className="border-border/60 bg-card/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{booking.moderatorName || "Moderator"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Payment Status</span>
                    <Badge variant={getPaymentStatusBadgeVariant(booking.paymentStatus)}>
                      {booking.paymentStatus || "unpaid"}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground">{formatSlot(booking)}</div>

                  <div className="flex gap-2">
                    <Button asChild size="sm" className="flex-1 gap-1.5">
                      <a href={emailHref || profileHref}>
                        <MessageSquare className="h-3.5 w-3.5" />
                        Message
                      </a>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link href={profileHref}>View Profile</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
