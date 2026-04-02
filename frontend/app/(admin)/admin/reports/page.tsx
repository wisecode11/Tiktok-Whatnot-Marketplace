"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PageHeader } from "@/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  Flag,
  MessageSquare,
  MoreHorizontal,
  ShieldAlert,
  XCircle,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const reports = [
  {
    id: "1",
    type: "content",
    reportedUser: "BadActor123",
    reportedBy: "TechStyle Live",
    reason: "Spam/Promotional content",
    description: "User repeatedly posting promotional links in chat during stream.",
    status: "open",
    priority: "high",
    createdAt: "2 hours ago",
  },
  {
    id: "2",
    type: "behavior",
    reportedUser: "TrollAccount",
    reportedBy: "Fashion Forward",
    reason: "Harassment",
    description: "User sending threatening messages to other viewers.",
    status: "open",
    priority: "critical",
    createdAt: "5 hours ago",
  },
  {
    id: "3",
    type: "content",
    reportedUser: "SuspiciousSeller",
    reportedBy: "System",
    reason: "Fraudulent activity",
    description: "Multiple chargebacks detected on this account.",
    status: "investigating",
    priority: "critical",
    createdAt: "1 day ago",
  },
  {
    id: "4",
    type: "content",
    reportedUser: "SpamBot42",
    reportedBy: "Beauty Boss",
    reason: "Bot activity",
    description: "Automated messages detected in stream chat.",
    status: "resolved",
    priority: "medium",
    createdAt: "2 days ago",
    resolvedAt: "1 day ago",
  },
  {
    id: "5",
    type: "behavior",
    reportedUser: "RudeViewer",
    reportedBy: "Gadget Galaxy",
    reason: "Inappropriate language",
    description: "Using offensive language in stream chat.",
    status: "dismissed",
    priority: "low",
    createdAt: "3 days ago",
  },
]

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState("open")

  const filteredReports = reports.filter((report) => {
    if (activeTab === "open") return report.status === "open" || report.status === "investigating"
    if (activeTab === "resolved") return report.status === "resolved"
    if (activeTab === "dismissed") return report.status === "dismissed"
    return true
  })

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "destructive"
      case "high":
        return "warning"
      case "medium":
        return "info"
      default:
        return "secondary"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <Clock className="h-4 w-4" />
      case "investigating":
        return <Eye className="h-4 w-4" />
      case "resolved":
        return <CheckCircle2 className="h-4 w-4" />
      case "dismissed":
        return <XCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Review and manage user reports and violations"
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15">
              <ShieldAlert className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">3</p>
              <p className="text-sm text-muted-foreground">Critical</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/15">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">5</p>
              <p className="text-sm text-muted-foreground">High Priority</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-info/30 bg-info/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/15">
              <Eye className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">2</p>
              <p className="text-sm text-muted-foreground">Investigating</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">24</p>
              <p className="text-sm text-muted-foreground">Resolved (30d)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="open" className="gap-2">
            <Flag className="h-4 w-4" />
            Open ({reports.filter(r => r.status === "open" || r.status === "investigating").length})
          </TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
          <TabsTrigger value="all">All Reports</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <Card
                key={report.id}
                className="border-border/50 bg-card/50 transition-all hover:border-primary/30"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Left Section */}
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-destructive/10 text-destructive">
                          {report.reportedUser.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{report.reportedUser}</span>
                          <StatusBadge variant={getPriorityColor(report.priority) as any} size="sm">
                            {report.priority}
                          </StatusBadge>
                          <StatusBadge
                            variant={
                              report.status === "open"
                                ? "warning"
                                : report.status === "investigating"
                                ? "info"
                                : report.status === "resolved"
                                ? "success"
                                : "secondary"
                            }
                            size="sm"
                          >
                            {getStatusIcon(report.status)}
                            <span className="ml-1">{report.status}</span>
                          </StatusBadge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Flag className="h-3.5 w-3.5" />
                          <span>{report.reason}</span>
                          <span>-</span>
                          <span>Reported by {report.reportedBy}</span>
                        </div>
                        <p className="text-sm">{report.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Reported {report.createdAt}
                          {report.resolvedAt && ` - Resolved ${report.resolvedAt}`}
                        </p>
                      </div>
                    </div>

                    {/* Right Section - Actions */}
                    <div className="flex items-center gap-2">
                      {(report.status === "open" || report.status === "investigating") && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1.5">
                            <MessageSquare className="h-4 w-4" />
                            Contact
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive">
                            <Ban className="h-4 w-4" />
                            Ban User
                          </Button>
                          <Button size="sm" className="gap-1.5">
                            <CheckCircle2 className="h-4 w-4" />
                            Resolve
                          </Button>
                        </>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>View User Profile</DropdownMenuItem>
                          <DropdownMenuItem>View Report History</DropdownMenuItem>
                          <DropdownMenuItem>Add Note</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {report.status !== "dismissed" && (
                            <DropdownMenuItem>Dismiss Report</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
