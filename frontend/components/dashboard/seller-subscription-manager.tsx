"use client"

import { useAuth } from "@clerk/nextjs"
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js"
import {
  loadStripe,
  type Stripe as StripeClient,
  type StripeCardElement,
} from "@stripe/stripe-js"
import {
  Check,
  CreditCard,
  ExternalLink,
  Loader2,
  Trash2,
  Receipt,
  RefreshCcw,
  ShieldCheck,
  Star,
} from "lucide-react"
import Link from "next/link"
import { startTransition, useEffect, useMemo, useState } from "react"

import { PageHeader } from "@/components/page-header"
import { useOptionalSellerSubscriptionAccess } from "@/components/dashboard/seller-subscription-access"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { StatusBadge } from "@/components/ui/status-badge"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { waitForSessionToken } from "@/lib/auth"
import { cn } from "@/lib/utils"
import {
  changeSellerSubscription,
  createSellerSetupIntent,
  deleteSellerPaymentMethod,
  getSellerBillingOverview,
  type BillingOverviewResponse,
  type BillingPaymentMethod,
  type BillingPlan,
  type SubscriptionMutationResponse,
  updateSellerDefaultPaymentMethod,
} from "@/lib/billing"

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

type DialogMode = "subscribe" | "payment-method"

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

function formatAmountFromCents(amountCents: number, currency: string) {
  return formatMoney(amountCents / 100, currency)
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not scheduled"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function toTitleCase(value: string | null | undefined) {
  return String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function getSubscriptionVariant(status: string | null | undefined) {
  if (status === "active" || status === "trialing" || status === "free") {
    return "success" as const
  }

  if (status === "past_due" || status === "incomplete") {
    return "warning" as const
  }

  if (status === "cancelled" || status === "incomplete_expired" || status === "unpaid") {
    return "danger" as const
  }

  return "default" as const
}

function formatCardLabel(paymentMethod: BillingPaymentMethod) {
  return `${toTitleCase(paymentMethod.brand)} ending in ${paymentMethod.last4 || "----"}`
}

function billingIntervalDisplay(interval: string) {
  if (interval === "year") return "year"
  if (interval === "month") return "month"
  return interval
}

function isFeaturedBillingPlan(plan: BillingPlan, plans: BillingPlan[]) {
  if (plans.length < 2) return false
  const middleIndex = Math.floor(plans.length / 2)
  return plans[middleIndex]?.id === plan.id
}

function NewPaymentMethodFields({
  billingEmail,
  billingName,
  clientSecret,
  disabled,
  onConfirmed,
  submitLabel,
}: {
  billingEmail: string
  billingName: string
  clientSecret: string
  disabled: boolean
  onConfirmed: (paymentMethodId: string, stripeClient: StripeClient) => Promise<void>
  submitLabel: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit() {
    if (!stripe || !elements) {
      setErrorMessage("Stripe has not finished loading yet.")
      return
    }

    const cardElement = elements.getElement(CardElement) as StripeCardElement | null

    if (!cardElement) {
      setErrorMessage("Card input is not ready yet.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            email: billingEmail,
            name: billingName,
          },
        },
      })

      if (result.error) {
        throw new Error(result.error.message || "Unable to save this card.")
      }

      if (!result.setupIntent?.payment_method || typeof result.setupIntent.payment_method !== "string") {
        throw new Error("Stripe did not return a saved payment method.")
      }

      await onConfirmed(result.setupIntent.payment_method, stripe)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save this card.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <Label className="mb-3 block">Card details</Label>
        <div className="rounded-lg border border-border bg-background px-3 py-3 shadow-xs">
          <CardElement
            options={{
              hidePostalCode: true,
            }}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Your card is stored directly in Stripe and reused for future subscription renewals.
        </p>
        {errorMessage ? <p className="mt-2 text-sm text-destructive">{errorMessage}</p> : null}
      </div>

      <Button className="w-full sm:w-auto" disabled={disabled || isSubmitting} onClick={handleSubmit}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        {submitLabel}
      </Button>
    </div>
  )
}

function NewPaymentMethodForm({
  billingEmail,
  billingName,
  clientSecret,
  disabled,
  onConfirmed,
  submitLabel,
}: {
  billingEmail: string
  billingName: string
  clientSecret: string
  disabled: boolean
  onConfirmed: (paymentMethodId: string, stripeClient: StripeClient) => Promise<void>
  submitLabel: string
}) {
  if (!stripePromise) {
    return null
  }

  return (
    <Elements stripe={stripePromise}>
      <NewPaymentMethodFields
        billingEmail={billingEmail}
        billingName={billingName}
        clientSecret={clientSecret}
        disabled={disabled}
        onConfirmed={onConfirmed}
        submitLabel={submitLabel}
      />
    </Elements>
  )
}

export function SellerSubscriptionManager() {
  const { getToken, isLoaded } = useAuth()
  const { toast } = useToast()
  const subscriptionAccess = useOptionalSellerSubscriptionAccess()

  const [overview, setOverview] = useState<BillingOverviewResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>("subscribe")
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null)
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("")
  const [useNewPaymentMethod, setUseNewPaymentMethod] = useState(false)
  const [setupIntentSecret, setSetupIntentSecret] = useState<string | null>(null)
  const [isPreparingSetupIntent, setIsPreparingSetupIntent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingPaymentMethodId, setDeletingPaymentMethodId] = useState<string | null>(null)
  const [billingPeriodView, setBillingPeriodView] = useState<"month" | "year">("month")
  const [billingPeriodInitialized, setBillingPeriodInitialized] = useState(false)

  const sortedPlans = useMemo(() => overview?.plans || [], [overview?.plans])
  const { hasBothBillingIntervals, visiblePlans } = useMemo(() => {
    const monthlyPlans = sortedPlans.filter((plan) => plan.billingInterval === "month")
    const yearlyPlans = sortedPlans.filter((plan) => plan.billingInterval === "year")
    const hasBothBillingIntervals = monthlyPlans.length > 0 && yearlyPlans.length > 0
    const visiblePlans = hasBothBillingIntervals
      ? billingPeriodView === "year"
        ? yearlyPlans
        : monthlyPlans
      : sortedPlans

    return { hasBothBillingIntervals, visiblePlans }
  }, [billingPeriodView, sortedPlans])
  const primaryPlan = sortedPlans[0] || null
  const currentPlanId = overview?.currentSubscription?.plan?.id || null
  const hasActiveSubscription = Boolean(
    overview?.currentSubscription?.plan?.id &&
      ["active", "trialing", "past_due", "incomplete"].includes(
        overview.currentSubscription.status,
      ),
  )

  async function getAccessToken() {
    return waitForSessionToken(getToken)
  }

  function resetDialogState() {
    setDialogOpen(false)
    setSelectedPlan(null)
    setSelectedPaymentMethodId("")
    setUseNewPaymentMethod(false)
    setSetupIntentSecret(null)
    setIsPreparingSetupIntent(false)
    setIsSubmitting(false)
  }

  async function loadOverview(showSpinner = true) {
    if (!isLoaded) {
      return
    }

    if (showSpinner) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      const token = await getAccessToken()
      const response = await getSellerBillingOverview(token)
      await subscriptionAccess?.refreshAccess()

      startTransition(() => {
        setOverview(response)
        setErrorMessage(null)
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load billing details.")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  async function ensureSetupIntent(force = false) {
    if (!stripePublishableKey) {
      throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required to add a new card.")
    }

    if (setupIntentSecret && !force) {
      return setupIntentSecret
    }

    setIsPreparingSetupIntent(true)

    try {
      const token = await getAccessToken()
      const response = await createSellerSetupIntent(token)
      setSetupIntentSecret(response.clientSecret)
      return response.clientSecret
    } finally {
      setIsPreparingSetupIntent(false)
    }
  }

  useEffect(() => {
    void loadOverview()
  }, [isLoaded])

  useEffect(() => {
    if (billingPeriodInitialized) {
      return
    }

    const interval = overview?.currentSubscription?.plan?.billingInterval
    if (interval === "year" || interval === "month") {
      setBillingPeriodView(interval)
      setBillingPeriodInitialized(true)
    }
  }, [billingPeriodInitialized, overview?.currentSubscription?.plan?.billingInterval])

  useEffect(() => {
    if (!dialogOpen || !useNewPaymentMethod) {
      return
    }

    if (dialogMode === "subscribe" && selectedPlan?.isFree) {
      return
    }

    void ensureSetupIntent().catch((error) => {
      toast({
        title: "Stripe setup failed",
        description: error instanceof Error ? error.message : "Unable to initialize card setup.",
        variant: "destructive",
      })
    })
  }, [dialogMode, dialogOpen, selectedPlan?.id, selectedPlan?.isFree, useNewPaymentMethod])

  function openPlanDialog(plan: BillingPlan) {
    const initialPaymentMethod = overview?.defaultPaymentMethodId || overview?.paymentMethods[0]?.id || ""

    setDialogMode("subscribe")
    setSelectedPlan(plan)
    setSelectedPaymentMethodId(initialPaymentMethod)
    setUseNewPaymentMethod(!plan.isFree && (!overview?.paymentMethods.length || !initialPaymentMethod))
    setSetupIntentSecret(null)
    setDialogOpen(true)
  }

  function openPaymentMethodDialog() {
    const initialPaymentMethod = overview?.defaultPaymentMethodId || overview?.paymentMethods[0]?.id || ""

    setDialogMode("payment-method")
    setSelectedPlan(null)
    setSelectedPaymentMethodId(initialPaymentMethod)
    setUseNewPaymentMethod(!overview?.paymentMethods.length)
    setSetupIntentSecret(null)
    setDialogOpen(true)
  }

  async function completeSubscriptionFlow(
    response: SubscriptionMutationResponse,
    stripeClient?: StripeClient | null,
  ) {
    if (!response.requiresAction || !response.paymentIntentClientSecret) {
      return
    }

    const checkoutStripe = stripeClient || (stripePromise ? await stripePromise : null)

    if (!checkoutStripe) {
      throw new Error("Stripe.js is required to complete additional card authentication.")
    }

    const confirmation = await checkoutStripe.confirmCardPayment(response.paymentIntentClientSecret)

    if (confirmation.error) {
      throw new Error(confirmation.error.message || "Card authentication failed.")
    }
  }

  async function finalizeDialogAction(paymentMethodId?: string, stripeClient?: StripeClient | null) {
    const effectivePaymentMethodId = paymentMethodId || selectedPaymentMethodId

    setIsSubmitting(true)

    try {
      const token = await getAccessToken()

      if (dialogMode === "payment-method") {
        if (!effectivePaymentMethodId) {
          throw new Error("Choose or add a payment method first.")
        }

        const nextOverview = await updateSellerDefaultPaymentMethod(token, effectivePaymentMethodId)
        startTransition(() => {
          setOverview(nextOverview)
          resetDialogState()
        })

        toast({
          title: "Payment method updated",
          description: "Your default Stripe payment method has been updated.",
        })
        return
      }

      if (!selectedPlan) {
        throw new Error("Choose a subscription plan first.")
      }

      const mutation = await changeSellerSubscription(token, {
        planId: selectedPlan.id,
        ...(selectedPlan.isFree ? {} : { paymentMethodId: effectivePaymentMethodId }),
      })

      await completeSubscriptionFlow(mutation, stripeClient)

      const refreshedOverview = await getSellerBillingOverview(token)
      await subscriptionAccess?.refreshAccess()

      startTransition(() => {
        setOverview(refreshedOverview)
        resetDialogState()
      })

      toast({
        title: selectedPlan.isFree ? "Plan changed" : "Subscription updated",
        description: selectedPlan.isFree
          ? `Your account has been moved to ${selectedPlan.name}.`
          : `${selectedPlan.name} is now active for your seller account and all organizations.`,
      })
    } catch (error) {
      toast({
        title: "Billing update failed",
        description: error instanceof Error ? error.message : "Unable to complete this billing action.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeletePaymentMethod(paymentMethodId: string) {
    setDeletingPaymentMethodId(paymentMethodId)

    try {
      const token = await getAccessToken()
      const nextOverview = await deleteSellerPaymentMethod(token, paymentMethodId)

      startTransition(() => {
        setOverview(nextOverview)

        if (selectedPaymentMethodId === paymentMethodId) {
          setSelectedPaymentMethodId(nextOverview.defaultPaymentMethodId || nextOverview.paymentMethods[0]?.id || "")
        }
      })

      toast({
        title: "Card removed",
        description: "The payment method has been removed from Stripe.",
      })
    } catch (error) {
      toast({
        title: "Unable to remove card",
        description: error instanceof Error ? error.message : "The payment method could not be removed.",
        variant: "destructive",
      })
    } finally {
      setDeletingPaymentMethodId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-8 pb-8">
        <PageHeader title="Subscription" description="Manage your subscription and billing" />
        <div className="flex min-h-[50vh] items-center justify-center rounded-3xl bg-muted/30">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            Loading subscription details...
          </div>
        </div>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="space-y-6">
        <PageHeader title="Subscription" description="Manage your subscription and billing" />
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle>Billing data is unavailable</CardTitle>
            <CardDescription>{errorMessage || "Unable to load billing details right now."}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => void loadOverview()}>
              <RefreshCcw className="size-4" />
              Retry
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const currentSubscription = overview.currentSubscription

  if (!primaryPlan) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Subscription"
          description="Manage your seller subscription, saved cards, and invoices. One subscription covers every organization on your account."
        />
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle>No active subscription plan is configured</CardTitle>
            <CardDescription>
              No seller billing plans are available. Add active plans in the admin Subscription tab (with Stripe
              configured) or sync your Stripe product catalog.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const isYearlyView = billingPeriodView === "year"

  return (
    <div className="mx-auto w-full  space-y-10 pb-8">
      <PageHeader
        title="Subscription"
        description="One subscription covers every organization on your account. Manage plans, payment methods, and invoices."
        className="border-b border-border/60 pb-6"
      >
        <Button variant="outline" className="rounded-full" onClick={() => void loadOverview(false)} disabled={isRefreshing}>
          {isRefreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          Refresh
        </Button>
      </PageHeader>

      {errorMessage ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Billing sync needs attention</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-full shrink-0" onClick={() => void loadOverview(false)}>
            Retry
          </Button>
        </div>
      ) : null}

      {hasActiveSubscription && currentSubscription?.plan ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your active plan</p>
            <p className="truncate text-lg font-semibold">{currentSubscription.plan.name}</p>
            <p className="text-sm text-muted-foreground">
              {currentSubscription.currentPeriodEnd
                ? `Renews ${formatDate(currentSubscription.currentPeriodEnd)}`
                : "Billing synced with Stripe"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-2xl font-bold tabular-nums">
              {formatMoney(currentSubscription.plan.price, currentSubscription.plan.currency)}
              <span className="text-base font-normal text-muted-foreground">
                /{billingIntervalDisplay(currentSubscription.plan.billingInterval)}
              </span>
            </p>
            <StatusBadge variant={getSubscriptionVariant(currentSubscription.status)} dot pulse>
              {toTitleCase(currentSubscription.status)}
            </StatusBadge>
          </div>
        </div>
      ) : null}

      <section className="rounded-3xl bg-muted/40 px-4 py-10 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Choose your <span className="text-primary">plan</span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Pick the subscription that fits your seller workspace. Changes are billed securely through Stripe.
          </p>

          {hasBothBillingIntervals ? (
            <div className="mt-8 flex items-center justify-center gap-3">
              <span
                className={cn(
                  "text-sm font-medium transition-colors",
                  !isYearlyView ? "text-foreground" : "text-muted-foreground",
                )}
              >
                Monthly
              </span>
              <Switch
                checked={isYearlyView}
                onCheckedChange={(checked) => setBillingPeriodView(checked ? "year" : "month")}
                aria-label="Toggle yearly billing"
              />
              <span
                className={cn(
                  "text-sm font-medium transition-colors",
                  isYearlyView ? "text-foreground" : "text-muted-foreground",
                )}
              >
                Yearly
              </span>
            </div>
          ) : null}
        </div>

        {visiblePlans.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            No {isYearlyView ? "yearly" : "monthly"} plans are available right now.
          </p>
        ) : (
          <div
            className={cn(
              "mt-10 grid gap-6",
              visiblePlans.length === 1
                ? "mx-auto max-w-md"
                : visiblePlans.length === 2
                  ? "mx-auto max-w-4xl lg:grid-cols-2"
                  : "lg:grid-cols-3",
            )}
          >
            {visiblePlans.map((plan) => {
              const isCurrentPlan = currentPlanId === plan.id && hasActiveSubscription
              const featured = !isCurrentPlan && isFeaturedBillingPlan(plan, visiblePlans)
              const interval = billingIntervalDisplay(plan.billingInterval)

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-card p-8 shadow-sm transition-shadow hover:shadow-md",
                    isCurrentPlan
                      ? "border-primary/50 ring-1 ring-primary/25"
                      : featured
                        ? "border-primary/40 shadow-md shadow-primary/10"
                        : "border-border",
                  )}
                >
                  {isCurrentPlan ? (
                    <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Current plan
                    </div>
                  ) : featured ? (
                    <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      <Star className="size-3 fill-current" />
                      Most Popular
                    </div>
                  ) : null}

                  <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.description || "Full seller workspace access on the marketplace."}
                  </p>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tabular-nums text-foreground">
                      {formatMoney(plan.price, plan.currency)}
                    </span>
                    <span className="text-muted-foreground">/{interval}</span>
                  </div>

                  {isCurrentPlan ? (
                    <Button className="mt-6 w-full rounded-xl" variant="outline" disabled>
                      Current subscription
                    </Button>
                  ) : (
                    <Button
                      className={cn("mt-6 w-full rounded-xl", !featured && "bg-card")}
                      variant={featured ? "default" : "outline"}
                      onClick={() => openPlanDialog(plan)}
                    >
                      {featured ? "Choose plan" : "Get started"}
                    </Button>
                  )}

                  {plan.features.length > 0 ? (
                    <ul className="mt-8 flex flex-1 flex-col gap-3">
                      {plan.features.map((feature) => (
                        <li
                          key={`${plan.id}-${feature}`}
                          className="flex items-start gap-3 text-sm text-muted-foreground"
                        >
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                            <Check className="size-3 text-primary" aria-hidden />
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-8 text-sm text-muted-foreground">Full platform access included.</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold">Billing & account</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Workspace billing for {overview.workspace.businessName}
              </p>
            </div>
            <StatusBadge variant={getSubscriptionVariant(currentSubscription?.status)}>
              {toTitleCase(currentSubscription?.status || "free")}
            </StatusBadge>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/30 px-4 py-3">
              <dt className="text-xs font-medium text-muted-foreground">Billing contact</dt>
              <dd className="mt-1 text-sm font-medium">{overview.workspace.billingName}</dd>
              <dd className="text-sm text-muted-foreground">{overview.workspace.billingEmail}</dd>
            </div>
            <div className="rounded-xl bg-muted/30 px-4 py-3">
              <dt className="text-xs font-medium text-muted-foreground">Payment status</dt>
              <dd className="mt-1 text-sm font-medium">
                {toTitleCase(currentSubscription?.latestPaymentStatus || "No pending payment")}
              </dd>
            </div>
            <div className="rounded-xl bg-muted/30 px-4 py-3 sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">Stripe customer</dt>
              <dd className="mt-1 truncate font-mono text-xs text-muted-foreground">
                {overview.workspace.stripeCustomerId || "Created on first paid billing action"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={openPaymentMethodDialog}>
              <CreditCard className="size-4" />
              Manage payment method
            </Button>
            {overview.invoices[0]?.hostedInvoiceUrl ? (
              <Button asChild variant="outline" className="rounded-full">
                <Link href={overview.invoices[0].hostedInvoiceUrl} target="_blank">
                  <Receipt className="size-4" />
                  Latest invoice
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-base font-semibold">Saved payment methods</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Cards stored in Stripe for renewals and plan changes.
          </p>

          <div className="mt-5 space-y-3">
            {overview.paymentMethods.length ? (
              overview.paymentMethods.map((paymentMethod) => (
                <div
                  key={paymentMethod.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      <CreditCard className="size-4 text-muted-foreground" />
                      {formatCardLabel(paymentMethod)}
                      {paymentMethod.isDefault ? <StatusBadge variant="info">Default</StatusBadge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Expires {String(paymentMethod.expMonth || "--").padStart(2, "0")}/
                      {paymentMethod.expYear || "----"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={openPaymentMethodDialog}>
                      Update
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void handleDeletePaymentMethod(paymentMethod.id)}
                      disabled={deletingPaymentMethodId === paymentMethod.id}
                    >
                      {deletingPaymentMethodId === paymentMethod.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                No card on file. Add one when you choose a paid plan or update payment method.
              </div>
            )}

            {!stripePublishableKey ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
                Card checkout requires NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in the frontend environment.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/80 px-6 py-5">
          <h3 className="text-base font-semibold">Invoice history</h3>
          <p className="mt-1 text-sm text-muted-foreground">Issued and paid invoices from Stripe.</p>
        </div>

        {overview.invoices.length ? (
          <ul className="divide-y divide-border/80">
            {overview.invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold tabular-nums">
                      {formatAmountFromCents(
                        invoice.amountPaidCents || invoice.amountDueCents,
                        invoice.currency,
                      )}
                    </span>
                    <StatusBadge variant={getSubscriptionVariant(invoice.status)}>
                      {toTitleCase(invoice.status)}
                    </StatusBadge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Issued {formatDate(invoice.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {invoice.hostedInvoiceUrl ? (
                    <Button asChild size="sm" variant="outline" className="rounded-full">
                      <Link href={invoice.hostedInvoiceUrl} target="_blank">
                        View invoice
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </Button>
                  ) : null}
                  {invoice.invoicePdfUrl ? (
                    <Button asChild size="sm" variant="outline" className="rounded-full">
                      <Link href={invoice.invoicePdfUrl} target="_blank">
                        PDF
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            No invoices yet. They appear here after your first billing cycle.
          </p>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : resetDialogState())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "payment-method"
                ? "Update payment method"
                : `Confirm ${selectedPlan?.name || "subscription"}`}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "payment-method"
                ? "Choose a saved Stripe card or attach a new one and make it the workspace default."
                : selectedPlan?.isFree
                  ? "Switching to the free plan does not require a payment method."
                  : "Choose an existing Stripe card or securely add a new one before the subscription is created or updated."}
            </DialogDescription>
          </DialogHeader>

          {dialogMode === "subscribe" && selectedPlan ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{selectedPlan.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedPlan.description || "Stripe-managed subscription plan"}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{formatMoney(selectedPlan.price, selectedPlan.currency)}</p>
                  {!selectedPlan.isFree ? (
                    <p className="text-sm text-muted-foreground">per {selectedPlan.billingInterval}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {dialogMode === "subscribe" && selectedPlan?.isFree ? null : (
            <div className="space-y-4">
              {overview.paymentMethods.length ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <Label>Saved payment methods</Label>
                    <Button
                      size="sm"
                      variant={useNewPaymentMethod ? "outline" : "secondary"}
                      onClick={async () => {
                        setUseNewPaymentMethod((current) => !current)
                        if (!useNewPaymentMethod) {
                          await ensureSetupIntent(true).catch((error) => {
                            toast({
                              title: "Stripe setup failed",
                              description: error instanceof Error ? error.message : "Unable to initialize Stripe card setup.",
                              variant: "destructive",
                            })
                          })
                        }
                      }}
                    >
                      {useNewPaymentMethod ? "Use saved card" : "Use new card"}
                    </Button>
                  </div>

                  {!useNewPaymentMethod ? (
                    <RadioGroup value={selectedPaymentMethodId} onValueChange={setSelectedPaymentMethodId}>
                      {overview.paymentMethods.map((paymentMethod) => (
                        <label
                          key={paymentMethod.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-background p-4"
                        >
                          <RadioGroupItem value={paymentMethod.id} />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 font-medium">
                              <span>{formatCardLabel(paymentMethod)}</span>
                              {paymentMethod.isDefault ? <StatusBadge variant="info">Default</StatusBadge> : null}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Expires {String(paymentMethod.expMonth || "--").padStart(2, "0")}/{paymentMethod.expYear || "----"}
                            </p>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  No saved cards are available yet. Add one now to continue.
                </div>
              )}

              {useNewPaymentMethod ? (
                isPreparingSetupIntent ? (
                  <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Preparing a secure Stripe setup session.
                  </div>
                ) : setupIntentSecret ? (
                  <NewPaymentMethodForm
                    billingEmail={overview.workspace.billingEmail}
                    billingName={overview.workspace.billingName}
                    clientSecret={setupIntentSecret}
                    disabled={isSubmitting}
                    onConfirmed={async (paymentMethodId, stripeClient) => {
                      await finalizeDialogAction(paymentMethodId, stripeClient)
                    }}
                    submitLabel={dialogMode === "payment-method" ? "Save card as default" : "Save card and continue"}
                  />
                ) : (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">
                    A Stripe setup session could not be created. Check the Stripe frontend and backend environment keys.
                  </div>
                )
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={resetDialogState}>
              Cancel
            </Button>

            {(dialogMode === "subscribe" && selectedPlan?.isFree) || !useNewPaymentMethod ? (
              <Button
                disabled={
                  isSubmitting ||
                  (!selectedPlan?.isFree && !selectedPaymentMethodId && dialogMode !== "payment-method") ||
                  (dialogMode === "payment-method" && !selectedPaymentMethodId)
                }
                onClick={() => void finalizeDialogAction()}
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {dialogMode === "payment-method"
                  ? "Save default payment method"
                  : selectedPlan?.isFree
                    ? "Confirm plan change"
                    : "Confirm subscription"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}