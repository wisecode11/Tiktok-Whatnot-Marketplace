import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Star,
  Clock,
  Briefcase,
  ArrowRight,
  Shield,
  DollarSign,
  Calendar,
} from "lucide-react"
import { mockModerators } from "@/lib/mock-data"

const benefits = [
  {
    icon: Shield,
    title: "Verified Professionals",
    description: "All moderators complete KYC verification and background checks.",
  },
  {
    icon: Clock,
    title: "Fast Response",
    description: "Most moderators respond to booking requests within an hour.",
  },
  {
    icon: DollarSign,
    title: "Secure Payments",
    description: "Payments are held securely and released after completed sessions.",
  },
  {
    icon: Calendar,
    title: "Flexible Booking",
    description: "Book by the hour or session. Cancel up to 24 hours before.",
  },
]

export default function ModeratorsPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              Moderator Marketplace
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Find verified professional moderators to help manage your live
              streams and boost engagement.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="gap-2">
                <Link href="/get-started?role=seller">
                  Hire a Moderator
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/get-started?role=moderator">Become a Moderator</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="border-y border-border bg-muted/30 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <benefit.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{benefit.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {benefit.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Search & Filter Section */}
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search moderators by name or skills..."
                className="bg-muted/50 pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-[140px] bg-muted/50">
                  <SelectValue placeholder="Availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available Now</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="rating">
                <SelectTrigger className="w-[140px] bg-muted/50">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">Top Rated</SelectItem>
                  <SelectItem value="jobs">Most Jobs</SelectItem>
                  <SelectItem value="price-low">Price: Low</SelectItem>
                  <SelectItem value="price-high">Price: High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Moderator Listings */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {mockModerators.map((moderator) => (
              <Card
                key={moderator.id}
                className="group overflow-hidden border-border/50 bg-card/50 transition-all hover:border-primary/50"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 border-2 border-background">
                        <AvatarImage src={moderator.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {moderator.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{moderator.name}</h3>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                          <span>{moderator.rating}</span>
                          <span>({moderator.reviewCount} reviews)</span>
                        </div>
                      </div>
                    </div>
                    <StatusBadge
                      variant={
                        moderator.availability === "available"
                          ? "success"
                          : moderator.availability === "busy"
                          ? "warning"
                          : "default"
                      }
                      dot
                      pulse={moderator.availability === "available"}
                    >
                      {moderator.availability === "available"
                        ? "Available"
                        : moderator.availability === "busy"
                        ? "Busy"
                        : "Offline"}
                    </StatusBadge>
                  </div>

                  <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">
                    {moderator.bio}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {moderator.skills.slice(0, 3).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-xs"
                      >
                        {skill}
                      </span>
                    ))}
                    {moderator.skills.length > 3 && (
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                        +{moderator.skills.length - 3}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Briefcase className="h-3.5 w-3.5" />
                        {moderator.completedJobs} jobs
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {moderator.responseTime}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">
                        ${moderator.hourlyRate}
                        <span className="text-sm font-normal text-muted-foreground">
                          /hr
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button asChild className="mt-4 w-full">
                    <Link href={`/moderators/${moderator.id}`}>
                      View Profile
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Load More */}
          <div className="mt-12 text-center">
            <Button variant="outline" size="lg">
              Load More Moderators
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold">For Sellers</h3>
                <p className="mt-2 text-muted-foreground">
                  Find the perfect moderator to help manage your live streams,
                  engage your audience, and process orders.
                </p>
                <Button asChild className="mt-6">
                  <Link href="/get-started?role=seller">Hire a Moderator</Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold">For Moderators</h3>
                <p className="mt-2 text-muted-foreground">
                  Join our marketplace to connect with top streamers, build your
                  reputation, and earn on your own schedule.
                </p>
                <Button asChild variant="outline" className="mt-6">
                  <Link href="/get-started?role=moderator">
                    Become a Moderator
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
