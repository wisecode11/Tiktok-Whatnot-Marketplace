const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

export interface PublicSubscriptionPlan {
  _id: string
  name: string
  description: string
  price: number
  currency: string
  billing_interval: string
  features_json: string[]
  display_order: number
  is_active: boolean
  metadata_json?: Record<string, unknown> | null
}

export interface PublicSubscriptionPlansResponse {
  plans: PublicSubscriptionPlan[]
}

export async function getPublicSubscriptionPlans(): Promise<PublicSubscriptionPlan[]> {
  const response = await fetch(`${API_BASE_URL}/api/subscriptions/plans`, {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("Failed to load subscription plans.")
  }

  const data = (await response.json()) as PublicSubscriptionPlansResponse
  return Array.isArray(data.plans) ? data.plans : []
}

export function formatPlanPrice(amount: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function billingIntervalLabel(interval: string) {
  if (interval === "year") return "year"
  if (interval === "month") return "month"
  return interval
}

export function getVisibleSubscriptionPlans(plans: PublicSubscriptionPlan[], isYearly: boolean) {
  const monthlyPlans = plans.filter((plan) => plan.billing_interval === "month")
  const yearlyPlans = plans.filter((plan) => plan.billing_interval === "year")
  const hasBothIntervals = monthlyPlans.length > 0 && yearlyPlans.length > 0
  const visiblePlans = hasBothIntervals ? (isYearly ? yearlyPlans : monthlyPlans) : plans

  return { monthlyPlans, yearlyPlans, hasBothIntervals, visiblePlans }
}

export function isPlanPopular(plan: PublicSubscriptionPlan, visiblePlans: PublicSubscriptionPlan[]) {
  const flagged = plan.metadata_json && plan.metadata_json.is_popular === true
  if (flagged) return true
  if (visiblePlans.length < 2) return false
  const middleIndex = Math.floor(visiblePlans.length / 2)
  return visiblePlans[middleIndex]?._id === plan._id
}
