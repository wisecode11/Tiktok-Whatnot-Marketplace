import type { SignOutOptions } from "@clerk/types"

type ClerkSignOut = (options?: SignOutOptions) => Promise<void>

export function clearClientAuthState() {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.clear()
    window.sessionStorage.clear()
  } catch {
    // Ignore storage access errors (private mode, blocked storage, etc.).
  }

  try {
    if ("caches" in window) {
      void caches.keys().then((keys) => {
        for (const key of keys) {
          void caches.delete(key)
        }
      })
    }
  } catch {
    // Ignore cache API errors.
  }
}

export async function signOutAndClearAuth(signOut: ClerkSignOut, options?: SignOutOptions) {
  clearClientAuthState()
  await signOut(options)
}
