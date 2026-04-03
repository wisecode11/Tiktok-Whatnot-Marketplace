"use client"

import { Suspense, useMemo, useState } from "react"
import { SignIn, useAuth, useClerk, useUser } from "@clerk/nextjs"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Shield, Radio, Users, Loader2 } from "lucide-react"
import { BrandLogo } from "../../../components/brand-logo"
import { buildPath, getDashboardPath, normalizeRole, type AppRole } from "@/lib/auth"
import { cn } from "@/lib/utils"

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

function LoginContent() {
  const searchParams = useSearchParams()
  const { isLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const { user } = useUser()
  const initialRole = normalizeRole(searchParams.get("role"))
  const [selectedRole, setSelectedRole] = useState<Role>(initialRole)

  const signUpUrl = useMemo(() => {
    return buildPath("/signup", { role: selectedRole })
  }, [selectedRole])

  const completionUrl = useMemo(() => {
    return buildPath("/auth-complete", {
      flow: "login",
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
  const continueUrl = currentRole ? getDashboardPath(currentRole) : completionUrl
  const switchAccountRedirectUrl = buildPath("/login", { role: selectedRole || currentRole })
  const roleMismatch = Boolean(selectedRole && currentRole && selectedRole !== currentRole)

  const roleOptions = [
    {
      id: "streamer",
      label: "Streamer",
      icon: Radio,
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

  return (
    <div className="flex w-full justify-center">
      <div className="w-full max-w-[27rem]">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo
            showText={false}
            className="mb-5"
            iconClassName="h-14 w-14 rounded-full ring-8 ring-primary/8 dark:ring-primary/12"
          />
          <h1 className="text-[2rem] font-bold tracking-tight text-foreground">Welcome Back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your account</p>
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
                {currentRole ? ` is active in the ${currentRole} portal.` : " already has an active session in this browser."}
              </p>
              {roleMismatch ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Sign out first to switch from {currentRole} to {selectedRole}.
                </p>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3">
              <Link
                href={continueUrl}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-gradient-to-r from-primary to-accent px-4 text-sm font-semibold text-primary-foreground shadow-[0_18px_35px_-20px_var(--color-primary)] hover:opacity-95"
              >
                Continue to your dashboard
              </Link>

              <button
                type="button"
                onClick={() => void signOut({ redirectUrl: switchAccountRedirectUrl })}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Sign out and use another account
              </button>
            </div>
          </div>
        ) : selectedRole ? (
          <div className="w-full">
            <SignIn
              key={`sign-in-${selectedRole}`}
              routing="hash"
              signUpUrl={signUpUrl}
              signUpFallbackRedirectUrl={completionUrl}
              signUpForceRedirectUrl={completionUrl}
              fallbackRedirectUrl={completionUrl}
              forceRedirectUrl={completionUrl}
              appearance={clerkAppearance}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/70 px-4 py-8 text-center text-sm text-muted-foreground dark:bg-background/40">
            Select a role above to sign in.
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <Link href="/forgot-password" className="font-medium transition-colors hover:text-primary">
            Forgot password?
          </Link>
          <span>{selectedRole ? `Signing into ${selectedRole} portal` : "Choose a portal first"}</span>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href={signUpUrl} className="font-medium text-primary hover:underline">
            Create account
          </Link>
        </p>

        <p className="mt-2 text-center text-xs text-muted-foreground/90">
          Choose Streamer, Moderator, or Admin before continuing.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <LoginContent />
    </Suspense>
  )
}
