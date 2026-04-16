"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { StatusBadge } from "@/components/ui/status-badge"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import {
  AlertCircle,
  Heart,
  Users,
  DollarSign,
  Clock,
  Video,
  RefreshCw,
  ShieldCheck,
  BadgeCheck,
  UserPlus,
  Clapperboard,
  Link as LinkIcon,
  PlugZap,
  Radio,
  CircleDollarSign,
  PackageSearch,
} from "lucide-react"
import {
  AuthApiError,
  getConnectedAccounts,
  getWhatnotInventorySnapshot,
  getTikTokProfile,
  waitForSessionToken,
  type ConnectedAccountResponse,
  type WhatnotInventorySnapshotResponse,
  type TikTokProfileResponse,
} from "@/lib/auth"

const formatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
})

const platformLabels: Record<string, string> = {
  tiktok: "TikTok Shop",
  whatnot: "Whatnot",
}

const launchPadLinks: Record<string, string> = {
  tiktok: "/launch-pad?role=streamer&autoconnect=tiktok",
  whatnot: "/launch-pad?role=streamer&autoconnect=whatnot",
}

function getAvatarFallback(profile: TikTokProfileResponse["profile"], account: TikTokProfileResponse["account"]) {
  const source = profile?.displayName || account?.username || profile?.username || profile?.openId || "TT"
  return source.replace(/^@/, "").slice(0, 2).toUpperCase()
}

function formatOptionalNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "Unavailable"
}

function getUnavailableValue(isConnected: boolean) {
  return isConnected ? "Not available" : "Account not connected"
}

function hasTikTokScope(scopes: string | null | undefined, requiredScope: string) {
  if (!scopes) {
    return false
  }

  return scopes
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean)
    .includes(requiredScope)
}

export default function SellerDashboard() {
  const { getToken, isLoaded } = useAuth()
  const [tiktokProfile, setTikTokProfile] = useState<TikTokProfileResponse | null>(null)
  const [whatnotSnapshot, setWhatnotSnapshot] = useState<WhatnotInventorySnapshotResponse | null>(null)
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccountResponse["accounts"]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false

    async function loadDashboardData() {
      if (!isLoaded) {
        return
      }

      try {
        setIsLoading(true)
        setErrorMessage(null)

        const token = await waitForSessionToken(getToken)
        const [profileResult, accountsResult, whatnotResult] = await Promise.allSettled([
          getTikTokProfile(token),
          getConnectedAccounts(token),
          getWhatnotInventorySnapshot(token, { first: 5 }),
        ])

        if (!isCancelled) {
          if (profileResult.status === "fulfilled") {
            setTikTokProfile(profileResult.value)
          } else {
            setTikTokProfile(null)
          }

          if (accountsResult.status === "fulfilled") {
            setConnectedAccounts(accountsResult.value.accounts)
          } else {
            setConnectedAccounts([])
          }

          if (whatnotResult.status === "fulfilled") {
            setWhatnotSnapshot(whatnotResult.value)
          } else {
            setWhatnotSnapshot(null)
          }

          if (
            profileResult.status === "rejected" &&
            accountsResult.status === "rejected" &&
            whatnotResult.status === "rejected"
          ) {
            throw profileResult.reason
          }
        }
      } catch (error) {
        if (isCancelled) {
          return
        }

        const message = error instanceof AuthApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to load TikTok profile right now."
        setErrorMessage(message)
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadDashboardData()

    return () => {
      isCancelled = true
    }
  }, [getToken, isLoaded])


  const platformAccounts = useMemo(() => {
    return ["tiktok", "whatnot"].map((platformId) => {
      const account = connectedAccounts.find((item) => item.platform === platformId)

      if (platformId === "tiktok") {
        return {
          id: platformId,
          name: platformLabels[platformId],
          connected: Boolean(tiktokProfile?.connected || account?.connected),
          username:
            tiktokProfile?.profile?.username
              ? `@${tiktokProfile.profile.username}`
              : tiktokProfile?.account?.username || account?.username || null,
          externalId: tiktokProfile?.profile?.openId || tiktokProfile?.account?.externalId || account?.externalId || null,
          status: tiktokProfile?.account?.status || account?.status || "not connected",
          actionHref: launchPadLinks[platformId],
        }
      }

      return {
        id: platformId,
        name: platformLabels[platformId],
        connected: Boolean(account?.connected),
        username: account?.username || null,
        externalId: account?.externalId || null,
        status: account?.status || "not connected",
        actionHref: launchPadLinks[platformId],
      }
    })
  }, [connectedAccounts, tiktokProfile])

  const isTikTokConnected = platformAccounts.some((platform) => platform.id === "tiktok" && platform.connected)

  const accountSummary = useMemo(() => {
    if (!tiktokProfile?.account) {
      return []
    }

    return [
      {
        label: "Open ID",
        value: tiktokProfile.profile?.openId || tiktokProfile.account.externalId || "Unavailable",
      },
      {
        label: "Union ID",
        value: tiktokProfile.profile?.unionId || "Unavailable",
      },
      {
        label: "Token expires",
        value: tiktokProfile.account.expiresAt
          ? formatter.format(new Date(tiktokProfile.account.expiresAt))
          : "Unavailable",
      },
      {
        label: "Last sync",
        value: tiktokProfile.account.lastSyncedAt
          ? formatter.format(new Date(tiktokProfile.account.lastSyncedAt))
          : "Not synced yet",
      },
      {
        label: "Scopes",
        value: tiktokProfile.account.scopes || "Unavailable",
      },
    ]
  }, [tiktokProfile])

  const hasStatsScope = useMemo(() => {
    return hasTikTokScope(tiktokProfile?.account?.scopes, "user.info.stats")
  }, [tiktokProfile])

  const tiktokStats = useMemo(() => {
    const profile = tiktokProfile?.profile

    return [
      {
        title: "Followers",
        value:
          profile?.followerCount != null
            ? formatOptionalNumber(profile.followerCount)
            : isTikTokConnected && !hasStatsScope
              ? "Scope user.info.stats required"
              : getUnavailableValue(isTikTokConnected),
        icon: Users,
      },
      {
        title: "Following",
        value:
          profile?.followingCount != null
            ? formatOptionalNumber(profile.followingCount)
            : isTikTokConnected && !hasStatsScope
              ? "Scope user.info.stats required"
              : getUnavailableValue(isTikTokConnected),
        icon: UserPlus,
      },
      {
        title: "Total Likes",
        value:
          profile?.likesCount != null
            ? formatOptionalNumber(profile.likesCount)
            : isTikTokConnected && !hasStatsScope
              ? "Scope user.info.stats required"
              : getUnavailableValue(isTikTokConnected),
        icon: Heart,
      },
      {
        title: "Public Videos",
        value: profile?.videoCount != null ? formatOptionalNumber(profile.videoCount) : getUnavailableValue(isTikTokConnected),
        icon: Clapperboard,
      },
    ]
  }, [hasStatsScope, isTikTokConnected, tiktokProfile])

  const commerceStats = useMemo(() => {
    const whatnotProductsCount = whatnotSnapshot?.data?.products?.edges?.length ?? null
    const whatnotProductsValue =
      whatnotProductsCount != null
        ? `${whatnotProductsCount.toLocaleString()} items`
        : whatnotSnapshot?.connected
          ? "Not available"
          : "Account not connected"

    const value = isTikTokConnected ? "Not available" : "Account not connected"

    return [
      { title: "Whatnot Products", value: whatnotProductsValue, icon: PackageSearch },
      { title: "Revenue", value, icon: CircleDollarSign },
      { title: "Avg Order Value", value, icon: DollarSign },
      { title: "Stream Duration", value, icon: Clock },
    ]
  }, [isTikTokConnected, whatnotSnapshot])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Monitor your live commerce performance and connected TikTok account"
      >
        <Button className="gap-2">
          <Video className="h-4 w-4" />
          Go Live
        </Button>
      </PageHeader>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">TikTok Account</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Live profile data from your connected TikTok account.
            </p>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" />
              Syncing
            </div>
          ) : isTikTokConnected ? (
            <StatusBadge variant="success" dot pulse>
              Connected
            </StatusBadge>
          ) : (
            <StatusBadge variant="warning">Not connected</StatusBadge>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed bg-muted/20">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4" />
                Loading TikTok profile
              </div>
            </div>
          ) : errorMessage ? (
            <EmptyState
              icon={AlertCircle}
              title="TikTok profile unavailable"
              description={errorMessage}
              className="min-h-40"
            />
          ) : !isTikTokConnected ? (
            <EmptyState
              icon={RefreshCw}
              title="Account not connected"
              description="Connect your TikTok account from launch pad to load live TikTok profile data on this dashboard."
              action={{
                label: "Connect account",
                onClick: () => {
                  window.location.href = launchPadLinks.tiktok
                },
              }}
              className="min-h-40"
            />
          ) : !tiktokProfile?.account ? (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 text-center">
              <div className="space-y-2">
                <p className="text-sm font-medium">TikTok account is connected</p>
                <p className="text-sm text-muted-foreground">
                  Profile sync is still in progress or limited by current scopes. Basic account connection is active.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="flex items-start gap-4 rounded-2xl border border-border/50 bg-muted/20 p-5">
                <Avatar className="h-16 w-16 border border-border/60">
                  <AvatarImage src={tiktokProfile.profile?.avatarLargeUrl || tiktokProfile.profile?.avatarUrl || undefined} alt="TikTok avatar" />
                  <AvatarFallback>{getAvatarFallback(tiktokProfile.profile, tiktokProfile.account)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">
                      {tiktokProfile.profile?.displayName || tiktokProfile.account.username || "TikTok account"}
                    </h2>
                    <StatusBadge variant="info">{tiktokProfile.account.platform}</StatusBadge>
                    {tiktokProfile.profile?.isVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Verified
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    @{tiktokProfile.profile?.username || tiktokProfile.account.username?.replace(/^@/, "") || tiktokProfile.account.externalId || "Unavailable"}
                  </p>
                  {tiktokProfile.profile?.bioDescription ? (
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      {tiktokProfile.profile.bioDescription}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Status: {tiktokProfile.account.status}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <RefreshCw className="h-4 w-4 text-primary" />
                      Last sync: {tiktokProfile.account.lastSyncedAt ? formatter.format(new Date(tiktokProfile.account.lastSyncedAt)) : "Not synced yet"}
                    </span>
                    {tiktokProfile.profile?.profileDeepLink ? (
                      <a
                        href={tiktokProfile.profile.profileDeepLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <LinkIcon className="h-4 w-4" />
                        Open profile
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {accountSummary.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border/50 bg-muted/20 p-4"
                  >
                    <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      {item.label}
                    </div>
                    <div className="mt-2 break-all text-sm font-medium text-foreground">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {isTikTokConnected && !hasStatsScope ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              Followers, Following, and Likes require TikTok scope <span className="font-medium">user.info.stats</span>.
              Reconnect TikTok from launch pad and approve stats access to load these values.
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiktokStats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
          />
        ))}
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {commerceStats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Current Platforms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {platformAccounts.map((platform) => (
              <div
                key={platform.id}
                className="flex items-center justify-between rounded-2xl border border-border/50 bg-muted/20 p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{platform.name}</div>
                    <StatusBadge variant={platform.connected ? "success" : "warning"}>
                      {platform.connected ? "Connected" : "Not connected"}
                    </StatusBadge>
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {platform.connected
                      ? platform.username || platform.externalId || "Not available"
                      : "Account not connected"}
                  </div>
                </div>
                <Button asChild variant={platform.connected ? "outline" : "default"} size="sm">
                  <Link href={platform.actionHref}>
                    {platform.connected ? "Manage" : "Connect account"}
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">API Availability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <PlugZap className="h-4 w-4 text-primary" />
                  Live from current APIs
                </div>
                <p className="mt-2">TikTok profile, account identity, followers, following, likes, and public video count. Whatnot inventory now uses the official GraphQL endpoint first.</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Radio className="h-4 w-4 text-primary" />
                  Whatnot fallback policy
                </div>
                <p className="mt-2">
                  Current source: {whatnotSnapshot?.source || "none"}. Fallback to structured mock data is only used for Whatnot access-denied or empty responses. Technical errors fail fast for debugging.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
