"use client"

import { useEffect, useState } from "react"
import { OrganizationList, useAuth, useOrganization } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  AuthApiError,
  getClerkErrorMessage,
  syncSellerActiveOrganization,
  waitForSessionToken,
} from "@/lib/auth"

export default function SellerSelectOrganizationPage() {
  const router = useRouter()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { organization } = useOrganization()

  const [isSyncing, setIsSyncing] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    if (!isSignedIn) {
      router.replace("/login?role=streamer")
    }
  }, [isLoaded, isSignedIn, router])

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

  if (!isLoaded) {
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
        After account login, select or create your organization, then click continue.
      </p>

      <div className="mt-6 flex justify-center rounded-xl border border-border bg-background p-4">
        <OrganizationList
          hidePersonal
          skipInvitationScreen
          afterSelectOrganizationUrl="/seller/select-organization"
          afterCreateOrganizationUrl="/seller/select-organization"
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
        <p className="text-sm text-muted-foreground">
          {organization?.name
            ? `Selected organization: ${organization.name}`
            : "No organization selected yet."}
        </p>
        <Button onClick={() => void continueWithOrganization()} disabled={isSyncing || !organization?.id}>
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
