"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Loader2,
  Star,
  BadgeCheck,
  Timer,
  BriefcaseBusiness,
  BadgeDollarSign,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  getPublicModeratorProfileBySlug,
  getPublicModeratorProfileByUserId,
  type PublicModeratorProfile,
} from "@/lib/moderator-profile"

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function renderRating(rating: number | null) {
  const normalized = Math.max(0, Math.min(5, rating || 0))
  const rounded = Math.round(normalized)

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${index < rounded ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35"}`}
        />
      ))}
    </div>
  )
}

export default function SellerModeratorProfilePage() {
  const params = useParams<{ slug: string }>()
  const slugOrToken = params?.slug

  const [profile, setProfile] = useState<PublicModeratorProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      if (!slugOrToken) {
        return
      }

      setIsLoading(true)
      setErrorMessage(null)

      try {
        const isUserToken = slugOrToken.startsWith("user-")
        const result = isUserToken
          ? await getPublicModeratorProfileByUserId(slugOrToken.slice(5))
          : await getPublicModeratorProfileBySlug(slugOrToken)

        if (!cancelled) {
          setProfile(result.profile)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load moderator profile.")
          setProfile(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [slugOrToken])

  const sortedWeekly = useMemo(() => {
    if (!profile) {
      return []
    }

    return [...profile.availability.weekly].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  }, [profile])

  if (isLoading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile || errorMessage) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" className="gap-2 pl-0">
          <Link href="/seller/moderators">
            <ArrowLeft className="h-4 w-4" />
            Back to moderators
          </Link>
        </Button>
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-6">
            <p className="font-semibold text-destructive">Profile unavailable</p>
            <p className="mt-1 text-sm text-destructive">{errorMessage || "This moderator profile could not be found."}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" className="gap-2 pl-0">
          <Link href="/seller/moderators">
            <ArrowLeft className="h-4 w-4" />
            Back to moderators
          </Link>
        </Button>
        <Button disabled>Hire Moderator</Button>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {profile.displayName || "Moderator"}
              </h1>
              <p className="mt-1 text-muted-foreground">
                {profile.headline || "Live commerce moderator"}
              </p>
            </div>
            <BadgeCheck className="h-6 w-6 text-primary" />
          </div>

          <div className="flex items-center gap-2 text-sm">
            {renderRating(profile.averageRating)}
            <span className="text-muted-foreground">
              {(profile.averageRating || 0).toFixed(1)} rating ({profile.ratingCount || 0} reviews)
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <BriefcaseBusiness className="h-4 w-4" />
              {profile.yearsExperience ?? 0}+ years experience
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <Timer className="h-4 w-4" />
              Response in {profile.responseTimeMinutes ?? 60} min
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <BadgeDollarSign className="h-4 w-4" />
              {profile.hourlyRateCents ? `$${(profile.hourlyRateCents / 100).toFixed(2)}/hr` : "Rate on request"}
            </div>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            {profile.bio || "No bio available for this moderator yet."}
          </p>

          <div className="flex flex-wrap gap-2">
            {profile.skills.length ? profile.skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="bg-primary/10 text-primary">
                {skill}
              </Badge>
            )) : (
              <Badge variant="secondary">General moderation</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock3 className="h-5 w-5 text-primary" />
              Weekly Availability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedWeekly.map((day) => (
              <div key={day.dayOfWeek} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{DAY_LABELS[day.dayOfWeek] || `Day ${day.dayOfWeek}`}</span>
                  <span className="text-muted-foreground">
                    {day.isAvailable ? `${day.startTime} - ${day.endTime}` : "Unavailable"}
                  </span>
                </div>
                {day.breaks.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {day.breaks.map((item, index) => (
                      <Badge key={`${day.dayOfWeek}-${index}`} variant="outline" className="text-xs">
                        Break: {item.startTime} - {item.endTime}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Holidays and Time Off
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Holidays</p>
              {profile.availability.holidays.length ? (
                <div className="flex flex-wrap gap-2">
                  {profile.availability.holidays.map((holiday) => (
                    <Badge key={holiday} variant="outline">
                      {holiday}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No holiday blocks listed.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Time-Off Ranges</p>
              {profile.availability.timeOffRanges.length ? (
                <div className="space-y-2">
                  {profile.availability.timeOffRanges.map((range, index) => (
                    <div key={`${range.startAt}-${index}`} className="rounded-md border border-border/60 bg-muted/30 p-2.5 text-sm text-muted-foreground">
                      <p>{new Date(range.startAt).toLocaleString()} - {new Date(range.endAt).toLocaleString()}</p>
                      <p className="text-xs uppercase tracking-wide">{range.reason || "time-off"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No time-off ranges listed.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
