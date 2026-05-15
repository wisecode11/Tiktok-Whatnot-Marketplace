"use client"

import { use, useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { ChevronLeft, ChevronRight, Clock, Download, Loader2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { getClerkErrorMessage, waitForSessionToken } from "@/lib/auth"
import {
  getStaffMonthlyAttendance,
  downloadAttendanceCSV,
  formatDuration,
  formatTime,
  type AttendanceRecord,
  type StaffMonthlyAttendance,
} from "@/lib/attendance"

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

interface PageProps {
  params: Promise<{
    userId: string
  }>
}

function StatusBadge({ status }: { status: AttendanceRecord["status"] }) {
  const isComplete = status === "clocked_out"
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isComplete
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
      }`}
    >
      {isComplete ? "✓ Complete" : "⏳ Incomplete"}
    </span>
  )
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-border/60 bg-muted/10">
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

export default function AttendanceDetailPage({ params }: PageProps) {
  const { getToken, isLoaded } = useAuth()
  const { toast } = useToast()
  const { userId: staffId } = use(params)

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const [data, setData] = useState<StaffMonthlyAttendance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!isLoaded) return
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
    return () => {
      cancelled = true
    }
  }, [staffId, year, month, isLoaded, getToken])

  function prevMonth() {
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
    if (isCurrentMonth) return
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  async function handleDownload() {
    if (!data) return
    try {
      setIsDownloading(true)
      downloadAttendanceCSV(data)
      toast({
        title: "Downloaded",
        description: "Attendance records exported as CSV.",
      })
    } catch (error) {
      toast({
        title: "Download failed",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth() + 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Records"
        description={
          data ? `Monthly attendance for ${data.staffName}` : "Loading attendance records..."
        }
      >
        <Button
          onClick={handleDownload}
          disabled={!data || isDownloading}
          size="sm"
          variant="outline"
        >
          {isDownloading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          Download CSV
        </Button>
      </PageHeader>

      {/* Month Navigator */}
      <Card className="border-border/60">
        <CardContent className="flex items-center justify-between py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-lg font-semibold">
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
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : !data ? (
        <div className="rounded-lg border border-border/60 bg-muted/10 p-8 text-center">
          <p className="text-sm text-muted-foreground">No data available</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard
              label="Days Present"
              value={data.summary.totalDaysPresent}
            />
            <SummaryCard
              label="Days Complete"
              value={data.summary.totalDaysWorked}
            />
            <SummaryCard label="Total Hours" value={`${data.summary.totalHours}h`} />
            <SummaryCard
              label="Average / Day"
              value={
                data.summary.totalDaysWorked > 0
                  ? formatDuration(data.summary.totalMinutes / data.summary.totalDaysWorked)
                  : "—"
              }
            />
          </div>

          {/* Records Table */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.records.length === 0 ? (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No attendance records for {MONTH_NAMES[month - 1]} {year}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
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
                            <StatusBadge status={record.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
