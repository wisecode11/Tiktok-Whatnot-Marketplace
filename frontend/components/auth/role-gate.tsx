"use client"

import { ReactNode, useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { getCurrentUserProfile, type AppRole, type AuthUserProfile, AuthApiError } from "@/lib/auth"

type RoleGateProps = {
  allowedRoles: AppRole[]
  unauthenticatedPath: string
  children: ReactNode
}

export function RoleGate({ allowedRoles, unauthenticatedPath, children }: RoleGateProps) {
  const { getToken, isLoaded, userId } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [authorizedUser, setAuthorizedUser] = useState<AuthUserProfile | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  const allowedKey = useMemo(() => allowedRoles.join("|"), [allowedRoles])

  useEffect(() => {
    let cancelled = false

    async function validateRole() {
      if (!isLoaded) {
        return
      }

      if (!userId) {
        router.replace(unauthenticatedPath)
        return
      }

      try {
        const token = await getToken()

        if (!token) {
          router.replace(unauthenticatedPath)
          return
        }

        const { user, redirectTo } = await getCurrentUserProfile(token)

        if (cancelled) {
          return
        }

        if (!allowedRoles.includes(user.role)) {
          router.replace(redirectTo)
          return
        }

        setAuthorizedUser(user)
      } catch (error) {
        if (!cancelled) {
          if (error instanceof AuthApiError && error.status === 401) {
            router.replace(unauthenticatedPath)
          } else {
            router.replace(userId ? "/login" : unauthenticatedPath)
          }
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false)
        }
      }
    }

    setIsChecking(true)
    setAuthorizedUser(null)
    void validateRole()

    return () => {
      cancelled = true
    }
  }, [allowedKey, allowedRoles, getToken, isLoaded, pathname, router, unauthenticatedPath, userId])

  if (isChecking || !authorizedUser) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}
