"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { RoleGate } from "@/components/auth/role-gate"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import {
  MarketplaceHubContext,
  SELLER_MARKETPLACE_HUB_OPTIONS,
  type MarketplaceHub,
} from "@/components/dashboard/marketplace-hub-context"
import { SellerSubscriptionAccessProvider } from "@/components/dashboard/seller-subscription-access"
import { Topbar } from "@/components/dashboard/topbar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  BarChart3,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Clock4,
  CreditCard,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  Package,
  PackageSearch,
  Radio,
  Rocket,
  Settings,
  Sparkles,
  Truck,
  UserPlus,
  UserSearch,
  Users,
  Video,
} from "lucide-react"

type NavItem = {
  title: string
  href: string
  icon: typeof LayoutDashboard
  requiresSubscription?: boolean
}

type NavGroup = {
  label?: string
  items: NavItem[]
}

const HUB_STORAGE_KEY = "seller-marketplace-hub"

function isMarketplaceHub(value: string | null): value is MarketplaceHub {
  return value === "whatnot" || value === "tiktok" || value === "agency" || value === "launch-pad"
}

function inferHubFromPathname(pathname: string): MarketplaceHub | null {
  if (pathname === "/seller") {
    return "agency"
  }

  if (pathname.startsWith("/seller/publish") || pathname.startsWith("/seller/fulfillment") || pathname.startsWith("/seller/analytics")) {
    return "tiktok"
  }

  if (pathname.startsWith("/seller/organization") || pathname.startsWith("/seller/manage-staff")) {
    return "agency"
  }

  if (pathname.startsWith("/seller/whatnot-show") || pathname.startsWith("/seller/pending-inventory")) {
    return "whatnot"
  }

  return null
}

function getSellerNavigation(hub: MarketplaceHub): NavGroup[] {
  const sharedNavigation: NavGroup[] = [
    {
      label: "Shared",
      items: [
        { title: "Dashboard", href: "/seller/dashboard", icon: LayoutDashboard },
        { title: "Calendar", href: "/seller/calendar", icon: CalendarDays, requiresSubscription: true },
        { title: "Chat", href: "/seller/chat", icon: MessageSquare, requiresSubscription: true },
        { title: "Subscription", href: "/seller/subscription", icon: CreditCard },
      ],
    },
    {
      label: "Moderators",
      items: [
        { title: "Find Moderators", href: "/seller/moderators", icon: UserSearch, requiresSubscription: true },
        { title: "Hired Moderators", href: "/seller/hired-moderators", icon: Users, requiresSubscription: true },
      ],
    },
  ]

  if (hub === "whatnot") {
    return [
      {
        label: "Whatnot",
        items: [
          { title: "Inventory Management", href: "/seller/inventory-management", icon: PackageSearch, requiresSubscription: true },
          { title: "Orders", href: "/seller/orders", icon: Package, requiresSubscription: true },
          { title: "Order Management", href: "/seller/order-management", icon: ClipboardList, requiresSubscription: true },
          { title: "Finance Management", href: "/seller/finance-management", icon: CircleDollarSign },
          { title: "Whatnot Show", href: "/seller/whatnot-show", icon: Radio, requiresSubscription: true },
          { title: "Staff Listings", href: "/seller/pending-inventory", icon: Clock4, requiresSubscription: true },
        ],
      },
      ...sharedNavigation,
    ]
  }

  if (hub === "tiktok") {
    return [
      {
        label: "TikTok",
        items: [
          { title: "Inventory Management", href: "/seller/inventory-management", icon: PackageSearch, requiresSubscription: true },
          { title: "Orders", href: "/seller/orders", icon: Package, requiresSubscription: true },
          { title: "Order Management", href: "/seller/order-management", icon: ClipboardList, requiresSubscription: true },
          { title: "Finance Management", href: "/seller/finance-management", icon: CircleDollarSign },
          { title: "Publish", href: "/seller/publish", icon: Video, requiresSubscription: true },
          { title: "Fulfillment", href: "/seller/fulfillment", icon: Truck, requiresSubscription: true },
          { title: "Analytics", href: "/seller/analytics", icon: BarChart3, requiresSubscription: true },
        ],
      },
      ...sharedNavigation,
    ]
  }

  if (hub === "agency") {
    return [
      {
        label: "Agency",
        items: [
          { title: "Organization", href: "/seller/organization", icon: Building2 },
          { title: "Manage Staff", href: "/seller/manage-staff", icon: UserPlus },
          { title: "Launch Pad", href: "/seller", icon: Rocket }
          // { title: "Launch Pad",href: "/seller", icon: Rocket },

          // { title: "Agency Controls", href: "/seller/settings", icon: Settings },
        ],
      },
      ...sharedNavigation,
    ]
  }

  return [
    {
      label: "Launch Pad",
      items: [{ title: "Connect Platforms", href: "/seller", icon: Rocket }],
    },
    ...sharedNavigation,
  ]
}

const footerItems = [{ title: "Help", href: "/seller/help", icon: HelpCircle }]

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [hub, setHub] = useState<MarketplaceHub>(() => inferHubFromPathname(pathname) ?? "agency")

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const inferred = inferHubFromPathname(pathname)
    if (inferred) {
      setHub(inferred)
      return
    }

    const stored = window.localStorage.getItem(HUB_STORAGE_KEY)
    if (isMarketplaceHub(stored)) {
      setHub(stored)
    }
  }, [pathname])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(HUB_STORAGE_KEY, hub)
  }, [hub])

  const sellerNavigation = useMemo(() => getSellerNavigation(hub), [hub])

  return (
    <RoleGate allowedRoles={["streamer"]} unauthenticatedPath="/login">
      <SellerSubscriptionAccessProvider>
        <MarketplaceHubContext.Provider value={{ hub, setHub, options: SELLER_MARKETPLACE_HUB_OPTIONS }}>
          <SidebarProvider>
            <AppSidebar
              navigation={sellerNavigation}
              user={{
                name: "Alex Chen",
                email: "alex@techstyle.com",
                avatar: "/avatars/alex.jpg",
              }}
              logo={{
                href: "/seller",
              }}
              footerItems={footerItems}
            />
            <SidebarInset>
              <Topbar />
              <main className="flex-1 p-4 md:p-6">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </MarketplaceHubContext.Provider>
      </SellerSubscriptionAccessProvider>
    </RoleGate>
  )
}
