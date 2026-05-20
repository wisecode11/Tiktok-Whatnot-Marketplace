"use client"

import { useAuth } from "@clerk/nextjs"
import { CalendarDays, Clock3, ExternalLink, Loader2, Radio, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { waitForSessionToken } from "@/lib/auth"
import { listMyShowAssignments, type ShowHostAssignment } from "@/lib/show-host"

function formatStartTime(
  assignment: ShowHostAssignment,
): { date: string; time: string } {
  const timestamp =
    assignment.whatnotStartTime != null
      ? Number(assignment.whatnotStartTime)
      : assignment.scheduledStartAt
        ? new Date(assignment.scheduledStartAt).getTime()
        : null

  if (!timestamp || Number.isNaN(timestamp)) {
    return { date: "—", time: "—" }
  }

  const date = new Date(timestamp)
  return {
    date: date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  }
}

function formatShowTypeBadgeClass(showType: string | null) {
  if (showType === "Live") {
    return "border-red-300 bg-red-50 text-red-700"
  }

  if (showType === "Upcoming") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700"
  }

  return "border-slate-300 bg-slate-50 text-slate-500"
}

function formatShowIdLabel(showId: string) {
  if (showId.length <= 12) {
    return showId
  }

  return `${showId.slice(0, 8)}…`
}

function isUpcomingAssignment(assignment: ShowHostAssignment) {
  const now = Date.now()
  const end =
    assignment.scheduledEndAt != null
      ? new Date(assignment.scheduledEndAt).getTime()
      : assignment.scheduledStartAt != null
        ? new Date(assignment.scheduledStartAt).getTime() + 60 * 60 * 1000
        : assignment.whatnotStartTime != null
          ? Number(assignment.whatnotStartTime) + 60 * 60 * 1000
          : null

  if (!end || Number.isNaN(end)) {
    return true
  }

  return end >= now
}

function AssignedShowsContent() {
  const { getToken, isLoaded } = useAuth()
  const [assignments, setAssignments] = useState<ShowHostAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadAssignments = useCallback(
    async (isManualRefresh: boolean) => {
      if (!isLoaded) {
        return
      }

      if (isManualRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      setErrorMessage(null)

      try {
        const token = await waitForSessionToken(getToken)
        const result = await listMyShowAssignments(token)
        setAssignments(result.assignments)
      } catch (error) {
        setAssignments([])
        setErrorMessage(error instanceof Error ? error.message : "Unable to load assigned shows.")
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [getToken, isLoaded],
  )

  useEffect(() => {
    void loadAssignments(false)
  }, [loadAssignments])

  const upcomingAssignments = useMemo(
    () => assignments.filter(isUpcomingAssignment),
    [assignments],
  )

  const statusLabel =
    upcomingAssignments.length === 0
      ? "No upcoming assigned shows."
      : `${upcomingAssignments.length} assigned show${upcomingAssignments.length !== 1 ? "s" : ""} ready for you.`

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AssignedShowsHeader statusLabel={statusLabel} count={upcomingAssignments.length} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadAssignments(true)}
          disabled={isRefreshing || isLoading}
          className="gap-1.5 self-start sm:self-auto"
        >
          {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      <Card className="overflow-hidden border-border/60 bg-card">
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className="h-4 w-4 text-primary" />
            <span>{statusLabel}</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Show</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Show ID</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Loading your assigned shows…
                    </TableCell>
                  </TableRow>
                ) : upcomingAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No upcoming assigned shows. Your streamer will assign shows from their calendar.
                    </TableCell>
                  </TableRow>
                ) : (
                  upcomingAssignments.map((assignment) => {
                    const { date, time } = formatStartTime(assignment)
                    const showType = assignment.showType || "Upcoming"
                    const showLink = assignment.showLink

                    return (
                      <TableRow key={assignment.showId}>
                        <TableCell>
                          <p className="font-medium text-foreground">
                            {assignment.showTitle || "Untitled show"}
                          </p>
                          {assignment.showStatus ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Status: {assignment.showStatus}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <ShowScheduleCell date={date} time={time} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={formatShowTypeBadgeClass(showType)}>
                            {showType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground">
                            {formatShowIdLabel(assignment.showId)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {showLink ? (
                            <a
                              href={showLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 hover:underline"
                            >
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                              {`whatnot.com/live/${formatShowIdLabel(assignment.showId)}`}
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="ml-auto inline-flex rounded-lg border border-border bg-slate-50 p-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                if (showLink) {
                                  window.open(showLink, "_blank", "noopener,noreferrer")
                                }
                              }}
                              disabled={!showLink}
                            >
                              Open show
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AssignedShowsHeader({
  statusLabel,
  count,
}: {
  statusLabel: string
  count: number
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">Assigned Whatnot shows</h2>
      </div>
      <p className="text-sm text-muted-foreground">{statusLabel}</p>
      {count > 0 ? (
        <p className="text-xs text-muted-foreground">
          Open a show on Whatnot when it is time to go live.
        </p>
      ) : null}
    </div>
  )
}

function ShowScheduleCell({ date, time }: { date: string; time: string }) {
  return (
    <div className="inline-flex flex-col gap-1 text-sm text-foreground">
      <span>{date}</span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" />
        {time}
      </span>
    </div>
  )
}

export function AssignedShowsPage() {
  return (
    <StaffModuleGate
      moduleId="assigned_shows"
      title="Host Shows"
      description="Upcoming Whatnot live shows assigned to you as host."
      fullWidth
    >
      <AssignedShowsContent />
    </StaffModuleGate>
  )
}
