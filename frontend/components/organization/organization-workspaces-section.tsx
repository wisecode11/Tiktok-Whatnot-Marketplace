"use client"

import { useAuth, useClerk, useOrganization } from "@clerk/nextjs"
import { Building2, Check, Loader2, Plus } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

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
  createSellerOrganization,
  getClerkErrorMessage,
  getSellerOrganizations,
  type SellerOrganization,
  waitForSessionToken,
} from "@/lib/auth"
import { switchSellerOrganization } from "@/lib/seller-organization"
import { cn } from "@/lib/utils"

export function OrganizationWorkspacesSection() {
  const { getToken, isLoaded } = useAuth()
  const { setActive } = useClerk()
  const { organization } = useOrganization()

  const [organizations, setOrganizations] = useState<SellerOrganization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSwitchingId, setIsSwitchingId] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newOrgName, setNewOrgName] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const loadOrganizations = useCallback(async () => {
    if (!isLoaded) {
      return
    }

    try {
      setIsLoading(true)
      const token = await waitForSessionToken(getToken)
      const result = await getSellerOrganizations(token)
      setOrganizations(result.organizations)
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [getToken, isLoaded])

  useEffect(() => {
    void loadOrganizations()
  }, [loadOrganizations, organization?.id])

  async function handleSwitchOrganization(workspace: SellerOrganization) {
    if (!workspace.clerkOrganizationId || !setActive) {
      return
    }

    if (organization?.id === workspace.clerkOrganizationId) {
      return
    }

    try {
      setIsSwitchingId(workspace.id)
      setErrorMessage("")
      await switchSellerOrganization({
        clerkOrganizationId: workspace.clerkOrganizationId,
        getToken,
        setActive,
      })
      await loadOrganizations()
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setIsSwitchingId(null)
    }
  }

  async function handleCreateOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = newOrgName.trim()
    if (!trimmedName) {
      setErrorMessage("Organization name is required.")
      return
    }

    if (!setActive) {
      setErrorMessage("Unable to activate the new organization.")
      return
    }

    try {
      setIsCreating(true)
      setErrorMessage("")
      const token = await waitForSessionToken(getToken)
      const result = await createSellerOrganization(token, { name: trimmedName })

      if (result.organization.clerkOrganizationId) {
        await switchSellerOrganization({
          clerkOrganizationId: result.organization.clerkOrganizationId,
          getToken,
          setActive,
        })
      }

      setNewOrgName("")
      setIsCreateOpen(false)
      await loadOrganizations()
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="border-b border-border/60 px-5 py-4 md:px-6">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Your organizations</p>
          <p className="text-sm text-muted-foreground">Switch workspace or create another organization.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Create organization
        </Button>
      </div>

      {errorMessage ? (
        <p className="mb-3 text-sm text-destructive">{errorMessage}</p>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading organizations…
        </div>
      ) : organizations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No organizations yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {organizations.map((workspace) => {
            const isActive =
              workspace.isActive || workspace.clerkOrganizationId === organization?.id
            const isSwitching = isSwitchingId === workspace.id

            return (
              <li key={workspace.id}>
                <button
                  type="button"
                  disabled={isSwitching || isActive}
                  onClick={() => void handleSwitchOrganization(workspace)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    isActive
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/60 bg-background hover:border-primary/20 hover:bg-muted/30",
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{workspace.name}</p>
                    {/* <p className="truncate text-xs text-muted-foreground capitalize">{workspace.status}</p> */}
                  </div>
                  {isSwitching ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : isActive ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(event) => void handleCreateOrganization(event)}>
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
              <DialogDescription>Add another workspace for a separate team.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="new-org-name">Organization name</Label>
              <Input
                id="new-org-name"
                value={newOrgName}
                onChange={(event) => setNewOrgName(event.target.value)}
                placeholder="My Organization Name"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || !newOrgName.trim()}>
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
