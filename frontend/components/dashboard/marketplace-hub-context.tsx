"use client"

import { createContext, useContext } from "react"

export type MarketplaceHub = "whatnot" | "tiktok" | "agency" | "launch-pad"

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

type MarketplaceHubContextValue = {
  hub: MarketplaceHub
  setHub: (hub: MarketplaceHub) => void
}

const MarketplaceHubContext = createContext<MarketplaceHubContextValue | null>(null)

export function useMarketplaceHub() {
  return useContext(MarketplaceHubContext)
}

export { MarketplaceHubContext }