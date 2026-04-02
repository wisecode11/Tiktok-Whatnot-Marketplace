"use client"

import { RoleGate } from "@/components/auth/role-gate"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { Topbar } from "@/components/dashboard/topbar"
import {
  LayoutDashboard,
  BarChart3,
  Calendar,
  Package,
  Users,
  FileText,
  Brain,
  UserSearch,
  CreditCard,
  Settings,
  Rocket,
  HelpCircle,
} from "lucide-react"

const sellerNavigation = [
  {
    items: [
      { title: "Launch Pad", href: "/seller", icon: Rocket },
      { title: "Dashboard", href: "/seller/dashboard", icon: LayoutDashboard },
      { title: "Analytics", href: "/seller/analytics", icon: BarChart3 },
      { title: "Calendar", href: "/seller/calendar", icon: Calendar },
    ],
  },
  {
    label: "Commerce",
    items: [
      { title: "Products", href: "/seller/products", icon: Package, badge: 4 },
      { title: "Team", href: "/seller/team", icon: Users },
      { title: "Content", href: "/seller/content", icon: FileText },
    ],
  },
  {
    label: "Tools",
    items: [
      { title: "AI Tools", href: "/seller/ai-tools", icon: Brain },
      { title: "Find Moderators", href: "/seller/moderators", icon: UserSearch },
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
    </RoleGate>
  )
}
