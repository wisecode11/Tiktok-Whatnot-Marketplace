"use client"

import { createContext, useContext } from "react"

export type MarketplaceHub = "whatnot" | "tiktok" | "agency" | "launch-pad"

export type StaffMarketplaceHub = Extract<MarketplaceHub, "whatnot" | "tiktok">

export const STAFF_MARKETPLACE_HUB_OPTIONS: StaffMarketplaceHub[] = ["tiktok", "whatnot"]

export const STAFF_MARKETPLACE_HUB_LANDING_PATHS: Record<StaffMarketplaceHub, string> = {
  tiktok: "/staff/modules/tiktok_inventory",
  whatnot: "/staff/modules/view_orders",
}

export const MARKETPLACE_HUB_LABELS: Record<MarketplaceHub, string> = {
  whatnot: "Whatnot",
  tiktok: "TikTok",
  agency: "Agency",
  "launch-pad": "Launch Pad",
}

export const MARKETPLACE_HUB_DESCRIPTIONS: Record<MarketplaceHub, string> = {
  whatnot: "Whatnot inventory, orders, finance, and show tools.",
  tiktok: "TikTok inventory, orders, finance, publishing, and fulfillment.",
  agency: "Organization, staff, and agency controls.",
  "launch-pad": "Connect TikTok Shop, Whatnot, and QuickBooks.",
}

export const MARKETPLACE_HUB_LANDING_PATHS: Record<MarketplaceHub, string> = {
  whatnot: "/seller/inventory-management",
  tiktok: "/seller/inventory-management",
  agency: "/seller/organization",
  "launch-pad": "/seller",
}

export const MARKETPLACE_HUB_OPTIONS: MarketplaceHub[] = ["whatnot", "tiktok", "agency", "launch-pad"]

/** Seller sidebar dropdown — Launch Pad is reached via /seller, not the hub switcher. */
export const SELLER_MARKETPLACE_HUB_OPTIONS: MarketplaceHub[] = ["whatnot", "tiktok", "agency"]

type MarketplaceHubContextValue = {
  hub: MarketplaceHub
  setHub: (hub: MarketplaceHub) => void
  /** When set (e.g. staff layout), only these hubs appear in the sidebar dropdown. */
  options?: readonly MarketplaceHub[]
  /** Override landing routes when switching hub (e.g. staff module paths). */
  landingPaths?: Partial<Record<MarketplaceHub, string>>
}

const MarketplaceHubContext = createContext<MarketplaceHubContextValue | null>(null)

export function useMarketplaceHub() {
  return useContext(MarketplaceHubContext)
}

export { MarketplaceHubContext }