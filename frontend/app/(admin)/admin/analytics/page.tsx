"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertTriangle,
  Ban,
  BarChart3,
  CheckCircle2,
  Eye,
  Flag,
  MoreHorizontal,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  UserX,
  XCircle,
} from "lucide-react"
import {
  getAdminRiskAnalytics,
  updateAdminReportStatus,
  waitForSessionToken,
  type AdminRiskAnalyticsResponse,
  type AdminRiskReport,
} from "@/lib/auth"

const PRIORITY_CONFIG: Record<string, { label: string; variant: "destructive" | "warning" | "info" | "default" }> = {
  critical: { label: "Critical", variant: "destructive" },
  high: { label: "High", variant: "warning" },
  medium: { label: "Medium", variant: "info" },
  low: { label: "Low", variant: "default" },
}

const STATUS_CONFIG: Record<string, { label: string; variant: "destructive" | "warning" | "info" | "success" | "default" }> = {
  open: { label: "Open", variant: "destructive" },
  under_review: { label: "Under Review", variant: "warning" },
  resolved: { label: "Resolved", variant: "success" },
  dismissed: { label: "Dismissed", variant: "default" },
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  colorClass,
  loading,
}: {
  title: string
  value: number
  icon: React.ElementType
  colorClass: string
  loading: boolean
}) {
  return (
    <Card className={`border-border/50 bg-gradient-to-br ${colorClass}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="mt-1 h-8 w-12" />
            ) : (
              <p className="text-2xl font-bold">{value}</p>
            )}
          </div>
          <Icon className="h-6 w-6 text-muted-foreground/60" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function AnalyticsRiskPage() {
  const { getToken, isLoaded } = useAuth()
  const [data, setData] = useState<AdminRiskAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null)

  const fetchRiskData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const token = await waitForSessionToken(getToken)
      const result = await getAdminRiskAnalytics(token)
      setData(result)
    } catch (err) {
      console.error("Failed to fetch risk analytics:", err)
      setError("Failed to load analytics. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    if (!isLoaded) return
    fetchRiskData()
  }, [isLoaded, fetchRiskData])

  const handleUpdateReportStatus = async (
    reportId: string,
    status: "open" | "under_review" | "resolved" | "dismissed",
  ) => {
    try {
      setUpdatingReportId(reportId)
      const token = await waitForSessionToken(getToken)
      await updateAdminReportStatus(token, reportId, status)
      // Refresh data after update
      await fetchRiskData()
    } catch (err) {
      console.error("Failed to update report:", err)
    } finally {
      setUpdatingReportId(null)
    }
  }

  const summary = data?.summary
  const reportsByPriority = data?.reportsByPriority ?? {}
  const reportsByType = data?.reportsByType ?? {}

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics & Risk Control"
        description="Monitor reported users, blocked accounts, and platform risk indicators."
      >
        <Button variant="outline" size="sm" onClick={fetchRiskData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </PageHeader>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Risk Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Reported Users"
          value={summary?.totalReportedUsers ?? 0}
          icon={Flag}
          colorClass="from-destructive/10 to-destructive/5"
          loading={loading}
        />
        <SummaryCard
          title="Blocked Accounts"
          value={summary?.blockedAccounts ?? 0}
          icon={UserX}
          colorClass="from-warning/10 to-warning/5"
          loading={loading}
        />
        <SummaryCard
          title="Open Reports"
          value={summary?.openReports ?? 0}
          icon={ShieldAlert}
          colorClass="from-orange-500/10 to-orange-500/5"
          loading={loading}
        />
        <SummaryCard
          title="Under Review"
          value={summary?.underReviewReports ?? 0}
          icon={Eye}
          colorClass="from-info/10 to-info/5"
          loading={loading}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Resolved Reports"
          value={summary?.resolvedReports ?? 0}
          icon={CheckCircle2}
          colorClass="from-success/10 to-success/5"
          loading={loading}
        />
        <SummaryCard
          title="Dismissed Reports"
          value={summary?.dismissedReports ?? 0}
          icon={XCircle}
          colorClass="from-muted/50 to-muted/20"
          loading={loading}
        />
        <SummaryCard
          title="Total Reports"
          value={summary?.totalReports ?? 0}
          icon={BarChart3}
          colorClass="from-primary/10 to-primary/5"
          loading={loading}
        />
      </div>

      {/* Breakdown Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Reports by Priority */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Reports by Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {["critical", "high", "medium", "low"].map((priority) => {
                  const count = reportsByPriority[priority] ?? 0
                  const total = summary?.totalReports || 1
                  const pct = Math.round((count / total) * 100)
                  return (
                    <div key={priority} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <StatusBadge variant={PRIORITY_CONFIG[priority]?.variant ?? "default"}>
                            {PRIORITY_CONFIG[priority]?.label ?? priority}
                          </StatusBadge>
                        </div>
                        <span className="font-medium">{count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className={`h-1.5 rounded-full ${
                            priority === "critical"
                              ? "bg-destructive"
                              : priority === "high"
                              ? "bg-warning"
                              : priority === "medium"
                              ? "bg-info"
                              : "bg-muted-foreground/40"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reports by Type */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Reports by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            ) : Object.keys(reportsByType).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No reports yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(reportsByType).map(([type, count]) => {
                  const total = summary?.totalReports || 1
                  const pct = Math.round((count / total) * 100)
                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize font-medium">{type}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tables */}
      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">
            <Flag className="mr-2 h-4 w-4" />
            Recent Reports
          </TabsTrigger>
          <TabsTrigger value="blocked">
            <Ban className="mr-2 h-4 w-4" />
            Recently Blocked
          </TabsTrigger>
        </TabsList>

        {/* Recent Reports Table */}
        <TabsContent value="reports">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Recent User Reports</CardTitle>
              <CardDescription>
                Latest reports filed. Update their status to track moderation progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-2 p-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !data?.recentReports?.length ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No reports filed yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reported User</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentReports.map((report) => (
                      <TableRow key={report._id}>
                        <TableCell>
                          {report.reportedUser ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src="" />
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {report.reportedUser.first_name?.charAt(0) ?? "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {report.reportedUser.first_name} {report.reportedUser.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {report.reportedUser.email}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {report.reported_user_id.slice(0, 8)}…
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="truncate text-sm">{report.reason}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {report.report_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={PRIORITY_CONFIG[report.priority]?.variant ?? "default"}>
                            {PRIORITY_CONFIG[report.priority]?.label ?? report.priority}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={STATUS_CONFIG[report.status]?.variant ?? "default"}>
                            {STATUS_CONFIG[report.status]?.label ?? report.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(report.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={updatingReportId === report._id}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleUpdateReportStatus(report._id, "under_review")}
                                disabled={report.status === "under_review"}
                              >
                                <Eye className="mr-2 h-4 w-4 text-warning" />
                                Mark Under Review
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleUpdateReportStatus(report._id, "resolved")}
                                disabled={report.status === "resolved"}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                                Mark Resolved
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleUpdateReportStatus(report._id, "dismissed")}
                                disabled={report.status === "dismissed"}
                              >
                                <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                                Dismiss
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleUpdateReportStatus(report._id, "open")}
                                disabled={report.status === "open"}
                              >
                                <Flag className="mr-2 h-4 w-4 text-destructive" />
                                Reopen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recently Blocked Tab */}
        <TabsContent value="blocked">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Recently Blocked Accounts</CardTitle>
              <CardDescription>
                Accounts that have been blocked on the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-2 p-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !data?.recentlyBlocked?.length ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No blocked accounts.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Blocked On</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentlyBlocked.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src="" />
                              <AvatarFallback className="text-xs bg-destructive/10 text-destructive">
                                {user.first_name?.charAt(0) ?? "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {user.first_name} {user.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {user.user_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(user.updated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={`/admin/user-profile-management`}>
                              <Users className="mr-1 h-3 w-3" />
                              View Profile
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
