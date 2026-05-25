import Image from "next/image"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  BarChart3,
  Bot,
  Box,
  Calendar,
  CheckCircle,
  CreditCard,
  DollarSign,
  FileText,
  Headphones,
  ImageIcon,
  Layers,
  LineChart,
  Medal,
  Package,
  Play,
  Send,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from "lucide-react"

import whyChooseImage from "./images/three.png"
import firefly from "./images/firefly.png"
import { AnalyticsSalesChart } from "@/components/public/analytics-sales-chart"
import { LandingConfidenceCta } from "@/components/public/landing-confidence-cta"
import { LandingPricingSection } from "@/components/public/landing-pricing"
import { PartnerLogos } from "@/components/public/partner-logos"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const heroStats = [
  {
    value: "$12,450",
    label: "Revenue Today",
    icon: DollarSign,
    iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500",
  },
  {
    value: "234",
    label: "Orders Pending",
    icon: Package,
    iconBg: "bg-gradient-to-br from-blue-400 to-blue-600",
  },
  {
    value: "$248K",
    label: "GMV This Month",
    icon: TrendingUp,
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-600",
  },
  {
    value: "1,847",
    label: "Live Viewers",
    icon: Users,
    iconBg: "bg-gradient-to-br from-orange-400 to-amber-500",
  },
]

const features = [
  {
    title: "Advanced Analytics",
    description:
      "Track stream performance, engagement, and revenue in real time with dashboards built for live sellers.",
    icon: BarChart3,
    iconBg: "bg-gradient-to-br from-blue-500 to-blue-600",
    tag: "Insights",
    gridClass: "lg:col-span-3 lg:row-span-2 lg:col-start-1 lg:row-start-1",
    featured: true,
  },
  {
    title: "Moderator Marketplace",
    description: "Hire verified moderators by skills, ratings, and availability.",
    icon: Users,
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-600",
    tag: "Team",
    gridClass: "lg:col-start-4 lg:row-start-1",
    compact: true,
    featured: false,
  },
  {
    title: "Smart Scheduling",
    description: "Plan streams across TikTok, Whatnot, and more.",
    icon: Calendar,
    iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500",
    tag: "Planning",
    gridClass: "lg:col-start-5 lg:row-start-1",
    compact: true,
    featured: false,
  },
  {
    title: "AI-Powered Tools",
    description: "Generate listings, spot trends, and optimize with AI.",
    icon: Sparkles,
    iconBg: "bg-gradient-to-br from-sky-400 to-blue-500",
    tag: "AI",
    gridClass: "lg:col-span-2 lg:col-start-4 lg:row-start-2",
    compact: true,
    featured: false,
  },
  {
    title: "Secure Payments",
    description: "Checkout with fraud protection and fast payouts.",
    icon: CreditCard,
    iconBg: "bg-gradient-to-br from-orange-400 to-orange-500",
    tag: "Payments",
    gridClass: "lg:col-start-1 lg:row-start-3",
    compact: true,
    featured: false,
  },
  {
    title: "Multi-Platform Support",
    description: "TikTok Shop, Whatnot, and more in one hub.",
    icon: Layers,
    iconBg: "bg-gradient-to-br from-pink-400 to-rose-500",
    tag: "Channels",
    gridClass: "lg:col-start-2 lg:row-start-3",
    compact: true,
    featured: false,
  },
  {
    title: "Inventory Management",
    description: "Sync stock in real time — never oversell on live.",
    icon: Box,
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-600",
    tag: "Inventory",
    gridClass: "lg:col-start-3 lg:row-start-3",
    compact: true,
    featured: false,
  },
  {
    title: "Finance & Payroll",
    description: "Expenses, staff pay, and QuickBooks in one place.",
    icon: Wallet,
    iconBg: "bg-gradient-to-br from-teal-400 to-cyan-500",
    tag: "Finance",
    gridClass: "lg:col-start-4 lg:row-start-3",
    compact: true,
    featured: false,
  },
  {
    title: "Team Collaboration",
    description: "Roles, invites, and live-session coordination.",
    icon: UserPlus,
    iconBg: "bg-gradient-to-br from-orange-400 to-amber-500",
    tag: "Collaboration",
    gridClass: "lg:col-start-5 lg:row-start-3",
    compact: true,
    featured: false,
  },
] as const

const steps = [
  {
    step: "01",
    title: "Create Your Account",
    description:
      "Sign up for free and connect your streaming platforms. No credit card required.",
    icon: UserPlus,
    iconBg: "bg-gradient-to-br from-blue-500 to-sky-400",
  },
  {
    step: "02",
    title: "Set Up Your Dashboard",
    description:
      "Configure your products, team, and preferences. Import existing inventory easily.",
    icon: Zap,
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-400",
  },
  {
    step: "03",
    title: "Hire Moderators",
    description:
      "Browse our verified marketplace and hire professional moderators for your streams.",
    icon: Users,
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-400",
  },
  {
    step: "04",
    title: "Start Streaming",
    description:
      "Go live with confidence. Track analytics, manage orders, and grow your audience.",
    icon: Sparkles,
    iconBg: "bg-gradient-to-br from-orange-500 to-yellow-400",
  },
]

const whyChooseFeatures = [
  "Sync products, track orders, and analyze stream",
  "Manage live auctions, inventory, and payouts automatically",
  "Connect payroll, expenses, and accounting with zero manual entry",
  "See revenue, orders, and growth metrics across ALL platforms",
]

const aiFeatures = [
  {
    title: "AI Thumbnail Generation",
    description:
      "Create eye-catching thumbnails that drive clicks and engagement.",
    icon: ImageIcon,
    iconBg: "bg-gradient-to-br from-pink-500 to-rose-500",
  },
  {
    title: "Trend Analysis",
    description:
      "Get AI-powered insights on trending products and optimal stream times.",
    icon: LineChart,
    iconBg: "bg-gradient-to-br from-sky-400 to-blue-500",
  },
  {
    title: "Smart Descriptions",
    description:
      "Generate compelling product descriptions that convert viewers to buyers.",
    icon: FileText,
    iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
  },
  {
    title: "AI Assistant",
    description:
      "Your personal business advisor, available 24/7 to answer questions.",
    icon: Bot,
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-600",
  },
]

const testimonials = [
  {
    badge: "+300% Revenue",
    badgeClass: "bg-gradient-to-r from-emerald-400 to-green-500",
    quote:
      "Marketplace Hub transformed my business. I went from managing spreadsheets to a unified dashboard that handles everything. My revenue increased 300% in 6 months.",
    author: "Sarah Chen",
    role: "TikTok Shop Seller",
    avatar: "SC",
    avatarBg: "bg-gradient-to-br from-rose-400 to-pink-500",
  },
  {
    badge: "10K+ Followers",
    badgeClass: "bg-gradient-to-r from-sky-400 to-blue-600",
    quote:
      "The moderator marketplace is a game-changer. Finding reliable mods used to take days. Now I can hire verified professionals in minutes.",
    author: "Marcus Johnson",
    role: "Whatnot Streamer",
    avatar: "MJ",
    avatarBg: "bg-gradient-to-br from-blue-400 to-indigo-500",
  },
  {
    badge: "Zero Oversells",
    badgeClass: "bg-gradient-to-r from-violet-400 to-purple-600",
    quote:
      "Managing inventory across TikTok Shop and Whatnot was a nightmare before. Now everything syncs automatically. I haven't had an oversell in months.",
    author: "Emily Rodriguez",
    role: "Multi-Platform Seller",
    avatar: "ER",
    avatarBg: "bg-gradient-to-br from-amber-400 to-orange-500",
  },
]

const benefits = [
  {
    title: "99.9% Uptime Guarantee",
    description:
      "Enterprise-grade infrastructure ensures your business never misses a beat.",
    icon: Shield,
    iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500",
  },
  {
    title: "24/7 Priority Support",
    description:
      "Our expert team is always ready to help you succeed, day or night.",
    icon: Headphones,
    iconBg: "bg-gradient-to-br from-blue-400 to-blue-600",
  },
  {
    title: "Bank-Grade Security",
    description:
      "Your data is protected with industry-leading encryption and security protocols.",
    icon: Medal,
    iconBg: "bg-gradient-to-br from-violet-400 to-purple-600",
  },
  {
    title: "Same-Day Onboarding",
    description:
      "Get up and running in hours, not days. We make setup effortless.",
    icon: Zap,
    iconBg: "bg-gradient-to-br from-orange-400 to-amber-500",
  },
]

function FeatureIcon({
  icon: Icon,
  className,
  large = false,
  compact = false,
}: {
  icon: LucideIcon
  className: string
  large?: boolean
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl text-white shadow-md shadow-black/10 transition-transform duration-300 group-hover:scale-110",
        large ? "h-14 w-14 rounded-2xl" : compact ? "h-9 w-9" : "h-12 w-12",
        className,
      )}
    >
      <Icon className={large ? "h-7 w-7" : compact ? "h-4 w-4" : "h-6 w-6"} />
    </div>
  )
}

function LandingFeatureCard({
  feature,
}: {
  feature: (typeof features)[number]
}) {
  const isLarge = feature.gridClass.includes("row-span-2")
  const isCompact = "compact" in feature && feature.compact

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-300",
        "bg-card/90 backdrop-blur-sm",
        "hover:-translate-y-1 hover:border-primary/25 hover:shadow-xl hover:shadow-primary/10",
        isCompact ? "p-4" : "p-6 md:p-7",
        feature.gridClass,
        feature.featured
          ? "border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card to-card"
          : "border-border/60",
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />

      <div className={cn("flex items-start justify-between gap-2", isCompact && "gap-1.5")}>
        <FeatureIcon
          icon={feature.icon}
          className={feature.iconBg}
          large={isLarge}
          compact={isCompact}
        />
        <span
          className={cn(
            "shrink-0 rounded-full border border-border/80 bg-muted/50 font-semibold uppercase tracking-wide text-muted-foreground",
            isCompact ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-0.5 text-[11px]",
          )}
        >
          {feature.tag}
        </span>
      </div>

      <h3
        className={cn(
          "font-semibold tracking-tight text-foreground",
          isLarge && "mt-5 text-xl md:text-2xl",
          isCompact && "mt-3 text-sm leading-snug",
          !isLarge && !isCompact && "mt-5 text-lg",
        )}
      >
        {feature.title}
      </h3>
      <p
        className={cn(
          "leading-relaxed text-muted-foreground",
          isLarge && "mt-2 text-sm md:text-base",
          isCompact && "mt-1.5 flex-1 text-xs leading-relaxed",
          !isLarge && !isCompact && "mt-2 flex-1 text-sm",
        )}
      >
        {feature.description}
      </p>

      {feature.title === "Advanced Analytics" && <AnalyticsSalesChart />}

      {!isCompact && (
        <div
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100",
            isLarge ? "mt-4" : "mt-5",
          )}
        >
          Explore
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      )}
    </article>
  )
}

export default function HomePage() {
  return (
    <div className="flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* Hero — white + check/grid lines (hero-checker-bg in globals.css) */}
      <section className="hero-checker-bg relative overflow-hidden py-16 md:py-24">
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e53775] px-4 py-2 text-sm font-medium text-[#e53775]">
  <Sparkles className="h-4 w-4 text-[#e53775]" />
  The Future of Live Commerce
</div>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              Scale Your Live{" "}
              <span className="text-[#6d11e8]">Commerce</span>
              <br />
              <span className="text-[#6d11e8]">Business</span>
            </h1>
           
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl">
              The all-in-one platform for TikTok Shop and Whatnot sellers.
              Manage your streams, hire professional moderators, and grow your
              business with powerful analytics.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="h-12 gap-2 rounded-full px-8 text-base">
                <Link href="/get-started">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 gap-2 rounded-full bg-card px-8 text-base"
              >
                <Link href="/how-it-works">
                  <Play className="h-4 w-4 fill-current" />
                  Watch Demo
                </Link>
              </Button>
            </div>
          </div>

          {/* <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
            {heroStats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center text-center">
                <div
                  className={cn(
                    "mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm",
                    stat.iconBg,
                  )}
                >
                  <stat.icon className="h-5 w-5" />
                </div>
                <div className="text-xl font-bold text-foreground md:text-2xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground md:text-sm">
                  {stat.label}
                </div>
              </div>
            ))}
          </div> */}
        </div>
      </section>







      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-pink-100/50 via-purple-100/30 to-transparent dark:from-pink-950/20 dark:via-purple-950/10 dark:to-transparent" />

        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left content */}
            <div className="space-y-6 mx-auto max-w-2xl lg:mx-0 lg:max-w-2xl">
              {/* Badge */}
              <span className="inline-block px-4 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/50 rounded-full">
                Why Choose Us
              </span>

              {/* Heading */}
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                Scale Your Live Commerce Empire Across{" "}
                <span className="text-[#e53775]">
                  TikTok, Whatnot & QuickBooks
                </span>
              </h2>

              {/* Description */}
              <p className="text-lg text-muted-foreground leading-relaxed">
                One dashboard for TikTok, Whatnot & QuickBooks. Stop switching. Start scaling.

                —{" "}
                <strong className="text-foreground font-semibold">
                  engaging your audience and growing your business.
                </strong>
              </p>

              {/* Features list */}
              <ul className="space-y-4 pt-2">
                {whyChooseFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-[#775fff] flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <div className="pt-4">
                <Button asChild size="lg" className="text-white px-6">
                  <Link href="/how-it-works">
                    Learn More
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right image */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src={whyChooseImage}
                  alt="Live commerce streaming setup"
                  width={700}
                  height={500}
                  priority
                  className="w-full h-auto md:max-h-[26rem] lg:max-h-[34rem] rounded-3xl object-cover shadow-2xl ring-1 ring-white/10 dark:ring-white/20"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <PartnerLogos />

      <LandingConfidenceCta />

      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-pink-100/50 via-purple-100/30 to-transparent dark:from-pink-950/20 dark:via-purple-950/10 dark:to-transparent" />

        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left content */}
            <div className="space-y-6 mx-auto max-w-2xl lg:mx-0 lg:max-w-2xl">
              <h2 className="font-display text-balance text-3xl font-extrabold leading-[1.12] tracking-[-0.03em] text-foreground md:text-4xl lg:text-5xl">
                One Dashboard to Power Your Entire{" "}
                <span className="text-[#6d11e8]">Live Commerce</span> Operation
              </h2>
              <p className="font-body text-lg leading-relaxed tracking-[0.01em] text-muted-foreground md:text-xl md:leading-relaxed">
                Manage your products, orders, inventory, and global shipping from one
                intelligent dashboard. Let AI handle the heavy lifting — while you focus on
                growing your live{" "}
                <span className="font-semibold text-[#6d11e8]">commerce</span>{" "}
                <span className="font-semibold text-[#6d11e8]">business</span>.
              </p>

              <div className="pt-2">
                <Button asChild size="lg" className="text-white px-6">
                  <Link href="/how-it-works">
                    Learn More
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right image */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src={firefly}
                  alt="Live commerce streaming setup"
                  width={700}
                  height={500}
                  priority
                  className="w-full h-auto md:max-h-[26rem] lg:max-h-[34rem] rounded-3xl object-cover shadow-2xl ring-1 ring-white/10 dark:ring-white/20"
                />
              </div>
            </div>
          </div>
        </div>
      </section>




      {/* Features — bento grid */}
      <section id="features" className="relative overflow-hidden bg-muted/30 py-20 md:py-28">
        <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/15 blur-3xl dark:bg-primary/10" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl dark:bg-sky-500/5" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.25] dark:opacity-[0.12]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative mx-auto w-full max-w-[min(100%,90rem)] px-4 sm:px-6 lg:px-10 xl:px-12">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Zap className="h-3.5 w-3.5" />
              All-in-one toolkit
            </div>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Everything You Need to{" "}
              <span className="text-[#e53775]">
                Succeed
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Powerful tools designed for live commerce professionals — from your first stream to
              scaling across platforms.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:auto-rows-[minmax(9.5rem,auto)] lg:gap-3">
            {features.map((feature) => (
              <LandingFeatureCard key={feature.title} feature={feature} />
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-xl bg-background/80 text-[#e53775] border-[#e53775]"
            >
              <Link href="/features">
                Explore all features
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-card/30 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Get Started in Minutes
            </h2>
            <p className="mt-4 text-muted-foreground">
              Simple steps to launch your live commerce journey
            </p>
          </div>

          <div className="relative mt-16">
            <div className="absolute left-0 right-0 top-6 hidden h-px bg-border md:block md:top-8" />
            <div className="grid gap-10 md:grid-cols-4">
              {steps.map((item) => (
                <div key={item.step} className="relative flex flex-col items-center text-center">
                  <div
                    className={cn(
                      "relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md",
                      item.iconBg,
                    )}
                  >
                    <item.icon className="h-6 w-6" />
                  </div>
                  <p className="mt-6 text-xs font-bold tracking-wider text-muted-foreground">
                    STEP {item.step}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 max-w-[220px] text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-14 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Powered by AI
          </p>
        </div>
      </section>

      {/* AI section */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)] dark:bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent)]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-primary">✨ Powered by AI</p>
            <h2 className="mt-2 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Supercharge Your Business with AI
            </h2>
            <p className="mt-4 text-muted-foreground">
              Leverage cutting-edge AI to optimize your content and boost sales
            </p>
          </div>

          <div className="mt-14 grid items-center gap-12 lg:grid-cols-2">
            <div className="grid gap-8 sm:grid-cols-2">
              {aiFeatures.map((feature) => (
                <div key={feature.title}>
                  <FeatureIcon icon={feature.icon} className={feature.iconBg} />
                  <h3 className="mt-3 font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-lg shadow-primary/5">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">AI Assistant</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Online
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-4">
                <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground">
                  Generate a catchy title for my vintage sneaker collection
                  stream
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-border bg-muted/50 px-4 py-4 text-sm text-muted-foreground">
                  <p>Here are 3 title suggestions for your vintage sneaker stream:</p>
                  <ol className="mt-3 list-decimal space-y-2 pl-4">
                    <li>Rare Kicks Alert: 90s Sneaker Treasures Live!</li>
                    <li>
                      Vintage Heat Drop - Limited Grails You Won&apos;t Find
                      Anywhere
                    </li>
                    <li>
                      Throwback Sneaker Vault - Iconic Pairs from the Golden Era
                    </li>
                  </ol>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  readOnly
                  placeholder="Ask AI anything..."
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  aria-label="Send message"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LandingPricingSection />

      {/* Testimonials */}
      <section id="testimonials" className="relative py-20 md:py-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent)]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Loved by Sellers <span className="text-primary">Worldwide</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Join thousands of successful sellers who trust Marketplace Hub to
              grow their business
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonials.map((item) => (
              <div
                key={item.author}
                className="relative rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <span
                  className={cn(
                    "absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold text-white",
                    item.badgeClass,
                  )}
                >
                  {item.badge}
                </span>
                <span className="text-4xl font-serif leading-none text-border">
                  &ldquo;
                </span>
                <div className="mt-2 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {item.quote}
                </p>
                <div className="mt-6 flex items-center gap-3 border-t border-border pt-6">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white",
                      item.avatarBg,
                    )}
                  >
                    {item.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{item.author}</p>
                    <p className="text-sm text-muted-foreground">{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t border-border bg-card/30 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((item) => (
              <div key={item.title} className="flex flex-col items-center text-center">
                <FeatureIcon icon={item.icon} className={item.iconBg} />
                <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-[#ffe414]/40 bg-gradient-to-br from-[#fffbeb] via-[#fff9db] to-[#fef3c7] p-8 text-center md:p-16 dark:from-[#ffe414]/10 dark:via-[#ffe414]/5 dark:to-background">
            <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#ffe414]/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-[#fde047]/20 blur-3xl" />

            <div className="relative mx-auto max-w-3xl">
              <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Ready to Transform Your Live Commerce Business?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Join thousands of successful sellers using Marketplace Hub to grow
                their business. Start your free trial today.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button size="lg" asChild className="h-12 gap-2 rounded-xl px-8">
                  <Link href="/get-started">
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-12 rounded-xl bg-card px-8"
                >
                  <Link href="/contact">Book a Demo</Link>
                </Button>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                Free 14-day trial | No credit card required | Cancel anytime
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
                <span>99.9% Uptime</span>
                <span>24/7 Support</span>
                <span>Same-Day Setup</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
