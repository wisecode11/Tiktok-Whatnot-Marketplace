"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"

import { useAuthenticatedUser } from "@/components/auth/authenticated-user-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  Heart,
  LayoutDashboard,
  Radio,
  UserPlus,
  Users,
  Video,
  Zap,
} from "lucide-react"

import {
  AuthApiError,
  getConnectedAccounts,
  getTikTokProfile,
  waitForSessionToken,
  type ConnectedAccountResponse,
  type TikTokProfileResponse,
} from "@/lib/auth"

type SupportedPlatformId = "tiktok" | "whatnot"

interface PlatformDefinition {
  id: SupportedPlatformId
  name: string
  shortName: string
  description: string
}

const supportedPlatforms: PlatformDefinition[] = [
  {
    id: "tiktok",
    name: "TikTok Shop",
    shortName: "TT",
    description: "Connect your TikTok seller account to sync profile and account stats.",
  },
  {
    id: "whatnot",
    name: "Whatnot",
    shortName: "WN",
    description: "Manage your Whatnot connection and keep platform access up to date.",
  },
]

const quickActions = [
  {
    title: "View Dashboard",
    description: "Open your live seller dashboard.",
    href: "/seller/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Open Launch Pad",
    description: "Manage platform connections and reconnect accounts.",
    href: "/launch-pad?role=streamer",
    icon: Radio,
  },
]

function formatOptionalNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "Not available"
}

function getConnectHref(platformId: SupportedPlatformId) {
  return `/launch-pad?role=streamer&autoconnect=${platformId}`
}

export default function SellerConnectPlatformsPage() {
  const { getToken, isLoaded } = useAuth()
  const authenticatedUser = useAuthenticatedUser()
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccountResponse["accounts"]>([])
  const [tiktokProfile, setTikTokProfile] = useState<TikTokProfileResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPlatformState() {
      if (!isLoaded) {
        return
      }

      try {
        setIsLoading(true)
        setErrorMessage(null)

        const token = await waitForSessionToken(getToken)
        const [accountsResult, tiktokResult] = await Promise.allSettled([
          getConnectedAccounts(token),
          getTikTokProfile(token),
        ])

        if (cancelled) {
          return
        }

        if (accountsResult.status === "fulfilled") {
          setConnectedAccounts(accountsResult.value.accounts)
        } else {
          setConnectedAccounts([])
        }

        if (tiktokResult.status === "fulfilled") {
          setTikTokProfile(tiktokResult.value)
        } else {
          setTikTokProfile(null)
        }

        if (accountsResult.status === "rejected" && tiktokResult.status === "rejected") {
          throw accountsResult.reason
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        const message = error instanceof AuthApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to load platform connections right now."
        setErrorMessage(message)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadPlatformState()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  const platformCards = useMemo(() => {
    return supportedPlatforms.map((platform) => {
      const account = connectedAccounts.find((item) => item.platform === platform.id)

      if (platform.id === "tiktok") {
        return {
          ...platform,
          connected: Boolean(tiktokProfile?.connected || account?.connected),
          username:
            tiktokProfile?.profile?.username
              ? `@${tiktokProfile.profile.username}`
              : tiktokProfile?.account?.username || account?.username || null,
          status: tiktokProfile?.account?.status || account?.status || "not connected",
          externalId: tiktokProfile?.profile?.openId || tiktokProfile?.account?.externalId || account?.externalId || null,
        }
      }

      return {
        ...platform,
        connected: Boolean(account?.connected),
        username: account?.username || null,
        status: account?.status || "not connected",
        externalId: account?.externalId || null,
      }
    })
  }, [connectedAccounts, tiktokProfile])

  const connectedCount = platformCards.filter((platform) => platform.connected).length
  const progressValue = (connectedCount / supportedPlatforms.length) * 100
  const displayName = authenticatedUser
    ? [authenticatedUser.firstName, authenticatedUser.lastName].filter(Boolean).join(" ") || authenticatedUser.email
    : "Streamer"

  const tiktokStats = useMemo(() => {
    const isConnected = platformCards.some((platform) => platform.id === "tiktok" && platform.connected)
    const fallback = isConnected ? "Not available" : "Account not connected"

    return [
      { title: "Followers", value: tiktokProfile?.profile?.followerCount != null ? formatOptionalNumber(tiktokProfile.profile.followerCount) : fallback, icon: Users },
      { title: "Following", value: tiktokProfile?.profile?.followingCount != null ? formatOptionalNumber(tiktokProfile.profile.followingCount) : fallback, icon: UserPlus },
      { title: "Total Likes", value: tiktokProfile?.profile?.likesCount != null ? formatOptionalNumber(tiktokProfile.profile.likesCount) : fallback, icon: Heart },
      { title: "Public Videos", value: tiktokProfile?.profile?.videoCount != null ? formatOptionalNumber(tiktokProfile.profile.videoCount) : fallback, icon: Clapperboard },
    ]
  }, [platformCards, tiktokProfile])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Connect Platforms
          </h1>
          <p className="text-muted-foreground">
            Manage only the platforms currently supported for streamers: TikTok Shop and Whatnot.
          </p>
        </div>
        <Button asChild className="gap-2 shadow-lg shadow-primary/25">
          <Link href="/seller/dashboard">
            <Video className="h-4 w-4" />
            Open Dashboard
          </Link>
        </Button>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-primary" />
                Current Setup
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {displayName}, you have connected {connectedCount} of {supportedPlatforms.length} supported platforms.
              </p>
            </div>
            <StatusBadge variant={connectedCount > 0 ? "success" : "warning"}>
              {isLoading ? "Checking" : `${connectedCount}/${supportedPlatforms.length} connected`}
            </StatusBadge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progressValue} className="mb-4 h-2" />
          <div className="grid gap-2 sm:grid-cols-2">
            {supportedPlatforms.map((platform) => {
              const isConnected = platformCards.some((item) => item.id === platform.id && item.connected)

              return (
                <div key={platform.id} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={`h-4 w-4 ${isConnected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={isConnected ? "text-foreground" : "text-muted-foreground"}>
                    {platform.name}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {errorMessage ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">
            {errorMessage}
          </CardContent>
        </Card>
      ) : null}

      <div>
        <h2 className="mb-4 text-lg font-semibold">Supported Platforms</h2>
        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed bg-muted/20">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" />
              Loading platform status
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {platformCards.map((platform) => (
              <Card key={platform.id} className="border-border/50 bg-card/50">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl font-bold ${platform.connected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {platform.shortName}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{platform.name}</div>
                          <StatusBadge variant={platform.connected ? "success" : "warning"}>
                            {platform.connected ? "Connected" : "Not connected"}
                          </StatusBadge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {platform.connected
                            ? platform.username || platform.externalId || "Not available"
                            : platform.description}
                        </p>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Status: {platform.status}
                        </p>
                      </div>
                    </div>
                    <Button asChild variant={platform.connected ? "outline" : "default"} size="sm" className="gap-2">
                      <Link href={platform.connected ? "/launch-pad?role=streamer" : getConnectHref(platform.id)}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        {platform.connected ? "Manage" : "Connect"}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">TikTok Live Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {tiktokStats.map((item) => (
                <div key={item.title} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <item.icon className="h-4 w-4 text-primary" />
                    {item.title}
                  </div>
                  <div className="mt-2 text-xl font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map((action) => (
              <Link key={action.title} href={action.href} className="block">
                <div className="rounded-xl border border-border/50 bg-muted/20 p-4 transition-colors hover:bg-muted/30">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <action.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{action.title}</div>
                      <div className="text-sm text-muted-foreground">{action.description}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {!isLoading && connectedCount === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="No supported platform connected"
          description="Connect TikTok Shop or Whatnot to start using the seller platform with live account data."
          action={{
            label: "Connect TikTok",
            onClick: () => {
              window.location.href = getConnectHref("tiktok")
            },
          }}
        />
      ) : null}
    </div>
  )
}
