"use client"

import { useEffect, useState } from "react"
import { Loader2, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

interface AccessControlModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffName: string
  selectedModules: string[]
  allModules: Array<{
    id: string
    label: string
    description: string
    isOptional?: boolean
  }>
  onSave: (modules: string[]) => Promise<void>
  isLoading?: boolean
}

export function AccessControlModal({
  open,
  onOpenChange,
  staffName,
  selectedModules,
  allModules,
  onSave,
  isLoading = false,
}: AccessControlModalProps) {
  const { toast } = useToast()
  const [modules, setModules] = useState<string[]>(selectedModules)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setModules(selectedModules)
  }, [selectedModules, open])

  function toggleModule(moduleId: string) {
    setModules((current) => {
      if (current.includes(moduleId)) {
        return current.filter((m) => m !== moduleId)
      } else {
        return [...current, moduleId]
      }
    })
  }

  async function handleSave() {
    try {
      setIsSaving(true)
      await onSave(modules)
      toast({
        title: "Permissions updated",
        description: `Access permissions for ${staffName} have been saved.`,
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save permissions. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (newOpen === false && (isSaving || isLoading)) {
      return
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Access for {staffName}</DialogTitle>
          <DialogDescription>
            Select which modules {staffName} can access in their dashboard. They will only see and
            interact with the modules you enable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3">
            {isLoading ? (
              <div className="flex min-h-48 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              allModules.map((module) => (
                <div
                  key={module.id}
                  className="flex items-start space-x-3 rounded-lg border border-border/60 bg-card/50 p-4 hover:bg-card/80 cursor-pointer transition-colors"
                >
                  <Checkbox
                    id={module.id}
                    checked={modules.includes(module.id)}
                    onCheckedChange={() => toggleModule(module.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <label htmlFor={module.id} className="text-sm font-medium cursor-pointer">
                        {module.label}
                      </label>
                      {module.isOptional && (
                        <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{module.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">
              <strong>Selected:</strong> {modules.length} of {allModules.length} modules
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSaving || isLoading}
          >
            Cancel
          </Button>
          <Button disabled={isSaving || isLoading} onClick={handleSave}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
