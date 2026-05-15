"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { loadStripe } from "@stripe/stripe-js"
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js"
import { AlertCircle, CheckCircle2, CreditCard, ExternalLink, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { getClerkErrorMessage, waitForSessionToken } from "@/lib/auth"
import {
  confirmPayrollPayment,
  createPayrollPaymentIntent,
  type CreatePayrollPaymentIntentResponse,
} from "@/lib/payroll-payment"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")

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

function CheckoutForm({
  intent,
  periodLabel,
  onSuccess,
  onClose,
}: {
  intent: CreatePayrollPaymentIntentResponse
  periodLabel: string
  onSuccess: (invoiceUrl: string | null) => void
  onClose: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const { getToken } = useAuth()
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  async function handlePay(event: React.FormEvent) {
    event.preventDefault()
    if (!stripe || !elements) return

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) return

    setIsProcessing(true)
    setPaymentError(null)

    const { error, paymentIntent } = await stripe.confirmCardPayment(intent.clientSecret, {
      payment_method: { card: cardElement },
    })

    if (error) {
      setPaymentError(error.message || "Payment failed. Please try again.")
      setIsProcessing(false)
      return
    }

    if (paymentIntent?.status !== "succeeded") {
      setPaymentError("Payment could not be completed. Please try again.")
      setIsProcessing(false)
      return
    }

    try {
      const token = await waitForSessionToken(getToken)
      const confirmed = await confirmPayrollPayment(token, intent.payrollRunId)
      onSuccess(
        confirmed.hostedInvoiceUrl || intent.hostedInvoiceUrl || null,
      )
    } catch (confirmError) {
      setPaymentError(getClerkErrorMessage(confirmError))
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-5">
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Staff</span>
          <span className="font-medium">{intent.staffName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Period</span>
          <span>{periodLabel}</span>
        </div>
        <div className="flex justify-between border-t border-border/50 pt-2">
          <span className="font-medium">Net pay (charged to your card)</span>
          <span className="font-semibold text-primary">${intent.netPay}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Card details</Label>
        <div className="rounded-md border border-input bg-background px-3 py-3">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>

      {paymentError ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {paymentError}
        </div>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onClose} disabled={isProcessing}>
          Cancel
        </Button>
        <Button type="submit" disabled={isProcessing || !stripe} className="gap-2 min-w-[140px]">
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Pay ${intent.netPay}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

export type PayStaffModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffUserId: string
  staffName: string
  periodStart: string
  periodEnd: string
  netPay: string
  grossPay: string
  deductions: string
  onPaid: () => void
}

export function PayStaffModal({
  open,
  onOpenChange,
  staffUserId,
  staffName,
  periodStart,
  periodEnd,
  netPay,
  grossPay,
  deductions,
  onPaid,
}: PayStaffModalProps) {
  const { getToken } = useAuth()
  const [step, setStep] = useState<"review" | "pay">("review")
  const [intent, setIntent] = useState<CreatePayrollPaymentIntentResponse | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)
  const [prepareError, setPrepareError] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const prepareStartedRef = useRef(false)

  const periodLabel = `${periodStart} → ${periodEnd}`

  useEffect(() => {
    if (!open) {
      setStep("review")
      setIntent(null)
      setPrepareError(null)
      setPaid(false)
      setInvoiceUrl(null)
      setIsPreparing(false)
      prepareStartedRef.current = false
    }
  }, [open])

  async function handleContinueToPayment() {
    if (prepareStartedRef.current && intent) {
      setStep("pay")
      return
    }

    try {
      setIsPreparing(true)
      setPrepareError(null)
      prepareStartedRef.current = true
      const token = await waitForSessionToken(getToken)
      const result = await createPayrollPaymentIntent(token, staffUserId, periodStart, periodEnd)
      setIntent(result)
      setStep("pay")
    } catch (error) {
      prepareStartedRef.current = false
      setPrepareError(getClerkErrorMessage(error))
    } finally {
      setIsPreparing(false)
    }
  }

  function handleSuccess(hostedInvoiceUrl: string | null) {
    setInvoiceUrl(hostedInvoiceUrl)
    setPaid(true)
    onPaid()
  }

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && open) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay staff</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-destructive">
            Stripe publishable key is missing. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
          </p>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay staff via Stripe</DialogTitle>
          <DialogDescription>
            Pay {staffName} for {periodLabel}. Funds go to their connected Stripe account.
          </DialogDescription>
        </DialogHeader>

        {paid ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <p className="font-medium">Payment successful</p>
            <p className="text-sm text-muted-foreground">
              ${netPay} was sent to {staffName}. A Stripe invoice was created for your records.
            </p>
            {invoiceUrl ? (
              <Button variant="outline" className="gap-2" asChild>
                <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  View Stripe invoice
                </a>
              </Button>
            ) : null}
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : step === "review" ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Staff</span>
                <span className="font-medium">{staffName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period</span>
                <span>{periodLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross</span>
                <span>${grossPay}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deductions</span>
                <span>${deductions}</span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-2">
                <span className="font-medium">Net pay</span>
                <span className="font-semibold text-primary">${netPay}</span>
              </div>
            </div>

            {prepareError ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {prepareError}
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="gap-2"
                disabled={isPreparing}
                onClick={() => void handleContinueToPayment()}
              >
                {isPreparing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparing…
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Continue to payment
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : intent && stripePromise ? (
          <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret }}>
            <CheckoutForm
              intent={intent}
              periodLabel={periodLabel}
              onSuccess={handleSuccess}
              onClose={() => onOpenChange(false)}
            />
          </Elements>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
