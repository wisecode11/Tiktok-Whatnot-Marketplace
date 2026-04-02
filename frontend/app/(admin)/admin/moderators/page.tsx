"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/ui/status-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PageHeader } from "@/components/page-header"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Download,
  Filter,
  MoreHorizontal,
  Search,
  Star,
} from "lucide-react"

const moderators = [
  {
    id: "1",
    name: "Jordan Smith",
    email: "jordan@example.com",
    avatar: "",
    status: "active",
    verified: true,
    completedJobs: 156,
    earnings: "$12,450",
    rating: 4.9,
    responseRate: "98%",
    joined: "Dec 10, 2023",
  },
  {
    id: "2",
    name: "Alex Chen",
    email: "alex@example.com",
    avatar: "",
    status: "active",
    verified: true,
    completedJobs: 128,
    earnings: "$9,800",
    rating: 4.8,
    responseRate: "95%",
    joined: "Jan 5, 2024",
  },
  {
    id: "3",
    name: "Sam Wilson",
    email: "sam@example.com",
    avatar: "",
    status: "active",
    verified: false,
    completedJobs: 89,
    earnings: "$6,720",
    rating: 4.7,
    responseRate: "92%",
    joined: "Feb 1, 2024",
  },
  {
    id: "4",
    name: "Taylor Brown",
    email: "taylor@example.com",
    avatar: "",
    status: "inactive",
    verified: true,
    completedJobs: 45,
    earnings: "$3,200",
    rating: 4.5,
    responseRate: "88%",
    joined: "Feb 15, 2024",
  },
  {
    id: "5",
    name: "Morgan Lee",
    email: "morgan@example.com",
    avatar: "",
    status: "pending",
    verified: false,
    completedJobs: 0,
    earnings: "$0",
    rating: 0,
    responseRate: "-",
    joined: "Mar 20, 2024",
  },
]

export default function AdminModeratorsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filteredModerators = moderators.filter((mod) => {
    const matchesSearch = mod.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || mod.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moderators"
        description="Manage all registered moderators on the platform"
        actions={
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        }
      />

      {/* Filters */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search moderators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/50"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] bg-muted/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                More Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Moderator</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Completed Jobs</TableHead>
                <TableHead>Earnings</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Response Rate</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredModerators.map((mod) => (
                <TableRow key={mod.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={mod.avatar} />
                        <AvatarFallback className="bg-accent/10 text-accent">
                          {mod.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{mod.name}</span>
                          {mod.verified && (
                            <StatusBadge variant="info" size="sm">Verified</StatusBadge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {mod.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={
                        mod.status === "active"
                          ? "success"
                          : mod.status === "pending"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {mod.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="font-medium">{mod.completedJobs}</TableCell>
                  <TableCell className="font-medium">{mod.earnings}</TableCell>
                  <TableCell>
                    {mod.rating > 0 ? (
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                        {mod.rating}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{mod.responseRate}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {mod.joined}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>View Profile</DropdownMenuItem>
                        <DropdownMenuItem>View Jobs</DropdownMenuItem>
                        <DropdownMenuItem>Contact</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {mod.status === "pending" && (
                          <DropdownMenuItem className="text-success">
                            Approve Account
                          </DropdownMenuItem>
                        )}
                        {mod.status === "active" && (
                          <DropdownMenuItem className="text-destructive">
                            Suspend Account
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
