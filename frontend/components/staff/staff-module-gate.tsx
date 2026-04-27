"use client"

import Link from "next/link"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useStaffModules } from "@/components/staff/staff-modules-context"

export function StaffModuleGate({
  moduleId,
  title,
  description,
  children,
}: {
  moduleId: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  const { modules, loading, permissionError } = useStaffModules()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm">Loading workspace permissions…</p>
      </div>
    )
  }

  if (permissionError) {
    return (
      <Card className="max-w-lg border-destructive/30">
        <CardHeader>
          <CardTitle>Unable to verify access</CardTitle>
          <CardDescription>{permissionError}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/staff">Back to staff home</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!modules.includes(moduleId)) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Module not enabled</CardTitle>
          <CardDescription>
            Your streamer has not granted access to <span className="font-medium text-foreground">{title}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/staff">Back to staff home</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}
