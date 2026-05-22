"use client"

import Link from "next/link"
import { useState } from "react"
import { Check, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

const plans = [
  {
    name: "Starter",
    description: "Perfect for getting started with live commerce",
    monthly: 29,
    yearly: 23,
    features: [
      "1 connected platform",
      "Basic analytics",
      "Up to 500 products",
      "Email support",
      "Standard payouts",
    ],
    highlighted: false,
  },
  {
    name: "Professional",
    description: "For growing sellers ready to scale",
    monthly: 79,
    yearly: 63,
    features: [
      "3 connected platforms",
      "Advanced analytics",
      "Unlimited products",
      "Priority support",
      "AI tools included",
      "Team collaboration (5 members)",
      "Weekly payouts",
      "Moderator marketplace access",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    description: "For large teams and high-volume sellers",
    monthly: 199,
    yearly: 159,
    features: [
      "Unlimited platforms",
      "Custom analytics & reports",
      "Unlimited products",
      "Dedicated account manager",
      "Advanced AI suite",
      "Unlimited team members",
      "Daily payouts",
      "White-label options",
      "API access",
      "QuickBooks integration",
    ],
    highlighted: false,
  },
]

export function LandingPricingSection() {
  const [yearly, setYearly] = useState(false)

  return (
    <section id="pricing" className="bg-muted/40 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Simple, <span className="text-primary">Transparent</span> Pricing
          </h2>
          <p className="mt-4 text-muted-foreground">
            Choose the perfect plan for your business. All plans include a
            14-day free trial.
          </p>
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
            <span className="text-sm text-primary">Save 20%</span>
          </div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const price = yearly ? plan.yearly : plan.monthly
            return (
              <div
                key={plan.name}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-8 shadow-sm",
                  plan.highlighted
                    ? "border-primary/40 shadow-md shadow-primary/10"
                    : "border-border",
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    <Star className="h-3 w-3 fill-current" />
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.description}
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">
                    ${price}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <Button
                  asChild
                  className={cn("mt-6 w-full rounded-xl", !plan.highlighted && "bg-card")}
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  <Link href="/get-started">
                    {plan.highlighted ? "Start Free Trial" : "Get Started"}
                  </Link>
                </Button>
                <ul className="mt-8 flex flex-1 flex-col gap-3">
                  {plan.features.map((feature) => (
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
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
