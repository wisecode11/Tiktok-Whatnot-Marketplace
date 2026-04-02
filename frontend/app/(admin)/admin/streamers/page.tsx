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
  UserPlus,
} from "lucide-react"

const streamers = [
  {
    id: "1",
    name: "TechStyle Live",
    email: "tech@example.com",
    avatar: "",
    status: "active",
    verified: true,
    plan: "Enterprise",
    revenue: "$45,230",
    streams: 156,
    rating: 4.9,
    joined: "Jan 15, 2024",
  },
  {
    id: "2",
    name: "Fashion Forward",
    email: "fashion@example.com",
    avatar: "",
    status: "active",
    verified: true,
    plan: "Professional",
    revenue: "$38,450",
    streams: 142,
    rating: 4.8,
    joined: "Feb 3, 2024",
  },
  {
    id: "3",
    name: "Beauty Boss",
    email: "beauty@example.com",
    avatar: "",
    status: "active",
    verified: true,
    plan: "Professional",
    revenue: "$32,100",
    streams: 128,
    rating: 4.9,
    joined: "Feb 18, 2024",
  },
  {
    id: "4",
    name: "Gadget Galaxy",
    email: "gadgets@example.com",
    avatar: "",
    status: "active",
    verified: false,
    plan: "Starter",
    revenue: "$28,750",
    streams: 98,
    rating: 5.0,
    joined: "Mar 5, 2024",
  },
  {
    id: "5",
    name: "Home & Living",
    email: "home@example.com",
    avatar: "",
    status: "suspended",
    verified: false,
    plan: "Starter",
    revenue: "$12,300",
    streams: 45,
    rating: 4.2,
    joined: "Mar 12, 2024",
  },
  {
    id: "6",
    name: "Sports Zone",
    email: "sports@example.com",
    avatar: "",
    status: "pending",
    verified: false,
    plan: "Starter",
    revenue: "$0",
    streams: 0,
    rating: 0,
    joined: "Mar 25, 2024",
  },
]

export default function AdminStreamersPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filteredStreamers = streamers.filter((streamer) => {
    const matchesSearch = streamer.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || streamer.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Streamers"
        description="Manage all registered streamers on the platform"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Streamer
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search streamers..."
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
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
                <TableHead>Streamer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Streams</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStreamers.map((streamer) => (
                <TableRow key={streamer.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={streamer.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {streamer.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{streamer.name}</span>
                          {streamer.verified && (
                            <StatusBadge variant="info" size="sm">Verified</StatusBadge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {streamer.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={
                        streamer.status === "active"
                          ? "success"
                          : streamer.status === "pending"
                          ? "warning"
                          : "destructive"
                      }
                    >
                      {streamer.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={
                        streamer.plan === "Enterprise"
                          ? "default"
                          : streamer.plan === "Professional"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {streamer.plan}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="font-medium">{streamer.revenue}</TableCell>
                  <TableCell>{streamer.streams}</TableCell>
                  <TableCell>
                    {streamer.rating > 0 ? (
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                        {streamer.rating}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {streamer.joined}
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
                        <DropdownMenuItem>Edit Details</DropdownMenuItem>
                        <DropdownMenuItem>View Streams</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {streamer.status === "active" ? (
                          <DropdownMenuItem className="text-destructive">
                            Suspend Account
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className="text-success">
                            Activate Account
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
