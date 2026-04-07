"use client"

import { useState } from "react"
import Link from "next/link"
import { BRAND_HANDLE_PREFIX } from "@/lib/brand"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Progress } from "@/components/ui/progress"
import {
  ArrowRight,
  LayoutDashboard,
  Package,
  Users,
  Calendar,
  Video,
  CheckCircle2,
  Circle,
  TrendingUp,
  Zap,
  ExternalLink,
  Plus,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Platform {
  id: string
  name: string
  logo: string
  connected: boolean
  username?: string
}

const quickActions = [
  {
    title: "View Dashboard",
    description: "Check your latest stats and performance",
    icon: LayoutDashboard,
    href: "/seller/dashboard",
  },
  {
    title: "Manage Products",
    description: "Add or update your inventory",
    icon: Package,
    href: "/seller/products",
  },
  {
    title: "Find Moderators",
    description: "Hire help for your streams",
    icon: Users,
    href: "/seller/moderators",
  },
  {
    title: "Schedule Stream",
    description: "Plan your upcoming streams",
    icon: Calendar,
    href: "/seller/calendar",
  },
]

const onboardingSteps = [
  { title: "Create account", completed: true },
  { title: "Connect platforms", completed: true },
  { title: "Add products", completed: false },
  { title: "Schedule first stream", completed: false },
  { title: "Hire a moderator", completed: false },
]

const initialPlatforms: Platform[] = [
  {
    id: "tiktok",
    name: "TikTok Shop",
    logo: "TT",
    connected: true,
    username: "@techstyle_live",
  },
  {
    id: "whatnot",
    name: "Whatnot",
    logo: "WN",
    connected: true,
    username: "techstyle_live",
  },
  {
    id: "amazon",
    name: "Amazon Live",
    logo: "AL",
    connected: false,
  },
]

export default function SellerLaunchPad() {
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms)
  const [connecting, setConnecting] = useState<string | null>(null)

  const completedSteps = onboardingSteps.filter((s) => s.completed).length
  const progress = (completedSteps / onboardingSteps.length) * 100

  const handleConnect = async (platformId: string) => {
    setConnecting(platformId)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setPlatforms((prev) =>
      prev.map((p) =>
        p.id === platformId
          ? { ...p, connected: true, username: `@${BRAND_HANDLE_PREFIX}_${platformId}` }
          : p
      )
    )
    setConnecting(null)
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Welcome back, Alex
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s happening with your streams
          </p>
        </div>
        <Button asChild className="gap-2 shadow-lg shadow-primary/25">
          <Link href="/seller/calendar">
            <Video className="h-4 w-4" />
            Go Live
          </Link>
        </Button>
      </div>

      {/* Onboarding Progress */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5 text-primary" />
              Getting Started
            </CardTitle>
            <StatusBadge variant="info">{completedSteps}/{onboardingSteps.length} Complete</StatusBadge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="mb-4 h-2" />
          <div className="grid gap-2 sm:grid-cols-5">
            {onboardingSteps.map((step) => (
              <div
                key={step.title}
                className="flex items-center gap-2 text-sm"
              >
                {step.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span
                  className={
                    step.completed ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.title} href={action.href}>
              <Card className="group h-full cursor-pointer border-border/50 bg-card/50 transition-all hover:border-primary/50 hover:bg-card hover:shadow-lg hover:shadow-primary/5">
                <CardContent className="flex h-full flex-col p-4">
                  <div className="mb-3 inline-flex rounded-xl bg-primary/10 p-2.5 transition-colors group-hover:bg-primary/15">
                    <action.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mb-1 font-semibold">{action.title}</h3>
                  <p className="flex-1 text-sm text-muted-foreground">
                    {action.description}
                  </p>
                  <div className="mt-3 flex items-center text-sm text-primary">
                    <span>Get started</span>
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Platform Connections & Stats */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Platform Connections</CardTitle>
              <Button variant="ghost" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {platforms.map((platform) => (
              <div
                key={platform.id}
                className={cn(
                  "flex items-center justify-between rounded-xl p-4 transition-colors",
                  platform.connected
                    ? "bg-primary/5 ring-1 ring-primary/20"
                    : "bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg font-bold",
                      platform.connected
                        ? "bg-primary/15 text-primary"
                        : "bg-background text-muted-foreground"
                    )}
                  >
                    {platform.logo}
                  </div>
                  <div>
                    <div className="font-medium">{platform.name}</div>
                    {platform.connected ? (
                      <div className="text-sm text-primary">{platform.username}</div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Not connected</div>
                    )}
                  </div>
                </div>
                {platform.connected ? (
                  <StatusBadge variant="success" dot pulse>
                    Connected
                  </StatusBadge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleConnect(platform.id)}
                    disabled={connecting === platform.id}
                  >
                    {connecting === platform.id ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Connecting
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-3 w-3" />
                        Connect
                      </>
                    )}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-4 ring-1 ring-primary/10">
                <div className="text-2xl font-bold text-primary">125K</div>
                <div className="text-sm text-muted-foreground">
                  Total Followers
                </div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 p-4 ring-1 ring-accent/10">
                <div className="text-2xl font-bold text-accent">342</div>
                <div className="text-sm text-muted-foreground">
                  Orders This Week
                </div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-success/10 to-success/5 p-4 ring-1 ring-success/10">
                <div className="text-2xl font-bold text-success">$12.4K</div>
                <div className="text-sm text-muted-foreground">
                  Revenue This Week
                </div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-warning/10 to-warning/5 p-4 ring-1 ring-warning/10">
                <div className="text-2xl font-bold text-warning">4.2%</div>
                <div className="text-sm text-muted-foreground">
                  Engagement Rate
                </div>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/seller/analytics">View Full Analytics</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
