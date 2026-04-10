"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import {
  Eye,
  MessageSquare,
  Users,
  UserPlus,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { StatCard } from "@/components/ui/stat-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  AuthApiError,
  getTikTokVideoAnalytics,
  waitForSessionToken,
  type TikTokVideoAnalyticsResponse,
} from "@/lib/auth"

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "Not available"
}

const PAGE_SIZE = 10

export default function SellerAnalytics() {
  const { getToken, isLoaded } = useAuth()
  const [analytics, setAnalytics] = useState<TikTokVideoAnalyticsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cursorTrail, setCursorTrail] = useState<Array<number | null>>([null])
  const [pageIndex, setPageIndex] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadAnalytics() {
      if (!isLoaded) {
        return
      }

      try {
        setIsLoading(true)
        setErrorMessage(null)

        const token = await waitForSessionToken(getToken)
        const cursor = cursorTrail[pageIndex] ?? undefined
        const result = await getTikTokVideoAnalytics(token, { cursor: cursor ?? undefined, maxCount: PAGE_SIZE })

        if (!cancelled) {
          setAnalytics(result)
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        const message =
          error instanceof AuthApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to load analytics right now."

        setErrorMessage(message)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadAnalytics()

    return () => {
      cancelled = true
    }
  }, [cursorTrail, getToken, isLoaded, pageIndex])

  const avgViewsPerVideo = useMemo(() => {
    if (!analytics || !analytics.summary.totalVideos || analytics.summary.totalViews == null) {
      return null
    }

    return analytics.summary.totalViews / analytics.summary.totalVideos
  }, [analytics])

  const overviewStats = useMemo(() => {
    return [
      {
        title: "Combined Views",
        value: formatNumber(analytics?.summary.totalViews),
        icon: Eye,
      },
      {
        title: "Combined Comments",
        value: formatNumber(analytics?.summary.totalComments),
        icon: MessageSquare,
      },
      {
        title: "Account Followers",
        value: formatNumber(analytics?.followerBreakdown?.followers),
        icon: Users,
      },
      {
        title: "Account Following",
        value: formatNumber(analytics?.followerBreakdown?.following),
        icon: UserPlus,
      },
    ]
  }, [analytics])

  const canGoBack = pageIndex > 0
  const canGoNext = Boolean(analytics?.pagination.hasMore && analytics?.pagination.cursor != null)
  const currentScopeText = analytics?.account?.scopes || "Unavailable"

  function handlePrevPage() {
    if (!canGoBack) {
      return
    }

    setPageIndex((current) => Math.max(0, current - 1))
  }

  function handleNextPage() {
    if (!canGoNext || analytics?.pagination.cursor == null) {
      return
    }

    setCursorTrail((current) => {
      if (current[pageIndex + 1] === analytics.pagination.cursor) {
        return current
      }

      return [...current.slice(0, pageIndex + 1), analytics.pagination.cursor]
    })
    setPageIndex((current) => current + 1)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Live TikTok video analytics from your connected account.">
        <Button variant="outline" className="gap-2" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </PageHeader>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {isLoading ? (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="flex min-h-40 items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-4 w-4" />
                  Loading TikTok analytics
                </div>
              </CardContent>
            </Card>
          ) : errorMessage ? (
            <EmptyState icon={AlertCircle} title="Analytics unavailable" description={errorMessage} className="min-h-40" />
          ) : !analytics?.connected ? (
            <EmptyState
              icon={RefreshCw}
              title="Account not connected"
              description="Connect your TikTok account from Launch Pad to load video analytics."
              action={{
                label: "Connect TikTok",
                onClick: () => {
                  window.location.href = "/launch-pad?role=streamer&autoconnect=tiktok"
                },
              }}
              className="min-h-40"
            />
          ) : !analytics.hasVideoScope ? (
            <EmptyState
              icon={AlertCircle}
              title="video.list scope required"
              description={`Your TikTok app token does not include video.list. Current scopes: ${currentScopeText}. Add video.list in TikTok developer portal and reconnect TikTok.`}
              action={{
                label: "Reconnect TikTok",
                onClick: () => {
                  window.location.href = "/launch-pad?role=streamer&autoconnect=tiktok"
                },
              }}
              className="min-h-40"
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {overviewStats.map((item) => (
                  <StatCard key={item.title} title={item.title} value={item.value} icon={item.icon} />
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-border/50 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Audience Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        This section shows raw TikTok account counters from <span className="font-medium">/v2/user/info</span>.
                        It is not a demographic or audience-segment breakdown.
                      </div>
                    </div>

                    <div className="grid gap-3 pt-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-border/50 p-3">
                        <p className="text-xs text-muted-foreground">Followers</p>
                        <p className="mt-1 text-lg font-semibold">{formatNumber(analytics.followerBreakdown?.followers)}</p>
                      </div>
                      <div className="rounded-lg border border-border/50 p-3">
                        <p className="text-xs text-muted-foreground">Following</p>
                        <p className="mt-1 text-lg font-semibold">{formatNumber(analytics.followerBreakdown?.following)}</p>
                      </div>
                      <div className="rounded-lg border border-border/50 p-3">
                        <p className="text-xs text-muted-foreground">Total Likes</p>
                        <p className="mt-1 text-lg font-semibold">{formatNumber(analytics.followerBreakdown?.likes)}</p>
                      </div>
                      <div className="rounded-lg border border-border/50 p-3">
                        <p className="text-xs text-muted-foreground">Public Videos</p>
                        <p className="mt-1 text-lg font-semibold">{formatNumber(analytics.followerBreakdown?.videos)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Video Totals</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground">Videos in current page</p>
                      <p className="mt-1 text-lg font-semibold">{analytics.summary.totalVideos}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground">Combined Likes</p>
                      <p className="mt-1 text-lg font-semibold">{formatNumber(analytics.summary.totalLikes)}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground">Combined Shares</p>
                      <p className="mt-1 text-lg font-semibold">{formatNumber(analytics.summary.totalShares)}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground">Has more videos</p>
                      <p className="mt-1 text-lg font-semibold">{analytics.pagination.hasMore ? "Yes" : "No"}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3 sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Scope of this page</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        These totals are calculated from the latest TikTok videos returned for page {pageIndex + 1}, not the entire account history.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/50 bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Per-Video Performance</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Showing page {pageIndex + 1} of your latest TikTok videos returned by the API.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={!canGoBack || isLoading}>
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!canGoNext || isLoading}>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!analytics.videos.length ? (
                    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed bg-muted/20">
                      <p className="text-sm text-muted-foreground">No public videos returned by TikTok for this account.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {analytics.videos.map((video, index) => (
                        <div key={video.id || `video-${index}`} className="rounded-xl border border-border/50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{video.title || "Untitled TikTok video"}</p>
                              <p className="text-xs text-muted-foreground">Video ID: {video.id || "Not available"}</p>
                            </div>
                            {video.shareUrl ? (
                              <Button asChild size="sm" variant="outline">
                                <Link href={video.shareUrl} target="_blank" rel="noreferrer">
                                  Open Video
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-4">
                            <p className="text-xs text-muted-foreground">
                              Views: <span className="font-medium text-foreground">{formatNumber(video.viewCount)}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Comments: <span className="font-medium text-foreground">{formatNumber(video.commentCount)}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Likes: <span className="font-medium text-foreground">{formatNumber(video.likeCount)}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Shares: <span className="font-medium text-foreground">{formatNumber(video.shareCount)}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
              Engagement insights are derived from the currently loaded page of TikTok videos in Overview.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
              Sales analytics are not available from TikTok video APIs yet.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audience" className="space-y-6">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
              Audience demographics are not provided by current TikTok scopes.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
