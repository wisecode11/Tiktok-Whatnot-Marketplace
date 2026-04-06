"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Loader2, Save, Send, UserRound } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { useToast } from "@/hooks/use-toast"
import { waitForSessionToken } from "@/lib/auth"
import {
  getMyModeratorProfile,
  publishMyModeratorProfile,
  updateMyModeratorProfile,
  type ModeratorProfileResponse,
} from "@/lib/moderator-profile"

type ProfileFormState = {
  displayName: string
  headline: string
  bio: string
  yearsExperience: string
  hourlyRateUsd: string
  responseTimeMinutes: string
  skillsText: string
  availabilitySummary: string
}

function toFormState(profile: ModeratorProfileResponse["profile"]): ProfileFormState {
  return {
    displayName: profile.displayName || "",
    headline: profile.headline || "",
    bio: profile.bio || "",
    yearsExperience: profile.yearsExperience === null ? "" : String(profile.yearsExperience),
    hourlyRateUsd:
      profile.hourlyRateCents === null ? "" : (profile.hourlyRateCents / 100).toFixed(2),
    responseTimeMinutes:
      profile.responseTimeMinutes === null ? "" : String(profile.responseTimeMinutes),
    skillsText: (profile.skills || []).join(", "),
    availabilitySummary: profile.availabilitySummary || "",
  }
}

function parseSkills(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function ModeratorPublicProfilePage() {
  const { getToken, isLoaded } = useAuth()
  const { toast } = useToast()

  const [profile, setProfile] = useState<ModeratorProfileResponse["profile"] | null>(null)
  const [form, setForm] = useState<ProfileFormState>({
    displayName: "",
    headline: "",
    bio: "",
    yearsExperience: "",
    hourlyRateUsd: "",
    responseTimeMinutes: "",
    skillsText: "",
    availabilitySummary: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
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

        if (cancelled) {
          return
        }

        setProfile(result.profile)
        setForm(toFormState(result.profile))
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

  function updateField<K extends keyof ProfileFormState>(field: K, value: ProfileFormState[K]) {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  async function saveProfile() {
    setIsSaving(true)

    try {
      const token = await waitForSessionToken(getToken)
      const hourlyRateUsd = form.hourlyRateUsd.trim()
      const hourlyRate = hourlyRateUsd ? Number(hourlyRateUsd) : null

      if (hourlyRate !== null && (!Number.isFinite(hourlyRate) || hourlyRate < 0)) {
        throw new Error("Hourly rate must be a positive number.")
      }

      const response = await updateMyModeratorProfile(token, {
        displayName: form.displayName,
        headline: form.headline,
        bio: form.bio,
        yearsExperience: form.yearsExperience.trim() ? Number(form.yearsExperience.trim()) : null,
        hourlyRateCents: hourlyRate === null ? null : Math.round(hourlyRate * 100),
        responseTimeMinutes: form.responseTimeMinutes.trim()
          ? Number(form.responseTimeMinutes.trim())
          : null,
        skills: parseSkills(form.skillsText),
        availabilitySummary: form.availabilitySummary,
      })

      setProfile(response.profile)
      setForm(toFormState(response.profile))
      toast({
        title: "Profile saved",
        description: "Your moderator public profile draft was updated.",
      })
    } catch (error) {
      toast({
        title: "Unable to save profile",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function publishProfile() {
    setIsPublishing(true)

    try {
      const token = await waitForSessionToken(getToken)
      const response = await publishMyModeratorProfile(token)
      setProfile(response.profile)
      setForm(toFormState(response.profile))
      toast({
        title: "Profile published",
        description: "Your public profile is now visible in the marketplace.",
      })
    } catch (error) {
      toast({
        title: "Unable to publish",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsPublishing(false)
    }
  }

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
          title="Public Profile"
          description="Create your moderator profile for the marketplace"
        />
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle>Profile is unavailable</CardTitle>
            <CardDescription>{errorMessage || "Unable to load your profile."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Public Profile"
        description="Showcase your experience, skills, and availability for marketplace bookings"
      />

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            Moderator Marketplace Profile
          </CardTitle>
          <CardDescription>
            Complete this profile so streamers can discover and book you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup>
              <Field>
                <FieldLabel>Display Name</FieldLabel>
                <Input
                  value={form.displayName}
                  onChange={(event) => updateField("displayName", event.target.value)}
                  placeholder="How your name appears publicly"
                  className="bg-muted/50"
                />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field>
                <FieldLabel>Headline</FieldLabel>
                <Input
                  value={form.headline}
                  onChange={(event) => updateField("headline", event.target.value)}
                  placeholder="Example: Live Commerce Moderator"
                  className="bg-muted/50"
                />
              </Field>
            </FieldGroup>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel>Bio</FieldLabel>
              <Textarea
                value={form.bio}
                onChange={(event) => updateField("bio", event.target.value)}
                placeholder="Describe your experience and strengths"
                className="min-h-[120px] bg-muted/50"
              />
            </Field>
          </FieldGroup>

          <div className="grid gap-4 sm:grid-cols-3">
            <FieldGroup>
              <Field>
                <FieldLabel>Years of Experience</FieldLabel>
                <Input
                  type="number"
                  value={form.yearsExperience}
                  onChange={(event) => updateField("yearsExperience", event.target.value)}
                  className="bg-muted/50"
                />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field>
                <FieldLabel>Hourly Rate (USD)</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  value={form.hourlyRateUsd}
                  onChange={(event) => updateField("hourlyRateUsd", event.target.value)}
                  className="bg-muted/50"
                />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field>
                <FieldLabel>Response Time (minutes)</FieldLabel>
                <Input
                  type="number"
                  value={form.responseTimeMinutes}
                  onChange={(event) => updateField("responseTimeMinutes", event.target.value)}
                  className="bg-muted/50"
                />
              </Field>
            </FieldGroup>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel>Skills (comma separated)</FieldLabel>
              <Input
                value={form.skillsText}
                onChange={(event) => updateField("skillsText", event.target.value)}
                placeholder="TikTok moderation, Comment triage, Audience engagement"
                className="bg-muted/50"
              />
            </Field>
          </FieldGroup>

          <FieldGroup>
            <Field>
              <FieldLabel>Availability Summary</FieldLabel>
              <Textarea
                value={form.availabilitySummary}
                onChange={(event) => updateField("availabilitySummary", event.target.value)}
                placeholder="Example: Mon-Fri 6PM-11PM EST, weekends flexible"
                className="min-h-[90px] bg-muted/50"
              />
            </Field>
          </FieldGroup>

          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Status: <span className="font-medium text-foreground capitalize">{profile.profileStatus}</span>
              {profile.publicSlug ? (
                <span className="ml-2 text-primary">slug: {profile.publicSlug}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => void saveProfile()} disabled={isSaving || isPublishing}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Draft
              </Button>
              <Button onClick={() => void publishProfile()} disabled={isSaving || isPublishing}>
                {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publish Profile
              </Button>
            </div>
          </div>

          {publicProfileUrl ? (
            <p className="text-xs text-muted-foreground">
              Public URL slug ready: {publicProfileUrl}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
