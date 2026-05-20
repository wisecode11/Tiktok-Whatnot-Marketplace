"use client"

import { TikTokShopOrderManagementPanel } from "@/components/orders/tiktok-shop-order-management-panel"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"

export function StaffTikTokOrderManagementPage() {
  return (
    <StaffModuleGate
      moduleId="order_management"
      title="Order Management"
      description="TikTok Shop operational queue for your parent seller workspace (Partner API / mock data)."
    >
      <TikTokShopOrderManagementPanel />
    </StaffModuleGate>
  )
}
