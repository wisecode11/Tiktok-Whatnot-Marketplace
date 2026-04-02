import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { StatusBadge } from "@/components/ui/status-badge"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Eye,
  Heart,
  Users,
  ShoppingCart,
  DollarSign,
  Clock,
  TrendingUp,
  MessageSquare,
  Video,
  Calendar,
} from "lucide-react"
import { mockDashboardStats, mockRecentActivity, mockUpcomingStreams } from "@/lib/mock-data"

export default function SellerDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Monitor your live commerce performance"
      >
        <Button className="gap-2">
          <Video className="h-4 w-4" />
          Go Live
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Views"
          value={mockDashboardStats.totalViews.toLocaleString()}
          change={mockDashboardStats.viewsChange}
          icon={Eye}
        />
        <StatCard
          title="Total Likes"
          value={mockDashboardStats.totalLikes.toLocaleString()}
          change={mockDashboardStats.likesChange}
          icon={Heart}
        />
        <StatCard
          title="Followers"
          value={mockDashboardStats.followers.toLocaleString()}
          change={mockDashboardStats.followersChange}
          icon={Users}
        />
        <StatCard
          title="Engagement Rate"
          value={`${mockDashboardStats.engagementRate}%`}
          change={mockDashboardStats.engagementChange}
          icon={TrendingUp}
        />
      </div>

      {/* Revenue Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Orders"
          value={mockDashboardStats.totalOrders.toLocaleString()}
          change={mockDashboardStats.ordersChange}
          icon={ShoppingCart}
        />
        <StatCard
          title="Revenue"
          value={`$${mockDashboardStats.revenue.toLocaleString()}`}
          change={mockDashboardStats.revenueChange}
          icon={DollarSign}
        />
        <StatCard
          title="Avg Order Value"
          value={`$${mockDashboardStats.avgOrderValue}`}
          change={mockDashboardStats.aovChange}
          icon={DollarSign}
        />
        <StatCard
          title="Stream Duration"
          value={mockDashboardStats.streamDuration}
          change={mockDashboardStats.durationChange}
          icon={Clock}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart Placeholder */}
        <Card className="border-border/50 bg-card/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="mx-auto mb-2 h-8 w-8" />
                <p>Analytics chart placeholder</p>
                <p className="text-sm">Connect real data to display charts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Streams */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Upcoming Streams</CardTitle>
            <Button variant="ghost" size="sm">
              <Calendar className="mr-1 h-4 w-4" />
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockUpcomingStreams.map((stream) => (
                <div
                  key={stream.id}
                  className="rounded-xl border border-border/50 bg-muted/30 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{stream.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {stream.scheduledAt}
                      </div>
                    </div>
                    <StatusBadge
                      variant={
                        stream.status === "scheduled" ? "info" : "default"
                      }
                    >
                      {stream.status}
                    </StatusBadge>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {stream.duration}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 uppercase">
                      {stream.platform}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockRecentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  {activity.type === "order" && (
                    <ShoppingCart className="h-4 w-4 text-primary" />
                  )}
                  {activity.type === "follow" && (
                    <Users className="h-4 w-4 text-primary" />
                  )}
                  {activity.type === "comment" && (
                    <MessageSquare className="h-4 w-4 text-primary" />
                  )}
                  {activity.type === "stream" && (
                    <Video className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm">{activity.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
