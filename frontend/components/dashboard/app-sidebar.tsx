"use client"

import Link from "next/link"
import { useClerk, useUser, useAuth } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import { BRAND_NAME } from "@/lib/brand"
import { cn } from "@/lib/utils"
import { BrandLogo } from "@/components/brand-logo"
import { useAuthenticatedUser } from "@/components/auth/authenticated-user-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useOptionalSellerSubscriptionAccess } from "@/components/dashboard/seller-subscription-access"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ChevronUp,
  Settings,
  LogOut,
  User,
  LucideIcon,
  Lock,
} from "lucide-react"
import { useEffect, useState } from "react"
import { waitForSessionToken } from "@/lib/auth"
import { getMyModeratorProfile, type ModeratorProfileResponse } from "@/lib/moderator-profile"

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  badge?: string | number
  requiresSubscription?: boolean
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

interface AppSidebarProps {
  navigation: NavGroup[]
  user?: {
    name: string
    email: string
    avatar?: string
  }
  logo?: {
    name?: string
    href: string
  }
  footerItems?: NavItem[]
}

export function AppSidebar({
  navigation,
  user,
  logo,
  footerItems,
}: AppSidebarProps) {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user: clerkUser } = useUser()
  const { getToken, isLoaded } = useAuth()
  const authenticatedUser = useAuthenticatedUser()
  const subscriptionAccess = useOptionalSellerSubscriptionAccess()
  const [lockedItemTitle, setLockedItemTitle] = useState<string | null>(null)
  const [moderatorProfile, setModeratorProfile] = useState<ModeratorProfileResponse["profile"] | null>(null)
  const logoutRedirectUrl = pathname.startsWith("/admin") ? "/admin-login" : "/login"
  const hasActiveSubscription = subscriptionAccess?.hasActiveSubscription ?? true
  const isLoading = subscriptionAccess?.isLoading ?? false
  const isModerator = authenticatedUser?.backendRole === "moderator"

  useEffect(() => {
    let cancelled = false

    async function loadModeratorProfile() {
      if (!isLoaded || !isModerator) {
        return
      }

      try {
        const token = await waitForSessionToken(getToken)
        const result = await getMyModeratorProfile(token)

        if (!cancelled) {
          setModeratorProfile(result.profile)
        }
      } catch {
        if (!cancelled) {
          setModeratorProfile(null)
        }
      }
    }

    void loadModeratorProfile()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded, isModerator])

  const displayEmail = authenticatedUser?.email || user?.email
  const displayName = moderatorProfile?.displayName || (authenticatedUser
    ? [authenticatedUser.firstName, authenticatedUser.lastName].filter(Boolean).join(" ") || authenticatedUser.email
    : user?.name)
  const displaySubtitle = moderatorProfile?.headline || displayEmail
  const displayAvatar = clerkUser?.imageUrl || user?.avatar

  return (
    <>
      <Dialog open={lockedItemTitle !== null} onOpenChange={(open) => !open && setLockedItemTitle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscription required</DialogTitle>
            <DialogDescription>
              Please get a subscription to access this feature.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockedItemTitle(null)}>
              Close
            </Button>
            <Button asChild>
              <Link href="/seller/subscription" onClick={() => setLockedItemTitle(null)}>
                Get Subscription
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sidebar className="border-sidebar-border">
        <SidebarHeader className="border-b border-sidebar-border p-4">
          <BrandLogo href={logo?.href || "/"} text={logo?.name || BRAND_NAME} iconClassName="h-8 w-8 rounded-lg" />
        </SidebarHeader>

        <SidebarContent className="px-2">
          {navigation.map((group, groupIndex) => (
            <SidebarGroup key={groupIndex}>
              {group.label && (
                <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                    const isLocked = Boolean(item.requiresSubscription && !isLoading && !hasActiveSubscription)

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            "transition-colors",
                            isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                            isLocked && "opacity-90"
                          )}
                        >
                          <Link
                            href={item.href}
                            aria-disabled={isLocked}
                            onClick={(event) => {
                              if (!isLocked) {
                                return
                              }

                              event.preventDefault()
                              setLockedItemTitle(item.title)
                            }}
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                            {isLocked ? <Lock className="ml-auto h-4 w-4 text-muted-foreground" /> : null}
                            {!isLocked && item.badge !== undefined && (
                              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-xs font-medium text-primary">
                                {item.badge}
                              </span>
                            )}
                            {isLocked && item.badge !== undefined && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-xs font-medium text-primary">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
              {groupIndex < navigation.length - 1 && (
                <SidebarSeparator className="my-2" />
              )}
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-2">
          {footerItems && footerItems.length > 0 && (
            <SidebarMenu className="mb-2">
              {footerItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          )}

          {(displayName || displayEmail) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2 rounded-lg p-2 text-sm hover:bg-sidebar-accent">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={displayAvatar} alt={displayName || displayEmail || "User"} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {(displayName || displayEmail || "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col items-start text-left">
                    <span className="font-medium">{displayName || displayEmail}</span>
                    <span className="text-xs text-muted-foreground">
                      {displaySubtitle}
                    </span>
                  </div>
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="top"
                className="w-56"
              >
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                {moderatorProfile ? (
                  <DropdownMenuLabel className="pt-0 font-normal text-xs text-muted-foreground">
                    {moderatorProfile.displayName || "Moderator"}
                    {moderatorProfile.headline ? ` • ${moderatorProfile.headline}` : ""}
                  </DropdownMenuLabel>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={isModerator ? "/moderator/profile" : pathname}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => {
                    void signOut({ redirectUrl: logoutRedirectUrl })
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </SidebarFooter>
      </Sidebar>
    </>
  )
}
