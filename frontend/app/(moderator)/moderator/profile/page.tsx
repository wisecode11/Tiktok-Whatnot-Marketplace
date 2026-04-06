"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Eye, Loader2, PencilLine, UserRound } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { waitForSessionToken } from "@/lib/auth"
import { getMyModeratorProfile, type ModeratorProfileResponse } from "@/lib/moderator-profile"

function formatMoney(cents: number | null) {
  if (cents === null) {
    return "Not set"
  }

  return `$${(cents / 100).toFixed(2)}`
}

function formatNumber(value: number | null, suffix?: string) {
  if (value === null) {
    return "Not set"
  }

  return suffix ? `${value} ${suffix}` : String(value)
}

function getValue(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return "Not set"
  }

  return value
}

export default function ModeratorProfileViewPage() {
  const { getToken, isLoaded } = useAuth()
  const [profile, setProfile] = useState<ModeratorProfileResponse["profile"] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const publicProfileUrl = useMemo(() => {
    if (!profile?.publicSlug) {
      return null
    }

    return `/moderator/${profile.publicSlug}`
  }, [profile?.publicSlug])

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      if (!isLoaded) {
        return
      }

      setIsLoading(true)
      setErrorMessage(null)

      try {
        const token = await waitForSessionToken(getToken)
        const result = await getMyModeratorProfile(token)

        if (!cancelled) {
          setProfile(result.profile)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load your profile.")
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
  }, [getToken, isLoaded])

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (errorMessage || !profile) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Profile"
          description="View your saved moderator profile details"
        />
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle>Profile is unavailable</CardTitle>
            <CardDescription>{errorMessage || "Unable to load your profile."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/moderator/public-profile">Go to edit profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="This page only shows the moderator profile data currently saved in the database"
      />

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-primary" />
              Saved Moderator Profile
            </CardTitle>
            <CardDescription>
              Review the exact profile data currently stored for your moderator account.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/moderator/public-profile">
                <PencilLine className="h-4 w-4" />
                Edit Profile
              </Link>
            </Button>
            {publicProfileUrl ? (
              <Button asChild>
                <Link href={publicProfileUrl}>
                  <Eye className="h-4 w-4" />
                  View Public Page
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
              <div className="mt-2">
                <Badge variant="outline" className="capitalize">{profile.profileStatus}</Badge>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Hourly Rate</p>
              <p className="mt-2 text-sm font-medium text-foreground">{formatMoney(profile.hourlyRateCents)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Experience</p>
              <p className="mt-2 text-sm font-medium text-foreground">{formatNumber(profile.yearsExperience, "years")}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Response Time</p>
              <p className="mt-2 text-sm font-medium text-foreground">{formatNumber(profile.responseTimeMinutes, "minutes")}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Display Name</p>
              <p className="mt-2 text-sm font-medium text-foreground">{getValue(profile.displayName)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Headline</p>
              <p className="mt-2 text-sm font-medium text-foreground">{getValue(profile.headline)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Bio</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{getValue(profile.bio)}</p>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Skills</p>
            {profile.skills.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">{skill}</Badge>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-foreground">Not set</p>
            )}
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Availability Summary</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{getValue(profile.availabilitySummary)}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Public Slug</p>
              <p className="mt-2 text-sm font-medium text-foreground">{getValue(profile.publicSlug)}</p>
            </div> */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last Saved</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : "Not available"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}