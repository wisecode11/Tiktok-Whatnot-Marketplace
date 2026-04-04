import { AuthApiError } from "@/lib/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

export interface BillingPlan {
  id: string
  name: string
  description: string
  price: number
  currency: string
  billingInterval: string
  features: string[]
  stripePriceId: string | null
  isFree: boolean
}

export interface BillingPaymentMethod {
  id: string
  brand: string
  last4?: string
  expMonth?: number
  expYear?: number
  funding?: string
  isDefault: boolean
}

export interface BillingInvoice {
  id: string
  stripeInvoiceId: string
  amountDueCents: number
  amountPaidCents: number
  currency: string
  status: string
  hostedInvoiceUrl: string | null
  invoicePdfUrl: string | null
  createdAt: string | null
}

export interface BillingWorkspace {
  id: string
  businessName: string
  billingEmail: string
  billingName: string
  stripeCustomerId: string | null
}

export interface BillingSubscription {
  id: string
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  latestPaymentStatus: string | null
  stripeSubscriptionId: string | null
  plan: BillingPlan | null
}

export interface BillingOverviewResponse {
  workspace: BillingWorkspace
  plans: BillingPlan[]
  currentSubscription: BillingSubscription | null
  paymentMethods: BillingPaymentMethod[]
  defaultPaymentMethodId: string | null
  invoices: BillingInvoice[]
}

export interface SetupIntentResponse {
  clientSecret: string
  customerId: string
}

export interface SubscriptionMutationResponse {
  paymentIntentClientSecret: string | null
  paymentIntentStatus: string | null
  requiresAction: boolean
  overview: BillingOverviewResponse
}

async function request<T>(
  path: string,
  {
    token,
    method = "GET",
    body,
  }: {
    token: string
    method?: "GET" | "POST" | "DELETE"
    body?: Record<string, unknown>
  },
) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new AuthApiError(
      (payload && (payload.error as string)) || "Request failed.",
      response.status,
      payload && payload.details,
    )
  }

  return payload as T
}

export function getSellerBillingOverview(token: string) {
  return request<BillingOverviewResponse>("/api/billing/subscription", { token })
}

export function createSellerSetupIntent(token: string) {
  return request<SetupIntentResponse>("/api/billing/setup-intent", {
    token,
    method: "POST",
  })
}

export function updateSellerDefaultPaymentMethod(
  token: string,
  paymentMethodId: string,
) {
  return request<BillingOverviewResponse>("/api/billing/payment-methods/default", {
    token,
    method: "POST",
    body: { paymentMethodId },
  })
}

export function deleteSellerPaymentMethod(token: string, paymentMethodId: string) {
  return request<BillingOverviewResponse>(`/api/billing/payment-methods/${paymentMethodId}`, {
    token,
    method: "DELETE",
  })
}

export function changeSellerSubscription(
  token: string,
  {
    planId,
    paymentMethodId,
  }: {
    planId: string
    paymentMethodId?: string
  },
) {
  return request<SubscriptionMutationResponse>("/api/billing/subscriptions", {
    token,
    method: "POST",
    body: {
      planId,
      ...(paymentMethodId ? { paymentMethodId } : {}),
    },
  })
}