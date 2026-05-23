"use client"

import { CreateOrganization, useOrganization } from "@clerk/nextjs"
import { Building2, Loader2 } from "lucide-react"
import { useState } from "react"

import { OrganizationGeneralSettings } from "@/components/organization/organization-general-settings"
import { OrganizationMembersPanel } from "@/components/organization/organization-members-panel"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { sellerClerkCreateOrganizationAppearance } from "@/lib/clerk-organization-appearance"

import "./seller-organization-styles.css"

type SellerOrganizationPanelProps = {
  isSyncing: boolean
  errorMessage: string
}

export function SellerOrganizationPanel({ isSyncing, errorMessage }: SellerOrganizationPanelProps) {
  const { organization } = useOrganization()
  const [activeTab, setActiveTab] = useState("general")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization"
        description="Manage your workspace profile and team members."
      >
        {organization && isSyncing ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Syncing…
          </span>
        ) : null}
      </PageHeader>

      {errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {!organization ? (
        <Card className="mx-auto max-w-lg border-border/60 shadow-sm">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <CardTitle>Create organization</CardTitle>
            <CardDescription>
              Set up your agency workspace before inviting staff or connecting platforms.
            </CardDescription>
          </CardHeader>
          <CardContent className="seller-org-shell pt-0">
            <CreateOrganization
              routing="path"
              path="/seller/organization"
              afterCreateOrganizationUrl="/seller/organization"
              appearance={sellerClerkCreateOrganizationAppearance}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60 shadow-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b border-border/60 px-5 pt-4 md:px-6">
              <TabsList className="h-auto w-full justify-start gap-1 rounded-none bg-transparent p-0">
                <TabsTrigger
                  value="general"
                  className="rounded-lg px-4 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none"
                >
                  General
                </TabsTrigger>
                <TabsTrigger
                  value="members"
                  className="rounded-lg px-4 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none"
                >
                  Members
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="general" className="mt-0 focus-visible:outline-none">
              <OrganizationGeneralSettings />
            </TabsContent>

            <TabsContent value="members" className="mt-0 focus-visible:outline-none">
              {activeTab === "members" ? <OrganizationMembersPanel /> : null}
            </TabsContent>
          </Tabs>
        </Card>
      )}
    </div>
  )
}
