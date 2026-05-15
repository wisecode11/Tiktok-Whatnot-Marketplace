"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { Building, CalendarDays, DollarSign, Loader2, Lock, Plus } from "lucide-react"

import { AccessControlModal } from "@/components/staff/access-control-modal"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  disconnectPlatform,
  getClerkErrorMessage,
  getConnectedAccounts,
  waitForSessionToken,
} from "@/lib/auth"
import {
  createStaffMember,
  listStaffMembers,
  type StaffMember,
} from "@/lib/staff"
import {
  DEFAULT_MODULES,
  getStaffPermissions,
  updateStaffPermissions,
  type StaffPermissions,
} from "@/lib/staff-permissions"

function formatDate(value: string | null) {
  if (!value) {
    return "Just now"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

export default function ManageStaffPage() {
  const router = useRouter()
  const { getToken, isLoaded } = useAuth()
  const { toast } = useToast()

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [formValues, setFormValues] = useState({
    username: "",
    email: "",
    password: "",
  })

  const [isAccessControlOpen, setIsAccessControlOpen] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [selectedStaffName, setSelectedStaffName] = useState<string | null>(null)
  const [staffPermissions, setStaffPermissions] = useState<StaffPermissions | null>(null)
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false)
  const [isQuickBooksConnected, setIsQuickBooksConnected] = useState(false)
  const [isQuickBooksLoading, setIsQuickBooksLoading] = useState(true)
  const [isQuickBooksConnecting, setIsQuickBooksConnecting] = useState(false)
  const [isQuickBooksDisconnecting, setIsQuickBooksDisconnecting] = useState(false)
  const [quickBooksError, setQuickBooksError] = useState<string | null>(null)

  function handleOpenAttendance(staffId: string) {
    router.push(`/seller/manage-staff/attendance/${staffId}`)
  }

  function handleOpenPayroll() {
    router.push(`/seller/payroll`)
  }

  useEffect(() => {
    let cancelled = false

    async function loadStaff() {
      if (!isLoaded) {
        return
      }

      try {
        setIsLoading(true)
        setErrorMessage(null)

        const token = await waitForSessionToken(getToken)
        const result = await listStaffMembers(token)

        if (!cancelled) {
          setStaffMembers(result.staff)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getClerkErrorMessage(error))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadStaff()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  useEffect(() => {
    let cancelled = false

    async function loadQuickBooksState() {
      if (!isLoaded) {
        return
      }

      try {
        setIsQuickBooksLoading(true)
        setQuickBooksError(null)
        const token = await waitForSessionToken(getToken)
        const result = await getConnectedAccounts(token)
        const connected = result.accounts.some((account) => account.platform === "quickbooks" && account.connected)

        if (!cancelled) {
          setIsQuickBooksConnected(connected)
        }
      } catch (error) {
        if (!cancelled) {
          setQuickBooksError(getClerkErrorMessage(error))
          setIsQuickBooksConnected(false)
        }
      } finally {
        if (!cancelled) {
          setIsQuickBooksLoading(false)
        }
      }
    }

    void loadQuickBooksState()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setIsSubmitting(true)
      setErrorMessage(null)

      const token = await waitForSessionToken(getToken)
      const result = await createStaffMember(token, formValues)

      setStaffMembers((current) => [result.member, ...current])
      setFormValues({ username: "", email: "", password: "" })
      setIsDialogOpen(false)

      toast({
        title: result.emailSent ? "Staff member created" : "Staff member created with warning",
        description: result.emailSent
          ? `Credentials were emailed to ${result.member.email}.`
          : `${result.emailError || "Welcome email could not be sent."} The account was still created.`,
      })
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleOpenAccessControl(staffId: string, staffName: string) {
    setSelectedStaffId(staffId)
    setSelectedStaffName(staffName)
    setIsLoadingPermissions(true)

    try {
      const token = await waitForSessionToken(getToken)
      const permissions = await getStaffPermissions(token, staffId)
      setStaffPermissions(permissions)
      setIsAccessControlOpen(true)
    } catch {
      toast({
        title: "Error",
        description: "Failed to load permissions. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingPermissions(false)
    }
  }

  async function handleSavePermissions(modules: string[]) {
    if (!selectedStaffId) {
      return
    }

    const token = await waitForSessionToken(getToken)
    await updateStaffPermissions(token, selectedStaffId, modules)
    setStaffPermissions((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        modules,
      }
    })
  }

  async function handleDisconnectQuickBooks() {
    try {
      setIsQuickBooksDisconnecting(true)
      setQuickBooksError(null)

      const token = await waitForSessionToken(getToken)
      await disconnectPlatform(token, "quickbooks")
      setIsQuickBooksConnected(false)
    } catch (error) {
      setQuickBooksError(getClerkErrorMessage(error))
    } finally {
      setIsQuickBooksDisconnecting(false)
    }
  }

  async function handleConnectQuickBooks() {
    try {
      setIsQuickBooksConnecting(true)
      setQuickBooksError(null)

      const token = await waitForSessionToken(getToken)
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/api/integrations/quickbooks/connect`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Connection failed" }))
        throw new Error(error.error || "Failed to connect QuickBooks")
      }

      const data = await response.json()
      window.location.href = data.authorizationUrl
    } catch (error) {
      setQuickBooksError(getClerkErrorMessage(error))
      setIsQuickBooksConnecting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Staff"
        description="Create staff accounts for your team and send their login credentials automatically."
      >
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="size-4" />
          Add Member
        </Button>
      </PageHeader>

      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-amber-700" />
              <div>
                <CardTitle>QuickBooks Integration</CardTitle>
                <CardDescription>
                  {isQuickBooksConnected
                    ? "Connected to QuickBooks for staff payroll sync"
                    : "Connect your QuickBooks account from Connect Platforms to enable staff payroll sync"}
                </CardDescription>
              </div>
            </div>
            {isQuickBooksConnected ? (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Connected</span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex gap-2">
          {isQuickBooksLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isQuickBooksConnected ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isQuickBooksDisconnecting}
              onClick={() => void handleDisconnectQuickBooks()}
            >
              {isQuickBooksDisconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Disconnect
            </Button>
          ) : quickBooksError ? (
            <Button disabled size="sm" variant="destructive">
              Connection Error
            </Button>
          ) : (
            <Button size="sm" disabled={isQuickBooksConnecting} onClick={() => void handleConnectQuickBooks()}>
              {isQuickBooksConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Connect QuickBooks
            </Button>
          )}
        </CardContent>
      </Card>

      {quickBooksError ? <p className="text-sm text-destructive">{quickBooksError}</p> : null}

      <Card className="border-emerald-200 bg-emerald-50">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-700" />
              <div>
                <CardTitle>Payroll Management</CardTitle>
                <CardDescription>
                  Generate payroll from attendance records and sync to QuickBooks
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button 
            size="sm" 
            onClick={() => void handleOpenPayroll()}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Manage Payroll
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage the staff accounts connected to your streamer profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : errorMessage ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : staffMembers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
              <p className="text-sm font-medium text-foreground">No staff members yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Click Add Member to create the first staff account for your streamer team.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                  <TableHead className="text-right">Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.username || "-"}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell className="capitalize">{member.role}</TableCell>
                    <TableCell className="capitalize">{member.status}</TableCell>
                    <TableCell>{formatDate(member.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAttendance(member.id)}
                      >
                        <CalendarDays className="mr-1.5 size-3.5" />
                        Attendance
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAccessControl(member.id, member.username || member.email)}
                      >
                        <Lock className="mr-1.5 size-3.5" />
                        Allow Access
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AccessControlModal
        open={isAccessControlOpen}
        onOpenChange={setIsAccessControlOpen}
        staffName={selectedStaffName || ""}
        selectedModules={staffPermissions?.modules || []}
        allModules={DEFAULT_MODULES}
        onSave={handleSavePermissions}
        isLoading={isLoadingPermissions}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add Member</DialogTitle>
              <DialogDescription>
                Create a staff account, attach it to this streamer workspace, and email the login credentials.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formValues.username}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, username: event.target.value }))
                }
                placeholder="team-member-01"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formValues.email}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="staff@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="text"
                value={formValues.password}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="Enter a temporary password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input id="role" value="Staff" readOnly />
            </div>

            {errorMessage ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Create Member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
