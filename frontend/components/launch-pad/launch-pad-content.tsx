"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { BRAND_HANDLE_PREFIX, BRAND_NAME } from "@/lib/brand"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Rocket,
  Sparkles,
  Video,
  Users,
  Wallet,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  disconnectPlatform,
  getCurrentUserProfile,
  getClerkErrorMessage,
  getConnectedAccounts,
  getWhatnotExtensionStatus,
  getStripeStatus,
  normalizeRole,
  startPlatformConnection,
  waitForSessionToken,
  getDashboardPath,
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
  ctaLabel?: string
}

const streamerPlatforms: Platform[] = [
  {
    id: "tiktok",
    name: "TikTok Shop",
    logo: "TT",
    description: "Connect your TikTok Shop seller account",
    connected: false,
    connecting: false,
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

const stripePayoutPlatforms: Record<"moderator" | "staff", Platform[]> = {
  moderator: [
    {
      id: "stripe",
      name: "Stripe Payments",
      logo: "ST",
      description: "Connect your Stripe account to receive payouts for moderation work",
      connected: false,
      connecting: false,
      required: true,
    },
  ],
  staff: [
    {
      id: "stripe",
      name: "Stripe Payments",
      logo: "ST",
      description: "Connect your Stripe account to receive payroll and work payouts",
      connected: false,
      connecting: false,
      required: true,
    },
  ],
}

function getPlatformsForRole(role: AppRole): Platform[] {
  if (role === "streamer") {
    return streamerPlatforms
  }

  if (role === "staff") {
    return stripePayoutPlatforms.staff
  }

  return stripePayoutPlatforms.moderator
}

function getRoleMeta(role: AppRole) {
  if (role === "streamer") {
    return {
      title: "Streamer",
      subtitle: `Connect your streaming platforms to get started with ${BRAND_NAME}`,
      icon: Video,
      usesStripe: false,
    }
  }

  if (role === "staff") {
    return {
      title: "Staff",
      subtitle: "Connect Stripe to receive payroll and payouts from your streamer",
      icon: Wallet,
      usesStripe: true,
    }
  }

  return {
    title: "Moderator",
    subtitle: "Connect Stripe to receive payouts for moderation work",
    icon: Users,
    usesStripe: true,
  }
}

export type LaunchPadContentProps = {
  /** When set, ignores `?role=` from the URL (used on embedded staff launch pad). */
  forcedRole?: AppRole
  /** Hides auth-only chrome when rendered inside staff layout. */
  embedded?: boolean
}

export function LaunchPadContent({ forcedRole, embedded = false }: LaunchPadContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getToken, isLoaded } = useAuth()
  const role = forcedRole ?? normalizeRole(searchParams.get("role")) ?? "streamer"
  const roleMeta = getRoleMeta(role)

  const [platforms, setPlatforms] = useState<Platform[]>(() => getPlatformsForRole(role))
  const [isLaunching, setIsLaunching] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(true)
  const [feedbackMessage, setFeedbackMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [autoConnectTriggered, setAutoConnectTriggered] = useState(false)
  const [isWhatnotDialogOpen, setIsWhatnotDialogOpen] = useState(false)
  const [licenseKey, setLicenseKey] = useState("")
  const [copiedLicenseKey, setCopiedLicenseKey] = useState(false)
  const isStreamer = role === "streamer"
  const dashboardPath = getDashboardPath(role)
  const Icon = roleMeta.icon

  useEffect(() => {
    setPlatforms(getPlatformsForRole(role))
  }, [role])

  useEffect(() => {
    const platform = searchParams.get("platform")
    const status = searchParams.get("status")
    const message = searchParams.get("message")

    if (!platform || !status) {
      return
    }

    if (platform === "stripe" && status === "return") {
      async function verifyStripe() {
        try {
          const token = await waitForSessionToken(getToken)
          const result = await getStripeStatus(token)

          if (result.connected) {
            setPlatforms((prev) =>
              prev.map((p) =>
                p.id === "stripe"
                  ? { ...p, connected: true, connecting: false, username: result.stripeAccountId }
                  : p,
              ),
            )
            setFeedbackMessage("Stripe account connected successfully. You are ready to receive payouts.")
            setErrorMessage("")
          } else {
            setFeedbackMessage("")
            setErrorMessage(
              "Stripe onboarding is incomplete. Please finish all required steps to enable payouts.",
            )
          }
        } catch (error) {
          setErrorMessage(getClerkErrorMessage(error))
        }
      }

      void verifyStripe()
      return
    }

    if (platform === "stripe" && status === "refresh") {
      setErrorMessage('Stripe onboarding link expired. Click "Connect Stripe Payments" to get a new link.')
      return
    }

    if (status === "connected") {
      const label = platform === "tiktok" ? "TikTok Shop" : platform === "whatnot" ? "Whatnot" : platform
      setFeedbackMessage(`${label} connected successfully.`)
      setErrorMessage("")
      return
    }

    if (status === "error") {
      setFeedbackMessage("")
      setErrorMessage(message || `Unable to connect ${platform}.`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const [connectionsResult, currentUserResult, whatnotStatusResult, stripeStatusResult] =
          await Promise.all([
            getConnectedAccounts(token),
            getCurrentUserProfile(token),
            isStreamer ? getWhatnotExtensionStatus(token) : Promise.resolve(null),
            roleMeta.usesStripe ? getStripeStatus(token) : Promise.resolve(null),
          ])

        if (cancelled) {
          return
        }

        setLicenseKey(currentUserResult.user.clerkUserId || "")
        setPlatforms((prev) =>
          prev.map((platform) => {
            if (platform.id === "whatnot" && whatnotStatusResult) {
              const isConnected = whatnotStatusResult.connected
              const isInstalled = whatnotStatusResult.extensionInstalled
              return {
                ...platform,
                connected: isConnected,
                connecting: false,
                username: isConnected
                  ? whatnotStatusResult.savedSession?.whatnotUsername || "@whatnot_connected"
                  : undefined,
                ctaLabel: isInstalled
                  ? "Connect Extension to Whatnot Account"
                  : "Connect Whatnot",
                error: isConnected
                  ? undefined
                  : isInstalled
                    ? "Extension detected. Open it and connect your Whatnot account."
                    : "Extension not detected. Install the extension, then connect your Whatnot account.",
              }
            }

            if (platform.id === "stripe" && stripeStatusResult) {
              return {
                ...platform,
                connected: stripeStatusResult.connected,
                connecting: false,
                username: stripeStatusResult.connected
                  ? stripeStatusResult.stripeAccountId
                  : undefined,
                error: stripeStatusResult.connected
                  ? undefined
                  : stripeStatusResult.detailsSubmitted
                    ? "Finish Stripe onboarding to enable payouts."
                    : platform.description,
              }
            }

            const connection = connectionsResult.accounts.find(
              (account) => account.platform === platform.id && account.connected,
            )

            if (!connection) {
              return { ...platform, connected: false, connecting: false, username: undefined, error: undefined }
            }

            return {
              ...platform,
              connected: true,
              connecting: false,
              username: connection.username || `@${BRAND_HANDLE_PREFIX}_${platform.id}`,
              error: undefined,
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
    const intervalId = window.setInterval(() => {
      void loadConnections()
    }, 10000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [getToken, isLoaded, isStreamer, roleMeta.usesStripe])

  const connectedCount = platforms.filter((p) => p.connected).length
  const hasRequiredPlatform = isStreamer
    ? platforms.some((p) => p.connected)
    : platforms.some((p) => p.required && p.connected)
  const progress = platforms.length > 0 ? (connectedCount / platforms.length) * 100 : 0

  const handleConnect = async (platformId: string) => {
    if (platformId === "whatnot") {
      setIsWhatnotDialogOpen(true)
      return
    }

    setPlatforms((prev) => prev.map((p) => (p.id === platformId ? { ...p, connecting: true } : p)))

    setFeedbackMessage("")
    setErrorMessage("")

    try {
      if (platformId === "tiktok" || platformId === "stripe" || platformId === "whatnot") {
        const token = await waitForSessionToken(getToken)
        const result = await startPlatformConnection(token, platformId, role)
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
      setPlatforms((prev) => prev.map((p) => (p.id === platformId ? { ...p, connecting: false } : p)))
      setErrorMessage(getClerkErrorMessage(error))
    }
  }

  const handleCopyLicenseKey = async () => {
    if (!licenseKey) {
      return
    }

    await navigator.clipboard.writeText(licenseKey)
    setCopiedLicenseKey(true)
    setTimeout(() => setCopiedLicenseKey(false), 1500)
  }

  useEffect(() => {
    const autoConnectPlatform = searchParams.get("autoconnect")

    if (!autoConnectPlatform || autoConnectTriggered || isRefreshing) {
      return
    }

    const platform = platforms.find((item) => item.id === autoConnectPlatform)

    if (!platform || platform.connected || platform.connecting) {
      setAutoConnectTriggered(true)
      return
    }

    setAutoConnectTriggered(true)
    void handleConnect(autoConnectPlatform)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnectTriggered, isRefreshing, platforms, searchParams])

  const handleDisconnect = async (platformId: string) => {
    setErrorMessage("")
    setFeedbackMessage("")

    try {
      if (platformId === "tiktok" || platformId === "stripe" || platformId === "whatnot") {
        const token = await waitForSessionToken(getToken)
        await disconnectPlatform(token, platformId)
      }

      const label =
        platformId === "tiktok"
          ? "TikTok Shop"
          : platformId === "stripe"
            ? "Stripe Payments"
            : platformId === "whatnot"
              ? "Whatnot"
              : platformId

      setPlatforms((prev) =>
        prev.map((p) => (p.id === platformId ? { ...p, connected: false, username: undefined } : p)),
      )
      setFeedbackMessage(`${label} disconnected.`)
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    }
  }

  const handleLaunch = async () => {
    setIsLaunching(true)
    await new Promise((resolve) => setTimeout(resolve, 600))
    router.push(dashboardPath)
  }

  const requiredPlatformMessage =
    role === "moderator" || role === "staff"
      ? "Please connect your Stripe account to enable payouts before continuing."
      : "Please connect at least one platform (TikTok Shop or Whatnot) to continue."

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 ring-1 ring-primary/20">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {roleMeta.title}!</h1>
        <p className="mt-2 text-muted-foreground">{roleMeta.subtitle}</p>
      </div>

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

      <div className="grid gap-4 sm:grid-cols-2">
        {platforms.map((platform) => (
          <Card
            key={platform.id}
            className={cn(
              "border-border/50 bg-card/50 transition-all",
              platform.connected && "border-primary/30 bg-primary/5",
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/50 font-bold text-lg",
                    platform.connected && "border-primary/30 bg-primary/10 text-primary",
                  )}
                >
                  {platform.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{platform.name}</span>
                    {platform.required ? <StatusBadge variant="warning">Required</StatusBadge> : null}
                  </div>
                  {platform.connected ? (
                    <p className="mt-1 truncate text-sm text-primary">{platform.username}</p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {platform.error || platform.description}
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
                        {platform.id === "whatnot"
                          ? platform.ctaLabel || "Connect Whatnot"
                          : `Connect ${platform.name}`}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!hasRequiredPlatform ? (
        <Card className="border-warning/30 bg-warning/10">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-medium text-warning">Platform Required</p>
              <p className="mt-1 text-warning/80">{requiredPlatformMessage}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {role === "streamer" ? (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">TikTok sandbox testing note</p>
              <p className="mt-1">
                If your TikTok app is still in sandbox mode, the TikTok account you use for login must be added in the
                app&apos;s Target Users list inside the TikTok developer portal. Otherwise TikTok can block login before
                it returns to this app.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        {!embedded ? (
          <Button variant="ghost" asChild className="text-muted-foreground">
            <Link href="/login">
              <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
              Back to login
            </Link>
          </Button>
        ) : (
          <div />
        )}

        <div className="flex gap-3 sm:ml-auto">
          <Button
            variant="outline"
            onClick={() => router.push(dashboardPath)}
            disabled={embedded ? false : !hasRequiredPlatform}
          >
            {embedded ? "Skip for now" : "Skip for now"}
          </Button>
          <Button onClick={handleLaunch} disabled={!hasRequiredPlatform || isLaunching} className="gap-2">
            {isLaunching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {embedded ? "Continuing..." : "Launching..."}
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                {embedded ? "Continue to modules" : "Launch Dashboard"}
              </>
            )}
          </Button>
        </div>
      </div>

      {!embedded ? (
        <p className="text-center text-sm text-muted-foreground">
          Need help connecting your platforms?{" "}
          <Link href="/help/platforms" className="text-primary hover:underline">
            View our setup guide
          </Link>
        </p>
      ) : null}

      <Dialog open={isWhatnotDialogOpen} onOpenChange={setIsWhatnotDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect Whatnot to {BRAND_NAME}</DialogTitle>
            <DialogDescription>
              Complete these steps to connect your Whatnot account with our marketplace extension flow.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background p-2">
                <Image
                  src="/whatnotImage.png"
                  alt="Whatnot logo"
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain"
                />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className="flex h-12 min-w-44 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 font-semibold">
                <Image
                  src="/icon.svg"
                  alt={`${BRAND_NAME} logo`}
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain"
                />
                <span>{BRAND_NAME}</span>
              </div>
            </div>
          </div>

          <Button asChild className="w-full">
            <a href="/downloads/whatnot-extension-updated.zip" download>
              Download extension
            </a>
          </Button>

          <div className="rounded-lg border border-border/70 bg-background p-4">
            <p className="text-sm font-medium">License key (Clerk User ID)</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs">
                {licenseKey || "Unable to load license key. Refresh and try again."}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopyLicenseKey()}
                disabled={!licenseKey}
              >
                <Copy className="mr-1 h-4 w-4" />
                {copiedLicenseKey ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Download the extension using the button above.</li>
            <li>Open `whatnot.com` and sign in with your Whatnot account.</li>
            <li>Open extension popup and paste the license key (Clerk User ID).</li>
            <li>In extension, click `Connect Whatnot`.</li>
            <li>Return to launch pad and continue your setup.</li>
          </ol>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsWhatnotDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
