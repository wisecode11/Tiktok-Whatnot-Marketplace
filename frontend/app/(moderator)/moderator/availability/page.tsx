"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { CalendarClock, Loader2, Plus, Save, Trash2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { waitForSessionToken } from "@/lib/auth"
import {
  getMyModeratorAvailability,
  updateMyModeratorAvailability,
  type ModeratorAvailabilityResponse,
} from "@/lib/moderator-profile"

type DayCode = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

type DayAvailability = {
  day: DayCode
  dayOfWeek: number
  label: string
  enabled: boolean
  start: string
  end: string
}

type DayBreak = {
  id: string
  day: DayCode
  dayOfWeek: number
  start: string
  end: string
}

const dayOptions: Array<{ code: DayCode; label: string; dayOfWeek: number }> = [
  { code: "mon", label: "Monday", dayOfWeek: 1 },
  { code: "tue", label: "Tuesday", dayOfWeek: 2 },
  { code: "wed", label: "Wednesday", dayOfWeek: 3 },
  { code: "thu", label: "Thursday", dayOfWeek: 4 },
  { code: "fri", label: "Friday", dayOfWeek: 5 },
  { code: "sat", label: "Saturday", dayOfWeek: 6 },
  { code: "sun", label: "Sunday", dayOfWeek: 0 },
]

const defaultHours: DayAvailability[] = dayOptions.map((day, index) => ({
  day: day.code,
  dayOfWeek: day.dayOfWeek,
  label: day.label,
  enabled: index < 5,
  start: "09:00",
  end: "17:00",
}))

function createBreakId() {
  return `br-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function isValidTimeRange(start: string, end: string) {
  return start < end
}

function normalizeHolidayDate(value: string) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function mapApiToState(availability: ModeratorAvailabilityResponse["availability"]) {
  const weeklyByDay = new Map(availability.weekly.map((entry) => [entry.dayOfWeek, entry]))

  const hours: DayAvailability[] = dayOptions.map((day) => {
    const apiDay = weeklyByDay.get(day.dayOfWeek)

    return {
      day: day.code,
      dayOfWeek: day.dayOfWeek,
      label: day.label,
      enabled: apiDay?.isAvailable ?? false,
      start: apiDay?.startTime || "09:00",
      end: apiDay?.endTime || "17:00",
    }
  })

  // Breaks are now embedded per day inside each weekly entry
  const breaks: DayBreak[] = availability.weekly.flatMap((entry) => {
    const dayMeta = dayOptions.find((day) => day.dayOfWeek === entry.dayOfWeek) || dayOptions[0]
    return (entry.breaks || []).map((br) => ({
      id: createBreakId(),
      day: dayMeta.code,
      dayOfWeek: dayMeta.dayOfWeek,
      start: br.startTime,
      end: br.endTime,
    }))
  })

  const holidays = Array.from(new Set((availability.holidays || []).filter(normalizeHolidayDate))).sort()

  return {
    timezone: availability.timezone || "UTC",
    hours,
    breaks,
    holidays,
  }
}

function buildAvailabilityPayload(hours: DayAvailability[], breaks: DayBreak[], holidays: string[], timezone: string) {
  for (const day of hours) {
    if (day.enabled && !isValidTimeRange(day.start, day.end)) {
      throw new Error(`${day.label}: start time must be before end time.`)
    }
  }

  for (const entry of breaks) {
    if (!isValidTimeRange(entry.start, entry.end)) {
      throw new Error("Each break must have start time before end time.")
    }
  }

  return {
    timezone,
    weekly: hours.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      isAvailable: day.enabled,
      startTime: day.start,
      endTime: day.end,
    })),
    breaks: breaks.map((entry) => ({
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.start,
      endTime: entry.end,
    })),
    holidays,
  }
}

export default function ModeratorAvailabilityPage() {
  const { getToken, isLoaded } = useAuth()
  const { toast } = useToast()

  const [timezone, setTimezone] = useState("UTC")
  const [hours, setHours] = useState<DayAvailability[]>(defaultHours)
  const [breaks, setBreaks] = useState<DayBreak[]>([])
  const [holidays, setHolidays] = useState<string[]>([])
  const [holidayDraft, setHolidayDraft] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadAvailability() {
      if (!isLoaded) {
        return
      }

      setIsLoading(true)

      try {
        const token = await waitForSessionToken(getToken)
        const result = await getMyModeratorAvailability(token)

        if (cancelled) {
          return
        }

        const mapped = mapApiToState(result.availability)
        setTimezone(mapped.timezone)
        setHours(mapped.hours)
        setBreaks(mapped.breaks)
        setHolidays(mapped.holidays)
        setSaveStatus(null)
      } catch (error) {
        if (!cancelled) {
          setSaveStatus({
            type: "error",
            message: error instanceof Error ? error.message : "Unable to load availability.",
          })
          toast({
            title: "Unable to load availability",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          })
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadAvailability()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded, toast])

  function updateDay(day: DayCode, key: "enabled" | "start" | "end", value: boolean | string) {
    setHours((previous) =>
      previous.map((entry) => {
        if (entry.day !== day) {
          return entry
        }

        return {
          ...entry,
          [key]: value,
        }
      }),
    )
  }

  function addBreak() {
    setBreaks((previous) => [
      ...previous,
      { id: createBreakId(), day: "mon", dayOfWeek: 1, start: "13:00", end: "14:00" },
    ])
  }

  function updateBreak(id: string, key: "day" | "start" | "end", value: string) {
    setBreaks((previous) =>
      previous.map((entry) => {
        if (entry.id !== id) {
          return entry
        }

        if (key === "day") {
          const dayMeta = dayOptions.find((day) => day.code === value) || dayOptions[0]
          return {
            ...entry,
            day: dayMeta.code,
            dayOfWeek: dayMeta.dayOfWeek,
          }
        }

        return {
          ...entry,
          [key]: value,
        }
      }),
    )
  }

  function removeBreak(id: string) {
    setBreaks((previous) => previous.filter((entry) => entry.id !== id))
  }

  function addHoliday() {
    if (!holidayDraft || holidays.includes(holidayDraft)) {
      return
    }

    if (!normalizeHolidayDate(holidayDraft)) {
      toast({
        title: "Invalid holiday date",
        description: "Date must be in YYYY-MM-DD format.",
        variant: "destructive",
      })
      return
    }

    setHolidays((previous) => [...previous, holidayDraft].sort())
    setHolidayDraft("")
  }

  function removeHoliday(value: string) {
    setHolidays((previous) => previous.filter((entry) => entry !== value))
  }

  async function saveAvailability() {
    setIsSaving(true)
    setSaveStatus(null)

    try {
      const payload = buildAvailabilityPayload(hours, breaks, holidays, timezone)
      const token = await waitForSessionToken(getToken)
      const result = await updateMyModeratorAvailability(token, payload)
      const mapped = mapApiToState(result.availability)

      setTimezone(mapped.timezone)
      setHours(mapped.hours)
      setBreaks(mapped.breaks)
      setHolidays(mapped.holidays)
      setLastSavedAt(new Date().toISOString())
      setSaveStatus({
        type: "success",
        message: "Availability saved successfully.",
      })

      toast({
        title: "Availability saved",
        description: "Working hours, breaks, and holidays were saved to database.",
      })
    } catch (error) {
      setSaveStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to save availability.",
      })
      toast({
        title: "Unable to save",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability"
        description="Set weekly working hours, break timings, and holidays. This data will be used for future streamer booking slot availability."
      />

      {saveStatus ? (
        <div
          className={
            saveStatus.type === "success"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              : "rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          }
        >
          {saveStatus.message}
        </div>
      ) : null}

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Weekly Working Hours
          </CardTitle>
          <CardDescription>
            Enable days and set your start and end time for each day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hours.map((day) => (
                <TableRow key={day.day}>
                  <TableCell className="font-medium">{day.label}</TableCell>
                  <TableCell>
                    <Checkbox
                      checked={day.enabled}
                      onCheckedChange={(checked) => updateDay(day.day, "enabled", Boolean(checked))}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      value={day.start}
                      onChange={(event) => updateDay(day.day, "start", event.target.value)}
                      disabled={!day.enabled}
                      className="w-[140px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      value={day.end}
                      onChange={(event) => updateDay(day.day, "end", event.target.value)}
                      disabled={!day.enabled}
                      className="w-[140px]"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>Break Timings</CardTitle>
          <CardDescription>
            Break timings will be excluded from available booking windows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {breaks.map((entry) => (
            <div key={entry.id} className="grid gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center">
              <Select value={entry.day} onValueChange={(value) => updateBreak(entry.id, "day", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {dayOptions.map((day) => (
                    <SelectItem key={day.code} value={day.code}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                value={entry.start}
                onChange={(event) => updateBreak(entry.id, "start", event.target.value)}
              />
              <Input
                type="time"
                value={entry.end}
                onChange={(event) => updateBreak(entry.id, "end", event.target.value)}
              />
              <Button variant="ghost" size="icon" onClick={() => removeBreak(entry.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button variant="outline" onClick={addBreak}>
            <Plus className="h-4 w-4" />
            Add Break
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>Holidays / Time Off</CardTitle>
          <CardDescription>
            Add blackout dates when you are not available for bookings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="date"
              value={holidayDraft}
              onChange={(event) => setHolidayDraft(event.target.value)}
              className="sm:max-w-[220px]"
            />
            <Button variant="outline" onClick={addHoliday}>Add Holiday</Button>
          </div>

          <div className="space-y-2">
            {holidays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No holidays added yet.</p>
            ) : (
              holidays.map((entry) => (
                <div key={entry} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                  <span>{new Date(`${entry}T00:00:00`).toLocaleDateString()}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeHoliday(entry)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {lastSavedAt ? (
          <p className="text-xs text-muted-foreground">Last saved: {new Date(lastSavedAt).toLocaleString()}</p>
        ) : (
          <span />
        )}

        <Button onClick={() => void saveAvailability()} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Availability
        </Button>
      </div>
    </div>
  )
}
