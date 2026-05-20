"use client"

import { useAuth } from "@clerk/nextjs"
import { Loader2, UserRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { waitForSessionToken } from "@/lib/auth"
import { assignShowHost, type ShowHostAssignment } from "@/lib/show-host"
import { listStaffMembers, type StaffMember } from "@/lib/staff"

export interface AssignShowHostEvent {
  id: string
  streamTitle: string
  platform: string
  startAt: Date
  endAt: Date
  showLink?: string | null
}

interface AssignShowHostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: AssignShowHostEvent | null
  currentAssignment: ShowHostAssignment | null
  onAssigned: (assignment: ShowHostAssignment) => void
}

function formatStaffLabel(member: StaffMember) {
  const fullName = [member.firstName, member.lastName].filter(Boolean).join(" ").trim()
  if (fullName) {
    return fullName
  }

  if (member.username) {
    return member.username
  }

  return member.email
}

export function AssignShowHostDialog({
  open,
  onOpenChange,
  event,
  currentAssignment,
  onAssigned,
}: AssignShowHostDialogProps) {
  const { getToken, isLoaded } = useAuth()
  const { toast } = useToast()

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [selectedHostId, setSelectedHostId] = useState("")
  const [isLoadingStaff, setIsLoadingStaff] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !isLoaded) {
      return
    }

    let cancelled = false

    async function loadStaff() {
      setIsLoadingStaff(true)
      setErrorMessage(null)

      try {
        const token = await waitForSessionToken(getToken)
        const result = await listStaffMembers(token)

        if (!cancelled) {
          setStaffMembers(
            result.staff.filter((member) => (member.modules || []).includes("assigned_shows")),
          )
        }
      } catch (error) {
        if (!cancelled) {
          setStaffMembers([])
          setErrorMessage(error instanceof Error ? error.message : "Unable to load staff members.")
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStaff(false)
        }
      }
    }

    void loadStaff()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded, open])

  useEffect(() => {
    if (!open) {
      return
    }

    setSelectedHostId(currentAssignment?.hostStaffUserId || "")
  }, [currentAssignment?.hostStaffUserId, open])

  const hasStaff = staffMembers.length > 0

  const selectedStaffLabel = useMemo(() => {
    const match = staffMembers.find((member) => member.id === selectedHostId)
    return match ? formatStaffLabel(match) : null
  }, [selectedHostId, staffMembers])

  async function handleAssign() {
    if (!event || !selectedHostId) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const token = await waitForSessionToken(getToken)
      const result = await assignShowHost(token, event.id, {
        hostStaffUserId: selectedHostId,
        showTitle: event.streamTitle,
        scheduledStartAt: event.startAt.toISOString(),
        scheduledEndAt: event.endAt.toISOString(),
        showLink: event.showLink || undefined,
        platform: event.platform,
      })

      onAssigned(result.assignment)
      toast({
        title: "Host assigned",
        description: `${selectedStaffLabel || "Staff member"} is assigned to "${event.streamTitle}".`,
      })
      onOpenChange(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to assign host.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            Assign host
          </DialogTitle>
          <DialogDescription>
            {event
              ? `Choose a staff host for "${event.streamTitle}" on ${event.startAt.toLocaleString()}.`
              : "Select an upcoming show to assign a host."}
          </DialogDescription>
        </DialogHeader>

        {isLoadingStaff ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : null}

        {!isLoadingStaff && errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : null}

        {!isLoadingStaff && !errorMessage && !hasStaff ? (
          <p className="text-sm text-muted-foreground">
            No staff with Host Shows access found. Add staff in Manage Staff, then enable Host Shows in Allow Access.
          </p>
        ) : null}

        {!isLoadingStaff && hasStaff ? (
          <div className="space-y-3 py-1">
            <Label htmlFor="show-host-select">Host</Label>
            <Select value={selectedHostId} onValueChange={setSelectedHostId}>
              <SelectTrigger id="show-host-select" className="w-full">
                <SelectValue placeholder="Select a host" />
              </SelectTrigger>
              <SelectContent>
                {staffMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {formatStaffLabel(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentAssignment?.hostName ? (
              <p className="text-xs text-muted-foreground">
                Current host: {currentAssignment.hostName}
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleAssign()}
            disabled={!event || !selectedHostId || isSubmitting || isLoadingStaff || !hasStaff}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
