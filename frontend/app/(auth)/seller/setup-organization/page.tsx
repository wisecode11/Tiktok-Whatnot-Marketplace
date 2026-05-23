"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth, useUser } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { CreateOrganizationForm } from "@/components/organization/create-organization-form"
import {
  AuthApiError,
  getClerkErrorMessage,
  getSellerOrganizations,
  waitForSessionToken,
} from "@/lib/auth"

export default function SellerSetupOrganizationPage() {
  const router = useRouter()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const [isChecking, setIsChecking] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [defaultName, setDefaultName] = useState("")

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

        if (!defaultName && suggestedName) {
          setDefaultName(suggestedName)
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
  }, [defaultName, getToken, isLoaded, isSignedIn, router, suggestedName])

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

      <div className="mt-6">
        <CreateOrganizationForm
          defaultName={defaultName}
          submitLabel="Create organization"
          onCreated={() => router.replace("/launch-pad?role=streamer")}
        />
      </div>
    </div>
  )
}
