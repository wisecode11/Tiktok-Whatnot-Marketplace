"use client"

import { RoleGate } from "@/components/auth/role-gate"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { Topbar } from "@/components/dashboard/topbar"
import { ADMIN_EMAIL } from "@/lib/brand"
import {
  LayoutDashboard,
  Users,
  Video,
  Package,
  ShieldCheck,
  BarChart3,
  Settings,
  HelpCircle,
  CreditCard,
  Flag,
  Bell,
} from "lucide-react"

const navigation = [
  {
    items: [
      { title: "Overview", href: "/admin", icon: LayoutDashboard },
      { title: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Streamers", href: "/admin/streamers", icon: Video, badge: 245 },
      { title: "Moderators", href: "/admin/moderators", icon: Users, badge: 89 },
      { title: "Products", href: "/admin/products", icon: Package },
      { title: "Transactions", href: "/admin/transactions", icon: CreditCard },
    ],
  },
  {
    label: "Moderation",
    items: [
      { title: "Reports", href: "/admin/reports", icon: Flag, badge: 12 },
      { title: "Verifications", href: "/admin/verifications", icon: ShieldCheck, badge: 5 },
      { title: "Announcements", href: "/admin/announcements", icon: Bell },
    ],
  },
]

const footerItems = [
  { title: "Settings", href: "/admin/settings", icon: Settings },
  { title: "Help", href: "/help", icon: HelpCircle },
]

const mockAdmin = {
  name: "Admin User",
  email: ADMIN_EMAIL,
  avatar: "",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleGate allowedRoles={["admin"]} unauthenticatedPath="/admin-login">
      <SidebarProvider>
        <AppSidebar
          navigation={navigation}
          user={mockAdmin}
          logo={{
            href: "/admin",
          }}
          footerItems={footerItems}
        />
        <SidebarInset>
          <Topbar />
          <main className="flex-1 overflow-auto">
            <div className="container max-w-7xl p-6">
              {children}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RoleGate>
  )
}
