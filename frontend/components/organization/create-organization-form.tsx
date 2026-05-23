"use client"

import { useAuth, useClerk } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"
import { FormEvent, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSellerOrganization, getClerkErrorMessage, waitForSessionToken } from "@/lib/auth"
import { switchSellerOrganization } from "@/lib/seller-organization"

type CreateOrganizationFormProps = {
  defaultName?: string
  submitLabel?: string
  onCreated?: () => void
}

export function CreateOrganizationForm({
  defaultName = "",
  submitLabel = "Create organization",
  onCreated,
}: CreateOrganizationFormProps) {
  const { getToken } = useAuth()
  const { setActive } = useClerk()
  const [name, setName] = useState(defaultName)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (defaultName) {
      setName(defaultName)
    }
  }, [defaultName])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMessage("Organization name is required.")
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage("")
      const token = await waitForSessionToken(getToken)
      const result = await createSellerOrganization(token, { name: trimmedName })

      if (result.organization.clerkOrganizationId && setActive) {
        await switchSellerOrganization({
          clerkOrganizationId: result.organization.clerkOrganizationId,
          getToken,
          setActive,
        })
      }

      onCreated?.()
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="create-org-name">Organization name</Label>
        <Input
          id="create-org-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="My Organization Name"
          required
        />
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting || !name.trim()}>
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
      </Button>
    </form>
  )
}
