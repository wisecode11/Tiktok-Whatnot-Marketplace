"use client"

import { Suspense } from "react"
import { Loader2 } from "lucide-react"

import { RoleGate } from "@/components/auth/role-gate"
import { LaunchPadContent } from "@/components/launch-pad/launch-pad-content"

export default function LaunchPadPage() {
  return (
    <RoleGate allowedRoles={["streamer", "moderator", "staff", "admin"]} unauthenticatedPath="/login">
      <Suspense
        fallback={
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <LaunchPadContent />
      </Suspense>
    </RoleGate>
  )
}
