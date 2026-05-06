"use client"

import { useEffect, useRef, useState } from "react"
import {
  CreateOrganization,
  OrganizationProfile,
  OrganizationSwitcher,
  useAuth,
  useOrganization,
} from "@clerk/nextjs"
import { Loader2 } from "lucide-react"

import {
  getClerkErrorMessage,
  syncSellerActiveOrganization,
  syncSellerOrganizationMembers,
  waitForSessionToken,
} from "@/lib/auth"

export default function SellerOrganizationPage() {
  const { getToken } = useAuth()
  const { organization } = useOrganization()
  const [isSyncing, setIsSyncing] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const isMemberSyncInFlightRef = useRef(false)

  async function syncOrganizationMembersOnce(organizationId: string) {
    if (isMemberSyncInFlightRef.current) {
      return
    }

    isMemberSyncInFlightRef.current = true
    try {
      const token = await waitForSessionToken(getToken)
      await syncSellerOrganizationMembers(token, organizationId)
    } finally {
      isMemberSyncInFlightRef.current = false
    }
  }

  useEffect(() => {
    const organizationId = organization?.id

    if (!organizationId) {
      return
    }

    let cancelled = false

    async function syncOrganizationContext() {
      try {
        setIsSyncing(true)
        setErrorMessage("")
        const token = await waitForSessionToken(getToken)
        await syncSellerActiveOrganization(token, organizationId as string)
        await syncOrganizationMembersOnce(organizationId as string)
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getClerkErrorMessage(error))
        }
      } finally {
        if (!cancelled) {
          setIsSyncing(false)
        }
      }
    }

    void syncOrganizationContext()

    return () => {
      cancelled = true
    }
  }, [getToken, organization?.id])

  useEffect(() => {
    const organizationId = organization?.id

    if (!organizationId) {
      return
    }

    const intervalId = window.setInterval(() => {
      void syncOrganizationMembersOnce(organizationId as string).catch(() => null)
    }, 15000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [getToken, organization?.id])

  return (
    <div className="seller-org-fullscreen w-full space-y-4">
      {/* <div>
        <h1 className="text-2xl font-semibold text-foreground">Organization</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your organization, manage members, and assign roles using Clerk organization settings.
        </p>
      </div> */}

      {/* <div className="w-full">
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/seller/organization"
          afterCreateOrganizationUrl="/seller/organization"
        />
      </div> */}

      {!organization ? (
        <div className="w-full">
          <CreateOrganization
            routing="path"
            path="/seller/organization"
            afterCreateOrganizationUrl="/seller/organization"
            appearance={{
              elements: {
                rootBox: "w-full",
                cardBox: "w-full",
                card: "w-full max-w-none shadow-none border-0 rounded-none bg-transparent",
              },
            }}
          />
        </div>
      ) : (
        <div className="w-full">
          <OrganizationProfile
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full",
                cardBox: "w-full",
                card: "w-full max-w-none shadow-none border-0 rounded-none bg-transparent",
              },
            }}
          />
        </div>
      )}

      {isSyncing ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Syncing organization and team members with workspace...
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <style jsx global>{`
        .seller-org-fullscreen .cl-rootBox,
        .seller-org-fullscreen .cl-cardBox,
        .seller-org-fullscreen .cl-card,
        .seller-org-fullscreen .cl-organizationProfile-root,
        .seller-org-fullscreen .cl-createOrganization-root {
          width: 100% !important;
          max-width: none !important;
        }

        .seller-org-fullscreen .cl-card {
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          min-height: calc(100vh - 220px);
        }
      `}</style>
    </div>
  )
}
