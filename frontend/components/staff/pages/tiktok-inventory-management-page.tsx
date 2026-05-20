"use client"

import { TikTokGlobalProductsPanel } from "@/components/inventory/tiktok-global-products-panel"
import { StaffModuleGate } from "@/components/staff/staff-module-gate"

export function StaffTikTokInventoryManagementPage() {
  return (
    <StaffModuleGate
      moduleId="view_inventory"
      title="Inventory Management"
      description="Manage your product list and inventory visibility for TikTok Shop."
    >
      <TikTokGlobalProductsPanel readOnly />
    </StaffModuleGate>
  )
}
