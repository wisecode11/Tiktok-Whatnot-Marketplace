"use client"

import { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { getClerkErrorMessage, updateWhatnotProfileBio, waitForSessionToken } from "@/lib/auth"

interface WhatnotBioEditorProps {
  title?: string
  description?: string
}

export default function WhatnotBioEditor({
  title = "Profile",
  description = "Update your Whatnot profile bio directly from the platform.",
}: WhatnotBioEditorProps) {
  const { getToken } = useAuth()
  const { toast } = useToast()

  const [bio, setBio] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)

  async function handleUpdateBio() {
    const nextBio = bio.trim()

    if (!nextBio) {
      toast({
        title: "Bio is required",
        description: "Please enter a new bio before clicking update.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsUpdating(true)

      const token = await waitForSessionToken(getToken)
      const result = await updateWhatnotProfileBio(token, nextBio)

      setBio(result.bio || nextBio)
      toast({
        title: "Bio updated",
        description: "Your Whatnot bio was updated in real time.",
      })
    } catch (error) {
      toast({
        title: "Unable to update bio",
        description: getClerkErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <Card className="max-w-3xl border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">Edit Bio</CardTitle>
          <CardDescription>
            Add your new bio and click update to apply it on Whatnot in real time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Edit bio"
            rows={5}
          />
          <div className="flex justify-end">
            <Button onClick={() => void handleUpdateBio()} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
