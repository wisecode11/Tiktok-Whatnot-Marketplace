"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useAuth, useClerk, useUser } from "@clerk/nextjs"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"

import {
  buildPath,
  completePortalAuthentication,
  getAccountStatusErrorCopy,
  getClerkErrorMessage,
  getDashboardPath,
  normalizeRole,
  waitForSessionToken,
  getAuthErrorRedirectTo,
  type AppRole,
} from "@/lib/auth"
import { signOutAndClearAuth } from "@/lib/auth-session"

type Flow = "login" | "signup"

function AuthCompleteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const { user } = useUser()
  const [errorMessage, setErrorMessage] = useState("")
  const [errorTitle, setErrorTitle] = useState("Authentication could not be completed")
  const [hasAccountStatusError, setHasAccountStatusError] = useState(false)
  const [alternateRedirect, setAlternateRedirect] = useState<string | null>(null)
  const [sessionGraceExpired, setSessionGraceExpired] = useState(false)
  const hasStartedRef = useRef(false)

  const flow: Flow = searchParams.get("flow") === "signup" ? "signup" : "login"
  const requestedRole = normalizeRole(searchParams.get("role"))

  const metadataRole = useMemo(() => {
    const publicRole = user?.publicMetadata?.role
    if (typeof publicRole === "string") {
      return normalizeRole(publicRole)
    }

    const unsafeRole = user?.unsafeMetadata?.role
    if (typeof unsafeRole === "string") {
      return normalizeRole(unsafeRole)
    }

    return null
  }, [user?.publicMetadata, user?.unsafeMetadata])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || hasStartedRef.current) {
      return
    }

    hasStartedRef.current = true

    const completeAuthentication = async () => {
      const effectiveRole = requestedRole || metadataRole

      if (!effectiveRole) {
        throw new Error("No account role was selected. Please choose a role and try again.")
      }

      const token = await waitForSessionToken(getToken, 24)
      const result = await completePortalAuthentication(token, flow, effectiveRole)

      router.replace(result.redirectTo)
    }

    void completeAuthentication().catch((error: unknown) => {
      const wrongPortalRedirect = getAuthErrorRedirectTo(error)

      if (wrongPortalRedirect) {
        setAlternateRedirect(wrongPortalRedirect)
      }

      const accountStatusError = getAccountStatusErrorCopy(error)

      if (accountStatusError) {
        setHasAccountStatusError(true)
        setErrorTitle(accountStatusError.title)
        setErrorMessage(accountStatusError.message)
        return
      }

      setHasAccountStatusError(false)
      setErrorTitle("Authentication could not be completed")
      setErrorMessage(getClerkErrorMessage(error))
    })
  }, [flow, getToken, isLoaded, isSignedIn, metadataRole, requestedRole, router])

  // After SignUp/SignIn redirect, Clerk may need a moment to hydrate the session cookie.
  useEffect(() => {
    if (!isLoaded || isSignedIn) {
      setSessionGraceExpired(false)
      return
    }

    const timer = window.setTimeout(() => setSessionGraceExpired(true), 3000)
    return () => window.clearTimeout(timer)
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    if (!isLoaded || isSignedIn || !sessionGraceExpired) {
      return
    }

    router.replace(buildPath(flow === "signup" ? "/signup" : "/login", { role: requestedRole }))
  }, [flow, isLoaded, isSignedIn, requestedRole, router, sessionGraceExpired])

  const fallbackPortal = requestedRole ? getDashboardPath(requestedRole as AppRole) : "/login"
  const signOutRedirectUrl = buildPath(flow === "signup" ? "/signup" : "/login", { role: requestedRole })
  const primaryActionHref = hasAccountStatusError
    ? signOutRedirectUrl
    : (alternateRedirect || fallbackPortal)
  const primaryActionLabel = hasAccountStatusError
    ? "Back to sign in"
    : (alternateRedirect ? "Open the correct dashboard" : "Go back")

  if (!errorMessage) {
    return (
      <div className="flex w-full max-w-md flex-col items-center justify-center rounded-2xl border border-border/70 bg-card/90 px-6 py-10 text-center shadow-[0_24px_80px_-50px_rgba(84,74,255,0.35)] backdrop-blur-sm">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <h1 className="mt-5 text-2xl font-semibold text-foreground">Preparing your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We are syncing your Clerk account with the correct portal and routing you to your dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-destructive/20 bg-card/95 p-6 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{errorTitle}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 text-sm">
        <Link
          href={primaryActionHref}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-95"
        >
          {primaryActionLabel}
        </Link>

        <button
          type="button"
          onClick={() => void signOutAndClearAuth(signOut, { redirectUrl: signOutRedirectUrl })}
          className="rounded-lg border border-border bg-background px-4 py-3 font-medium text-foreground transition-colors hover:bg-muted"
        >
          Sign out and try another account
        </button>
      </div>
    </div>
  )
}

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex w-full max-w-md flex-col items-center justify-center rounded-2xl border border-border/70 bg-card/90 px-6 py-10 text-center shadow-[0_24px_80px_-50px_rgba(84,74,255,0.35)] backdrop-blur-sm">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <h1 className="mt-5 text-2xl font-semibold text-foreground">Preparing your workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We are syncing your Clerk account with the correct portal and routing you to your dashboard.
          </p>
        </div>
      }
    >
      <AuthCompleteContent />
    </Suspense>
  )
}