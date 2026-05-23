"use client"

import { Suspense, useEffect, useMemo } from "react"
import { TaskChooseOrganization, useUser } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { buildPath, normalizeRole } from "@/lib/auth"

function ChooseOrganizationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoaded } = useUser()

  const role = useMemo(() => {
    const fromQuery = normalizeRole(searchParams.get("role"))
    if (fromQuery) {
      return fromQuery
    }

    const publicRole = user?.publicMetadata?.role
    if (typeof publicRole === "string") {
      return normalizeRole(publicRole)
    }

    const unsafeRole = user?.unsafeMetadata?.role
    if (typeof unsafeRole === "string") {
      return normalizeRole(unsafeRole)
    }

    return null
  }, [searchParams, user?.publicMetadata, user?.unsafeMetadata])

  const redirectUrlComplete = buildPath("/auth-complete", {
    flow: "login",
    role: role || undefined,
  })

  // Organization selection is streamer-only. Staff, moderator, and admin skip this Clerk task.
  useEffect(() => {
    if (!isLoaded) {
      return
    }

    if (role === "streamer") {
      router.replace("/seller/select-organization")
      return
    }

    if (role) {
      router.replace(redirectUrlComplete)
    }
  }, [isLoaded, redirectUrlComplete, role, router])

  if (!isLoaded || role !== "streamer") {
    return (
      <LoadingFallback>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </LoadingFallback>
    )
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="mb-2 text-center text-2xl font-semibold text-foreground">Choose your workspace</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Select your seller organization to continue.
      </p>
      <TaskChooseOrganization redirectUrlComplete={redirectUrlComplete} />
    </div>
  )
}

function LoadingFallback({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex w-full max-w-md flex-col items-center justify-center py-10">
      {children}
    </div>
  )
}

export default function ChooseOrganizationPage() {
  return (
    <Suspense
      fallback={
        <LoadingFallback>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </LoadingFallback>
      }
    >
      <ChooseOrganizationContent />
    </Suspense>
  )
}
