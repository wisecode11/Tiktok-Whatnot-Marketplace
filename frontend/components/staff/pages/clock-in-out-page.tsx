"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { CheckCircle2, Clock, LogIn, LogOut, Loader2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { getClerkErrorMessage, waitForSessionToken } from "@/lib/auth"
import {
  clockIn,
  clockOut,
  getTodayAttendance,
  formatDuration,
  formatTime,
  type AttendanceRecord,
} from "@/lib/attendance"

function StatusBadge({ status }: { status: "clocked_in" | "clocked_out" }) {
  const isIn = status === "clocked_in"
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        isIn
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${isIn ? "bg-green-500 animate-pulse" : "bg-slate-400"}`}
      />
      {isIn ? "Clocked In" : "Clocked Out"}
    </span>
  )
}

export function ClockInOutPage() {
  const { getToken, isLoaded } = useAuth()
  const { toast } = useToast()

  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null)
  const [todayDate, setTodayDate] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [isActing, setIsActing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!isLoaded) return
      try {
        setIsLoading(true)
        setErrorMessage(null)
        const token = await waitForSessionToken(getToken)
        const result = await getTodayAttendance(token)
        if (!cancelled) {
          setAttendance(result.attendance)
          setTodayDate(result.date)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getClerkErrorMessage(error))
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  async function handleClockIn() {
    try {
      setIsActing(true)
      const token = await waitForSessionToken(getToken)
      const result = await clockIn(token)
      setAttendance(result.attendance)
      toast({ title: "Clocked in", description: `Clocked in at ${formatTime(result.attendance.clock_in_at)}.` })
    } catch (error) {
      toast({
        title: "Clock in failed",
        description: getClerkErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsActing(false)
    }
  }

  async function handleClockOut() {
    try {
      setIsActing(true)
      const token = await waitForSessionToken(getToken)
      const result = await clockOut(token)
      setAttendance(result.attendance)
      toast({
        title: "Clocked out",
        description: `Total time today: ${formatDuration(result.attendance.duration_minutes)}.`,
      })
    } catch (error) {
      toast({
        title: "Clock out failed",
        description: getClerkErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsActing(false)
    }
  }

  const canClockIn  = !attendance
  const canClockOut = attendance?.status === "clocked_in"
  const isComplete  = attendance?.status === "clocked_out"

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clock In / Clock Out"
        description="Record your attendance for the day. One entry per day is allowed."
      />

      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* ── Status Card ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4 text-primary" />
                Today&apos;s Attendance
              </CardTitle>
              <CardDescription>{todayDate}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {attendance ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <StatusBadge status={attendance.status} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Clock In</span>
                    <span className="font-medium">{formatTime(attendance.clock_in_at)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Clock Out</span>
                    <span className="font-medium">{formatTime(attendance.clock_out_at)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">{formatDuration(attendance.duration_minutes)}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You have not clocked in yet today.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Action Card ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actions</CardTitle>
              <CardDescription>
                {isComplete
                  ? "Your attendance for today is complete."
                  : canClockIn
                  ? "Start your shift by clocking in."
                  : "End your shift by clocking out."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {isComplete ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900/30 dark:bg-green-900/10 dark:text-green-400">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Attendance recorded successfully for today.
                </div>
              ) : (
                <>
                  <Button
                    className="w-full"
                    disabled={!canClockIn || isActing}
                    onClick={handleClockIn}
                  >
                    {isActing && canClockIn ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <LogIn className="mr-2 size-4" />
                    )}
                    Clock In
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={!canClockOut || isActing}
                    onClick={handleClockOut}
                  >
                    {isActing && canClockOut ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <LogOut className="mr-2 size-4" />
                    )}
                    Clock Out
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
