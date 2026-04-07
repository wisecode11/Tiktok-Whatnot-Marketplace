"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  Camera,
  Globe,
  Lock,
  Save,
  Shield,
  User,
} from "lucide-react"

export default function ModeratorSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account preferences and profile"
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          {/* Profile Picture */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>
                This will be displayed on your public profile
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  JM
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Button variant="outline" className="gap-2">
                  <Camera className="h-4 w-4" />
                  Change Photo
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or GIF. Max 2MB.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Personal Info */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your personal details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup>
                  <Field>
                    <FieldLabel>First Name</FieldLabel>
                    <Input defaultValue="Jordan" className="bg-muted/50" />
                  </Field>
                </FieldGroup>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Last Name</FieldLabel>
                    <Input defaultValue="Smith" className="bg-muted/50" />
                  </Field>
                </FieldGroup>
              </div>
              <FieldGroup>
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    type="email"
                    defaultValue="jordan@moderator.io"
                    className="bg-muted/50"
                  />
                </Field>
              </FieldGroup>
              <FieldGroup>
                <Field>
                  <FieldLabel>Bio</FieldLabel>
                  <Textarea
                    placeholder="Tell streamers about yourself..."
                    defaultValue="Experienced live commerce moderator with 2+ years helping streamers manage their audiences. Specializing in tech and fashion categories."
                    className="bg-muted/50 min-h-[100px]"
                  />
                </Field>
              </FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup>
                  <Field>
                    <FieldLabel>Timezone</FieldLabel>
                    <Select defaultValue="pst">
                      <SelectTrigger className="bg-muted/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pst">Pacific Time (PST)</SelectItem>
                        <SelectItem value="est">Eastern Time (EST)</SelectItem>
                        <SelectItem value="cst">Central Time (CST)</SelectItem>
                        <SelectItem value="mst">Mountain Time (MST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Language</FieldLabel>
                    <Select defaultValue="en">
                      <SelectTrigger className="bg-muted/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
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

          {/* Skills & Experience */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle>Skills & Experience</CardTitle>
              <CardDescription>
                Help streamers find you based on your expertise
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>Hourly Rate</FieldLabel>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      defaultValue="25"
                      className="bg-muted/50 pl-7"
                    />
                  </div>
                </Field>
              </FieldGroup>
              <FieldGroup>
                <Field>
                  <FieldLabel>Categories</FieldLabel>
                  <Select defaultValue="tech">
                    <SelectTrigger className="bg-muted/50">
                      <SelectValue placeholder="Select categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tech">Electronics & Tech</SelectItem>
                      <SelectItem value="fashion">Fashion</SelectItem>
                      <SelectItem value="beauty">Beauty</SelectItem>
                      <SelectItem value="home">Home & Living</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
              <FieldGroup>
                <Field>
                  <FieldLabel>Years of Experience</FieldLabel>
                  <Select defaultValue="2">
                    <SelectTrigger className="bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Less than 1 year</SelectItem>
                      <SelectItem value="2">1-2 years</SelectItem>
                      <SelectItem value="3">3-5 years</SelectItem>
                      <SelectItem value="5">5+ years</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  title: "New job opportunities",
                  description: "Get notified when new jobs match your profile",
                  enabled: true,
                },
                {
                  title: "Job requests",
                  description: "When a streamer sends you a direct job request",
                  enabled: true,
                },
                {
                  title: "Messages",
                  description: "New messages from streamers",
                  enabled: true,
                },
                {
                  title: "Payment notifications",
                  description: "When you receive a payment or withdrawal completes",
                  enabled: true,
                },
                {
                  title: "Review alerts",
                  description: "When you receive a new review",
                  enabled: false,
                },
                {
                  title: "Marketing emails",
                  description: "Tips, updates, and promotional content",
                  enabled: false,
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

        <TabsContent value="security" className="space-y-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>Current Password</FieldLabel>
                  <Input type="password" className="bg-muted/50" />
                </Field>
              </FieldGroup>
              <FieldGroup>
                <Field>
                  <FieldLabel>New Password</FieldLabel>
                  <Input type="password" className="bg-muted/50" />
                </Field>
              </FieldGroup>
              <FieldGroup>
                <Field>
                  <FieldLabel>Confirm New Password</FieldLabel>
                  <Input type="password" className="bg-muted/50" />
                </Field>
              </FieldGroup>
              <Button className="gap-2">
                <Lock className="h-4 w-4" />
                Update Password
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>
                Add an extra layer of security to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Authenticator App</p>
                    <p className="text-sm text-muted-foreground">
                      Use an authenticator app for 2FA
                    </p>
                  </div>
                </div>
                <Button variant="outline">Enable</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
