"use client"

import { useAuth } from "@clerk/nextjs"
import { Loader2, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { StaffModuleGate } from "@/components/staff/staff-module-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

function formatTimeRange(assignment: ShowHostAssignment) {
  const start = assignment.scheduledStartAt ? new Date(assignment.scheduledStartAt) : null
  const end = assignment.scheduledEndAt ? new Date(assignment.scheduledEndAt) : null

  if (!start || Number.isNaN(start.getTime())) {
    return "—"
  }

  const startLabel = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const endLabel =
    end && !Number.isNaN(end.getTime())
      ? end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null

  return endLabel ? `${startLabel} – ${endLabel}` : startLabel
}

function formatPlatformLabel(platform: string) {
  if (platform === "tiktok") {
    return "TikTok"
  }

  return "Whatnot"
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

  const upcomingAssignments = useMemo(() => {
    const now = Date.now()
    return assignments.filter((assignment) => {
      const end = assignment.scheduledEndAt
        ? new Date(assignment.scheduledEndAt).getTime()
        : assignment.scheduledStartAt
          ? new Date(assignment.scheduledStartAt).getTime() + 60 * 60 * 1000
          : null

      if (!end || Number.isNaN(end)) {
        return true
      }

      return end >= now
    })
  }, [assignments])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Your assigned shows</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Upcoming live shows your streamer assigned you to host.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadAssignments(true)}
          disabled={isRefreshing || isLoading}
          className="gap-1.5"
        >
          {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex min-h-[180px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : null}

        {!isLoading && !errorMessage && upcomingAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming assigned shows right now. Your streamer will assign shows from their calendar.
          </p>
        ) : null}

        {!isLoading && !errorMessage && upcomingAssignments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Show</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingAssignments.map((assignment) => {
                const start = assignment.scheduledStartAt ? new Date(assignment.scheduledStartAt) : null
                return (
                  <TableRow key={assignment.showId}>
                    <TableCell className="font-medium">
                      {assignment.showTitle || "Untitled show"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatPlatformLabel(assignment.platform)}</Badge>
                    </TableCell>
                    <TableCell>
                      {start && !Number.isNaN(start.getTime()) ? start.toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>{formatTimeRange(assignment)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function AssignedShowsPage() {
  return (
    <StaffModuleGate
      moduleId="assigned_shows"
      title="Host Shows"
      description="Shows your streamer assigned you to host."
    >
      <AssignedShowsContent />
    </StaffModuleGate>
  )
}
