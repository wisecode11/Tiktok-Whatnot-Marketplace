"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Loader2, Lock, Mail, Plus, ShieldCheck, Users } from "lucide-react"

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
import { getClerkErrorMessage, waitForSessionToken } from "@/lib/auth"
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total staff</CardDescription>
            <CardTitle className="text-3xl">{staffMembers.length}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4 text-primary" />
            Active team members attached to your streamer workspace
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Default role</CardDescription>
            <CardTitle className="text-3xl">Staff</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" />
            New members are created with the staff role automatically
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Email delivery</CardDescription>
            <CardTitle className="text-3xl">SMTP</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="size-4 text-primary" />
            Login credentials are sent as soon as the account is created
          </CardContent>
        </Card>
      </div>

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
