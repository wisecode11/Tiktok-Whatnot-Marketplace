"use client"

import { createContext, useContext } from "react"

import type { AuthUserProfile } from "@/lib/auth"

const AuthenticatedUserContext = createContext<AuthUserProfile | null>(null)

export function AuthenticatedUserProvider({
  user,
  children,
}: {
  user: AuthUserProfile
  children: React.ReactNode
}) {
  return (
    <AuthenticatedUserContext.Provider value={user}>
      {children}
    </AuthenticatedUserContext.Provider>
  )
}

export function useAuthenticatedUser() {
  return useContext(AuthenticatedUserContext)
}
