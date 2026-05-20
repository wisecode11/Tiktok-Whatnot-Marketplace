"use client"

import { createContext, useContext } from "react"

import type { StaffMarketplaceHub } from "@/components/dashboard/marketplace-hub-context"

export type StaffModulesContextValue = {
  modules: string[]
  loading: boolean
  permissionError: string | null
  marketplaceHub: StaffMarketplaceHub
}

const StaffModulesContext = createContext<StaffModulesContextValue>({
  modules: [],
  loading: true,
  permissionError: null,
  marketplaceHub: "whatnot",
})

export function StaffModulesProvider({
  value,
  children,
}: {
  value: StaffModulesContextValue
  children: React.ReactNode
}) {
  return <StaffModulesContext.Provider value={value}>{children}</StaffModulesContext.Provider>
}

export function useStaffModules() {
  return useContext(StaffModulesContext)
}
