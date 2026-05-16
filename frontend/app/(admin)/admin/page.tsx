"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { StatCard } from "@/components/ui/stat-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowRight,
  BarChart3,
  CreditCard,
  Flag,
  ShieldAlert,
  ShieldCheck,
  Users,
  Video,
  Activity,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
} from "lucide-react"
import {
  getAdminDashboardStats,
  waitForSessionToken,
  type AdminDashboardStats,
  type AdminRecentSignup,
  type AdminRecentReport,
} from "@/lib/auth"

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  )
}

export default function AdminDashboard() {
  const { getToken, isLoaded } = useAuth()
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [recentSignups, setRecentSignups] = useState<AdminRecentSignup[]>([])
  const [recentReports, setRecentReports] = useState<AdminRecentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    fetchDashboard()
  }, [isLoaded])

  const fetchDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const token = await waitForSessionToken(getToken)
      const data = await getAdminDashboardStats(token)
      setStats(data.stats)
      setRecentSignups(data.recentSignups || [])
      setRecentReports(data.recentReports || [])
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err)
      setError("Failed to load dashboard data. Please refresh.")
    } finally {
      setLoading(false)
    }
  }

  const priorityColor: Record<string, string> = {
    critical: "bg-destructive/15",
    high: "bg-warning/15",
    medium: "bg-info/15",
    low: "bg-muted",
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform overview and management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics & Risk
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/user-profile-management">
              <Users className="mr-2 h-4 w-4" />
              Manage Users
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Primary Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              title="Total Users"
              value={stats?.totalUsers ?? 0}
              icon={Users}
              changeType="positive"
            />
            <StatCard
              title="Active Moderators"
              value={stats?.totalModerators ?? 0}
              icon={UserCheck}
              changeType="positive"
            />
            <StatCard
              title="Sellers / Streamers"
              value={stats?.totalSellers ?? 0}
              icon={Video}
              changeType="positive"
            />
            <StatCard
              title="Active Subscriptions"
              value={stats?.activeSubscriptions ?? 0}
              icon={CreditCard}
              changeType="positive"
            />
          </>
        )}
      </div>

      {/* Risk & Moderation Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              title="Blocked Accounts"
              value={stats?.blockedAccounts ?? 0}
              icon={UserX}
              changeType={stats?.blockedAccounts ? "negative" : "neutral"}
            />
            <StatCard
              title="Pending Review"
              value={stats?.pendingAccounts ?? 0}
              icon={Clock}
              changeType="neutral"
            />
            <StatCard
              title="Open Reports"
              value={stats?.openReports ?? 0}
              icon={Flag}
              changeType={stats?.openReports ? "negative" : "neutral"}
            />
            <StatCard
              title="Total Bookings"
              value={stats?.totalBookings ?? 0}
              icon={TrendingUp}
              changeType="positive"
            />
          </>
        )}
      </div>

      {/* Pending Actions Alert */}
      {!loading && stats && (stats.openReports > 0 || stats.pendingAccounts > 0) && (
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
                    {stats.openReports + stats.pendingAccounts} items need your attention
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {stats.openReports > 0 && (
                  <StatusBadge variant="warning">{stats.openReports} Open Reports</StatusBadge>
                )}
                {stats.pendingAccounts > 0 && (
                  <StatusBadge variant="warning">{stats.pendingAccounts} Pending Accounts</StatusBadge>
                )}
                {stats.blockedAccounts > 0 && (
                  <StatusBadge variant="destructive">{stats.blockedAccounts} Blocked</StatusBadge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Signups */}
        <Card className="border-border/50 bg-card/50 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Recent Signups
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/user-profile-management">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : recentSignups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent signups.</p>
            ) : (
              <div className="space-y-4">
                {recentSignups.map((user) => (
                  <div key={user._id} className="flex items-center gap-4 rounded-xl bg-muted/50 p-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {user.first_name?.charAt(0) ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge
                        variant={
                          user.user_type === "moderator"
                            ? "info"
                            : user.user_type === "seller"
                            ? "success"
                            : "default"
                        }
                      >
                        {user.user_type}
                      </StatusBadge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Recent Reports
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/analytics">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentReports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No reports yet.</p>
            ) : (
              <div className="space-y-4">
                {recentReports.map((report) => (
                  <div key={report._id} className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        priorityColor[report.priority] ?? "bg-muted"
                      }`}
                    >
                      <Flag className="h-4 w-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{report.reason}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground capitalize">{report.report_type}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground capitalize">{report.priority}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Health Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Staff Members</p>
                <p className="text-2xl font-bold">{loading ? "—" : stats?.totalStaff ?? 0}</p>
              </div>
              <ShieldCheck className="h-6 w-6 text-primary/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-gradient-to-br from-success/10 to-success/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reports Filed</p>
                <p className="text-2xl font-bold">{loading ? "—" : stats?.totalReports ?? 0}</p>
              </div>
              <Flag className="h-6 w-6 text-success/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-gradient-to-br from-warning/10 to-warning/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blocked Accounts</p>
                <p className="text-2xl font-bold">{loading ? "—" : stats?.blockedAccounts ?? 0}</p>
              </div>
              <UserX className="h-6 w-6 text-warning/60" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
