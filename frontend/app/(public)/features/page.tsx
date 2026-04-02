import Link from "next/link"
import { BRAND_NAME } from "@/lib/brand"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowRight,
  BarChart3,
  Users,
  Calendar,
  Package,
  Brain,
  MessageSquare,
  CreditCard,
  Shield,
  Globe,
  Video,
  TrendingUp,
  Headphones,
} from "lucide-react"

const featureCategories = [
  {
    title: "Analytics & Insights",
    description: "Data-driven decisions for your streaming business",
    features: [
      {
        icon: BarChart3,
        title: "Real-Time Dashboard",
        description: "Monitor views, engagement, and sales as they happen. Get instant insights into your stream performance.",
      },
      {
        icon: TrendingUp,
        title: "Performance Trends",
        description: "Track growth over time with historical data analysis. Identify patterns and optimize your strategy.",
      },
      {
        icon: Video,
        title: "Stream Analytics",
        description: "Deep dive into each stream with detailed metrics. See peak viewers, engagement rates, and conversion data.",
      },
    ],
  },
  {
    title: "Team & Moderation",
    description: "Build and manage your streaming team",
    features: [
      {
        icon: Users,
        title: "Moderator Marketplace",
        description: "Find and hire verified professional moderators. Filter by skills, availability, and ratings.",
      },
      {
        icon: MessageSquare,
        title: "Team Chat",
        description: "Built-in communication tools for your team. Coordinate during streams in real-time.",
      },
      {
        icon: Shield,
        title: "Role-Based Access",
        description: "Control who can access what. Set permissions for team members based on their role.",
      },
    ],
  },
  {
    title: "Commerce & Inventory",
    description: "Manage your products and sales",
    features: [
      {
        icon: Package,
        title: "Inventory Management",
        description: "Track stock levels, manage variants, and sync across platforms automatically.",
      },
      {
        icon: CreditCard,
        title: "Payment Processing",
        description: "Secure transactions with fraud protection. Multiple payment methods supported.",
      },
      {
        icon: Globe,
        title: "Multi-Platform Sync",
        description: "Connect TikTok Shop, Whatnot, and more. Unified inventory across all channels.",
      },
    ],
  },
  {
    title: "AI & Automation",
    description: "Work smarter with intelligent tools",
    features: [
      {
        icon: Brain,
        title: "AI Content Assistant",
        description: "Generate product descriptions, stream titles, and engaging captions automatically.",
      },
      {
        icon: Calendar,
        title: "Smart Scheduling",
        description: "AI-powered recommendations for optimal streaming times based on your audience.",
      },
      {
        icon: Headphones,
        title: "Automated Support",
        description: "Handle common customer inquiries automatically. Focus on what matters most.",
      },
    ],
  },
]

export default function FeaturesPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute right-1/4 top-1/2 h-[300px] w-[300px] rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              Powerful Features for Live Commerce
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Everything you need to run and scale your streaming business,
              all in one platform.
            </p>
            <div className="mt-8">
              <Button size="lg" asChild className="gap-2">
                <Link href="/get-started">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Sections */}
      {featureCategories.map((category, categoryIndex) => (
        <section
          key={category.title}
          className={`py-20 ${categoryIndex % 2 === 1 ? "bg-muted/30" : ""}`}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {category.title}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {category.description}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {category.features.map((feature) => (
                <Card
                  key={feature.title}
                  className="group border-border/50 bg-card/50 transition-all hover:border-primary/50"
                >
                  <CardContent className="p-6">
                    <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3 transition-colors group-hover:bg-primary/15">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* CTA Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 p-8 text-center md:p-16">
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to Get Started?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Join thousands of streamers who are already using {BRAND_NAME} to
              grow their live commerce business.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="gap-2">
                <Link href="/get-started">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
