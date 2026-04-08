"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { Loader2, CreditCard, CheckCircle2, AlertCircle, DollarSign } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  createBookingPaymentIntent,
  type CreateBookingIntentResponse,
} from "@/lib/booking-payment"

// ---------------------------------------------------------------------------
// Stripe publishable key – set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env.local
// ---------------------------------------------------------------------------
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
)

// ---------------------------------------------------------------------------
// Card styles that match the dark shadcn theme
// ---------------------------------------------------------------------------
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: "hsl(var(--foreground))",
      fontFamily: "inherit",
      fontSize: "14px",
      "::placeholder": {
        color: "hsl(var(--muted-foreground))",
      },
    },
    invalid: {
      color: "hsl(var(--destructive))",
    },
  },
}

// ---------------------------------------------------------------------------
// Inner form component – must be rendered inside <Elements>
// ---------------------------------------------------------------------------
function CheckoutForm({
  intent,
  moderatorName,
  onSuccess,
  onClose,
}: {
  intent: CreateBookingIntentResponse
  moderatorName: string
  onSuccess: (bookingId: string) => void
  onClose: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsProcessing(true)
    setPaymentError(null)

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setIsProcessing(false)
      return
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(
      intent.clientSecret,
      { payment_method: { card: cardElement } }
    )

    if (error) {
      setPaymentError(error.message || "Payment failed. Please try again.")
      setIsProcessing(false)
      return
    }

    if (paymentIntent?.status === "succeeded") {
      onSuccess(intent.bookingId)
    } else {
      setPaymentError("Payment could not be completed. Please try again.")
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-5">
      {/* Summary */}
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Moderator</span>
          <span className="font-medium">{moderatorName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total amount</span>
          <span className="font-semibold">${(intent.amountCents / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Platform fee (15%)</span>
          <span>${(intent.platformFeeCents / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Moderator receives (85%)</span>
          <span>${(intent.moderatorPayoutCents / 100).toFixed(2)}</span>
        </div>
      </div>

      {/* Card input */}
      <div className="space-y-2">
        <Label>Card details</Label>
        <div className="rounded-md border border-input bg-background px-3 py-3">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>

      {paymentError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {paymentError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onClose} disabled={isProcessing}>
          Cancel
        </Button>
        <Button type="submit" disabled={isProcessing || !stripe} className="gap-2 min-w-[160px]">
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Pay ${(intent.amountCents / 100).toFixed(2)}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main exported modal component
// ---------------------------------------------------------------------------
export interface HireModeratorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  moderatorUserId: string
  moderatorName: string
  hourlyRateCents: number | null
  initialScheduledDate?: string | null
  initialScheduledStartTime?: string | null
  initialScheduledEndTime?: string | null
}

export function HireModeratorModal({
  open,
  onOpenChange,
  moderatorUserId,
  moderatorName,
  hourlyRateCents,
  initialScheduledDate,
  initialScheduledStartTime,
  initialScheduledEndTime,
}: HireModeratorModalProps) {
  const { getToken } = useAuth()

  // Step 1: fill form — Step 2: Stripe card form — Step 3: success
  type Step = "form" | "checkout" | "success"
  const [step, setStep] = useState<Step>("form")

  // Form state
  const [hours, setHours] = useState("1")
  const [customAmountDollars, setCustomAmountDollars] = useState("")
  const [notes, setNotes] = useState("")
  const [scheduledDate, setScheduledDate] = useState(initialScheduledDate || "")
  const [scheduledStartTime, setScheduledStartTime] = useState(initialScheduledStartTime || "")
  const [scheduledEndTime, setScheduledEndTime] = useState(initialScheduledEndTime || "")
  const [isCreatingIntent, setIsCreatingIntent] = useState(false)
  const [intentError, setIntentError] = useState<string | null>(null)

  const [intent, setIntent] = useState<CreateBookingIntentResponse | null>(null)
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setScheduledDate(initialScheduledDate || "")
    setScheduledStartTime(initialScheduledStartTime || "")
    setScheduledEndTime(initialScheduledEndTime || "")
  }, [open, initialScheduledDate, initialScheduledStartTime, initialScheduledEndTime])

  // Derived amount
  const derivedAmountCents = (() => {
    if (customAmountDollars && parseFloat(customAmountDollars) > 0) {
      return Math.round(parseFloat(customAmountDollars) * 100)
    }
    if (hourlyRateCents && parseFloat(hours) > 0) {
      return Math.round(hourlyRateCents * parseFloat(hours))
    }
    return 0
  })()

  function handleClose(next: boolean) {
    if (!next) {
      // Reset state when closing
      setStep("form")
      setHours("1")
      setCustomAmountDollars("")
      setNotes("")
      setIntent(null)
      setIntentError(null)
      setSuccessBookingId(null)
    }
    onOpenChange(next)
  }

  async function handleProceed() {
    if (derivedAmountCents < 100) {
      setIntentError("Minimum booking amount is $1.00.")
      return
    }

    const hasFullScheduleValue = Boolean(scheduledDate && scheduledStartTime && scheduledEndTime)

    if (!hasFullScheduleValue) {
      setIntentError("Please select booking date, start time, and end time.")
      return
    }

    if (hasFullScheduleValue && scheduledEndTime <= scheduledStartTime) {
      setIntentError("End time must be after start time.")
      return
    }

    setIsCreatingIntent(true)
    setIntentError(null)

    try {
      const token = await getToken()
      if (!token) throw new Error("You must be signed in to book a moderator.")

      const result = await createBookingPaymentIntent(token, {
        moderatorUserId,
        amountCents: derivedAmountCents,
        notes: notes || undefined,
        scheduledStartAt: hasFullScheduleValue
          ? `${scheduledDate}T${scheduledStartTime}:00.000Z`
          : undefined,
        scheduledEndAt: hasFullScheduleValue
          ? `${scheduledDate}T${scheduledEndTime}:00.000Z`
          : undefined,
      })

      setIntent(result)
      setStep("checkout")
    } catch (err) {
      setIntentError(err instanceof Error ? err.message : "Could not initiate payment. Please try again.")
    } finally {
      setIsCreatingIntent(false)
    }
  }

  function handlePaymentSuccess(bookingId: string) {
    setSuccessBookingId(bookingId)
    setStep("success")
  }

  const displayRate = hourlyRateCents
    ? `$${(hourlyRateCents / 100).toFixed(2)}/hr`
    : "Custom rate"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Hire {moderatorName}
          </DialogTitle>
          <DialogDescription>
            15% platform fee applies. The moderator receives 85% via their connected Stripe account.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 — Fill booking details */}
        {step === "form" && (
          <div className="space-y-4">
            {hourlyRateCents ? (
              <div className="space-y-2">
                <Label htmlFor="hours">
                  Hours needed <span className="text-muted-foreground">(rate: {displayRate})</span>
                </Label>
                <Input
                  id="hours"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={hours}
                  onChange={(e) => { setHours(e.target.value); setCustomAmountDollars("") }}
                  placeholder="e.g. 2"
                />
              </div>
            ) : null}

            {/* <div className="space-y-2">
              <Label htmlFor="custom-amount">
                {hourlyRateCents ? "Or set a fixed amount (USD)" : "Amount (USD)"}
              </Label>
              <Input
                id="custom-amount"
                type="number"
                min="1"
                step="1"
                value={customAmountDollars}
                onChange={(e) => { setCustomAmountDollars(e.target.value); if (e.target.value) setHours("") }}
                placeholder="e.g. 50"
              />
            </div> */}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe the session goals, platform, schedule…"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="scheduled-date">Date</Label>
                <Input
                  id="scheduled-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled-start">Start time</Label>
                <Input
                  id="scheduled-start"
                  type="time"
                  value={scheduledStartTime}
                  onChange={(e) => setScheduledStartTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled-end">End time</Label>
                <Input
                  id="scheduled-end"
                  type="time"
                  value={scheduledEndTime}
                  onChange={(e) => setScheduledEndTime(e.target.value)}
                />
              </div>
            </div>

            {derivedAmountCents > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Total to pay</span>
                  <span>${(derivedAmountCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Moderator receives (85%)</span>
                  <span>${(Math.round(derivedAmountCents * 0.85) / 100).toFixed(2)}</span>
                </div>
              </div>
            )}

            {intentError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {intentError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleProceed}
                disabled={derivedAmountCents < 100 || isCreatingIntent}
                className="gap-2 min-w-[160px]"
              >
                {isCreatingIntent ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Please wait…
                  </>
                ) : (
                  "Proceed to Payment"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Stripe checkout */}
        {step === "checkout" && intent && (
          <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret }}>
            <CheckoutForm
              intent={intent}
              moderatorName={moderatorName}
              onSuccess={handlePaymentSuccess}
              onClose={() => handleClose(false)}
            />
          </Elements>
        )}

        {/* Step 3 — Success */}
        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
            <div>
              <p className="text-lg font-semibold">Booking confirmed!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your booking with <span className="font-medium">{moderatorName}</span> has been placed
                and payment was successful.
              </p>
              {successBookingId && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Booking&nbsp;ID:&nbsp;<span className="font-mono">{successBookingId}</span>
                </p>
              )}
            </div>
            <Button onClick={() => handleClose(false)} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
