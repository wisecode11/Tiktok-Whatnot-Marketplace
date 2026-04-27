"use client"

import { createContext, useContext } from "react"

export type StaffModulesContextValue = {
  modules: string[]
  loading: boolean
  permissionError: string | null
}

const StaffModulesContext = createContext<StaffModulesContextValue>({
  modules: [],
  loading: true,
  permissionError: null,
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
