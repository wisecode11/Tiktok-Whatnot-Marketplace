import Link from "next/link"
import { BRAND_NAME } from "@/lib/brand"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowRight,
  UserPlus,
  Link2,
  LayoutDashboard,
  Video,
  Users,
  TrendingUp,
} from "lucide-react"

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Create Your Account",
    description: "Sign up in seconds with your email or social login. Choose your role as a Seller or Moderator to get a personalized experience.",
    details: [
      "Free to start, no credit card required",
      "Role-based onboarding flow",
      "Secure authentication",
    ],
  },
  {
    number: "02",
    icon: Link2,
    title: "Connect Your Platforms",
    description: "Link your TikTok Shop, Whatnot, or other streaming accounts. We sync your data automatically for unified management.",
    details: [
      "One-click platform connection",
      "Automatic inventory sync",
      "Real-time order updates",
    ],
  },
  {
    number: "03",
    icon: LayoutDashboard,
    title: "Set Up Your Dashboard",
    description: "Customize your workspace with the metrics that matter most. Import products, configure notifications, and organize your team.",
    details: [
      "Drag-and-drop customization",
      "Bulk product import",
      "Team role configuration",
    ],
  },
  {
    number: "04",
    icon: Users,
    title: "Build Your Team",
    description: "Browse our moderator marketplace to find verified professionals. Or invite your existing team members to collaborate.",
    details: [
      "Verified moderator profiles",
      "Skill and availability filters",
      "Built-in booking system",
    ],
  },
  {
    number: "05",
    icon: Video,
    title: "Go Live",
    description: "Start streaming with confidence. Use our tools to manage chat, track orders, and engage your audience in real-time.",
    details: [
      "Live performance dashboard",
      "Real-time chat management",
      "Instant order notifications",
    ],
  },
  {
    number: "06",
    icon: TrendingUp,
    title: "Grow & Optimize",
    description: "Analyze your performance with detailed insights. Use AI recommendations to optimize your schedule and content strategy.",
    details: [
      "Comprehensive analytics",
      "AI-powered recommendations",
      "Growth tracking over time",
    ],
  },
]

const sellerPath = [
  { title: "Sign up as Seller", description: "Create your seller account" },
  { title: "Connect platforms", description: "Link TikTok, Whatnot, etc." },
  { title: "Import products", description: "Sync your inventory" },
  { title: "Hire moderators", description: "Build your support team" },
  { title: "Go live", description: "Stream with full support" },
]

const moderatorPath = [
  { title: "Sign up as Moderator", description: "Create your profile" },
  { title: "Complete KYC", description: "Verify your identity" },
  { title: "Set availability", description: "Define your schedule" },
  { title: "Get booked", description: "Accept jobs from sellers" },
  { title: "Get paid", description: "Weekly secure payouts" },
]

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              How {BRAND_NAME} Works
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Get started in minutes and transform your live commerce business
            </p>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="pb-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {/* Connection line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-6 top-20 h-full w-px bg-gradient-to-b from-primary/50 to-border" />
                )}
                
                <Card className="relative overflow-hidden border-border/50 bg-card/50">
                  <CardContent className="p-6 md:p-8">
                    <div className="flex gap-6">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
                        {step.number}
                      </div>
                      <div className="flex-1">
                        <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-2">
                          <step.icon className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="mb-2 text-xl font-semibold">
                          {step.title}
                        </h3>
                        <p className="mb-4 text-muted-foreground">
                          {step.description}
                        </p>
                        <ul className="grid gap-2 sm:grid-cols-3">
                          {step.details.map((detail) => (
                            <li
                              key={detail}
                              className="flex items-center gap-2 text-sm"
                            >
                              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* User Paths Section */}
      <section className="border-y border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Choose Your Path
            </h2>
            <p className="mt-2 text-muted-foreground">
              Different journeys for sellers and moderators
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Seller Path */}
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  For Sellers
                </div>
                <h3 className="mb-4 text-xl font-semibold">Seller Journey</h3>
                <div className="space-y-4">
                  {sellerPath.map((item, index) => (
                    <div key={item.title} className="flex items-start gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{item.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button asChild className="mt-6 w-full">
                  <Link href="/get-started?role=seller">Start as Seller</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Moderator Path */}
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
                  For Moderators
                </div>
                <h3 className="mb-4 text-xl font-semibold">Moderator Journey</h3>
                <div className="space-y-4">
                  {moderatorPath.map((item, index) => (
                    <div key={item.title} className="flex items-start gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-medium text-accent">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{item.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button asChild variant="outline" className="mt-6 w-full">
                  <Link href="/get-started?role=moderator">
                    Start as Moderator
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 p-8 text-center md:p-16">
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to Transform Your Streams?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Join the fastest-growing live commerce platform. Start your free
              trial today.
            </p>
            <Button size="lg" asChild className="mt-8 gap-2">
              <Link href="/get-started">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
