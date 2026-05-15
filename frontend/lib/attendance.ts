import { AuthApiError } from "@/lib/auth"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

export interface AttendanceRecord {
  _id: string
  user_id: string
  workspace_id: string
  creator_id: string
  date: string
  day: number
  month: number
  year: number
  status: "clocked_in" | "clocked_out"
  clock_in_at: string
  clock_out_at: string | null
  duration_minutes: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

async function handleResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    let errorData: { error?: string; attendance?: AttendanceRecord; details?: unknown }
    try {
      errorData = await response.json()
    } catch {
      throw new AuthApiError(fallbackMessage, response.status)
    }
    const err = new AuthApiError(
      errorData.error || fallbackMessage,
      response.status,
    ) as AuthApiError & { attendance?: AttendanceRecord }
    if (errorData.attendance) {
      err.attendance = errorData.attendance
    }
    throw err
  }
  return response.json() as Promise<T>
}

/** GET /api/attendance/today — returns today's record or null */
export async function getTodayAttendance(
  token: string,
): Promise<{ attendance: AttendanceRecord | null; date: string }> {
  const response = await fetch(`${BACKEND_URL}/api/attendance/today`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
  return handleResponse(response, "Failed to load today's attendance")
}

/** POST /api/attendance/clock-in */
export async function clockIn(token: string): Promise<{ attendance: AttendanceRecord }> {
  const response = await fetch(`${BACKEND_URL}/api/attendance/clock-in`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
  return handleResponse(response, "Failed to clock in")
}

/** POST /api/attendance/clock-out */
export async function clockOut(token: string): Promise<{ attendance: AttendanceRecord }> {
  const response = await fetch(`${BACKEND_URL}/api/attendance/clock-out`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
  return handleResponse(response, "Failed to clock out")
}

export interface MonthlyAttendanceSummary {
  totalDaysPresent: number
  totalDaysWorked: number
  totalMinutes: number
  totalHours: number
}

export interface StaffMonthlyAttendance {
  staffId: string
  staffName: string
  year: number
  month: number
  records: AttendanceRecord[]
  summary: MonthlyAttendanceSummary
}

/** GET /api/attendance/staff/:staffId/monthly?year=YYYY&month=M (seller-side) */
export async function getStaffMonthlyAttendance(
  token: string,
  staffId: string,
  year: number,
  month: number,
): Promise<StaffMonthlyAttendance> {
  const url = `${BACKEND_URL}/api/attendance/staff/${encodeURIComponent(staffId)}/monthly?year=${year}&month=${month}`
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
  return handleResponse(response, "Failed to load attendance")
}

/** Format minutes into "Xh Ym" display string */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—"
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** Format a UTC ISO string as a local time string, e.g. "9:04 AM" */
export function formatTime(iso: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso))
}

/** Download attendance records as CSV */
export function downloadAttendanceCSV(
  data: StaffMonthlyAttendance,
) {
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(data.year, data.month - 1)
  )
  const filename = `Attendance_${data.staffName}_${monthName}_${data.year}.csv`

  // CSV headers
  const headers = ["Date", "Clock In", "Clock Out", "Duration (minutes)", "Status"]

  // CSV rows
  const rows = data.records.map((r) => [
    r.date,
    formatTime(r.clock_in_at),
    formatTime(r.clock_out_at),
    r.duration_minutes ?? "",
    r.status === "clocked_out" ? "Complete" : "Incomplete",
  ])

  // Summary rows
  const summaryRows = [
    [],
    ["Summary"],
    ["Days Present", String(data.summary.totalDaysPresent)],
    ["Days Complete", String(data.summary.totalDaysWorked)],
    ["Total Hours", String(data.summary.totalHours)],
    ["Total Minutes", String(data.summary.totalMinutes)],
  ]

  // Build CSV content
  const csv = [
    headers,
    ...rows,
    ...summaryRows,
  ]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  // Trigger download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
}
