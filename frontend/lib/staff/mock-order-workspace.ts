import { cloneOrders, MOCK_ORDERS, type MockOrder, type OrderStatus } from "@/lib/staff/mock-workspace-data"

/**
 * In-memory workspace so fulfillment modules feel connected while still being static-first.
 */
let workspaceOrders: MockOrder[] = cloneOrders(MOCK_ORDERS)

export function resetWorkspaceOrdersForTests() {
  workspaceOrders = cloneOrders(MOCK_ORDERS)
}

export function listWorkspaceOrders() {
  return cloneOrders(workspaceOrders)
}

export function updateWorkspaceOrder(orderId: string, patch: Partial<MockOrder>) {
  workspaceOrders = workspaceOrders.map((order) => (order.id === orderId ? { ...order, ...patch } : order))
  return cloneOrders(workspaceOrders)
}

export function setWorkspaceOrderStatus(orderId: string, status: OrderStatus) {
  return updateWorkspaceOrder(orderId, { status })
}
