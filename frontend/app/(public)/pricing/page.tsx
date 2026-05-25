"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { CheckCircle, ArrowRight, Star, Loader2 } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  billingIntervalLabel,
  formatPlanPrice,
  getPublicSubscriptionPlans,
  getVisibleSubscriptionPlans,
  isPlanPopular,
  type PublicSubscriptionPlan,
} from "@/lib/subscriptions"

const testimonials = [
  {
    quote:
      "Since switching to their moderation service, my streams have been so much smoother. I can actually engage with my audience instead of constantly watching the chat.",
    author: "Sarah M.",
    role: "TikTok Creator",
    platform: "tiktok",
    rating: 5,
  },
  {
    quote:
      "Best investment for my Whatnot business. My auctions run clean, buyers feel safe, and I've seen a 40% increase in repeat customers.",
    author: "Marcus J.",
    role: "Whatnot Seller",
    platform: "whatnot",
    rating: 5,
  },
  {
    quote:
      "The team is incredibly responsive. They caught a scammer within seconds during my biggest live sale ever. Absolute lifesavers!",
    author: "Emily R.",
    role: "Collectibles Dealer",
    platform: "whatnot",
    rating: 5,
  },
]

const faqs = [
  {
    question: "How does the subscription work?",
    answer:
      "When you subscribe, you get a set number of moderation hours per month. Book sessions through your dashboard and hours are deducted from your balance. Unused hours don't roll over, but you can always top up with pay-as-you-go if needed.",
  },
  {
    question: "What happens if I run out of subscription hours?",
    answer:
      "No problem! Any additional time beyond your subscription hours is automatically billed at our pay-as-you-go rate. You can also upgrade your plan at any time.",
  },
  {
    question: "Can I cancel my subscription?",
    answer:
      "Yes, you can cancel anytime. Your subscription will remain active until the end of your billing period, and you can use any remaining hours during that time.",
  },
  {
    question: "What's the minimum booking duration?",
    answer: "The minimum booking duration is 30 minutes. This applies to both pay-as-you-go and subscription bookings.",
  },
  {
    question: "How far in advance do I need to book?",
    answer:
      "Booking notice requirements depend on your plan. Enterprise users can book same-day, Pro users need 24-hour notice, and Starter users need 48-hour notice. Pay-as-you-go bookings require 48-hour notice.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "We offer full refunds for cancellations made at least 24 hours before the scheduled session. Cancellations within 24 hours may be subject to a cancellation fee.",
  },
]

function PlatformBadge({ platform }: { platform: "tiktok" | "whatnot" }) {
  if (platform === "tiktok") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold bg-pink-600 text-white">
        TikTok
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold bg-[#ffe414] text-black">
      Whatnot
    </span>
  )
}

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)
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
          setLoadError("Unable to load subscription plans. Please try again later.")
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

  const { hasBothIntervals, visiblePlans } = useMemo(
    () => getVisibleSubscriptionPlans(plans, isYearly),
    [plans, isYearly],
  )

  return (
    <div className="">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute right-1/4 top-1/2 h-[300px] w-[300px] rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Simple, Transparent{" "}
            <span className="bg-pink-600 dark:bg-pink-500 px-2 rounded-md text-white">Pricing</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Professional live stream moderation for TikTok and Whatnot sellers. Pay as you go or save with a subscription.
          </p>
        </div>
      </section>

      {/* Pay-As-You-Go */}
      {/* <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-md">
            <Card className="text-center gradient-card card-shine">
              <CardHeader>
                <CardTitle className="text-3xl font-bold tracking-tight">Pay-As-You-Go</CardTitle>
                <CardDescription className="text-base font-medium mt-2">No commitment, book when you need it</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <span className="text-6xl font-extrabold text-gradient-primary tracking-tight">${payAsYouGoRate}</span>
                  <span className="text-lg font-semibold text-muted-foreground ml-1">/hour</span>
                </div>
                <ul className="mb-6 space-y-3 text-left">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-base font-medium text-foreground">No subscription required</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-base font-medium text-foreground">{minimumMinutes}-minute minimum booking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="flex items-center gap-1.5 text-base font-medium text-foreground">
                      <PlatformBadge platform="whatnot" />
                      <span>&</span>
                      <PlatformBadge platform="tiktok" />
                      <span>support</span>
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-base font-medium text-foreground">48-hour booking notice</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full btn-gradient-hover" asChild>
                  <Link href="/get-started">Get Started</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section> */}

      {/* Subscription Plans */}
      <section className="mesh-gradient py-20">
        <div className="container mx-auto px-4">
      

          {hasBothIntervals && (
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <div className="flex items-center justify-center gap-3">
                <Label htmlFor="billing-toggle" className={!isYearly ? "font-semibold" : ""}>
                  Monthly
                </Label>
                <Switch id="billing-toggle" checked={isYearly} onCheckedChange={setIsYearly} />
                <Label htmlFor="billing-toggle" className={isYearly ? "font-semibold" : ""}>
                  Yearly
                </Label>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex min-h-[240px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && loadError && (
            <p className="text-center text-muted-foreground">{loadError}</p>
          )}

          {!isLoading && !loadError && visiblePlans.length === 0 && (
            <p className="text-center text-muted-foreground">No subscription plans are available right now.</p>
          )}

          {!isLoading && !loadError && visiblePlans.length > 0 && (
            <div
              className={`grid gap-6 ${
                visiblePlans.length === 1
                  ? "max-w-md mx-auto"
                  : visiblePlans.length === 2
                    ? "md:grid-cols-2 max-w-4xl mx-auto"
                    : "md:grid-cols-3"
              }`}
            >
              {visiblePlans.map((plan) => {
                const popular = isPlanPopular(plan, visiblePlans)
                const features = plan.features_json?.length ? plan.features_json : []
                const interval = billingIntervalLabel(plan.billing_interval)

                return (
                  <Card
                    key={plan._id}
                    className={`flex flex-col gradient-card card-shine ${popular ? "relative border-primary glow-primary" : ""}`}
                  >
                    {popular && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white border-0 font-semibold">
                        Most Popular
                      </Badge>
                    )}
                    <CardHeader>
                      <CardTitle className="text-2xl font-bold tracking-tight">{plan.name}</CardTitle>
                      <CardDescription className="text-base font-medium mt-1">
                        {plan.description || "Subscription plan"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="mb-6">
                        <span className="text-5xl font-extrabold text-gradient-primary tracking-tight">
                          {formatPlanPrice(plan.price, plan.currency)}
                        </span>
                        <span className="text-lg font-semibold text-muted-foreground ml-1">/{interval}</span>
                      </div>
                      {features.length > 0 ? (
                        <ul className="space-y-3">
                          {features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-base">
                              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                              <span className="font-medium text-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">Full platform access included.</p>
                      )}
                    </CardContent>
                    <CardFooter className="mt-auto">
                      <Button
                        className="w-full btn-gradient-hover"
                        variant={popular ? "default" : "outline"}
                        asChild
                      >
                        <Link href="/signup">
                          Get Started
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Comparison Table */}
      {!isLoading && !loadError && visiblePlans.length > 0 && (
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-5xl">
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white text-center mb-20">
                <span className="relative inline-block pb-2">
                  <span className="relative z-10">Compare Plans</span>
                  <span className="absolute bottom-0 left-0 w-1/2 h-1 bg-pink-500 rounded-full"></span>
                  <span className="absolute bottom-0 right-0 w-1/2 h-1 bg-[#ffe414] rounded-full"></span>
                </span>
              </h2>
              <div className="overflow-x-auto gradient-card card-shine rounded-xl p-4">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-4 font-semibold">Feature</th>
                      {visiblePlans.map((plan) => (
                        <th key={plan._id} className="pb-4 text-center font-semibold">
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-md">
                    <tr className="border-b">
                      <td className="py-4">Price</td>
                      {visiblePlans.map((plan) => (
                        <td key={plan._id} className="py-4 text-center">
                          {formatPlanPrice(plan.price, plan.currency)}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-4">Billing</td>
                      {visiblePlans.map((plan) => (
                        <td key={plan._id} className="py-4 text-center capitalize">
                          {billingIntervalLabel(plan.billing_interval)}
                        </td>
                      ))}
                    </tr>
                    {Array.from(
                      new Set(visiblePlans.flatMap((plan) => plan.features_json || [])),
                    ).map((feature) => (
                      <tr key={feature} className="border-b">
                        <td className="py-4">{feature}</td>
                        {visiblePlans.map((plan) => (
                          <td key={plan._id} className="py-4 text-center">
                            {(plan.features_json || []).includes(feature) ? (
                              <CheckCircle className="mx-auto h-4 w-4 text-primary" />
                            ) : (
                              "-"
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="section-gradient-light py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white flex flex-wrap items-center justify-center gap-3 text-center mb-20">
            Frequently Asked
            <span className="inline-flex items-center gap-2 bg-primary text-white px-4 py-1 rounded text-3xl md:text-5xl">
              Questions
            </span>
          </h2>
          <div className="mx-auto max-w-4xl">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left text-xl">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-xl">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-slate-50 dark:bg-muted/30 fade-bottom-mask">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 text-balance">
              Loved by Creators
            </h2>
            <p className="text-muted-foreground text-lg md:text-xl">
              Join thousands of streamers who trust us to keep their communities safe.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="flex flex-col p-6 md:p-8 rounded-2xl bg-card border border-border shadow-sm">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                <blockquote className="flex-1 text-foreground leading-relaxed mb-6">&ldquo;{testimonial.quote}&rdquo;</blockquote>

                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      testimonial.platform === "tiktok"
                        ? "bg-pink-100 text-pink-600 dark:bg-pink-950/50 dark:text-pink-400"
                        : "bg-[#ffe414]/20 text-yellow-700 dark:bg-[#ffe414]/10 dark:text-yellow-500"
                    }`}
                  >
                    {testimonial.author.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl bg-primary p-8 text-center text-white md:p-12 glow-primary">
            <div className="absolute inset-0 opacity-10">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
              />
            </div>

            <div className="relative">
              <h2 className="mb-4 text-3xl md:text-3xl lg:text-4xl font-bold text-white mb-4 text-balance">Still Have Questions?</h2>
              <p className="mb-8 text-white/80">
                Our team is here to help you find the perfect plan for your streaming needs.
              </p>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/contact">Contact Sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
