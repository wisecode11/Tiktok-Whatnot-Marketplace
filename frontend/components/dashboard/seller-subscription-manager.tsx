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
  Zap,
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
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/ui/status-badge"
import { useToast } from "@/hooks/use-toast"
import { waitForSessionToken } from "@/lib/auth"
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

function LoadingState() {
  return (
    <div className="space-y-6">
      <PageHeader title="Subscription" description="Manage your subscription and billing" />
      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  )
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

  const subscriptionPlan = overview?.plans[0] || null
  const currentPlanId = overview?.currentSubscription?.plan?.id || null
  const hasActiveSubscription = Boolean(
    overview?.currentSubscription?.plan?.id &&
      ["active", "trialing", "past_due", "incomplete"].includes(
        overview.currentSubscription.status,
      ),
  )

  const sortedPlans = useMemo(() => overview?.plans || [], [overview?.plans])

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
          ? `Your workspace has been moved to ${selectedPlan.name}.`
          : `${selectedPlan.name} is now the active billing plan for this workspace.`,
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
    return <LoadingState />
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

  if (!subscriptionPlan) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Subscription"
          description="Manage live Stripe-backed subscriptions, saved cards, and invoice history for your seller workspace."
        />
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle>No active subscription plan is configured</CardTitle>
            <CardDescription>
              The `$300/month` seller plan was not found in Stripe sync results. Run the backend seed and sync again.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription"
        description="Manage live Stripe-backed subscriptions, saved cards, and invoice history for your seller workspace."
      >
        <Button variant="outline" onClick={() => void loadOverview(false)} disabled={isRefreshing}>
          {isRefreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          Refresh
        </Button>
      </PageHeader>

      {errorMessage ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start justify-between gap-4 py-4">
            <div>
              <p className="font-medium">Billing sync needs attention</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadOverview(false)}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Zap className="size-5 text-primary" />
                  {currentSubscription?.plan?.name || "No active subscription"}
                </CardTitle>
                <CardDescription>
                  Billing for {overview.workspace.businessName}. Renewals and invoices are synchronized from Stripe.
                </CardDescription>
              </div>
              <StatusBadge variant={getSubscriptionVariant(currentSubscription?.status)} dot pulse>
                {toTitleCase(currentSubscription?.status || "free")}
              </StatusBadge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <div className="text-3xl font-bold">
                  {currentSubscription?.plan
                    ? formatMoney(
                        currentSubscription.plan.price || 0,
                        currentSubscription.plan.currency || "usd",
                      )
                    : "Not subscribed"}
                  {currentSubscription?.plan ? (
                    <span className="ml-1 text-lg font-normal text-muted-foreground">
                      /{currentSubscription.plan.billingInterval || "month"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {currentSubscription?.currentPeriodEnd
                    ? `Next billing date: ${formatDate(currentSubscription.currentPeriodEnd)}`
                    : "No active Stripe subscription has been created yet."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={openPaymentMethodDialog}>
                  <CreditCard className="size-4" />
                  Manage payment method
                </Button>
                {overview.invoices[0]?.hostedInvoiceUrl ? (
                  <Button asChild variant="outline">
                    <Link href={overview.invoices[0].hostedInvoiceUrl} target="_blank">
                      <Receipt className="size-4" />
                      Latest invoice
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-4">
              <div>
                <p className="text-sm font-medium">Billing contact</p>
                <p className="text-sm text-muted-foreground">{overview.workspace.billingName}</p>
                <p className="text-sm text-muted-foreground">{overview.workspace.billingEmail}</p>
              </div>

              <div>
                <p className="text-sm font-medium">Payment status</p>
                <p className="text-sm text-muted-foreground">
                  {toTitleCase(currentSubscription?.latestPaymentStatus || "No pending payment")}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium">Stripe customer</p>
                <p className="truncate text-sm text-muted-foreground">
                  {overview.workspace.stripeCustomerId || "Created when the first paid billing action runs."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="size-5" />
              Saved payment methods
            </CardTitle>
            <CardDescription>
              Cards are stored in Stripe and available for subscription renewals and plan changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.paymentMethods.length ? (
              overview.paymentMethods.map((paymentMethod) => (
                <div
                  key={paymentMethod.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-medium">
                      <span>{formatCardLabel(paymentMethod)}</span>
                      {paymentMethod.isDefault ? <StatusBadge variant="info">Default</StatusBadge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Expires {String(paymentMethod.expMonth || "--").padStart(2, "0")}/{paymentMethod.expYear || "----"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={openPaymentMethodDialog}>
                      Update
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleDeletePaymentMethod(paymentMethod.id)}
                      disabled={deletingPaymentMethodId === paymentMethod.id}
                    >
                      {deletingPaymentMethodId === paymentMethod.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                No card is saved yet. Add one during checkout or from the payment method manager.
              </div>
            )}

            {!stripePublishableKey ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">
                Add-card checkout requires NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in the frontend environment.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Subscription plan</h2>
        <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          {currentPlanId === subscriptionPlan.id && hasActiveSubscription ? (
            <div className="absolute right-4 top-4">
              <StatusBadge variant="info">Current</StatusBadge>
            </div>
          ) : null}
          <CardHeader className="pb-4">
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold">{subscriptionPlan.name}</h3>
              <p className="text-sm text-muted-foreground">
                {subscriptionPlan.description || "Single Stripe-managed seller subscription plan."}
              </p>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-5xl font-bold">
                {formatMoney(subscriptionPlan.price, subscriptionPlan.currency)}
              </span>
              <span className="text-muted-foreground">/{subscriptionPlan.billingInterval}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-3">
              {subscriptionPlan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
              Clicking choose plan opens Stripe card entry. After card confirmation, Stripe creates the customer,
              subscription, invoice, and payment transaction in real time.
            </div>
          </CardContent>
          <CardFooter>
            {currentPlanId === subscriptionPlan.id && hasActiveSubscription ? (
              <Button className="w-full" variant="outline" disabled>
                Current subscription
              </Button>
            ) : (
              <Button className="w-full" onClick={() => openPlanDialog(subscriptionPlan)}>
                Choose plan
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="size-5" />
            Invoice history
          </CardTitle>
          <CardDescription>Invoice state is synchronized from Stripe webhooks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.invoices.length ? (
            overview.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <span>{formatAmountFromCents(invoice.amountPaidCents || invoice.amountDueCents, invoice.currency)}</span>
                    <StatusBadge variant={getSubscriptionVariant(invoice.status)}>{toTitleCase(invoice.status)}</StatusBadge>
                  </div>
                  <p className="text-sm text-muted-foreground">Issued {formatDate(invoice.createdAt)}</p>
                </div>

                <div className="flex gap-2">
                  {invoice.hostedInvoiceUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={invoice.hostedInvoiceUrl} target="_blank">
                        View hosted invoice
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                  ) : null}
                  {invoice.invoicePdfUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={invoice.invoicePdfUrl} target="_blank">
                        PDF
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
              No invoices have been generated yet.
            </div>
          )}
        </CardContent>
      </Card>

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