"use client"

import { RoleGate } from "@/components/auth/role-gate"
import { SellerSubscriptionAccessProvider } from "@/components/dashboard/seller-subscription-access"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { Topbar } from "@/components/dashboard/topbar"
import {
  LayoutDashboard,
  BarChart3,
  UserSearch,
  Users,
  CreditCard,
  MessageSquare,
  Settings,
  Rocket,
  HelpCircle,
} from "lucide-react"

const sellerNavigation = [
  {
    items: [
      { title: "Connect Platforms", href: "/seller", icon: Rocket },
      { title: "Dashboard", href: "/seller/dashboard", icon: LayoutDashboard },
      { title: "Analytics", href: "/seller/analytics", icon: BarChart3, requiresSubscription: true },
      { title: "Chat", href: "/seller/chat", icon: MessageSquare, requiresSubscription: true },
    ],
  },
  {
    label: "Moderators",
    items: [
      { title: "Find Moderators", href: "/seller/moderators", icon: UserSearch, requiresSubscription: true },
      { title: "Hired Moderators", href: "/seller/hired-moderators", icon: Users, requiresSubscription: true },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Subscription", href: "/seller/subscription", icon: CreditCard },
      { title: "Settings", href: "/seller/settings", icon: Settings },
    ],
  },
]

const footerItems = [
  { title: "Help", href: "/seller/help", icon: HelpCircle },
]

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleGate allowedRoles={["streamer"]} unauthenticatedPath="/login">
      <SellerSubscriptionAccessProvider>
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
      </SellerSubscriptionAccessProvider>
    </RoleGate>
  )
}
