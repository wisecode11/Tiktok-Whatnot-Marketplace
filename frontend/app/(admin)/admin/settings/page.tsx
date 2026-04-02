"use client"

import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { PageHeader } from "@/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Bell,
  CreditCard,
  Globe,
  Lock,
  Save,
  Settings,
  Shield,
  Zap,
} from "lucide-react"

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
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle>Commission Settings</CardTitle>
              <CardDescription>
                Configure platform commission rates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup>
                  <Field>
                    <FieldLabel>Streamer Commission (%)</FieldLabel>
                    <Input
                      type="number"
                      defaultValue="10"
                      className="bg-muted/50"
                    />
                  </Field>
                </FieldGroup>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Moderator Commission (%)</FieldLabel>
                    <Input
                      type="number"
                      defaultValue="5"
                      className="bg-muted/50"
                    />
                  </Field>
                </FieldGroup>
              </div>
              <FieldGroup>
                <Field>
                  <FieldLabel>Minimum Payout Amount ($)</FieldLabel>
                  <Input
                    type="number"
                    defaultValue="50"
                    className="bg-muted/50"
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle>Payment Gateways</CardTitle>
              <CardDescription>
                Configure payment processing integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: "Stripe", status: "connected", icon: Zap },
                { name: "PayPal", status: "not_connected", icon: Globe },
              ].map((gateway) => (
                <div
                  key={gateway.name}
                  className="flex items-center justify-between rounded-xl bg-muted/50 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <gateway.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{gateway.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {gateway.status === "connected" ? "Connected" : "Not connected"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={gateway.status === "connected" ? "outline" : "default"}
                  >
                    {gateway.status === "connected" ? "Configure" : "Connect"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
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
