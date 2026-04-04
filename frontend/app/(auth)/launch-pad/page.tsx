"use client"

import { useState, useEffect, Suspense } from "react"
import { useAuth } from "@clerk/nextjs"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  disconnectPlatform,
  getClerkErrorMessage,
  getConnectedAccounts,
  normalizeRole,
  startPlatformConnection,
  waitForSessionToken,
  type AppRole,
} from "@/lib/auth"

interface Platform {
  id: string
  name: string
  logo: string
  description: string
  connected: boolean
  connecting: boolean
  username?: string
  required?: boolean
  error?: string
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
  const { getToken, isLoaded } = useAuth()
  const role = normalizeRole(searchParams.get("role")) || "streamer"
  
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms)
  const [isLaunching, setIsLaunching] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(true)
  const [feedbackMessage, setFeedbackMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    const platform = searchParams.get("platform")
    const status = searchParams.get("status")
    const message = searchParams.get("message")

    if (!platform || !status) {
      return
    }

    if (status === "connected") {
      setFeedbackMessage(`${platform === "tiktok" ? "TikTok Shop" : platform} connected successfully.`)
      setErrorMessage("")
      return
    }

    if (status === "error") {
      setFeedbackMessage("")
      setErrorMessage(message || `Unable to connect ${platform}.`)
    }
  }, [searchParams])

  useEffect(() => {
    let cancelled = false

    async function loadConnections() {
      if (!isLoaded) {
        return
      }

      setIsRefreshing(true)

      try {
        const token = await waitForSessionToken(getToken)
        const result = await getConnectedAccounts(token)

        if (cancelled) {
          return
        }

        setPlatforms((prev) =>
          prev.map((platform) => {
            const connection = result.accounts.find((account) => account.platform === platform.id && account.connected)

            if (!connection) {
              return { ...platform, connected: false, connecting: false, username: undefined }
            }

            return {
              ...platform,
              connected: true,
              connecting: false,
              username: connection.username || `@${BRAND_HANDLE_PREFIX}_${platform.id}`,
            }
          }),
        )
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getClerkErrorMessage(error))
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false)
        }
      }
    }

    void loadConnections()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  const connectedCount = platforms.filter((p) => p.connected).length
  const hasRequiredPlatform = platforms.some((p) => p.required && p.connected)
  const progress = (connectedCount / platforms.length) * 100

  const handleConnect = async (platformId: string) => {
    setPlatforms((prev) =>
      prev.map((p) =>
        p.id === platformId ? { ...p, connecting: true } : p
      )
    )

    setFeedbackMessage("")
    setErrorMessage("")

    try {
      if (platformId === "tiktok") {
        const token = await waitForSessionToken(getToken)
        const result = await startPlatformConnection(token, platformId, role as AppRole)
        window.location.href = result.authorizationUrl
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 1200))

      setPlatforms((prev) =>
        prev.map((p) =>
          p.id === platformId
            ? {
                ...p,
                connecting: false,
                connected: true,
                username: `@${BRAND_HANDLE_PREFIX}_${platformId}`,
              }
            : p,
        ),
      )
    } catch (error) {
      setPlatforms((prev) =>
        prev.map((p) =>
          p.id === platformId ? { ...p, connecting: false } : p,
        ),
      )
      setErrorMessage(getClerkErrorMessage(error))
    }
  }

  const handleDisconnect = async (platformId: string) => {
    setErrorMessage("")
    setFeedbackMessage("")

    try {
      if (platformId === "tiktok") {
        const token = await waitForSessionToken(getToken)
        await disconnectPlatform(token, platformId)
      }

      setPlatforms((prev) =>
        prev.map((p) =>
          p.id === platformId
            ? { ...p, connected: false, username: undefined }
            : p,
        ),
      )
      setFeedbackMessage(`${platformId === "tiktok" ? "TikTok Shop" : platformId} disconnected.`)
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    }
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
              {isRefreshing ? "Checking connections" : hasRequiredPlatform ? "Ready to launch" : "Setup required"}
            </StatusBadge>
          </div>
          <Progress value={progress} className="mt-4 h-2" />
        </CardContent>
      </Card>

      {feedbackMessage ? (
        <Card className="border-success/30 bg-success/10">
          <CardContent className="p-4 text-sm text-success">{feedbackMessage}</CardContent>
        </Card>
      ) : null}

      {errorMessage ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

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
                      onClick={() => void handleDisconnect(platform.id)}
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
                    onClick={() => void handleConnect(platform.id)}
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
