import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { StatCard } from "@/components/ui/stat-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  DollarSign,
  Flag,
  ShieldCheck,
  TrendingUp,
  Users,
  Video,
  Activity,
} from "lucide-react"

const recentActivity = [
  {
    type: "signup",
    message: "New streamer registered: TechStyle Pro",
    time: "5 min ago",
  },
  {
    type: "verification",
    message: "Verification request from Fashion Hub",
    time: "15 min ago",
  },
  {
    type: "report",
    message: "Content report filed against user #4521",
    time: "1 hour ago",
  },
  {
    type: "transaction",
    message: "Large transaction flagged: $5,000+",
    time: "2 hours ago",
  },
  {
    type: "signup",
    message: "New moderator registered: Jordan K.",
    time: "3 hours ago",
  },
]

const topStreamers = [
  { name: "TechStyle Live", revenue: "$45,230", streams: 156, rating: 4.9 },
  { name: "Fashion Forward", revenue: "$38,450", streams: 142, rating: 4.8 },
  { name: "Beauty Boss", revenue: "$32,100", streams: 128, rating: 4.9 },
  { name: "Gadget Galaxy", revenue: "$28,750", streams: 98, rating: 5.0 },
]

const pendingActions = [
  { type: "verification", count: 5, label: "Pending Verifications" },
  { type: "report", count: 12, label: "Open Reports" },
  { type: "payout", count: 8, label: "Payout Requests" },
]

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Platform overview and management
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              Full Analytics
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/reports">
              <Flag className="mr-2 h-4 w-4" />
              View Reports
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value="$1.2M"
          change="+23%"
          changeType="positive"
          icon={DollarSign}
        />
        <StatCard
          title="Active Streamers"
          value="245"
          change="+12"
          changeType="positive"
          icon={Video}
        />
        <StatCard
          title="Active Moderators"
          value="89"
          change="+8"
          changeType="positive"
          icon={Users}
        />
        <StatCard
          title="Transactions Today"
          value="1,432"
          change="+18%"
          changeType="positive"
          icon={CreditCard}
        />
      </div>

      {/* Pending Actions Alert */}
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/15">
                <Activity className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="font-medium">Actions Required</p>
                <p className="text-sm text-muted-foreground">
                  {pendingActions.reduce((acc, a) => acc + a.count, 0)} items need your attention
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {pendingActions.map((action) => (
                <StatusBadge key={action.type} variant="warning">
                  {action.count} {action.label}
                </StatusBadge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Streamers */}
        <Card className="border-border/50 bg-card/50 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Top Performing Streamers
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/streamers">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topStreamers.map((streamer, index) => (
                <div
                  key={streamer.name}
                  className="flex items-center gap-4 rounded-xl bg-muted/50 p-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {index + 1}
                  </div>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {streamer.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{streamer.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {streamer.streams} streams
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">{streamer.revenue}</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <span className="text-warning">{streamer.rating}</span>
                      <span>rating</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      activity.type === "signup"
                        ? "bg-success/15"
                        : activity.type === "verification"
                        ? "bg-info/15"
                        : activity.type === "report"
                        ? "bg-destructive/15"
                        : "bg-warning/15"
                    }`}
                  >
                    {activity.type === "signup" && (
                      <Users className="h-4 w-4 text-success" />
                    )}
                    {activity.type === "verification" && (
                      <ShieldCheck className="h-4 w-4 text-info" />
                    )}
                    {activity.type === "report" && (
                      <Flag className="h-4 w-4 text-destructive" />
                    )}
                    {activity.type === "transaction" && (
                      <CreditCard className="h-4 w-4 text-warning" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border/50 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Platform GMV</p>
                <p className="text-2xl font-bold">$8.5M</p>
              </div>
              <div className="flex items-center text-sm text-success">
                <ArrowUpRight className="h-4 w-4" />
                32%
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-gradient-to-br from-accent/10 to-accent/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Live Streams Today</p>
                <p className="text-2xl font-bold">47</p>
              </div>
              <StatusBadge variant="success" dot pulse>Live</StatusBadge>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-gradient-to-br from-success/10 to-success/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Session Time</p>
                <p className="text-2xl font-bold">2h 34m</p>
              </div>
              <div className="flex items-center text-sm text-success">
                <ArrowUpRight className="h-4 w-4" />
                8%
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-gradient-to-br from-warning/10 to-warning/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold">4.8%</p>
              </div>
              <div className="flex items-center text-sm text-success">
                <ArrowUpRight className="h-4 w-4" />
                0.5%
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
