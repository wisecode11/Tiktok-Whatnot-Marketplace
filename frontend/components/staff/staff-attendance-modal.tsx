"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getClerkErrorMessage, waitForSessionToken } from "@/lib/auth"
import {
  getStaffMonthlyAttendance,
  formatDuration,
  formatTime,
  type AttendanceRecord,
  type StaffMonthlyAttendance,
} from "@/lib/attendance"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function StatusChip({ status }: { status: AttendanceRecord["status"] }) {
  const isIn = status === "clocked_in"
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isIn
          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      }`}
    >
      {isIn ? "Incomplete" : "Complete"}
    </span>
  )
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffId: string
  staffName: string
}

export function StaffAttendanceModal({ open, onOpenChange, staffId, staffName }: Props) {
  const { getToken } = useAuth()

  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const [data, setData]         = useState<StaffMonthlyAttendance | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reset + load whenever the dialog opens or month/year changes
  useEffect(() => {
    if (!open || !staffId) return

    let cancelled = false

    async function load() {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        const token = await waitForSessionToken(getToken)
        const result = await getStaffMonthlyAttendance(token, staffId, year, month)
        if (!cancelled) setData(result)
      } catch (error) {
        if (!cancelled) setErrorMessage(getClerkErrorMessage(error))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [open, staffId, year, month, getToken])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }

  function nextMonth() {
    const now = new Date()
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
    if (isCurrentMonth) return   // don't go into the future
    if (month === 12) { setMonth(1); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  const isCurrentMonth = (() => {
    const now = new Date()
    return year === now.getFullYear() && month === now.getMonth() + 1
  })()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            Attendance — {staffName}
          </DialogTitle>
          <DialogDescription>
            Monthly attendance records and total working hours.
          </DialogDescription>
        </DialogHeader>

        {/* Month navigator */}
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-2">
          <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-semibold">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextMonth}
            disabled={isCurrentMonth}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Summary chips */}
        {data && !isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryChip label="Days Present" value={String(data.summary.totalDaysPresent)} />
            <SummaryChip label="Days Complete" value={String(data.summary.totalDaysWorked)} />
            <SummaryChip label="Total Hours" value={`${data.summary.totalHours}h`} />
            <SummaryChip
              label="Avg / Day"
              value={
                data.summary.totalDaysWorked > 0
                  ? formatDuration(data.summary.totalMinutes / data.summary.totalDaysWorked)
                  : "—"
              }
            />
          </div>
        )}

        {/* Records table */}
        <div className="max-h-72 overflow-y-auto rounded-md border border-border/60">
          {isLoading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : errorMessage ? (
            <p className="p-4 text-sm text-destructive">{errorMessage}</p>
          ) : !data || data.records.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No attendance records for {MONTH_NAMES[month - 1]} {year}.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.records.map((record) => (
                  <TableRow key={record._id}>
                    <TableCell className="font-medium">{record.date}</TableCell>
                    <TableCell>{formatTime(record.clock_in_at)}</TableCell>
                    <TableCell>{formatTime(record.clock_out_at)}</TableCell>
                    <TableCell>{formatDuration(record.duration_minutes)}</TableCell>
                    <TableCell>
                      <StatusChip status={record.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-base font-semibold">{value}</span>
    </div>
  )
}
