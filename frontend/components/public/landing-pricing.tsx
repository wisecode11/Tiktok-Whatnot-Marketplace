"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Check, Loader2, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  billingIntervalLabel,
  formatPlanPrice,
  getPublicSubscriptionPlans,
  getVisibleSubscriptionPlans,
  isPlanPopular,
  type PublicSubscriptionPlan,
} from "@/lib/subscriptions"
import { cn } from "@/lib/utils"

export function LandingPricingSection() {
  const [yearly, setYearly] = useState(false)
  const [plans, setPlans] = useState<PublicSubscriptionPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPlans() {
      try {
        const data = await getPublicSubscriptionPlans()
        if (!cancelled) {
          setPlans(data)
          setLoadError(null)
        }
      } catch {
        if (!cancelled) {
          setLoadError("Unable to load plans right now.")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadPlans()
    return () => {
      cancelled = true
    }
  }, [])

  const { hasBothIntervals, visiblePlans } = getVisibleSubscriptionPlans(plans, yearly)

  return (
    <section id="pricing" className="bg-muted/40 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Simple, <span className="text-primary">Transparent</span> Pricing
          </h2>
          <p className="mt-4 text-muted-foreground">
            Choose the perfect plan for your business.
          </p>
          {hasBothIntervals && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <span
                className={cn(
                  "text-sm font-medium",
                  !yearly ? "text-foreground" : "text-muted-foreground",
                )}
              >
                Monthly
              </span>
              <Switch checked={yearly} onCheckedChange={setYearly} />
              <span
                className={cn(
                  "text-sm font-medium",
                  yearly ? "text-foreground" : "text-muted-foreground",
                )}
              >
                Yearly
              </span>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="mt-14 flex min-h-[280px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && loadError && (
          <p className="mt-14 text-center text-muted-foreground">{loadError}</p>
        )}

        {!isLoading && !loadError && visiblePlans.length === 0 && (
          <p className="mt-14 text-center text-muted-foreground">No plans available at the moment.</p>
        )}

        {!isLoading && !loadError && visiblePlans.length > 0 && (
          <div
            className={cn(
              "mt-14 grid gap-6",
              visiblePlans.length === 1
                ? "max-w-md mx-auto"
                : visiblePlans.length === 2
                  ? "lg:grid-cols-2 max-w-4xl mx-auto"
                  : "lg:grid-cols-3",
            )}
          >
            {visiblePlans.map((plan) => {
              const popular = isPlanPopular(plan, visiblePlans)
              const features = plan.features_json?.length ? plan.features_json : []
              const interval = billingIntervalLabel(plan.billing_interval)

              return (
                <div
                  key={plan._id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-card p-8 shadow-sm",
                    popular
                      ? "border-primary/40 shadow-md shadow-primary/10"
                      : "border-border",
                  )}
                >
                  {popular && (
                    <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      <Star className="h-3 w-3 fill-current" />
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.description || "Subscription plan"}
                  </p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      {formatPlanPrice(plan.price, plan.currency)}
                    </span>
                    <span className="text-muted-foreground">/{interval}</span>
                  </div>
                  <Button
                    asChild
                    className={cn("mt-6 w-full rounded-xl", !popular && "bg-card")}
                    variant={popular ? "default" : "outline"}
                  >
                    <Link href="/signup">
                      {popular ? "Start Free Trial" : "Get Started"}
                    </Link>
                  </Button>
                  {features.length > 0 ? (
                    <ul className="mt-8 flex flex-1 flex-col gap-3">
                      {features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-3 text-sm text-muted-foreground"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                            <Check className="h-3 w-3 text-primary" />
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

        {!isLoading && !loadError && visiblePlans.length > 0 && (
          <p className="mt-10 text-center">
            <Link href="/pricing" className="text-sm font-medium text-primary hover:underline">
              View full pricing details
            </Link>
          </p>
        )}
      </div>
    </section>
  )
}
