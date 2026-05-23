"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useAuth, useClerk, useUser } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  AuthApiError,
  createSellerOrganization,
  getClerkErrorMessage,
  getSellerOrganizations,
  waitForSessionToken,
} from "@/lib/auth"

function buildInitialSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

export default function SellerSetupOrganizationPage() {
  const router = useRouter()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const { setActive } = useClerk()

  const [isChecking, setIsChecking] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")

  const suggestedName = useMemo(() => {
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim()
    if (fullName) {
      return `${fullName} Store`
    }
    return ""
  }, [user?.firstName, user?.lastName])

  useEffect(() => {
    let cancelled = false

    async function checkOrganizations() {
      if (!isLoaded) {
        return
      }

      if (!isSignedIn) {
        router.replace("/login?role=streamer")
        return
      }

      try {
        const token = await waitForSessionToken(getToken)
        const result = await getSellerOrganizations(token)

        if (cancelled) {
          return
        }

        if (result.hasOrganizations) {
          const hasActiveOrganization = result.organizations.some((org) => org.isActive)
          router.replace(
            hasActiveOrganization ? "/launch-pad?role=streamer" : "/seller/select-organization",
          )
          return
        }

        if (!name && suggestedName) {
          setName(suggestedName)
          setSlug(buildInitialSlug(suggestedName))
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof AuthApiError && error.status === 401) {
            router.replace("/login?role=streamer")
            return
          }
          setErrorMessage(getClerkErrorMessage(error))
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false)
        }
      }
    }

    void checkOrganizations()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded, isSignedIn, name, router, suggestedName])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage("")

    try {
      setIsSubmitting(true)
      const token = await waitForSessionToken(getToken)
      const result = await createSellerOrganization(token, {
        name,
        slug,
      })

      if (result.organization.clerkOrganizationId) {
        await setActive({ organization: result.organization.clerkOrganizationId }).catch(() => null)
      }

      router.replace(result.redirectTo || "/launch-pad?role=streamer")
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isChecking) {
    return (
      <div className="flex w-full max-w-md flex-col items-center justify-center rounded-2xl border border-border/70 bg-card/90 px-6 py-10 text-center shadow-sm">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Checking organization setup...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/90 p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-foreground">Create Seller Organization</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your seller account needs an organization before entering launch pad.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label htmlFor="org-name" className="text-sm font-medium text-foreground">
            Organization Name
          </label>
          <input
            id="org-name"
            value={name}
            onChange={(event) => {
              const nextName = event.target.value
              setName(nextName)
              setSlug(buildInitialSlug(nextName))
            }}
            placeholder="My Seller Brand"
            required
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="org-slug" className="text-sm font-medium text-foreground">
            Slug (optional)
          </label>
          <input
            id="org-slug"
            value={slug}
            onChange={(event) => setSlug(buildInitialSlug(event.target.value))}
            placeholder="my-seller-brand"
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Organization"}
        </button>
      </form>
    </div>
  )
}
