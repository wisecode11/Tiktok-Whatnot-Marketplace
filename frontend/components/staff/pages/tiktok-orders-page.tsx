"use client"

import { TikTokShopOrdersPanel } from "@/components/orders/tiktok-shop-orders-panel"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"

export function StaffTikTokOrdersPage() {
  return (
    <StaffModuleGate
      moduleId="view_orders"
      title="Orders"
      description="TikTok Shop orders for your parent seller workspace (Partner API / mock data)."
    >
      <TikTokShopOrdersPanel />
    </StaffModuleGate>
  )
}
