"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { BRAND_HANDLE_PREFIX, BRAND_NAME } from "@/lib/brand"
import { RoleGate } from "@/components/auth/role-gate"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Progress } from "@/components/ui/progress"
import {
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  Rocket,
  Sparkles,
  Video,
  Users,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Platform {
  id: string
  name: string
  logo: string
  description: string
  connected: boolean
  connecting: boolean
  username?: string
  required?: boolean
}

const initialPlatforms: Platform[] = [
  {
    id: "tiktok",
    name: "TikTok Shop",
    logo: "TT",
    description: "Connect your TikTok Shop seller account",
    connected: false,
    connecting: false,
    required: true,
  },
  {
    id: "whatnot",
    name: "Whatnot",
    logo: "WN",
    description: "Stream and sell on Whatnot marketplace",
    connected: false,
    connecting: false,
  },
  
]

function LaunchPadContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const role = searchParams.get("role") || "streamer"
  
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms)
  const [isLaunching, setIsLaunching] = useState(false)

  const connectedCount = platforms.filter((p) => p.connected).length
  const hasRequiredPlatform = platforms.some((p) => p.required && p.connected)
  const progress = (connectedCount / platforms.length) * 100

  const handleConnect = async (platformId: string) => {
    // Set connecting state
    setPlatforms((prev) =>
      prev.map((p) =>
        p.id === platformId ? { ...p, connecting: true } : p
      )
    )

    // Simulate OAuth flow
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Update connected state with mock username
    setPlatforms((prev) =>
      prev.map((p) =>
        p.id === platformId
          ? {
              ...p,
              connecting: false,
              connected: true,
              username: `@${BRAND_HANDLE_PREFIX}_${platformId}`,
            }
          : p
      )
    )
  }

  const handleDisconnect = (platformId: string) => {
    setPlatforms((prev) =>
      prev.map((p) =>
        p.id === platformId
          ? { ...p, connected: false, username: undefined }
          : p
      )
    )
  }

  const handleLaunch = async () => {
    setIsLaunching(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    
    if (role === "moderator") {
      router.push("/moderator")
    } else {
      router.push("/seller")
    }
  }

  const isStreamer = role === "streamer"
  const Icon = isStreamer ? Video : Users
  const title = isStreamer ? "Streamer" : "Moderator"
  const dashboardPath = isStreamer ? "/seller" : "/moderator"

  return (
    <div className="w-full max-w-3xl space-y-6">
      {/* Welcome Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 ring-1 ring-primary/20">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome, {title}!
        </h1>
        <p className="mt-2 text-muted-foreground">
          Connect your streaming platforms to get started with {BRAND_NAME}
        </p>
      </div>

      {/* Progress Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-semibold">Platform Setup</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {connectedCount === 0
                  ? "Connect at least one platform to continue"
                  : `${connectedCount} of ${platforms.length} platforms connected`}
              </p>
            </div>
            <StatusBadge variant={hasRequiredPlatform ? "success" : "warning"}>
              {hasRequiredPlatform ? "Ready to launch" : "Setup required"}
            </StatusBadge>
          </div>
          <Progress value={progress} className="mt-4 h-2" />
        </CardContent>
      </Card>

      {/* Platforms Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {platforms.map((platform) => (
          <Card
            key={platform.id}
            className={cn(
              "border-border/50 bg-card/50 transition-all",
              platform.connected && "border-primary/30 bg-primary/5"
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/50 font-bold text-lg",
                    platform.connected && "border-primary/30 bg-primary/10 text-primary"
                  )}
                >
                  {platform.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{platform.name}</span>
                    {platform.required && (
                      <StatusBadge variant="warning">Required</StatusBadge>
                    )}
                  </div>
                  {platform.connected ? (
                    <p className="mt-1 truncate text-sm text-primary">
                      {platform.username}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {platform.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                {platform.connected ? (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 items-center gap-2 text-sm text-primary">
                      <Check className="h-4 w-4" />
                      Connected
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnect(platform.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => handleConnect(platform.id)}
                    disabled={platform.connecting}
                  >
                    {platform.connecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4" />
                        Connect {platform.name}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Banner */}
      {!hasRequiredPlatform && (
        <Card className="border-warning/30 bg-warning/10">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-medium text-warning">Platform Required</p>
              <p className="mt-1 text-warning/80">
                Please connect at least TikTok Shop to continue. This is required for the core platform functionality.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button
          variant="ghost"
          asChild
          className="text-muted-foreground"
        >
          <Link href="/login">
            <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
            Back to login
          </Link>
        </Button>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push(dashboardPath)}
            disabled={!hasRequiredPlatform}
          >
            Skip for now
          </Button>
          <Button
            onClick={handleLaunch}
            disabled={!hasRequiredPlatform || isLaunching}
            className="gap-2"
          >
            {isLaunching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                Launch Dashboard
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Help Text */}
      <p className="text-center text-sm text-muted-foreground">
        Need help connecting your platforms?{" "}
        <Link href="/help/platforms" className="text-primary hover:underline">
          View our setup guide
        </Link>
      </p>
    </div>
  )
}

export default function LaunchPadPage() {
  return (
    <RoleGate allowedRoles={["streamer", "moderator"]} unauthenticatedPath="/login">
      <Suspense fallback={
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <LaunchPadContent />
      </Suspense>
    </RoleGate>
  )
}
