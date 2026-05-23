"use client"

import { useOrganization } from "@clerk/nextjs"
import { Building2, Loader2, Pencil } from "lucide-react"
import { useEffect, useState } from "react"

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
import { getClerkErrorMessage } from "@/lib/auth"

function buildSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

export function OrganizationGeneralSettings() {
  const { organization } = useOrganization()

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")

  useEffect(() => {
    if (!organization) {
      return
    }
    setName(organization.name)
    setSlug(organization.slug || "")
  }, [organization])

  if (!organization) {
    return null
  }

  async function handleSaveProfile() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMessage("Organization name is required.")
      return
    }

    try {
      setIsSaving(true)
      setErrorMessage("")
      await organization.update({
        name: trimmedName,
        slug: slug.trim() ? buildSlug(slug) : undefined,
      })
      setIsEditOpen(false)
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLogoChange(file: File | undefined) {
    if (!file) {
      return
    }

    try {
      setIsSaving(true)
      setErrorMessage("")
      await organization.setLogo({ file })
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="px-5 py-2 md:px-6">
      <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {organization.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.imageUrl}
              alt=""
              className="h-12 w-12 rounded-full border border-border/60 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
          )}
          <div>
            <p className="font-medium text-foreground">{organization.name}</p>
            <p className="text-sm text-muted-foreground">
              {organization.slug ? `@${organization.slug}` : "No slug set"}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setIsEditOpen(true)}>
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Edit profile
        </Button>
      </div>

      {errorMessage ? <p className="pb-4 text-sm text-destructive">{errorMessage}</p> : null}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit organization</DialogTitle>
            <DialogDescription>Update your workspace name, slug, or logo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-edit-name">Name</Label>
              <Input
                id="org-edit-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Organization name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-edit-slug">Slug</Label>
              <Input
                id="org-edit-slug"
                value={slug}
                onChange={(event) => setSlug(buildSlug(event.target.value))}
                placeholder="my-organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-edit-logo">Logo</Label>
              <Input
                id="org-edit-logo"
                type="file"
                accept="image/*"
                disabled={isSaving}
                onChange={(event) => void handleLogoChange(event.target.files?.[0])}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSaveProfile()} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
