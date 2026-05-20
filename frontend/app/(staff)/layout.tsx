"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Box,
  ClipboardList,
  Clock,
  type LucideIcon,
  PackageSearch,
  Printer,
  Truck,
  Warehouse,
} from "lucide-react"

import { RoleGate } from "@/components/auth/role-gate"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import {
  MarketplaceHubContext,
  STAFF_MARKETPLACE_HUB_LANDING_PATHS,
  STAFF_MARKETPLACE_HUB_OPTIONS,
  type MarketplaceHub,
  type StaffMarketplaceHub,
} from "@/components/dashboard/marketplace-hub-context"
import { Topbar } from "@/components/dashboard/topbar"
import { StaffModulesProvider } from "@/components/staff/staff-modules-context"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getClerkErrorMessage, waitForSessionToken } from "@/lib/auth"
import { getMyPermissions } from "@/lib/permissions-checker"

const STAFF_HUB_STORAGE_KEY = "staff-marketplace-hub"

function isStaffMarketplaceHub(value: string | null): value is StaffMarketplaceHub {
  return value === "tiktok" || value === "whatnot"
}

const moduleIcons: Record<string, LucideIcon> = {
  view_inventory: Warehouse,
  view_orders: ClipboardList,
  shipment_details: Truck,
  packing: Box,
  labelling: Printer,
  order_status_update: ClipboardList,
  order_management: BarChart3,
  attendance: Clock,
}

const moduleOrder = [
  "view_inventory",
  "view_orders",
  "shipment_details",
  "packing",
  "labelling",
  "order_status_update",
  "order_management",
  "attendance",
] as const

const moduleTitles: Record<(typeof moduleOrder)[number], string> = {
  view_inventory: "View Inventory",
  view_orders: "View Orders",
  shipment_details: "Shipment Details",
  packing: "Packing",
  labelling: "Labelling",
  order_status_update: "Order Status Update",
  order_management: "Order Management",
  attendance: "Clock In / Clock Out",
}

/** Whatnot-only modules — hidden from staff sidebar when TikTok hub is selected. */
const TIKTOK_HIDDEN_MODULE_IDS = new Set([
  "shipment_details",
  "packing",
  "labelling",
  "order_status_update",
])

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { getToken, isLoaded } = useAuth()
  const [modules, setModules] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [hub, setHub] = useState<StaffMarketplaceHub>("whatnot")

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const stored = window.localStorage.getItem(STAFF_HUB_STORAGE_KEY)
    if (isStaffMarketplaceHub(stored)) {
      setHub(stored)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(STAFF_HUB_STORAGE_KEY, hub)
  }, [hub])

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

    const mapModuleNavItem = (moduleId: (typeof moduleOrder)[number]) => ({
      title: moduleTitles[moduleId],
      href: `/staff/modules/${moduleId}`,
      icon: moduleIcons[moduleId],
    })

    const tiktokSharedModuleItems = moduleOrder
      .filter(
        (moduleId) =>
          !TIKTOK_HIDDEN_MODULE_IDS.has(moduleId) &&
          moduleId !== "view_inventory" &&
          moduleId !== "view_orders" &&
          moduleId !== "order_management" &&
          allowedSet.has(moduleId),
      )
      .map(mapModuleNavItem)

    if (hub === "tiktok") {
      const tiktokItems = []
      if (allowedSet.has("view_inventory")) {
        tiktokItems.push({
          title: "Inventory Management",
          href: "/staff/modules/tiktok_inventory",
          icon: PackageSearch,
        })
      }
      if (allowedSet.has("view_orders")) {
        tiktokItems.push({
          title: "Orders",
          href: "/staff/modules/tiktok_orders",
          icon: ClipboardList,
        })
      }
      if (allowedSet.has("order_management")) {
        tiktokItems.push({
          title: "Order Management",
          href: "/staff/modules/tiktok_order_management",
          icon: BarChart3,
        })
      }
      tiktokItems.push(...tiktokSharedModuleItems)

      if (tiktokItems.length === 0) {
        return [
          {
            label: "TikTok",
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

      return [{ label: "TikTok", items: tiktokItems }]
    }

    const whatnotItems = moduleOrder
      .filter((moduleId) => allowedSet.has(moduleId))
      .map(mapModuleNavItem)

    if (whatnotItems.length === 0) {
      return [
        {
          label: "Whatnot",
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

    return [{ label: "Whatnot", items: whatnotItems }]
  }, [hub, loading, modules, permissionError])

  const hubLandingPath = STAFF_MARKETPLACE_HUB_LANDING_PATHS[hub]
  const logoHref = pathname.startsWith("/staff/modules/") ? pathname : hubLandingPath

  return (
    <RoleGate allowedRoles={["staff"]} unauthenticatedPath="/login?role=staff">
      <MarketplaceHubContext.Provider
        value={{
          hub: hub as MarketplaceHub,
          setHub: (nextHub) => {
            if (isStaffMarketplaceHub(nextHub)) {
              setHub(nextHub)
            }
          },
          options: STAFF_MARKETPLACE_HUB_OPTIONS,
          landingPaths: STAFF_MARKETPLACE_HUB_LANDING_PATHS,
        }}
      >
        <SidebarProvider>
          <AppSidebar
            navigation={staffNavigation}
            logo={{
              href: logoHref,
            }}
          />
          <SidebarInset>
            <Topbar />
            <StaffModulesProvider value={{ modules, loading, permissionError, marketplaceHub: hub }}>
              <main className="flex-1 p-4 md:p-6">{children}</main>
            </StaffModulesProvider>
          </SidebarInset>
        </SidebarProvider>
      </MarketplaceHubContext.Provider>
    </RoleGate>
  )
}
