import { AuthApiError } from "@/lib/auth"

/**
 * Get the current authenticated staff member's permissions
 * This checks if the staff member has access to specific modules
 */
export async function getMyPermissions(token: string): Promise<{
  modules: string[]
}> {
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

  const response = await fetch(`${BACKEND_URL}/api/staff/my-permissions`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {

    let errorData
    try {
      errorData = await response.json()
    } catch {
      throw new AuthApiError("Failed to get my permissions", response.status)
    }

    throw new AuthApiError(
      errorData.error || "Failed to get my permissions",
      response.status,
      errorData.details,
    )
  }

  return response.json()
}

/**
 * Check if a specific module is accessible to the current user
 */
export function hasModuleAccess(moduleId: string, userModules: string[]): boolean {
  if (!userModules || userModules.length === 0) {
    return false
  }
  return userModules.includes(moduleId)
}

/**
 * Module definitions with their metadata
 */
export const MODULE_DEFINITIONS: Record<
  string,
  { label: string; icon?: string; description: string }
> = {
  view_inventory: {
    label: "View Inventory",
    description: "View inventory and stock levels",
  },
  update_stock: {
    label: "Update Stock",
    description: "Update stock quantities",
  },
  add_edit_products: {
    label: "Add / Edit Products",
    description: "Add new products or edit existing ones",
  },
  view_orders: {
    label: "View Orders",
    description: "View customer orders",
  },
  packing: {
    label: "Packing",
    description: "Handle order packing",
  },
  labelling: {
    label: "Labelling",
    description: "Handle order labelling",
  },
  order_status_update: {
    label: "Order Status Update",
    description: "Update order status",
  },
}
