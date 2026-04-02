import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { StatCard } from "@/components/ui/stat-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ArrowRight,
  Briefcase,
  Calendar,
  Clock,
  DollarSign,
  Star,
  TrendingUp,
  Video,
  Users,
  CheckCircle2,
} from "lucide-react"

const upcomingJobs = [
  {
    id: "1",
    streamer: "TechStyle Live",
    avatar: "",
    platform: "TikTok Shop",
    date: "Today",
    time: "2:00 PM - 5:00 PM",
    rate: "$25/hr",
    status: "confirmed",
  },
  {
    id: "2",
    streamer: "Fashion Forward",
    avatar: "",
    platform: "Whatnot",
    date: "Tomorrow",
    time: "10:00 AM - 2:00 PM",
    rate: "$30/hr",
    status: "pending",
  },
  {
    id: "3",
    streamer: "Gadget Galaxy",
    avatar: "",
    platform: "Amazon Live",
    date: "Mar 28",
    time: "6:00 PM - 9:00 PM",
    rate: "$28/hr",
    status: "confirmed",
  },
]

const recentActivity = [
  {
    type: "payment",
    message: "Payment received from TechStyle Live",
    amount: "$150.00",
    time: "2 hours ago",
  },
  {
    type: "review",
    message: "New 5-star review from Fashion Forward",
    time: "5 hours ago",
  },
  {
    type: "job",
    message: "Job request from Gadget Galaxy",
    time: "1 day ago",
  },
  {
    type: "milestone",
    message: "Reached 50 completed streams!",
    time: "2 days ago",
  },
]

export default function ModeratorDashboard() {
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Welcome back, Jordan
          </h1>
          <p className="text-muted-foreground">
            You have 3 upcoming jobs this week
          </p>
        </div>
        <Button asChild className="gap-2 shadow-lg shadow-primary/25">
          <Link href="/moderator/marketplace">
            <Briefcase className="h-4 w-4" />
            Find New Jobs
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="This Month Earnings"
          value="$2,450"
          change="+18%"
          changeType="positive"
          icon={DollarSign}
        />
        <StatCard
          title="Completed Streams"
          value="52"
          change="+8"
          changeType="positive"
          icon={Video}
        />
        <StatCard
          title="Average Rating"
          value="4.9"
          icon={Star}
          iconColor="text-warning"
        />
        <StatCard
          title="Active Clients"
          value="8"
          change="+2"
          changeType="positive"
          icon={Users}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming Jobs */}
        <Card className="border-border/50 bg-card/50 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Upcoming Jobs
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/moderator/jobs">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-4 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={job.avatar} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {job.streamer.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{job.streamer}</span>
                    <StatusBadge
                      variant={job.status === "confirmed" ? "success" : "warning"}
                      size="sm"
                    >
                      {job.status}
                    </StatusBadge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span>{job.platform}</span>
                    <span>-</span>
                    <span>{job.date}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {job.time}
                  </div>
                  <div className="mt-1 font-semibold text-primary">
                    {job.rate}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    {activity.type === "payment" && (
                      <DollarSign className="h-4 w-4 text-primary" />
                    )}
                    {activity.type === "review" && (
                      <Star className="h-4 w-4 text-warning" />
                    )}
                    {activity.type === "job" && (
                      <Briefcase className="h-4 w-4 text-accent" />
                    )}
                    {activity.type === "milestone" && (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{activity.message}</p>
                    {activity.amount && (
                      <p className="text-sm font-semibold text-primary">
                        {activity.amount}
                      </p>
                    )}
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
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hours This Week</p>
              <p className="text-2xl font-bold">24.5</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-gradient-to-br from-accent/10 to-accent/5">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15">
              <Video className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Live Streams Moderated</p>
              <p className="text-2xl font-bold">156</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-gradient-to-br from-success/10 to-success/5">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/15">
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Response Rate</p>
              <p className="text-2xl font-bold">98%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
