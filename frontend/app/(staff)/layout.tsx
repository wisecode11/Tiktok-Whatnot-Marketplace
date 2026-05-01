"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Box, ClipboardList, type LucideIcon, Printer, Warehouse } from "lucide-react"

import { RoleGate } from "@/components/auth/role-gate"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { Topbar } from "@/components/dashboard/topbar"
import { StaffModulesProvider } from "@/components/staff/staff-modules-context"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getClerkErrorMessage, waitForSessionToken } from "@/lib/auth"
import { getMyPermissions } from "@/lib/permissions-checker"

const moduleIcons: Record<string, LucideIcon> = {
  view_inventory: Warehouse,
  view_orders: ClipboardList,
  packing: Box,
  labelling: Printer,
  order_status_update: ClipboardList,
}

const moduleOrder = [
  "view_inventory",
  "view_orders",
  "packing",
  "labelling",
  "order_status_update",
] as const

const moduleTitles: Record<(typeof moduleOrder)[number], string> = {
  view_inventory: "View Inventory",
  view_orders: "View Orders",
  packing: "Packing",
  labelling: "Labelling",
  order_status_update: "Order Status Update",
}

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { getToken, isLoaded } = useAuth()
  const [modules, setModules] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPermissions() {
      if (!isLoaded) {
        return
      }

      try {
        setLoading(true)
        setPermissionError(null)
        const token = await waitForSessionToken(getToken)
        const result = await getMyPermissions(token)

        if (!cancelled) {
          setModules(result.modules || [])
        }
      } catch (error) {
        if (!cancelled) {
          setPermissionError(getClerkErrorMessage(error))
          setModules([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPermissions()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  const staffNavigation = useMemo(() => {
    const allowedSet = new Set(modules)
    const items = moduleOrder
      .filter((moduleId) => allowedSet.has(moduleId))
      .map((moduleId) => ({
        title: moduleTitles[moduleId],
        href: `/staff/modules/${moduleId}`,
        icon: moduleIcons[moduleId],
      }))

    if (items.length === 0) {
      return [
        {
          label: "Modules",
          items: [
            {
              title: loading
                ? "Loading Modules"
                : permissionError
                  ? "Unable to Load Modules"
                  : "No Modules Allowed",
              href: "/staff",
              icon: ClipboardList,
            },
          ],
        },
      ]
    }

    return [
      {
        label: "Modules",
        items,
      },
    ]
  }, [loading, modules, permissionError])

  return (
    <RoleGate allowedRoles={["staff"]} unauthenticatedPath="/login?role=staff">
      <SidebarProvider>
        <AppSidebar
          navigation={staffNavigation}
          logo={{
            href: "/staff",
          }}
        />
        <SidebarInset>
          <Topbar />
          <StaffModulesProvider value={{ modules, loading, permissionError }}>
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </StaffModulesProvider>
        </SidebarInset>
      </SidebarProvider>
    </RoleGate>
  )
}
