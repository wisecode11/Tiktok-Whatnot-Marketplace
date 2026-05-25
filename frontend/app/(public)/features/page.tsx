import Link from "next/link"
import { FeaturesHeroRain } from "@/components/public/features-hero-rain"
import type { LucideIcon } from "lucide-react"
import { BRAND_NAME } from "@/lib/brand"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  BarChart3,
  Brain,
  Calendar,
  CreditCard,
  Globe,
  Headphones,
  MessageSquare,
  Package,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Video,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

type FeatureItem = {
  icon: LucideIcon
  iconBg: string
  title: string
  description: string
  highlighted?: boolean
}

type FeatureCategory = {
  title: string
  description: string
  badge: string
  accentText: string
  sectionGlow: string
  sectionBg?: string
  features: FeatureItem[]
}

const softWhiteSectionBg = "bg-[#fafafa] dark:bg-white/[0.04]"

const featureCategories: FeatureCategory[] = [
  {
    title: "Analytics & Insights",
    description: "Data-driven decisions for your streaming business",
    badge: "Analytics",
    accentText: "text-emerald-600 dark:text-emerald-400",
    sectionGlow: "from-emerald-500/8 via-transparent to-transparent",
    sectionBg: softWhiteSectionBg,
    features: [
      {
        icon: BarChart3,
        iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500",
        title: "Real-Time Dashboard",
        description:
          "Monitor views, engagement, and sales as they happen. Get instant insights into your stream performance.",
        highlighted: true,
      },
      {
        icon: TrendingUp,
        iconBg: "bg-gradient-to-br from-cyan-400 to-blue-500",
        title: "Performance Trends",
        description:
          "Track growth over time with historical data analysis. Identify patterns and optimize your strategy.",
      },
      {
        icon: Video,
        iconBg: "bg-gradient-to-br from-sky-400 to-indigo-500",
        title: "Stream Analytics",
        description:
          "Deep dive into each stream with detailed metrics. See peak viewers, engagement rates, and conversion data.",
      },
    ],
  },
  {
    title: "Team & Moderation",
    description: "Build and manage your streaming team",
    badge: "Team",
    accentText: "text-blue-600 dark:text-blue-400",
    sectionGlow: "from-blue-500/8 via-transparent to-transparent",
    sectionBg: softWhiteSectionBg,
    features: [
      {
        icon: Users,
        iconBg: "bg-gradient-to-br from-blue-400 to-indigo-500",
        title: "Moderator Marketplace",
        description:
          "Find and hire verified professional moderators. Filter by skills, availability, and ratings.",
        highlighted: true,
      },
      {
        icon: MessageSquare,
        iconBg: "bg-gradient-to-br from-violet-400 to-purple-500",
        title: "Team Chat",
        description:
          "Built-in communication tools for your team. Coordinate during streams in real-time.",
      },
      {
        icon: Shield,
        iconBg: "bg-gradient-to-br from-slate-500 to-slate-700",
        title: "Role-Based Access",
        description:
          "Control who can access what. Set permissions for team members based on their role.",
      },
    ],
  },
  {
    title: "Commerce & Inventory",
    description: "Manage your products and sales",
    badge: "Commerce",
    accentText: "text-amber-600 dark:text-amber-400",
    sectionGlow: "from-amber-500/8 via-transparent to-transparent",
    sectionBg: softWhiteSectionBg,
    features: [
      {
        icon: Package,
        iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
        title: "Inventory Management",
        description:
          "Track stock levels, manage variants, and sync across platforms automatically.",
        highlighted: true,
      },
      {
        icon: CreditCard,
        iconBg: "bg-gradient-to-br from-rose-400 to-pink-500",
        title: "Payment Processing",
        description:
          "Secure transactions with fraud protection. Multiple payment methods supported.",
      },
      {
        icon: Globe,
        iconBg: "bg-gradient-to-br from-teal-400 to-emerald-500",
        title: "Multi-Platform Sync",
        description:
          "Connect TikTok Shop, Whatnot, and more. Unified inventory across all channels.",
      },
    ],
  },
  {
    title: "AI & Automation",
    description: "Work smarter with intelligent tools",
    badge: "AI",
    accentText: "text-violet-600 dark:text-violet-400",
    sectionGlow: "from-violet-500/8 via-transparent to-transparent",
    sectionBg: softWhiteSectionBg,
    features: [
      {
        icon: Brain,
        iconBg: "bg-gradient-to-br from-violet-500 to-purple-600",
        title: "AI Content Assistant",
        description:
          "Generate product descriptions, stream titles, and engaging captions automatically.",
        highlighted: true,
      },
      {
        icon: Calendar,
        iconBg: "bg-gradient-to-br from-fuchsia-400 to-pink-500",
        title: "Smart Scheduling",
        description:
          "AI-powered recommendations for optimal streaming times based on your audience.",
      },
      {
        icon: Headphones,
        iconBg: "bg-gradient-to-br from-indigo-400 to-blue-600",
        title: "Automated Support",
        description:
          "Handle common customer inquiries automatically. Focus on what matters most.",
      },
    ],
  },
]

function FeatureIcon({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <div
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md shadow-black/10 transition-transform duration-300 group-hover:scale-110",
        className,
      )}
    >
      <Icon className="h-6 w-6" />
    </div>
  )
}

function FeatureCard({ feature }: { feature: FeatureItem }) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card/80 p-6 backdrop-blur-sm transition-all duration-300",
        "hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5",
        feature.highlighted
          ? "border-primary/25 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-md shadow-primary/5"
          : "border-border/60",
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-0" />

      <FeatureIcon icon={feature.icon} className={feature.iconBg} />

      <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">{feature.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>

      <div className="mt-5 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        Learn more
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </article>
  )
}

export default function FeaturesPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <FeaturesHeroRain />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge
              variant="secondary"
              className="mb-6 gap-1.5 rounded-full border border-[#e53775]/25 bg-white/80 px-4 py-1.5 text-sm font-medium text-[#e53775] backdrop-blur-sm dark:bg-card/80"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Built for live sellers
            </Badge>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Powerful Features for{" "}
              <span className="bg-gradient-to-r from-[#e53775] via-[#6d11e8] to-[#ffe414] bg-clip-text text-transparent">
                Live Commerce
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Everything you need to run and scale your streaming business — analytics, team tools,
              inventory, and AI — all in one platform.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="gap-2 rounded-xl px-8 shadow-lg shadow-primary/20">
                <Link href="/get-started">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="rounded-xl">
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>

            <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Platforms", value: "TikTok + Whatnot" },
                { label: "Tools", value: "20+ features" },
                { label: "Support", value: "24/7 help" },
                { label: "Setup", value: "Same day" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border/60 bg-white/75 px-4 py-3 shadow-sm backdrop-blur-md dark:bg-card/75"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature categories */}
      {featureCategories.map((category, categoryIndex) => (
        <section
          key={category.title}
          className={cn(
            "relative overflow-hidden py-20 md:py-24",
            category.sectionBg ??
              (categoryIndex % 2 === 1 ? "bg-muted/40" : "bg-background"),
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 w-2/3 bg-gradient-to-r opacity-40",
              category.sectionBg && "opacity-25",
              categoryIndex % 2 === 0 ? "left-0" : "right-0 bg-gradient-to-l",
              category.sectionGlow,
            )}
          />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 flex flex-col gap-4 md:mb-16 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <Badge variant="outline" className={cn("mb-4 font-semibold", category.accentText)}>
                  {category.badge}
                </Badge>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">{category.title}</h2>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground md:text-lg">
                  {category.description}
                </p>
              </div>
              <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
                <Zap className="h-4 w-4 text-primary" />
                {category.features.length} powerful tools
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {category.features.map((feature) => (
                <FeatureCard key={feature.title} feature={feature} />
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-[#ffe414]/40 bg-gradient-to-br from-[#fffbeb] via-[#fff9db] to-[#fef3c7] p-8 text-center md:p-16 dark:from-[#ffe414]/10 dark:via-[#ffe414]/5 dark:to-background">
            <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#ffe414]/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-[#fde047]/20 blur-3xl" />

            <div className="relative">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to Get Started?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Join thousands of streamers who are already using {BRAND_NAME} to grow their live
                commerce business.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button size="lg" asChild className="gap-2 rounded-xl shadow-lg shadow-primary/20">
                  <Link href="/get-started">
                    Start Free Trial
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="rounded-xl bg-background/80">
                  <Link href="/pricing">View Pricing</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
