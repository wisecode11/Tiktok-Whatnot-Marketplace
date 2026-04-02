"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, MoreHorizontal, Mail, Shield, UserMinus, Users } from "lucide-react"
import { mockTeamMembers } from "@/lib/mock-data"

export default function SellerTeam() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        description="Manage your team members and their roles"
      >
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Invite Member
        </Button>
      </PageHeader>

      {/* Team Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{mockTeamMembers.length}</div>
              <div className="text-sm text-muted-foreground">Team Members</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {mockTeamMembers.filter((m) => m.role === "moderator").length}
              </div>
              <div className="text-sm text-muted-foreground">Moderators</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Mail className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {mockTeamMembers.filter((m) => m.status === "pending").length}
              </div>
              <div className="text-sm text-muted-foreground">Pending Invites</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Members List */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockTeamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-4"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {member.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{member.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {member.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm capitalize">{member.role}</div>
                    <div className="text-xs text-muted-foreground">
                      Joined {member.joinedDate}
                    </div>
                  </div>
                  <StatusBadge
                    variant={member.status === "active" ? "success" : "warning"}
                    dot
                  >
                    {member.status}
                  </StatusBadge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Shield className="mr-2 h-4 w-4" />
                        Change Role
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Mail className="mr-2 h-4 w-4" />
                        Resend Invite
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <UserMinus className="mr-2 h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Roles Info */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="font-medium">Moderator</span>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Manage chat during streams</li>
                <li>Process orders and refunds</li>
                <li>View analytics (limited)</li>
                <li>Respond to customer inquiries</li>
              </ul>
            </div>
            <div className="rounded-xl bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" />
                <span className="font-medium">Assistant</span>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Manage products and inventory</li>
                <li>Schedule streams</li>
                <li>View full analytics</li>
                <li>Manage content posts</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
