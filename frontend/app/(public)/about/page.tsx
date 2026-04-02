import Link from "next/link"
import { BRAND_NAME } from "@/lib/brand"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Target, Heart, Users, Zap } from "lucide-react"

const values = [
  {
    icon: Target,
    title: "Mission-Driven",
    description: "We empower live commerce creators to build sustainable businesses through technology and community.",
  },
  {
    icon: Heart,
    title: "Creator-First",
    description: "Every decision we make puts creators and their success at the center. Your growth is our growth.",
  },
  {
    icon: Users,
    title: "Community Focused",
    description: "We believe in the power of connection. Our platform brings together sellers, moderators, and audiences.",
  },
  {
    icon: Zap,
    title: "Innovation Obsessed",
    description: "We continuously push boundaries to bring you cutting-edge tools that keep you ahead of the curve.",
  },
]

const team = [
  {
    name: "Alex Rivera",
    role: "CEO & Co-Founder",
    bio: "Former VP at Shopify. 15+ years in e-commerce.",
  },
  {
    name: "Jordan Kim",
    role: "CTO & Co-Founder",
    bio: "Ex-Google engineer. Built systems serving billions.",
  },
  {
    name: "Sam Chen",
    role: "Head of Product",
    bio: "Former Product Lead at TikTok. Creator economy expert.",
  },
  {
    name: "Taylor Morgan",
    role: "Head of Operations",
    bio: "Scaled operations at Whatnot from 10 to 500+ employees.",
  },
]

const milestones = [
  { year: "2022", title: "Founded", description: "Started with a vision to transform live commerce" },
  { year: "2023", title: "Launch", description: "Public launch with 1,000+ beta users" },
  { year: "2024", title: "Growth", description: "50K+ active streamers, $12M+ monthly GMV" },
  { year: "2025", title: "Expansion", description: "Global expansion and enterprise features" },
]

export default function AboutPage() {
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
              About {BRAND_NAME}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              We are building the future of live commerce, empowering creators to
              turn their passion into thriving businesses.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Our Mission</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Live commerce is revolutionizing how people discover and buy
                products. But running a successful streaming business is complex.
              </p>
              <p className="mt-4 text-muted-foreground">
                We built {BRAND_NAME} to give every creator the tools they need to
                succeed, from analytics and inventory management to finding
                professional moderators who can help them scale.
              </p>
              <p className="mt-4 text-muted-foreground">
                Our platform connects the entire live commerce ecosystem, sellers,
                moderators, and tools, in one seamless experience. We handle the
                complexity so you can focus on what you do best: creating amazing
                live shopping experiences.
              </p>
            </div>
            <div className="relative">
              <div className="aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10">
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl font-bold text-primary">50K+</div>
                    <div className="mt-2 text-muted-foreground">
                      Active Streamers
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="border-y border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Our Values</h2>
            <p className="mt-2 text-muted-foreground">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <Card key={value.title} className="border-border/50 bg-card/50">
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                    <value.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 font-semibold">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Our Journey</h2>
            <p className="mt-2 text-muted-foreground">
              Key milestones in our growth
            </p>
          </div>

          <div className="mx-auto max-w-3xl">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-8 top-0 h-full w-px bg-border md:left-1/2" />

              {milestones.map((milestone, index) => (
                <div
                  key={milestone.year}
                  className={`relative mb-8 flex items-center ${
                    index % 2 === 0 ? "md:flex-row-reverse" : ""
                  }`}
                >
                  <div className="flex-1 md:px-8">
                    <Card
                      className={`border-border/50 bg-card/50 ${
                        index % 2 === 0 ? "md:text-right" : ""
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="text-sm font-medium text-primary">
                          {milestone.year}
                        </div>
                        <div className="font-semibold">{milestone.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {milestone.description}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="absolute left-6 flex h-4 w-4 items-center justify-center rounded-full bg-primary md:left-1/2 md:-translate-x-1/2">
                    <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                  </div>
                  <div className="flex-1 hidden md:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="border-y border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Our Team</h2>
            <p className="mt-2 text-muted-foreground">
              Meet the people building the future of live commerce
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <Card key={member.name} className="border-border/50 bg-card/50">
                <CardContent className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <h3 className="font-semibold">{member.name}</h3>
                  <div className="text-sm text-primary">{member.role}</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {member.bio}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 p-8 text-center md:p-16">
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Join Our Journey
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Be part of the live commerce revolution. Start your free trial today.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="gap-2">
                <Link href="/get-started">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/contact">Contact Us</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
