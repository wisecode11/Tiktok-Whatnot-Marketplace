"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Loader2, MessageSquare, Star, UserCheck, XCircle, CheckCircle2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  decideBookingOrder,
  listHiredModerators,
  submitBookingReview,
  type HiredModeratorBooking,
} from "@/lib/booking-payment"

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

function getOrderStatusBadgeVariant(status: HiredModeratorBooking["orderStatus"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "accepted") return "default"
  if (status === "completed") return "secondary"
  if (status === "rejected") return "destructive"
  return "outline"
}

export default function SellerHiredModeratorsPage() {
  const { getToken } = useAuth()

  const [bookings, setBookings] = useState<HiredModeratorBooking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reviewDialogBooking, setReviewDialogBooking] = useState<HiredModeratorBooking | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState("")

  async function loadBookings() {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const token = await getToken()
      if (!token) {
        throw new Error("You must be signed in to view hired moderators.")
      }

      const result = await listHiredModerators(token)
      setBookings(Array.isArray(result.bookings) ? result.bookings : [])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load hired moderators.")
      setBookings([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function run() {
      await loadBookings()
    }

    void run()

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

  async function handleDecision(bookingId: string, decision: "accepted" | "rejected") {
    try {
      setIsActionLoading(`${bookingId}:${decision}`)
      setErrorMessage(null)
      const token = await getToken()

      if (!token) {
        throw new Error("You must be signed in to perform this action.")
      }

      await decideBookingOrder(token, bookingId, { decision })
      const result = await listHiredModerators(token)
      setBookings(Array.isArray(result.bookings) ? result.bookings : [])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update order decision.")
    } finally {
      setIsActionLoading(null)
    }
  }

  async function handleSubmitReview() {
    if (!reviewDialogBooking) {
      return
    }

    try {
      setIsActionLoading(`${reviewDialogBooking.bookingId}:review`)
      setErrorMessage(null)
      const token = await getToken()

      if (!token) {
        throw new Error("You must be signed in to submit a review.")
      }

      await submitBookingReview(token, reviewDialogBooking.bookingId, {
        rating: reviewRating,
        reviewText,
      })

      const result = await listHiredModerators(token)
      setBookings(Array.isArray(result.bookings) ? result.bookings : [])
      setReviewDialogBooking(null)
      setReviewRating(5)
      setReviewText("")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to submit review.")
    } finally {
      setIsActionLoading(null)
    }
  }

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
            const chatHref = booking.moderatorUserId
              ? `/seller/chat?peer=${encodeURIComponent(booking.moderatorUserId)}`
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

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Order Status</span>
                    <Badge variant={getOrderStatusBadgeVariant(booking.orderStatus)}>
                      {booking.orderStatus}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground">{formatSlot(booking)}</div>

                  {booking.review ? (
                    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                        {booking.review.rating}/5
                      </div>
                      {booking.review.reviewText ? <p className="mt-1 text-sm">{booking.review.reviewText}</p> : null}
                    </div>
                  ) : null}

                  <div className="flex gap-2">
                    <Button asChild size="sm" className="flex-1 gap-1.5" disabled={!chatHref}>
                      <Link href={chatHref || profileHref}>
                        <MessageSquare className="h-3.5 w-3.5" />
                        Message
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link href={profileHref}>View Profile</Link>
                    </Button>
                  </div>

                  {booking.orderStatus === "completed" ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1 gap-1.5"
                        onClick={() => void handleDecision(booking.bookingId, "accepted")}
                        disabled={isActionLoading === `${booking.bookingId}:accepted`}
                      >
                        {isActionLoading === `${booking.bookingId}:accepted` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 gap-1.5"
                        onClick={() => void handleDecision(booking.bookingId, "rejected")}
                        disabled={isActionLoading === `${booking.bookingId}:rejected`}
                      >
                        {isActionLoading === `${booking.bookingId}:rejected` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        Reject
                      </Button>
                    </div>
                  ) : null}

                  {booking.canSubmitReview ? (
                    <Button
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() => setReviewDialogBooking(booking)}
                    >
                      <Star className="h-3.5 w-3.5" />
                      Add Review
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}

      <Dialog open={Boolean(reviewDialogBooking)} onOpenChange={(open) => !open && setReviewDialogBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Moderator</DialogTitle>
            <DialogDescription>
              Share your feedback for {reviewDialogBooking?.moderatorName || "this moderator"}. This can only be submitted once per order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm font-medium">Rating</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <Button key={value} type="button" variant={value <= reviewRating ? "default" : "outline"} size="sm" onClick={() => setReviewRating(value)}>
                  {value}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Review</p>
            <Textarea
              placeholder="Write your public review..."
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              maxLength={1000}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogBooking(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmitReview()} disabled={!reviewDialogBooking || isActionLoading === `${reviewDialogBooking.bookingId}:review`}>
              {reviewDialogBooking && isActionLoading === `${reviewDialogBooking.bookingId}:review` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
