"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import {
  CreditCard,
  MoreHorizontal,
  Plus,
  Search,
  TrendingUp,
  Users,
  XCircle,
  RefreshCw,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  DollarSign,
  FileText,
  ExternalLink,
} from "lucide-react"
import {
  waitForSessionToken,
  getAdminSubscriptions,
  getAdminSubscriptionById,
  getAdminSubscriptionStats,
  getAdminSubscriptionPlans,
  createAdminSubscriptionPlan,
  updateAdminSubscriptionPlan,
  changeAdminSubscriptionPlan,
  cancelAdminSubscription,
  refundAdminSubscription,
  type AdminSubscriptionItem,
  type AdminSubscriptionPlan,
  type AdminSubscriptionDetailResponse,
  type AdminSubscriptionStatsResponse,
} from "@/lib/auth"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount)
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function statusColor(status: string) {
  switch (status) {
    case "active":
      return "default"
    case "trialing":
      return "secondary"
    case "cancelled":
      return "destructive"
    case "past_due":
    case "incomplete":
      return "outline"
    default:
      return "outline"
  }
}

function ownerName(item: AdminSubscriptionItem) {
  if (!item.owner) return "Unknown"
  const { first_name, last_name, email } = item.owner
  if (first_name || last_name) return `${first_name ?? ""} ${last_name ?? ""}`.trim()
  return email ?? "Unknown"
}

// ─── Plan Form Dialog ─────────────────────────────────────────────────────────

interface PlanFormDialogProps {
  open: boolean
  plan: AdminSubscriptionPlan | null
  onClose: () => void
  onSaved: () => void
  getToken: () => Promise<string | null>
}

function PlanFormDialog({ open, plan, onClose, onSaved, getToken }: PlanFormDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [currency, setCurrency] = useState("usd")
  const [billingInterval, setBillingInterval] = useState("month")
  const [featuresText, setFeaturesText] = useState("")
  const [displayOrder, setDisplayOrder] = useState("0")
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (plan) {
      setName(plan.name)
      setDescription(plan.description ?? "")
      setPrice(String(plan.price))
      setCurrency(plan.currency ?? "usd")
      setBillingInterval(plan.billing_interval ?? "month")
      setFeaturesText((plan.features_json ?? []).join("\n"))
      setDisplayOrder(String(plan.display_order ?? 0))
      setIsActive(plan.is_active ?? true)
    } else {
      setName("")
      setDescription("")
      setPrice("")
      setCurrency("usd")
      setBillingInterval("month")
      setFeaturesText("")
      setDisplayOrder("0")
      setIsActive(true)
    }
    setError("")
  }, [plan, open])

  async function handleSave() {
    if (!name.trim()) {
      setError("Plan name is required.")
      return
    }
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) {
      setError("A valid price is required.")
      return
    }
    try {
      setSaving(true)
      setError("")
      const token = await waitForSessionToken(getToken)
      const features = featuresText
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean)
      const payload = {
        name: name.trim(),
        description,
        price: priceNum,
        currency,
        billing_interval: billingInterval,
        features,
        display_order: parseInt(displayOrder) || 0,
        is_active: isActive,
      }
      if (plan) {
        await updateAdminSubscriptionPlan(token, plan._id, payload)
      } else {
        await createAdminSubscriptionPlan(token, payload)
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save plan.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{plan ? "Edit Plan" : "Create New Plan"}</DialogTitle>
          <DialogDescription>
            {plan
              ? "Update the subscription plan details. Price or interval changes create a new Stripe price and archive the old one."
              : "With Stripe configured on the server, a paid plan (price greater than zero) creates a Stripe Product and Price. Active plans appear on the seller Subscription page."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Plan Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Starter Monthly" />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short plan description"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Price *</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 29.99"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usd">USD</SelectItem>
                  <SelectItem value="eur">EUR</SelectItem>
                  <SelectItem value="gbp">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Billing Interval</Label>
              <Select value={billingInterval} onValueChange={setBillingInterval}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Display Order</Label>
              <Input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Features (one per line)</Label>
            <Textarea
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              placeholder={"Unlimited shows\nPriority support\nAdvanced analytics"}
              rows={4}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="is-active"
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <Label htmlFor="is-active">Active (visible to streamers)</Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : plan ? "Save Changes" : "Create Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Subscription Detail Dialog ───────────────────────────────────────────────

interface DetailDialogProps {
  open: boolean
  subscriptionId: string | null
  onClose: () => void
  onChanged: () => void
  getToken: () => Promise<string | null>
}

function SubscriptionDetailDialog({ open, subscriptionId, onClose, onChanged, getToken }: DetailDialogProps) {
  const [detail, setDetail] = useState<AdminSubscriptionDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState("")
  const [actionSuccess, setActionSuccess] = useState("")
  const [selectedPlanId, setSelectedPlanId] = useState("")
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "payments">("overview")

  useEffect(() => {
    if (!open || !subscriptionId) return
    setDetail(null)
    setError("")
    setActionError("")
    setActionSuccess("")
    setActiveTab("overview")

    async function load() {
      try {
        setLoading(true)
        const token = await waitForSessionToken(getToken)
        const data = await getAdminSubscriptionById(token, subscriptionId!)
        setDetail(data)
        setSelectedPlanId(data.plan?._id ?? "")
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load subscription.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, subscriptionId])

  async function handleChangePlan() {
    if (!detail || !selectedPlanId || selectedPlanId === detail.plan?._id) return
    try {
      setActionLoading(true)
      setActionError("")
      setActionSuccess("")
      const token = await waitForSessionToken(getToken)
      await changeAdminSubscriptionPlan(token, detail.subscription._id, selectedPlanId)
      setActionSuccess("Plan updated successfully.")
      onChanged()
      // Reload detail
      const updated = await getAdminSubscriptionById(token, detail.subscription._id)
      setDetail(updated)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to change plan.")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCancel() {
    if (!detail) return
    if (!confirm("Are you sure you want to cancel this subscription? This cannot be undone.")) return
    try {
      setActionLoading(true)
      setActionError("")
      setActionSuccess("")
      const token = await waitForSessionToken(getToken)
      await cancelAdminSubscription(token, detail.subscription._id)
      setActionSuccess("Subscription cancelled.")
      onChanged()
      const updated = await getAdminSubscriptionById(token, detail.subscription._id)
      setDetail(updated)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel subscription.")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRefund() {
    if (!detail) return
    if (!confirm("Issue a full refund for the latest paid invoice?")) return
    try {
      setActionLoading(true)
      setActionError("")
      setActionSuccess("")
      const token = await waitForSessionToken(getToken)
      const result = await refundAdminSubscription(token, detail.subscription._id)
      setActionSuccess(`Refund of ${formatCurrency(result.amount_cents / 100, result.currency)} processed.`)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to process refund.")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subscription Details</DialogTitle>
          <DialogDescription>
            {detail?.owner
              ? `${detail.owner.first_name ?? ""} ${detail.owner.last_name ?? ""}`.trim() ||
                detail.owner.email
              : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-12 text-center text-muted-foreground">Loading subscription…</div>
        )}

        {error && !loading && (
          <div className="py-8 text-center text-destructive">{error}</div>
        )}

        {detail && !loading && (
          <div className="space-y-6">
            {/* Action messages */}
            {actionSuccess && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {actionSuccess}
              </div>
            )}
            {actionError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionError}
              </div>
            )}

            {/* Status overview */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={statusColor(detail.subscription.status) as "default" | "secondary" | "destructive" | "outline"}>
                  {detail.subscription.status}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Current Plan</p>
                <p className="text-sm font-medium">{detail.plan?.name ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Period Start</p>
                <p className="text-sm">{formatDate(detail.subscription.current_period_start)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Period End</p>
                <p className="text-sm">{formatDate(detail.subscription.current_period_end)}</p>
              </div>
            </div>

            {/* Workspace & Owner */}
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="text-sm font-semibold">Account</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Business: </span>
                  {detail.workspace?.business_name ?? "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Billing email: </span>
                  {detail.workspace?.billing_email ?? "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Owner: </span>
                  {detail.owner
                    ? `${detail.owner.first_name ?? ""} ${detail.owner.last_name ?? ""}`.trim() ||
                      detail.owner.email
                    : "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  {detail.owner?.email ?? "—"}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="rounded-lg border p-4 space-y-4">
              <h4 className="text-sm font-semibold">Actions</h4>

              {/* Change plan */}
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">Change Plan</Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {(detail.availablePlans ?? []).map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name} — {formatCurrency(p.price, p.currency)} / {p.billing_interval}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionLoading || !selectedPlanId || selectedPlanId === detail.plan?._id}
                  onClick={handleChangePlan}
                >
                  <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
                  Apply
                </Button>
              </div>

              {/* Refund + Cancel */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionLoading}
                  onClick={handleRefund}
                >
                  <DollarSign className="mr-1.5 h-3.5 w-3.5" />
                  Refund Latest Invoice
                </Button>

                {detail.subscription.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={actionLoading}
                    onClick={handleCancel}
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </div>

            {/* Billing History Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="invoices">
                  Invoices ({detail.invoices.length})
                </TabsTrigger>
                <TabsTrigger value="payments">
                  Payments ({detail.payments.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="rounded-lg border p-4 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Stripe Subscription ID: </span>
                      <span className="font-mono text-xs">{detail.subscription.stripe_subscription_id ?? "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stripe Customer ID: </span>
                      <span className="font-mono text-xs">{detail.subscription.stripe_customer_id ?? "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created: </span>
                      {formatDate(detail.subscription.created_at)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cancelled at: </span>
                      {formatDate(detail.subscription.cancelled_at)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cancel at period end: </span>
                      {detail.subscription.cancel_at_period_end ? "Yes" : "No"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Latest payment: </span>
                      {detail.subscription.latest_payment_status ?? "—"}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="invoices">
                {detail.invoices.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No invoices yet.</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Amount Due</TableHead>
                          <TableHead>Amount Paid</TableHead>
                          <TableHead>Links</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.invoices.map((inv) => (
                          <TableRow key={inv._id}>
                            <TableCell className="text-xs">{formatDate(inv.created_at)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={inv.status === "paid" ? "default" : inv.status === "open" ? "secondary" : "outline"}
                              >
                                {inv.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatCurrency((inv.amount_due_cents ?? 0) / 100, inv.currency)}</TableCell>
                            <TableCell>{formatCurrency((inv.amount_paid_cents ?? 0) / 100, inv.currency)}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {inv.hosted_invoice_url && (
                                  <a
                                    href={inv.hosted_invoice_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    View
                                  </a>
                                )}
                                {inv.invoice_pdf_url && (
                                  <a
                                    href={inv.invoice_pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                                  >
                                    <FileText className="h-3 w-3" />
                                    PDF
                                  </a>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="payments">
                {detail.payments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No payment records yet.</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Failure Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.payments.map((pmt) => (
                          <TableRow key={pmt._id}>
                            <TableCell className="text-xs">{formatDate(pmt.created_at)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={pmt.status === "succeeded" ? "default" : pmt.status === "processing" ? "secondary" : "destructive"}
                              >
                                {pmt.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatCurrency((pmt.amount_cents ?? 0) / 100, pmt.currency)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {pmt.failure_reason ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubscriptionManagementPage() {
  const { getToken, isLoaded } = useAuth()

  // Stats
  const [stats, setStats] = useState<AdminSubscriptionStatsResponse | null>(null)

  // Subscriptions tab
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionItem[]>([])
  const [subsLoading, setSubsLoading] = useState(true)
  const [subsError, setSubsError] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Detail dialog
  const [detailSubId, setDetailSubId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Plans tab
  const [plans, setPlans] = useState<AdminSubscriptionPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [plansError, setPlansError] = useState("")
  const [planFormOpen, setPlanFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<AdminSubscriptionPlan | null>(null)

  const [activeTab, setActiveTab] = useState("subscriptions")

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoaded) return
    fetchStats()
    fetchSubscriptions()
  }, [isLoaded, page, statusFilter])

  useEffect(() => {
    if (!isLoaded) return
    fetchPlans()
  }, [isLoaded])

  async function fetchStats() {
    try {
      const token = await waitForSessionToken(getToken)
      const data = await getAdminSubscriptionStats(token)
      setStats(data)
    } catch {
      // Non-critical, don't block UI
    }
  }

  async function fetchSubscriptions() {
    try {
      setSubsLoading(true)
      setSubsError("")
      const token = await waitForSessionToken(getToken)
      const data = await getAdminSubscriptions(token, {
        page,
        limit: 20,
        status: statusFilter === "all" ? undefined : statusFilter,
      })
      setSubscriptions(data.data ?? [])
      setTotalPages(data.pagination?.pages ?? 1)
    } catch (err: unknown) {
      setSubsError(err instanceof Error ? err.message : "Failed to load subscriptions.")
    } finally {
      setSubsLoading(false)
    }
  }

  async function fetchPlans() {
    try {
      setPlansLoading(true)
      setPlansError("")
      const token = await waitForSessionToken(getToken)
      const data = await getAdminSubscriptionPlans(token)
      setPlans(data.plans ?? [])
    } catch (err: unknown) {
      setPlansError(err instanceof Error ? err.message : "Failed to load plans.")
    } finally {
      setPlansLoading(false)
    }
  }

  // ── Filter subscriptions client-side by search ─────────────────────────────

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    const name = ownerName(sub).toLowerCase()
    const bizName = (sub.workspace?.business_name ?? "").toLowerCase()
    const email = (sub.owner?.email ?? "").toLowerCase()
    return name.includes(term) || bizName.includes(term) || email.includes(term)
  })

  // ── Toggle plan active state ───────────────────────────────────────────────

  async function handleTogglePlan(plan: AdminSubscriptionPlan) {
    try {
      const token = await waitForSessionToken(getToken)
      await updateAdminSubscriptionPlan(token, plan._id, { is_active: !plan.is_active })
      fetchPlans()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update plan.")
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Management"
        description="View and manage all active streamer subscriptions, plans, billing history, and refunds."
      />

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.cancelled ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Est. MRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats != null ? formatCurrency(stats.estimatedMrr) : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>

        {/* ── Subscriptions Tab ─────────────────────────────────────────────── */}
        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>All Subscriptions</CardTitle>
                  <CardDescription>All streamer workspace subscriptions.</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setPage(1); fetchSubscriptions(); fetchStats() }}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>

              {/* Filters */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by name, business, email…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => { setStatusFilter(v); setPage(1) }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trialing">Trialing</SelectItem>
                    <SelectItem value="past_due">Past Due</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="incomplete">Incomplete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent>
              {subsError && (
                <p className="py-4 text-center text-sm text-destructive">{subsError}</p>
              )}

              {subsLoading && (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading subscriptions…</p>
              )}

              {!subsLoading && !subsError && (
                <>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Streamer</TableHead>
                          <TableHead>Business</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Period End</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead className="w-[60px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSubscriptions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                              No subscriptions found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredSubscriptions.map((sub) => (
                            <TableRow key={sub._id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{ownerName(sub)}</p>
                                  <p className="text-xs text-muted-foreground">{sub.owner?.email ?? ""}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {sub.workspace?.business_name ?? "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {sub.plan
                                  ? `${sub.plan.name} (${formatCurrency(sub.plan.price, sub.plan.currency)}/${sub.plan.billing_interval})`
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusColor(sub.status) as "default" | "secondary" | "destructive" | "outline"}>
                                  {sub.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatDate(sub.current_period_end)}
                              </TableCell>
                              <TableCell>
                                {sub.latest_payment_status ? (
                                  <Badge
                                    variant={
                                      sub.latest_payment_status === "succeeded"
                                        ? "default"
                                        : sub.latest_payment_status === "processing"
                                        ? "secondary"
                                        : "destructive"
                                    }
                                  >
                                    {sub.latest_payment_status}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setDetailSubId(sub._id)
                                        setDetailOpen(true)
                                      }}
                                    >
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setDetailSubId(sub._id)
                                        setDetailOpen(true)
                                      }}
                                    >
                                      Change Plan
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setDetailSubId(sub._id)
                                        setDetailOpen(true)
                                      }}
                                    >
                                      Refund Invoice
                                    </DropdownMenuItem>
                                    {sub.status !== "cancelled" && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => {
                                            setDetailSubId(sub._id)
                                            setDetailOpen(true)
                                          }}
                                        >
                                          Cancel Subscription
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <p className="text-muted-foreground">Page {page} of {totalPages}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Plans Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="plans">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Subscription Plans</CardTitle>
                  <CardDescription>
                    Paid plans create a matching Product and Price in Stripe and appear on the seller Subscription page.
                    Changing amount or billing interval archives the old Stripe price and creates a new one.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingPlan(null)
                    setPlanFormOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Plan
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {plansError && (
                <p className="py-4 text-center text-sm text-destructive">{plansError}</p>
              )}
              {plansLoading && (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading plans…</p>
              )}
              {!plansLoading && !plansError && (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plan Name</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Interval</TableHead>
                        <TableHead>Features</TableHead>
                        <TableHead>Stripe</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            No plans yet. Create one to get started.
                          </TableCell>
                        </TableRow>
                      ) : (
                        plans.map((plan) => (
                          <TableRow key={plan._id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{plan.name}</p>
                                {plan.description && (
                                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatCurrency(plan.price, plan.currency)}
                            </TableCell>
                            <TableCell className="text-sm capitalize">
                              {plan.billing_interval === "month" ? "Monthly" : plan.billing_interval === "year" ? "Yearly" : plan.billing_interval}
                            </TableCell>
                            <TableCell>
                              {plan.features_json?.length ? (
                                <ul className="text-xs text-muted-foreground space-y-0.5">
                                  {plan.features_json.slice(0, 3).map((f, i) => (
                                    <li key={i}>• {f}</li>
                                  ))}
                                  {plan.features_json.length > 3 && (
                                    <li className="text-xs">+{plan.features_json.length - 3} more</li>
                                  )}
                                </ul>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {plan.stripe_price_id ? (
                                <span className="text-xs text-muted-foreground font-mono">
                                  {plan.stripe_price_id.slice(0, 14)}…
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Manual</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={plan.is_active ? "default" : "outline"}>
                                {plan.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingPlan(plan)
                                      setPlanFormOpen(true)
                                    }}
                                  >
                                    Edit Plan
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleTogglePlan(plan)}>
                                    {plan.is_active ? "Deactivate" : "Activate"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <SubscriptionDetailDialog
        open={detailOpen}
        subscriptionId={detailSubId}
        onClose={() => { setDetailOpen(false); setDetailSubId(null) }}
        onChanged={() => { fetchSubscriptions(); fetchStats() }}
        getToken={getToken}
      />

      <PlanFormDialog
        open={planFormOpen}
        plan={editingPlan}
        onClose={() => { setPlanFormOpen(false); setEditingPlan(null) }}
        onSaved={fetchPlans}
        getToken={getToken}
      />
    </div>
  )
}
