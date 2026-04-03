"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth, useClerk, useUser } from "@clerk/nextjs"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"

import {
  AuthApiError,
  buildPath,
  getClerkErrorMessage,
  getDashboardPath,
  loginWithRole,
  normalizeRole,
  syncCurrentUser,
  waitForSessionToken,
  type AppRole,
} from "@/lib/auth"

type Flow = "login" | "signup"

export default function AuthCompletePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const { user } = useUser()
  const [errorMessage, setErrorMessage] = useState("")
  const [alternateRedirect, setAlternateRedirect] = useState<string | null>(null)
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

      const token = await waitForSessionToken(getToken)
      const result = flow === "signup"
        ? await syncCurrentUser(token, effectiveRole)
        : await loginWithRole(token, effectiveRole)

      router.replace(result.redirectTo)
    }

    void completeAuthentication().catch((error: unknown) => {
      if (error instanceof AuthApiError && error.details && typeof error.details === "object") {
        const redirectTo = (error.details as { redirectTo?: string }).redirectTo

        if (typeof redirectTo === "string") {
          setAlternateRedirect(redirectTo)
        }
      }

      setErrorMessage(getClerkErrorMessage(error))
    })
  }, [flow, getToken, isLoaded, isSignedIn, metadataRole, requestedRole, router])

  useEffect(() => {
    if (!isLoaded || isSignedIn) {
      return
    }

    router.replace(buildPath(flow === "signup" ? "/signup" : "/login", { role: requestedRole }))
  }, [flow, isLoaded, isSignedIn, requestedRole, router])

  const fallbackPortal = requestedRole ? getDashboardPath(requestedRole as AppRole) : "/login"
  const signOutRedirectUrl = buildPath(flow === "signup" ? "/signup" : "/login", { role: requestedRole })

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
          <h1 className="text-xl font-semibold text-foreground">Authentication could not be completed</h1>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 text-sm">
        <Link
          href={alternateRedirect || fallbackPortal}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-95"
        >
          {alternateRedirect ? "Open the correct dashboard" : "Go back"}
        </Link>

        <button
          type="button"
          onClick={() => signOut({ redirectUrl: signOutRedirectUrl })}
          className="rounded-lg border border-border bg-background px-4 py-3 font-medium text-foreground transition-colors hover:bg-muted"
        >
          Sign out and try another account
        </button>
      </div>
    </div>
  )
}