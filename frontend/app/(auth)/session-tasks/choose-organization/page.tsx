"use client"

import { Suspense, useMemo } from "react"
import { TaskChooseOrganization, useUser } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { buildPath, normalizeRole } from "@/lib/auth"

function ChooseOrganizationContent() {
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

  if (!isLoaded) {
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
        Select the organization your streamer admin added you to, then continue.
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
