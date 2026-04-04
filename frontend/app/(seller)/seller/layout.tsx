"use client"

import { SellerSubscriptionGate } from "@/components/dashboard/seller-subscription-gate"

export default function SellerRoutesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SellerSubscriptionGate>{children}</SellerSubscriptionGate>
}
