"use client"

import { RoleGate } from "@/components/auth/role-gate"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { Topbar } from "@/components/dashboard/topbar"
import {
  LayoutDashboard,
  CalendarClock,
  Briefcase,
  BadgeCheck,
  Star,
  MessageSquare,
  Wallet,
  Settings,
  HelpCircle,
  Users,
} from "lucide-react"

const navigation = [
  {
    items: [
      { title: "Dashboard", href: "/moderator", icon: LayoutDashboard },
      { title: "Public Profile", href: "/moderator/public-profile", icon: BadgeCheck },
      { title: "My Jobs", href: "/moderator/jobs", icon: Briefcase, badge: 3 },
      { title: "Find Work", href: "/moderator/marketplace", icon: Users },
      { title: "Availability", href: "/moderator/availability", icon: CalendarClock },
    ],
  },
  {
    label: "Performance",
    items: [
      { title: "Reviews", href: "/moderator/reviews", icon: Star },
      { title: "Messages", href: "/moderator/messages", icon: MessageSquare, badge: 5 },
      { title: "Earnings", href: "/moderator/earnings", icon: Wallet },
    ],
  },
]

const footerItems = [
  { title: "Settings", href: "/moderator/settings", icon: Settings },
  { title: "Help", href: "/help", icon: HelpCircle },
]

const mockUser = {
  name: "Jordan Smith",
  email: "jordan@moderator.io",
  avatar: "",
}

export default function ModeratorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleGate allowedRoles={["moderator"]} unauthenticatedPath="/login">
      <SidebarProvider>
        <AppSidebar
          navigation={navigation}
          user={mockUser}
          logo={{
            href: "/moderator",
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
