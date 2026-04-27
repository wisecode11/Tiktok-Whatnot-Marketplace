import { AuthApiError } from "@/lib/auth"

export interface StaffPermissions {
  staffId: string
  modules: string[]
  allModules: string[]
  updatedAt?: string
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

export async function getStaffPermissions(
  token: string,
  staffId: string,
): Promise<StaffPermissions> {
  const response = await fetch(`${BACKEND_URL}/api/staff/members/${staffId}/permissions`, {
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
      throw new AuthApiError("Failed to get staff permissions", response.status)
    }

    throw new AuthApiError(
      errorData.error || "Failed to get staff permissions",
      response.status,
      errorData.details,
    )
  }

  return response.json()
}

export async function updateStaffPermissions(
  token: string,
  staffId: string,
  modules: string[],
): Promise<{ success: boolean; permissions: StaffPermissions }> {
  const response = await fetch(`${BACKEND_URL}/api/staff/members/${staffId}/permissions`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ modules }),
  })

  if (!response.ok) {
    let errorData
    try {
      errorData = await response.json()
    } catch {
      throw new AuthApiError("Failed to update staff permissions", response.status)
    }

    throw new AuthApiError(
      errorData.error || "Failed to update staff permissions",
      response.status,
      errorData.details,
    )
  }

  return response.json()
}

export const DEFAULT_MODULES = [
  {
    id: "view_inventory",
    label: "View Inventory",
    description: "View inventory and stock levels",
  },
  {
    id: "update_stock",
    label: "Update Stock",
    description: "Update stock quantities",
  },
  {
    id: "add_edit_products",
    label: "Add / Edit Products",
    description: "Add new products or edit existing ones (optional toggle)",
    isOptional: true,
  },
  {
    id: "view_orders",
    label: "View Orders",
    description: "View customer orders",
  },
  {
    id: "packing",
    label: "Packing",
    description: "Handle order packing",
  },
  {
    id: "labelling",
    label: "Labelling",
    description: "Handle order labelling",
  },
  {
    id: "order_status_update",
    label: "Order Status Update",
    description: "Update order status",
  },
]
