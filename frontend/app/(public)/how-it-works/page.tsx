"use client"

import Link from "next/link"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  Building2,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  Layers,
  Package,
  Radio,
  Rocket,
  Shield,
  Sparkles,
  UserPlus,
  Users,
  UserSearch,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BRAND_NAME } from "@/lib/brand"
import { cn } from "@/lib/utils"

type TimelineStep = {
  title: string
  step: string
  icon: LucideIcon
  description: string
  accent: "pink" | "yellow" | "purple"
}

const timelineSteps: TimelineStep[] = [
  {
    step: "Step 1",
    title: "Create Your Seller Account",
    icon: UserPlus,
    accent: "purple",
    description:
      "Sign up in minutes with email or Google. Your workspace is ready instantly — no credit card required to explore.",
  },
  {
    step: "Step 2",
    title: "Open Launch Pad & Connect Platforms",
    icon: Rocket,
    accent: "pink",
    description:
      "Connect TikTok Shop and Whatnot from one place. Launch Pad is your hub to link accounts, verify access, and switch between marketplaces.",
  },
  {
    step: "Step 3",
    title: "Manage Inventory Across Channels",
    icon: Package,
    accent: "yellow",
    description:
      "Sync and manage products for TikTok and Whatnot. Track stock, variants, and listings so you never oversell during live shows.",
  },
  {
    step: "Step 4",
    title: "Handle Orders in One Dashboard",
    icon: ClipboardList,
    accent: "purple",
    description:
      "View orders, process fulfillments, and use order management tools built for live commerce — whether you sell on TikTok, Whatnot, or both.",
  },
  {
    step: "Step 5",
    title: "Hire Professional Moderators",
    icon: UserSearch,
    accent: "pink",
    description:
      "Browse the moderator marketplace, book verified mods for your streams, and keep chat safe while you focus on selling.",
  },
  {
    step: "Step 6",
    title: "Organize Your Team",
    icon: Building2,
    accent: "yellow",
    description:
      "Invite staff, assign roles, run payroll, and coordinate from Organization — built for sellers scaling with a team.",
  },
]

const platformHubs = [
  {
    name: "TikTok Shop",
    color: "border-pink-500/40 bg-pink-500/5",
    badge: "bg-pink-600 text-white",
    features: ["Inventory & orders", "Publish & fulfillment", "Analytics", "Live selling tools"],
  },
  {
    name: "Whatnot",
    color: "border-[#ffe414]/50 bg-[#ffe414]/10",
    badge: "bg-[#ffe414] text-black",
    features: ["Inventory & auctions", "Order management", "Whatnot Show", "Staff listings"],
  },
]

const benefits = [
  {
    icon: Layers,
    title: "One Hub, Two Platforms",
    description: "Run TikTok Shop and Whatnot without juggling separate tools.",
  },
  {
    icon: Zap,
    title: "Built for Live Selling",
    description: "Inventory, orders, and streams designed for how you actually sell live.",
  },
  {
    icon: Shield,
    title: "Safer Streams",
    description: "Professional moderators protect your community during high-traffic shows.",
  },
  {
    icon: Users,
    title: "Team-Ready",
    description: "Staff, roles, chat, and payroll when your business outgrows solo selling.",
  },
]

const accentStyles = {
  pink: {
    border: "border-pink-500/50",
    text: "text-pink-600 dark:text-pink-400",
    iconBg: "bg-pink-500/10",
    icon: "text-pink-600",
  },
  yellow: {
    border: "border-[#ffe414]/60",
    text: "text-amber-700 dark:text-yellow-400",
    iconBg: "bg-[#ffe414]/20",
    icon: "text-amber-700 dark:text-yellow-500",
  },
  purple: {
    border: "border-[#6d11e8]/40",
    text: "text-[#6d11e8]",
    iconBg: "bg-[#6d11e8]/10",
    icon: "text-[#6d11e8]",
  },
}

export default function HowItWorksPage() {
  const router = useRouter()
  const { isSignedIn } = useAuth()

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-background to-muted/30 py-20 md:py-28">
        <div className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-pink-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-[#ffe414]/15 blur-3xl" />

        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e53775]/30 bg-[#e53775]/5 px-4 py-2 text-sm font-medium text-[#e53775]">
              <Sparkles className="h-4 w-4" />
              How {BRAND_NAME} works
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              From Sign-Up to{" "}
              <span className="bg-gradient-to-r from-[#e53775] via-[#6d11e8] to-[#ffe414] bg-clip-text text-transparent">
                Live Commerce
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Connect TikTok Shop and Whatnot, manage inventory and orders, hire moderators, and
              organize your team — all in one platform built for live sellers.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="rounded-xl px-8"
                onClick={() => router.push("/signup")}
              >
                Create Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-xl"
                onClick={() => router.push(isSignedIn ? "/seller" : "/get-started")}
              >
                {isSignedIn ? "Open Launch Pad" : "Get Started"}
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                TikTok + Whatnot
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Inventory & orders
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Moderator marketplace
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section id="timeline" className="bg-[#fafafa] py-16 dark:bg-white/[0.02] md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Your workflow</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl md:text-5xl">
              Six Steps to Run Your{" "}
              <span className="text-[#6d11e8]">Marketplace</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Everything flows from account setup through Launch Pad, selling on both platforms,
              moderation, and team organization.
            </p>
          </div>

          <div className="relative mx-auto max-w-4xl">
            <div className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-0.5 -translate-x-1/2 bg-gradient-to-b from-pink-300 via-[#6d11e8] to-[#ffe414] sm:block" />

            <div className="space-y-10">
              {timelineSteps.map((step, index) => {
                const isRight = index % 2 === 0
                const Icon = step.icon
                const style = accentStyles[step.accent]

                return (
                  <div
                    key={step.title}
                    className={cn(
                      "relative flex",
                      isRight ? "justify-end" : "justify-start",
                    )}
                  >
                    <div className="absolute left-1/2 top-6 z-10 hidden h-5 w-5 -translate-x-1/2 rounded-full border-2 border-background bg-primary shadow sm:block">
                      <div className="m-auto mt-1 h-2 w-2 rounded-full bg-white" />
                    </div>

                    <div
                      className={cn(
                        "w-full rounded-2xl border bg-white p-5 shadow-sm dark:bg-card sm:w-[calc(50%-2rem)]",
                        style.border,
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl",
                            style.iconBg,
                          )}
                        >
                          <Icon className={cn("h-5 w-5", style.icon)} />
                        </div>
                        <span className={cn("text-xs font-bold uppercase tracking-wide", style.text)}>
                          {step.step}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* TikTok + Whatnot */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Sell on TikTok & Whatnot</h2>
            <p className="mt-3 text-muted-foreground">
              Switch hubs inside your dashboard — each platform gets the tools you need for inventory,
              orders, and live selling.
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            {platformHubs.map((platform) => (
              <Card key={platform.name} className={cn("overflow-hidden", platform.color)}>
                <CardHeader>
                  <span
                    className={cn(
                      "inline-flex w-fit rounded-md px-2.5 py-1 text-xs font-bold",
                      platform.badge,
                    )}
                  >
                    {platform.name}
                  </span>
                  <CardTitle className="text-xl">Dedicated seller tools</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {platform.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-muted/30 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Why sellers choose {BRAND_NAME}</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <Card key={benefit.title} className="border-border/60 bg-card/80">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <benefit.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Moderators */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Radio className="h-3.5 w-3.5" />
                Moderator marketplace
              </div>
              <h2 className="text-3xl font-bold md:text-4xl">Go live with backup</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                When chat moves fast, hire verified moderators from our marketplace. They handle
                spam, questions, and rule-breakers while you run the show and close sales.
              </p>
              <Button className="mt-6" variant="outline" asChild>
                <Link href="/moderators">
                  Browse moderators
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Real-time chat moderation",
                "Book by date & platform",
                "Verified moderator profiles",
                "Hired mods in your dashboard",
                "Team chat coordination",
                "Scale high-traffic streams",
              ].map((task) => (
                <div
                  key={task}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm"
                >
                  <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                  {task}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-[#ffe414]/40 bg-gradient-to-br from-[#fffbeb] via-[#fff9db] to-[#fef3c7] p-8 text-center md:p-14 dark:from-[#ffe414]/10 dark:via-[#ffe414]/5 dark:to-background">
            <h2 className="text-3xl font-bold md:text-4xl">Ready to get started?</h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Create your account, open Launch Pad, and connect TikTok Shop or Whatnot today.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="rounded-xl">
                <Link href="/signup">
                  Create Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="rounded-xl bg-white/80 dark:bg-card/80">
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
