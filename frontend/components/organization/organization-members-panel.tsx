"use client"

import { useAuth, useOrganization, useUser } from "@clerk/nextjs"
import { Loader2, Mail, Plus, Search, UserMinus } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getClerkErrorMessage, syncSellerOrganizationMembers, waitForSessionToken } from "@/lib/auth"
import { cn } from "@/lib/utils"

function formatJoinedDate(value: Date | number | string | null | undefined) {
  if (!value) {
    return "—"
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function getMemberDisplayName(member: {
  publicUserData?: {
    firstName?: string | null
    lastName?: string | null
    identifier?: string | null
  } | null
}) {
  const first = member.publicUserData?.firstName?.trim() || ""
  const last = member.publicUserData?.lastName?.trim() || ""
  const fullName = [first, last].filter(Boolean).join(" ")

  if (fullName) {
    return fullName
  }

  return member.publicUserData?.identifier || "Member"
}

export function OrganizationMembersPanel() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { organization, memberships, invitations } = useOrganization({
    memberships: {
      pageSize: 50,
      keepPreviousData: true,
    },
    invitations: {
      pageSize: 50,
      keepPreviousData: true,
    },
  })

  const [search, setSearch] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [isInviting, setIsInviting] = useState(false)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const memberRows = memberships?.data ?? []
  const invitationRows = invitations?.data ?? []
  const isLoadingMembers = memberships?.isLoading ?? false
  const isLoadingInvitations = invitations?.isLoading ?? false

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return memberRows
    }

    return memberRows.filter((member) => {
      const name = getMemberDisplayName(member).toLowerCase()
      const email = (member.publicUserData?.identifier || "").toLowerCase()
      const role = (member.role || "").toLowerCase()
      return name.includes(query) || email.includes(query) || role.includes(query)
    })
  }, [memberRows, search])

  const filteredInvitations = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return invitationRows
    }

    return invitationRows.filter((invitation) => {
      const email = (invitation.emailAddress || "").toLowerCase()
      const role = (invitation.role || "").toLowerCase()
      return email.includes(query) || role.includes(query)
    })
  }, [invitationRows, search])

  async function syncMembersToManageStaff() {
    if (!organization?.id) {
      return
    }

    try {
      const token = await waitForSessionToken(getToken)
      await syncSellerOrganizationMembers(token, organization.id)
    } catch {
      // Manage Staff also syncs on load; ignore transient errors here.
    }
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organization) {
      return
    }

    const email = inviteEmail.trim()
    if (!email) {
      setErrorMessage("Email is required.")
      return
    }

    try {
      setIsInviting(true)
      setErrorMessage("")
      setSuccessMessage("")
      await organization.inviteMember({
        emailAddress: email,
        role: "org:member",
      })
      setInviteEmail("")
      setInviteOpen(false)
      setSuccessMessage("Invitation sent successfully.")
      await invitations?.revalidate?.()
      await syncMembersToManageStaff()
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setIsInviting(false)
    }
  }

  async function handleRemoveMember(userId: string, displayName: string) {
    if (!organization) {
      return
    }

    if (!window.confirm(`Remove ${displayName} from this organization?`)) {
      return
    }

    try {
      setRemovingUserId(userId)
      setErrorMessage("")
      setSuccessMessage("")
      await organization.removeMember(userId)
      setSuccessMessage("Member removed.")
      await memberships?.revalidate?.()
      await syncMembersToManageStaff()
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setRemovingUserId(null)
    }
  }

  async function handleRevokeInvitation(invitationId: string, email: string) {
    const invitation = invitationRows.find((row) => row.id === invitationId)
    if (!invitation) {
      return
    }

    if (!window.confirm(`Revoke invitation for ${email}?`)) {
      return
    }

    try {
      setRevokingInvitationId(invitationId)
      setErrorMessage("")
      setSuccessMessage("")
      await invitation.revoke()
      setSuccessMessage("Invitation revoked.")
      await invitations?.revalidate?.()
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setRevokingInvitationId(null)
    }
  }

  return (
    <div className="space-y-4 px-5 py-5 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members or invitations"
            className="pl-9"
          />
        </div>
        <Button type="button" className="gap-2 shrink-0" onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Invite member
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          {successMessage}
        </div>
      ) : null}

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-lg bg-muted/40 p-1 sm:w-auto">
          <TabsTrigger value="members" className="rounded-md px-4 py-2">
            Members ({memberRows.length})
          </TabsTrigger>
          <TabsTrigger value="invitations" className="rounded-md px-4 py-2">
            Invitations ({invitationRows.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4 focus-visible:outline-none">
          <div className="overflow-hidden rounded-xl border border-border/60">
            {isLoadingMembers ? (
              <div className="flex min-h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No members found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => {
                    const userId = member.publicUserData?.userId
                    const isCurrentUser = userId === user?.id
                    const displayName = getMemberDisplayName(member)
                    const email = member.publicUserData?.identifier || "—"
                    const imageUrl = member.publicUserData?.imageUrl

                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={imageUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                {displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate font-medium text-foreground">{displayName}</p>
                                {isCurrentUser ? (
                                  <Badge variant="secondary" className="text-[10px]">
                                    You
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="truncate text-sm text-muted-foreground">{email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{member.role || "member"}</TableCell>
                        <TableCell>{formatJoinedDate(member.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={isCurrentUser || !userId || removingUserId === userId}
                            onClick={() => userId && void handleRemoveMember(userId, displayName)}
                          >
                            {removingUserId === userId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserMinus className="h-3.5 w-3.5" />
                            )}
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="invitations" className="mt-4 focus-visible:outline-none">
          <div className="overflow-hidden rounded-xl border border-border/60">
            {isLoadingInvitations ? (
              <div className="flex min-h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredInvitations.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No pending invitations.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
                          <span className="font-medium">{invitation.emailAddress}</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{invitation.role || "member"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            invitation.status === "pending"
                              ? "border-amber-500/30 text-amber-700 dark:text-amber-400"
                              : "",
                          )}
                        >
                          {invitation.status || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={revokingInvitationId === invitation.id}
                          onClick={() =>
                            void handleRevokeInvitation(invitation.id, invitation.emailAddress)
                          }
                        >
                          {revokingInvitationId === invitation.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Revoke"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(event) => void handleInvite(event)}>
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
              <DialogDescription>Send an email invitation to join this organization.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@example.com"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)} disabled={isInviting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isInviting}>
                {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
