"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Search, Star, Sparkles, Loader2, BadgeCheck, Clock3, BriefcaseBusiness, Calendar, X, Info } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { listPublicModerators, type ModeratorProfileResponse } from "@/lib/moderator-profile"

type ModeratorCardProfile = ModeratorProfileResponse["profile"]

// Pre-built time slot options in HH:MM format (UTC / moderator's schedule timezone)
const TIME_SLOTS: { label: string; value: string }[] = Array.from({ length: 24 }, (_, hour) => {
  const hh = String(hour).padStart(2, "0")
  return { label: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:00 ${hour < 12 ? "AM" : "PM"}`, value: `${hh}:00` }
})

function renderRating(rating: number | null) {
  const normalized = Math.max(0, Math.min(5, rating || 0))
  const rounded = Math.round(normalized)

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${index < rounded ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
        />
      ))}
    </div>
  )
}

/** Format a "YYYY-MM-DD" string into today's date in local time */
function getTodayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function SellerFindModeratorsPage() {
  const [search, setSearch] = useState("")
  const [skillsInput, setSkillsInput] = useState("")
  const [minExperienceInput, setMinExperienceInput] = useState("")
  const [minRatingInput, setMinRatingInput] = useState("")

  // Date & time slot state
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedStartTime, setSelectedStartTime] = useState<string>("")
  const [selectedEndTime, setSelectedEndTime] = useState<string>("")

  const [moderators, setModerators] = useState<ModeratorCardProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Whether the slot filter is fully specified (all three fields filled)
  const hasSlotFilter = Boolean(selectedDate && selectedStartTime && selectedEndTime)

  // End time options: only times strictly after selected start
  const endTimeOptions = useMemo(() => {
    if (!selectedStartTime) return TIME_SLOTS
    return TIME_SLOTS.filter((slot) => slot.value > selectedStartTime)
  }, [selectedStartTime])

  // Reset end time if it's no longer after start time
  useEffect(() => {
    if (selectedEndTime && selectedStartTime && selectedEndTime <= selectedStartTime) {
      setSelectedEndTime("")
    }
  }, [selectedStartTime, selectedEndTime])

  const parsedFilters = useMemo(() => {
    const skills = skillsInput
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean)

    const minExperience = minExperienceInput.trim() ? Number(minExperienceInput) : null
    const minRating = minRatingInput.trim() ? Number(minRatingInput) : null

    return {
      search: search.trim(),
      skills,
      minExperience: Number.isFinite(minExperience as number) ? minExperience : null,
      minRating: Number.isFinite(minRating as number) ? minRating : null,
      date: selectedDate || null,
      startTime: selectedStartTime || null,
      endTime: selectedEndTime || null,
    }
  }, [search, skillsInput, minExperienceInput, minRatingInput, selectedDate, selectedStartTime, selectedEndTime])

  useEffect(() => {
    let cancelled = false
    const timeoutId = setTimeout(async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const result = await listPublicModerators(parsedFilters)

        if (!cancelled) {
          setModerators(result.moderators)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load moderators.")
          setModerators([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [parsedFilters])

  function clearSlotFilter() {
    setSelectedDate("")
    setSelectedStartTime("")
    setSelectedEndTime("")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find Moderators"
        description="Discover and compare professional moderators for your next livestream"
      />

      {/* ── Date & Time Slot Selector ── */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Select Date &amp; Time Slot</span>
            <span className="text-xs text-muted-foreground">(shows only available moderators)</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Date picker */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date</label>
              <Input
                type="date"
                min={getTodayDateString()}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Start time */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Start Time</label>
              <select
                value={selectedStartTime}
                onChange={(e) => setSelectedStartTime(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">-- Select start time --</option>
                {TIME_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>

            {/* End time */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">End Time</label>
              <select
                value={selectedEndTime}
                onChange={(e) => setSelectedEndTime(e.target.value)}
                disabled={!selectedStartTime}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">-- Select end time --</option>
                {endTimeOptions.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hasSlotFilter && (
            <div className="mt-3 flex items-center justify-between rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">
              <span className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                Showing only moderators available on{" "}
                <strong>{selectedDate}</strong> from{" "}
                <strong>{selectedStartTime}</strong> to{" "}
                <strong>{selectedEndTime}</strong>
              </span>
              <button
                onClick={clearSlotFilter}
                className="ml-3 flex items-center gap-1 rounded hover:opacity-70"
                aria-label="Clear date/time filter"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          )}

          {selectedDate && selectedStartTime && !selectedEndTime && (
            <p className="mt-2 text-xs text-muted-foreground">
              Please also select an end time to apply availability filtering.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Other Filters ── */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Search by name, headline, bio, or skill"
              />
            </div>
            <Input
              value={skillsInput}
              onChange={(event) => setSkillsInput(event.target.value)}
              placeholder="Skills: TikTok, comments, engagement"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                min={0}
                value={minExperienceInput}
                onChange={(event) => setMinExperienceInput(event.target.value)}
                placeholder="Min exp"
              />
              <Input
                type="number"
                min={0}
                max={5}
                step="0.1"
                value={minRatingInput}
                onChange={(event) => setMinRatingInput(event.target.value)}
                placeholder="Min rating"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {moderators.length} moderator{moderators.length !== 1 ? "s" : ""} found
          {hasSlotFilter ? " for selected slot" : ""}
        </span>
      </div>

      {isLoading ? (
        <div className="flex min-h-[220px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-6 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && moderators.length === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-10 text-center">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-primary" />
            <p className="font-medium">
              {hasSlotFilter
                ? "No moderators are available for the selected date and time slot."
                : "No moderators match these filters yet."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasSlotFilter
                ? "Try a different date, time slot, or remove the date filter to see all moderators."
                : "Try clearing one or more filters."}
            </p>
            {hasSlotFilter && (
              <Button variant="outline" size="sm" className="mt-3" onClick={clearSlotFilter}>
                Clear Date &amp; Time Filter
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && moderators.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {moderators.map((moderator) => (
            <Card
              key={moderator.id}
              className="group max-w-[320px] border-border/60 bg-card/60 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            >
              <CardHeader className="space-y-2 pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl leading-tight">{moderator.displayName || "Moderator"}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {moderator.headline || "Live commerce moderator"}
                    </p>
                  </div>
                  <BadgeCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  {renderRating(moderator.averageRating)}
                  <span className="text-xs text-muted-foreground">
                    {(moderator.averageRating || 0).toFixed(1)} ({moderator.ratingCount || 0})
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {moderator.bio || "Experienced moderator ready to support your stream operations and audience engagement."}
                </p>

                <div className="flex flex-wrap gap-2">
                  {(moderator.skills || []).slice(0, 6).map((skill) => (
                    <Badge key={skill} variant="secondary" className="bg-primary/10 text-primary">
                      {skill}
                    </Badge>
                  ))}
                  {moderator.skills.length === 0 ? (
                    <Badge variant="secondary">General moderation</Badge>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2.5 py-2">
                    <BriefcaseBusiness className="h-3.5 w-3.5" />
                    {moderator.yearsExperience ?? 0}+ yrs
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2.5 py-2">
                    <Clock3 className="h-3.5 w-3.5" />
                    {moderator.responseTimeMinutes ?? 60} min
                  </div>
                </div>

                <Button asChild className="h-8 w-full gap-2 text-sm">
                  <Link
                    href={
                      `/seller/moderators/${moderator.publicSlug || `user-${moderator.userId}`}` +
                      (hasSlotFilter
                        ? `?date=${selectedDate}&startTime=${selectedStartTime}&endTime=${selectedEndTime}`
                        : "")
                    }
                  >
                    Hire Moderator
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}
