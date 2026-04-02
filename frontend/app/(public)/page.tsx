import Link from "next/link"
import { BRAND_NAME } from "@/lib/brand"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowRight,
  Zap,
  Users,
  BarChart3,
  Shield,
  Clock,
  Globe,
  Star,
  CheckCircle2,
  PlayCircle,
} from "lucide-react"

const features = [
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description:
      "Track your stream performance, engagement metrics, and revenue in real-time with our comprehensive dashboard.",
  },
  {
    icon: Users,
    title: "Moderator Marketplace",
    description:
      "Find and hire verified professional moderators to help manage your live streams and boost engagement.",
  },
  {
    icon: Clock,
    title: "Smart Scheduling",
    description:
      "Plan and schedule your streams across multiple platforms with our intelligent calendar system.",
  },
  {
    icon: Shield,
    title: "Secure Payments",
    description:
      "Built-in payment processing with fraud protection. Get paid fast with weekly payouts.",
  },
  {
    icon: Globe,
    title: "Multi-Platform Support",
    description:
      "Connect TikTok Shop, Whatnot, and more. Manage all your live commerce from one place.",
  },
  {
    icon: Zap,
    title: "AI-Powered Tools",
    description:
      "Leverage AI to optimize your content, generate product descriptions, and analyze trends.",
  },
]

const stats = [
  { value: "50K+", label: "Active Streamers" },
  { value: "$12M+", label: "Monthly GMV" },
  { value: "98%", label: "Satisfaction Rate" },
  { value: "24/7", label: "Support" },
]

const testimonials = [
  {
    quote:
      `${BRAND_NAME} transformed how I manage my live commerce business. The moderator marketplace alone saved me hours every week.`,
    author: "Sarah Chen",
    role: "Top TikTok Seller",
    rating: 5,
  },
  {
    quote:
      "The analytics are incredible. I can see exactly what products perform best and when my audience is most engaged.",
    author: "Marcus Williams",
    role: "Whatnot Power Seller",
    rating: 5,
  },
  {
    quote:
      "As a moderator, this platform has been a game-changer. Consistent bookings, reliable payments, and great clients.",
    author: "Jordan Martinez",
    role: "Professional Moderator",
    rating: 5,
  },
]

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute right-1/4 top-1/4 h-[400px] w-[400px] rounded-full bg-accent/15 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-primary">
              <Zap className="h-4 w-4" />
              <span>The Future of Live Commerce</span>
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Scale Your{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Live Commerce
              </span>{" "}
              Business
            </h1>
            <p className="mt-6 text-pretty text-lg text-muted-foreground md:text-xl">
              The all-in-one platform for live commerce streamers. Manage your
              streams, hire professional moderators, and grow your business with
              powerful analytics.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="gap-2">
                <Link href="/get-started">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="gap-2">
                <Link href="/how-it-works">
                  <PlayCircle className="h-4 w-4" />
                  Watch Demo
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border bg-muted/30 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold tracking-tight text-primary md:text-4xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Everything You Need to Succeed
            </h2>
            <p className="mt-4 text-muted-foreground">
              Powerful tools designed for live commerce professionals
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="group relative overflow-hidden border-border/50 bg-card/50 transition-all hover:border-primary/50 hover:bg-card"
              >
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="border-y border-border bg-muted/30 py-20 md:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Get Started in Minutes
            </h2>
            <p className="mt-4 text-muted-foreground">
              Simple steps to launch your live commerce journey
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Create Your Account",
                description:
                  "Sign up for free and connect your streaming platforms. No credit card required.",
              },
              {
                step: "02",
                title: "Set Up Your Dashboard",
                description:
                  "Configure your products, team, and preferences. Import existing inventory easily.",
              },
              {
                step: "03",
                title: "Start Streaming",
                description:
                  "Go live with confidence. Track analytics, hire moderators, and grow your audience.",
              },
            ].map((item) => (
              <div key={item.step} className="relative pl-16">
                <div className="absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section 
      <section className="py-20 md:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Loved by Streamers Worldwide
            </h2>
            <p className="mt-4 text-muted-foreground">
              See what our community has to say
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Card
                key={testimonial.author}
                className="border-border/50 bg-card/50"
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex gap-1">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-primary text-primary"
                      />
                    ))}
                  </div>
                  <blockquote className="text-sm leading-relaxed">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <div className="mt-4 border-t border-border pt-4">
                    <div className="font-medium">{testimonial.author}</div>
                    <div className="text-sm text-muted-foreground">
                      {testimonial.role}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
*/}
      {/* CTA Section */}
      <section className="border-t border-border bg-gradient-to-b from-muted/30 to-background py-20 md:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 p-8 md:p-16">
            <div className="relative z-10 mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to Transform Your Streams?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Join thousands of successful streamers using {BRAND_NAME} to grow
                their live commerce business.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button size="lg" asChild className="gap-2">
                  <Link href="/get-started">
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/contact">Talk to Sales</Link>
                </Button>
              </div>
              <div className="mt-6 flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Free 14-day trial
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  No credit card required
                </span>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
          </div>
        </div>
      </section>
    </div>
  )
}
