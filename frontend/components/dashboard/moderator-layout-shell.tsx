"use client"

import { RoleGate } from "@/components/auth/role-gate"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { Topbar } from "@/components/dashboard/topbar"
import {
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  BadgeCheck,
  MessageSquare,
} from "lucide-react"

const navigation = [
  {
    items: [
      { title: "Dashboard", href: "/moderator", icon: LayoutDashboard },
      { title: "Public Profile", href: "/moderator/public-profile", icon: BadgeCheck },
      { title: "Bookings", href: "/moderator/bookings", icon: CalendarDays, badge: 4 },
      { title: "Team Chat", href: "/moderator/chat", icon: MessageSquare },
      { title: "Availability", href: "/moderator/availability", icon: CalendarClock },
    //   { title: "Settings", href: "/moderator/settings", icon: Settings },
    ],
  },
]

const mockUser = {
  name: "Jordan Smith",
  email: "jordan@moderator.io",
  avatar: "",
}

export function ModeratorLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allowedRoles={["moderator"]} unauthenticatedPath="/login">
      <SidebarProvider>
        <AppSidebar
          navigation={navigation}
          user={mockUser}
          logo={{
            href: "/moderator",
          }}
        />
        <SidebarInset>
          <Topbar />
          <main className="flex-1 overflow-auto">
            <div className="container max-w-7xl p-6">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RoleGate>
  )
}
