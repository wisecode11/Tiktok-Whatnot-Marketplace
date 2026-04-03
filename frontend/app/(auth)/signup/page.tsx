"use client"

import { useMemo, useState, Suspense } from "react"
import { SignUp, useAuth, useClerk, useUser } from "@clerk/nextjs"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Loader2, Shield, Users, Video } from "lucide-react"

import { BRAND_NAME } from "@/lib/brand"
import { cn } from "@/lib/utils"
import { buildPath, getSignupRedirectPath, normalizeRole, type AppRole } from "@/lib/auth"
import { BrandLogo } from "../../../components/brand-logo"

const clerkAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full",
    card: "w-full rounded-[1.15rem] border-0 bg-transparent p-0 shadow-none",
    header: "hidden",
    socialButtonsBlockButton:
      "h-11 rounded-lg border border-border bg-background text-foreground shadow-none hover:bg-muted",
    socialButtonsBlockButtonText: "font-medium text-foreground",
    dividerLine: "bg-border",
    dividerText: "text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground",
    formFieldLabel: "text-sm font-semibold text-foreground",
    formFieldInput:
      "h-11 rounded-lg border border-border bg-background text-foreground shadow-none placeholder:text-muted-foreground",
    formButtonPrimary:
      "h-11 rounded-lg border-0 bg-gradient-to-r from-primary to-accent text-sm font-semibold text-primary-foreground shadow-[0_18px_35px_-20px_var(--color-primary)] hover:opacity-95",
    footerAction: "hidden",
    footerActionLink: "text-primary hover:text-primary/90",
    formResendCodeLink: "text-primary hover:text-primary/90",
    identityPreviewText: "text-foreground",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    alert: "rounded-lg border border-destructive/20 bg-destructive/10 text-destructive",
    formFieldSuccessText: "text-emerald-600 dark:text-emerald-400",
  },
} as const

type Role = AppRole | null

const roleOptions = [
  {
    id: "streamer",
    label: "Streamer",
    icon: Video,
    activeClassName: "border-primary/40 bg-primary/[0.08] text-primary shadow-[0_10px_30px_-22px_var(--color-primary)]",
  },
  {
    id: "moderator",
    label: "Moderator",
    icon: Users,
    activeClassName: "border-primary/40 bg-primary/[0.08] text-primary shadow-[0_10px_30px_-22px_var(--color-primary)]",
  },
  {
    id: "admin",
    label: "Admin",
    icon: Shield,
    activeClassName: "border-amber-400/50 bg-amber-500/10 text-amber-600 shadow-[0_10px_30px_-22px_rgba(245,158,11,0.55)] dark:text-amber-400",
  },
] as const

function SignupContent() {
  const searchParams = useSearchParams()
  const { isLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const { user } = useUser()
  const initialRole = normalizeRole(searchParams.get("role"))
  const [selectedRole, setSelectedRole] = useState<Role | null>(initialRole)

  const signInUrl = useMemo(() => {
    return buildPath("/login", { role: selectedRole })
  }, [selectedRole])

  const completionUrl = useMemo(() => {
    return buildPath("/auth-complete", {
      flow: "signup",
      role: selectedRole,
    })
  }, [selectedRole])

  const currentRole = useMemo(() => {
    const publicRole = user?.publicMetadata?.role
    if (typeof publicRole === "string") {
      return normalizeRole(publicRole)
    }

    const unsafeRole = user?.unsafeMetadata?.role
    if (typeof unsafeRole === "string") {
      return normalizeRole(unsafeRole)
    }

    return null
  }, [user?.publicMetadata, user?.unsafeMetadata])

  const currentEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses[0]?.emailAddress || "this account"
  const continueUrl = currentRole ? getSignupRedirectPath(currentRole) : signInUrl
  const signOutRedirectUrl = buildPath("/signup", { role: selectedRole || currentRole })
  const roleMismatch = Boolean(selectedRole && currentRole && selectedRole !== currentRole)

  return (
    <div className="flex w-full justify-center">
      <div className="w-full max-w-[27rem]">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo
            showText={false}
            className="mb-5"
            iconClassName="h-14 w-14 rounded-full ring-8 ring-primary/8 dark:ring-primary/12"
          />
          <h1 className="text-[2rem] font-bold tracking-tight">
            Join <span className="text-primary">{BRAND_NAME}</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your account with the right portal from the start.
          </p>
        </div>

        <div className="mb-5 flex justify-center">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-primary">
            System User Portal
          </span>
        </div>

        <div className="mb-6 space-y-3">
          <p className="text-sm font-semibold text-foreground">Choose your role</p>
          <div className="grid grid-cols-3 gap-3">
            {roleOptions.map((role) => {
              const isActive = selectedRole === role.id
              const Icon = role.icon

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRole(role.id)}
                  className={cn(
                    "flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-background/90 px-2 py-4 text-center text-foreground transition-all hover:border-primary/25 hover:bg-muted/30 dark:bg-background/50",
                    isActive && role.activeClassName,
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      isActive
                        ? role.id === "admin"
                          ? "text-amber-500 dark:text-amber-400"
                          : "text-primary"
                        : "text-muted-foreground",
                    )}
                  />
                  <span className="text-sm font-semibold">{role.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {isLoaded && isSignedIn ? (
          <div className="rounded-[1.15rem] border border-border bg-background/90 p-5 shadow-sm">
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-semibold text-foreground">You are already signed in</h2>
              <p className="text-sm text-muted-foreground">
                {currentEmail}
                {currentRole ? ` is already using the ${currentRole} portal.` : " already has an active session in this browser."}
              </p>
              <p className="text-sm text-muted-foreground">
                Sign out first if you want to create another account with a different email.
              </p>
              {roleMismatch ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  The current session is on {currentRole}, while this page is prepared for {selectedRole}.
                </p>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3">
              <Link
                href={continueUrl}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-gradient-to-r from-primary to-accent px-4 text-sm font-semibold text-primary-foreground shadow-[0_18px_35px_-20px_var(--color-primary)] hover:opacity-95"
              >
                Continue with current account
              </Link>

              <button
                type="button"
                onClick={() => void signOut({ redirectUrl: signOutRedirectUrl })}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Sign out and create another account
              </button>
            </div>
          </div>
        ) : selectedRole ? (
          <div className="w-full">
            <SignUp
              key={`sign-up-${selectedRole}`}
              routing="hash"
              signInUrl={signInUrl}
              signInFallbackRedirectUrl={completionUrl}
              signInForceRedirectUrl={completionUrl}
              unsafeMetadata={{ role: selectedRole }}
              fallbackRedirectUrl={completionUrl}
              forceRedirectUrl={completionUrl}
              appearance={clerkAppearance}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/70 px-4 py-8 text-center text-sm text-muted-foreground dark:bg-background/40">
            Select a role above to sign up.
          </div>
        )}

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account? <Link href={signInUrl} className="font-medium text-primary hover:underline">Sign in</Link>
        </p>

        <p className="mt-2 text-center text-xs text-muted-foreground/90">
          Choose Streamer, Moderator, or Admin before continuing.
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <SignupContent />
    </Suspense>
  )
}