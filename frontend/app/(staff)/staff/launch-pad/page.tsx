"use client"

import { Suspense } from "react"
import { Loader2 } from "lucide-react"

import { LaunchPadContent } from "@/components/launch-pad/launch-pad-content"

export default function StaffLaunchPadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LaunchPadContent forcedRole="staff" embedded />
    </Suspense>
  )
}
