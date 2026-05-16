"use client"

import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { RoleGate } from "@/components/auth/role-gate"
import { LaunchPadContent } from "@/components/launch-pad/launch-pad-content"
import { buildPath, normalizeRole } from "@/lib/auth"

function LaunchPadRoleGate({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const role = normalizeRole(searchParams.get("role"))
  const unauthenticatedPath = role ? buildPath("/login", { role }) : "/login"

  return (
    <RoleGate
      allowedRoles={["streamer", "moderator", "admin"]}
      unauthenticatedPath={unauthenticatedPath}
    >
      {children}
    </RoleGate>
  )
}

export default function LaunchPadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LaunchPadRoleGate>
        <Suspense
          fallback={
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <LaunchPadContent />
        </Suspense>
      </LaunchPadRoleGate>
    </Suspense>
  )
}
