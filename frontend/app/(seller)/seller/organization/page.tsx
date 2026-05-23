"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth, useOrganization } from "@clerk/nextjs"

import { SellerOrganizationPanel } from "@/components/organization/seller-organization-panel"
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
    <SellerOrganizationPanel isSyncing={isSyncing} errorMessage={errorMessage} />
  )
}
