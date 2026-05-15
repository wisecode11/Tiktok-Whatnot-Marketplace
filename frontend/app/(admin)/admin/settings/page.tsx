"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"

import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand"
import {
  disconnectPlatform,
  getAdminPlatformSettings,
  getStripeStatus,
  startPlatformConnection,
  updateAdminPlatformFeePercent,
  waitForSessionToken,
  type AdminPlatformSettingsResponse,
  type StripeStatusResponse,
} from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Bell,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Save,
  Settings,
  Shield,
  Zap,
} from "lucide-react"

function AdminPaymentsSection() {
  const { getToken, isLoaded } = useAuth()
  const { toast } = useToast()
  const [settings, setSettings] = useState<AdminPlatformSettingsResponse | null>(null)
  const [stripeStatus, setStripeStatus] = useState<StripeStatusResponse | null>(null)
  const [feeInput, setFeeInput] = useState("15")
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingFee, setIsSavingFee] = useState(false)
  const [isConnectingStripe, setIsConnectingStripe] = useState(false)
  const [isDisconnectingStripe, setIsDisconnectingStripe] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setErrorMessage(null)
    try {
      const token = await waitForSessionToken(getToken)
      const [adminResult, stripeResult] = await Promise.all([
        getAdminPlatformSettings(token),
        getStripeStatus(token).catch(() => null),
      ])
      setSettings(adminResult)
      setStripeStatus(stripeResult)
      setFeeInput(String(adminResult.platformFeePercent ?? 15))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load platform settings.")
    } finally {
      setIsLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    if (!isLoaded) return
    void loadSettings()
  }, [isLoaded, loadSettings])

  const adminStripeAccount = settings?.adminStripeAccount || null
  const isStripeConnected = Boolean(
    adminStripeAccount?.stripeAccountId && adminStripeAccount.chargesEnabled,
  )
  const isStripeOnboardingPending = Boolean(
    adminStripeAccount?.stripeAccountId && !adminStripeAccount.chargesEnabled,
  )

  async function handleSaveFee() {
    const parsed = Number(feeInput)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      toast({
        title: "Invalid fee",
        description: "Platform fee must be a number between 0 and 100.",
        variant: "destructive",
      })
      return
    }

    setIsSavingFee(true)
    try {
      const token = await waitForSessionToken(getToken)
      const result = await updateAdminPlatformFeePercent(token, parsed)
      setSettings(result)
      setFeeInput(String(result.platformFeePercent ?? parsed))
      toast({
        title: "Platform fee updated",
        description: `New fee: ${result.platformFeePercent}%`,
      })
    } catch (error) {
      toast({
        title: "Failed to update fee",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingFee(false)
    }
  }

  async function handleConnectStripe() {
    setIsConnectingStripe(true)
    try {
      const token = await waitForSessionToken(getToken)
      const result = await startPlatformConnection(token, "stripe", "admin")
      window.location.href = result.authorizationUrl
    } catch (error) {
      toast({
        title: "Could not start Stripe onboarding",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
      setIsConnectingStripe(false)
    }
  }

  async function handleDisconnectStripe() {
    setIsDisconnectingStripe(true)
    try {
      const token = await waitForSessionToken(getToken)
      await disconnectPlatform(token, "stripe")
      toast({
        title: "Stripe account disconnected",
        description: "Platform fees can no longer be transferred until you reconnect.",
      })
      await loadSettings()
    } catch (error) {
      toast({
        title: "Failed to disconnect",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDisconnectingStripe(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>Platform Fee</CardTitle>
          <CardDescription>
            Percent retained by the platform from each moderator booking. The
            remaining amount is paid out to the moderator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup>
                  <Field>
                    <FieldLabel>Platform Fee (%)</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={feeInput}
                      onChange={(event) => setFeeInput(event.target.value)}
                      className="bg-muted/50"
                    />
                  </Field>
                </FieldGroup>
                <div className="flex items-end">
                  <p className="text-xs text-muted-foreground">
                    Current fee: <span className="font-medium text-foreground">{settings?.platformFeePercent ?? 15}%</span>
                    {" "}— moderator keeps {Math.max(0, 100 - (settings?.platformFeePercent ?? 15)).toFixed(2)}%.
                  </p>
                </div>
              </div>
              {errorMessage ? (
                <p className="text-sm text-destructive">{errorMessage}</p>
              ) : null}
              <div className="flex justify-end">
                <Button className="gap-2" onClick={() => void handleSaveFee()} disabled={isSavingFee}>
                  {isSavingFee ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Fee
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>Platform Stripe Account</CardTitle>
          <CardDescription>
            Connect a Stripe Express account that receives the platform fee from
            every moderator booking. Without a connected account, fees will stay
            in the platform Stripe balance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Stripe Connect (Platform)</p>
                  <p className="text-sm text-muted-foreground">
                    {adminStripeAccount?.stripeAccountId
                      ? `Account: ${adminStripeAccount.stripeAccountId}`
                      : "No platform Stripe account connected yet."}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isStripeConnected ? (
                      <StatusBadge variant="success">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Connected
                      </StatusBadge>
                    ) : isStripeOnboardingPending ? (
                      <StatusBadge variant="warning">Onboarding incomplete</StatusBadge>
                    ) : (
                      <StatusBadge variant="warning">Not connected</StatusBadge>
                    )}
                    {stripeStatus && stripeStatus.requirements && stripeStatus.requirements.length > 0 ? (
                      <span className="text-xs text-warning">
                        Requirements due: {stripeStatus.requirements.join(", ")}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isStripeConnected ? (
                  <Button
                    variant="outline"
                    onClick={() => void handleDisconnectStripe()}
                    disabled={isDisconnectingStripe}
                  >
                    {isDisconnectingStripe ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    onClick={() => void handleConnectStripe()}
                    disabled={isConnectingStripe}
                    className="gap-2"
                  >
                    {isConnectingStripe ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    {isStripeOnboardingPending ? "Resume Onboarding" : "Connect Stripe"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Settings"
        description="Configure global platform settings and preferences"
      />

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle>Platform Information</CardTitle>
              <CardDescription>
                Basic platform configuration settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>Platform Name</FieldLabel>
                  <Input defaultValue={BRAND_NAME} className="bg-muted/50" />
                </Field>
              </FieldGroup>
              <FieldGroup>
                <Field>
                  <FieldLabel>Support Email</FieldLabel>
                  <Input
                    type="email"
                    defaultValue={SUPPORT_EMAIL}
                    className="bg-muted/50"
                  />
                </Field>
              </FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup>
                  <Field>
                    <FieldLabel>Default Timezone</FieldLabel>
                    <Select defaultValue="utc">
                      <SelectTrigger className="bg-muted/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utc">UTC</SelectItem>
                        <SelectItem value="pst">Pacific Time (PST)</SelectItem>
                        <SelectItem value="est">Eastern Time (EST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Default Currency</FieldLabel>
                    <Select defaultValue="usd">
                      <SelectTrigger className="bg-muted/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usd">USD ($)</SelectItem>
                        <SelectItem value="eur">EUR (&euro;)</SelectItem>
                        <SelectItem value="gbp">GBP (&pound;)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
              </div>
              <div className="flex justify-end">
                <Button className="gap-2">
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle>Feature Toggles</CardTitle>
              <CardDescription>
                Enable or disable platform features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  title: "New User Registrations",
                  description: "Allow new users to sign up on the platform",
                  enabled: true,
                },
                {
                  title: "Maintenance Mode",
                  description: "Put the platform in maintenance mode",
                  enabled: false,
                },
                {
                  title: "Beta Features",
                  description: "Enable beta features for all users",
                  enabled: false,
                },
                {
                  title: "Analytics Collection",
                  description: "Collect anonymous usage analytics",
                  enabled: true,
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{feature.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                  <Switch defaultChecked={feature.enabled} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <AdminPaymentsSection />
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Configure platform security options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  title: "Require Email Verification",
                  description: "Users must verify email before accessing the platform",
                  enabled: true,
                },
                {
                  title: "Require 2FA for Admins",
                  description: "Admin accounts must enable two-factor authentication",
                  enabled: true,
                },
                {
                  title: "IP Rate Limiting",
                  description: "Limit requests per IP to prevent abuse",
                  enabled: true,
                },
                {
                  title: "Suspicious Activity Detection",
                  description: "Automatically flag suspicious account activity",
                  enabled: true,
                },
              ].map((setting) => (
                <div
                  key={setting.title}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{setting.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {setting.description}
                    </p>
                  </div>
                  <Switch defaultChecked={setting.enabled} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle>Session Settings</CardTitle>
              <CardDescription>
                Configure user session behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup>
                  <Field>
                    <FieldLabel>Session Timeout (hours)</FieldLabel>
                    <Input
                      type="number"
                      defaultValue="24"
                      className="bg-muted/50"
                    />
                  </Field>
                </FieldGroup>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Max Login Attempts</FieldLabel>
                    <Input
                      type="number"
                      defaultValue="5"
                      className="bg-muted/50"
                    />
                  </Field>
                </FieldGroup>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle>Admin Notifications</CardTitle>
              <CardDescription>
                Configure when admins receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  title: "New User Registration",
                  description: "When a new user signs up",
                  enabled: false,
                },
                {
                  title: "High-Priority Reports",
                  description: "When a critical or high-priority report is filed",
                  enabled: true,
                },
                {
                  title: "Large Transactions",
                  description: "Transactions above $1,000",
                  enabled: true,
                },
                {
                  title: "Verification Requests",
                  description: "When a user requests verification",
                  enabled: true,
                },
                {
                  title: "System Errors",
                  description: "When system errors occur",
                  enabled: true,
                },
              ].map((notification) => (
                <div
                  key={notification.title}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{notification.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {notification.description}
                    </p>
                  </div>
                  <Switch defaultChecked={notification.enabled} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
