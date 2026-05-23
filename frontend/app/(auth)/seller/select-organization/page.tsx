"use client"

import { useEffect, useState } from "react"
import { useAuth, useOrganization, useOrganizationList } from "@clerk/nextjs"
import Link from "next/link"
import { Building2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  AuthApiError,
  getClerkErrorMessage,
  syncSellerActiveOrganization,
  waitForSessionToken,
} from "@/lib/auth"
import { cn } from "@/lib/utils"

export default function SellerSelectOrganizationPage() {
  const router = useRouter()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { organization } = useOrganization()
  const {
    isLoaded: isOrgListLoaded,
    setActive,
    userMemberships,
  } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  })

  const [isSyncing, setIsSyncing] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const memberships = userMemberships?.data ?? []
  const isPageReady = isLoaded && isOrgListLoaded

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    if (!isSignedIn) {
      router.replace("/login?role=streamer")
    }
  }, [isLoaded, isSignedIn, router])

  async function handleSelectOrganization(organizationId: string) {
    if (organization?.id === organizationId) {
      return
    }

    if (!setActive) {
      setErrorMessage("Organization selection is not available yet. Please try again.")
      return
    }

    try {
      setIsSelecting(true)
      setErrorMessage("")
      await setActive({
        organization: organizationId,
        redirectUrl: "/seller/select-organization",
      })
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setIsSelecting(false)
    }
  }

  async function continueWithOrganization() {
    if (!organization?.id) {
      setErrorMessage("Please select an organization first.")
      return
    }

    try {
      setIsSyncing(true)
      setErrorMessage("")
      const token = await waitForSessionToken(getToken)
      await syncSellerActiveOrganization(token, organization.id)
      router.replace("/seller/dashboard")
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 401) {
        router.replace("/login?role=streamer")
        return
      }
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setIsSyncing(false)
    }
  }

  if (!isPageReady) {
    return (
      <div className="flex w-full max-w-md flex-col items-center justify-center rounded-2xl border border-border/70 bg-card/90 px-6 py-10 text-center shadow-sm">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Loading organization login...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl rounded-2xl border border-border/70 bg-card/90 p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-foreground">Organization Login</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Select an existing organization to continue. New organizations can only be created during signup or from the
        Organization tab in your dashboard.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-background p-4">
        {memberships.length === 0 ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm font-medium text-foreground">No organizations found for this account.</p>
            <p className="text-sm text-muted-foreground">
              Create your organization during{" "}
              <Link href="/signup?role=streamer" className="font-medium text-primary hover:underline">
                signup
              </Link>
              , or ask your team admin to invite you to an existing organization.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {memberships.map((membership) => {
              const org = membership.organization
              const orgId = org.id
              const isSelected = organization?.id === orgId

              return (
                <li key={orgId}>
                  <button
                    type="button"
                    disabled={isSelecting || isSyncing}
                    onClick={() => void handleSelectOrganization(orgId)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                      isSelected
                        ? "border-primary/40 bg-primary/[0.08]"
                        : "border-border bg-background hover:border-primary/25 hover:bg-muted/30",
                    )}
                  >
                    {org.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={org.imageUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{org.name}</p>
                      {org.slug ? (
                        <p className="truncate text-xs text-muted-foreground">{org.slug}</p>
                      ) : null}
                    </div>
                    {isSelected ? (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Selected
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
        <p className="text-sm text-muted-foreground">
          {organization?.name
            ? `Selected organization: ${organization.name}`
            : "No organization selected yet."}
        </p>
        <Button
          onClick={() => void continueWithOrganization()}
          disabled={isSyncing || isSelecting || !organization?.id}
        >
          {isSyncing ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Continuing...
            </span>
          ) : (
            "Continue"
          )}
        </Button>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}
    </div>
  )
}
