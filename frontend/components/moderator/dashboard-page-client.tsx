"use client"

import Link from "next/link"
import { useAuthenticatedUser } from "@/components/auth/authenticated-user-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DollarSign,
  BadgeCheck,
} from "lucide-react"

const todayBookings = [
  {
    id: "1",
    streamer: "TechStyle Live",
    avatar: "",
    platform: "TikTok Shop",
    time: "2:00 PM - 5:00 PM",
    payout: "$75",
    status: "confirmed",
  },
  {
    id: "2",
    streamer: "Fashion Forward",
    avatar: "",
    platform: "Whatnot",
    time: "6:30 PM - 8:00 PM",
    payout: "$45",
    status: "pending",
  },
]

const pendingRequests = [
  {
    id: "3",
    streamer: "Gadget Galaxy",
    platform: "Amazon Live",
    requestedFor: "Tomorrow, 6:00 PM - 9:00 PM",
    payout: "$84",
  },
  {
    id: "4",
    streamer: "Beauty Boss",
    platform: "TikTok Shop",
    requestedFor: "Fri, 1:00 PM - 3:00 PM",
    payout: "$60",
  },
]

export default function ModeratorDashboard() {
  const authenticatedUser = useAuthenticatedUser()
  const displayName = authenticatedUser
    ? authenticatedUser.firstName || authenticatedUser.lastName
      ? [authenticatedUser.firstName, authenticatedUser.lastName].filter(Boolean).join(" ")
      : authenticatedUser.email
    : "Moderator"

  const firstName = displayName.split(" ")[0] || "Moderator"

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-slate-50 via-white to-sky-50 p-5 dark:from-slate-950/40 dark:via-background dark:to-sky-950/20">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Hi {firstName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Focus only on what needs action right now.
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/moderator/bookings">
              <CalendarClock className="h-4 w-4" />
              Open Bookings
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending Requests</p>
            <p className="mt-2 text-2xl font-semibold">{pendingRequests.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Needs accept or decline</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Today Sessions</p>
            <p className="mt-2 text-2xl font-semibold">{todayBookings.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Confirmed and pending</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">This Week Earnings</p>
            <p className="mt-2 text-2xl font-semibold">$420</p>
            <p className="mt-1 text-xs text-muted-foreground">Expected payout</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-border/60 bg-card/70 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-primary" />
              Today Schedule
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/moderator/bookings">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="space-y-3">
            {todayBookings.map((job) => (
              <div
                key={job.id}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/70 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={job.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {job.streamer.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{job.streamer}</p>
                      <StatusBadge variant={job.status === "confirmed" ? "success" : "warning"}>
                        {job.status}
                      </StatusBadge>
                    </div>
                    <p className="text-sm text-muted-foreground">{job.platform}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock3 className="h-4 w-4" />
                    {job.time}
                  </div>
                  <div className="flex items-center gap-1.5 font-medium text-primary">
                    <DollarSign className="h-4 w-4" />
                    {job.payout}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Action Required
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {pendingRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-border/60 bg-background/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{request.streamer}</p>
                    <p className="truncate text-xs text-muted-foreground">{request.platform}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">{request.payout}</span>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">{request.requestedFor}</p>

                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" asChild>
                    <Link href="/moderator/bookings">Decline</Link>
                  </Button>
                  <Button size="sm" className="flex-1" asChild>
                    <Link href="/moderator/bookings">Accept</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/70">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Quick Actions</p>
            <p className="text-sm text-muted-foreground">Go directly to the screens you use most.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/moderator/availability">Update Availability</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/moderator/public-profile">
                <BadgeCheck className="mr-1 h-4 w-4" />
                Public Profile
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/moderator/bookings">
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Manage Bookings
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
