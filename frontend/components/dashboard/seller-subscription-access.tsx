"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"

import { waitForSessionToken } from "@/lib/auth"
import { getSellerBillingOverview } from "@/lib/billing"

const RESTRICTED_SELLER_ROUTES = [
  "/seller/analytics",
  "/seller/products",
  "/seller/team",
  "/seller/ai-tools",
  "/seller/moderators",
] as const

type SellerSubscriptionAccessContextValue = {
  isLoading: boolean
  hasActiveSubscription: boolean
  subscriptionStatus: string | null
  refreshAccess: () => Promise<void>
}

const SellerSubscriptionAccessContext = createContext<SellerSubscriptionAccessContextValue | null>(null)

function isSubscriptionActive(status: string | null | undefined) {
  return status === "active" || status === "trialing" || status === "past_due" || status === "incomplete"
}

export function isRestrictedSellerRoute(pathname: string | null | undefined) {
  return RESTRICTED_SELLER_ROUTES.some((route) => pathname === route || pathname?.startsWith(`${route}/`))
}

export function SellerSubscriptionAccessProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { getToken, isLoaded, userId } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)

  const loadSubscriptionState = useCallback(async () => {
    if (!isLoaded) {
      return
    }

    if (!userId) {
      setSubscriptionStatus(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      const token = await waitForSessionToken(getToken)
      const overview = await getSellerBillingOverview(token)

      setSubscriptionStatus(overview.currentSubscription?.status || null)
    } catch {
      setSubscriptionStatus(null)
    } finally {
      setIsLoading(false)
    }
  }, [getToken, isLoaded, userId])

  useEffect(() => {
    let cancelled = false

    void loadSubscriptionState().catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [loadSubscriptionState])

  const value = useMemo(
    () => ({
      isLoading,
      hasActiveSubscription: isSubscriptionActive(subscriptionStatus),
      subscriptionStatus,
      refreshAccess: loadSubscriptionState,
    }),
    [isLoading, loadSubscriptionState, subscriptionStatus],
  )

  return (
    <SellerSubscriptionAccessContext.Provider value={value}>
      {children}
    </SellerSubscriptionAccessContext.Provider>
  )
}

export function useSellerSubscriptionAccess() {
  const context = useContext(SellerSubscriptionAccessContext)

  if (!context) {
    throw new Error("useSellerSubscriptionAccess must be used within SellerSubscriptionAccessProvider.")
  }

  return context
}

export function useOptionalSellerSubscriptionAccess() {
  return useContext(SellerSubscriptionAccessContext)
}

export { RESTRICTED_SELLER_ROUTES }
