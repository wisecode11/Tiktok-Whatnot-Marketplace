"use client"

import { Loader2, Lock } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  isRestrictedSellerRoute,
  useSellerSubscriptionAccess,
} from "@/components/dashboard/seller-subscription-access"

export function SellerSubscriptionGate({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { hasActiveSubscription, isLoading } = useSellerSubscriptionAccess()

  if (!isRestrictedSellerRoute(pathname)) {
    return <>{children}</>
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Checking subscription access...
        </div>
      </div>
    )
  }

  if (hasActiveSubscription) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-xl border-border/60 shadow-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 rounded-full bg-muted p-3">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <CardTitle>Subscription required</CardTitle>
          <CardDescription>
            Please get a subscription to access this feature.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={() => router.push("/seller/subscription")}>Get Subscription</Button>
        </CardContent>
      </Card>
    </div>
  )
}
