"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@clerk/nextjs"
import { ArrowRight, Loader2 } from "lucide-react"

import { useAuthenticatedUser } from "@/components/auth/authenticated-user-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getClerkErrorMessage, waitForSessionToken } from "@/lib/auth"
import { getMyPermissions, MODULE_DEFINITIONS } from "@/lib/permissions-checker"

function getDisplayName(firstName: string, lastName: string, email: string) {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
  return fullName || email
}

export default function StaffDashboardPage() {
  const user = useAuthenticatedUser()
  const { getToken, isLoaded } = useAuth()
  const [modules, setModules] = useState<string[]>([])
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPermissions() {
      if (!isLoaded) {
        return
      }

      try {
        setIsLoadingPermissions(true)
        setErrorMessage(null)

        const token = await waitForSessionToken(getToken)
        const result = await getMyPermissions(token)

        if (!cancelled) {
          setModules(result.modules || [])
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getClerkErrorMessage(error))
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPermissions(false)
        }
      }
    }

    void loadPermissions()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  if (!user) {
    return null
  }

  const displayName = getDisplayName(user.firstName, user.lastName, user.email)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl">Welcome Staff, {displayName}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You only see modules that your streamer has allowed for your account.
          </p>
        </CardContent>
      </Card>

      {isLoadingPermissions ? (
        <div className="flex min-h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : errorMessage ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </CardContent>
        </Card>
      ) : modules.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No modules are enabled for your account yet. Please contact your streamer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">
              Allowed modules are available in the left sidebar. You can also jump in directly from here.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {modules.map((moduleId) => {
                const definition = MODULE_DEFINITIONS[moduleId]
                const label = definition?.label || moduleId
                return (
                  <Link
                    key={moduleId}
                    href={`/staff/modules/${moduleId}`}
                    className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40"
                  >
                    <span>{label}</span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
