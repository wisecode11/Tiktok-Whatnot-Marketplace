"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import {
  Calendar,
  Clock,
  DollarSign,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Video,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const jobs = [
  {
    id: "1",
    streamer: "TechStyle Live",
    avatar: "",
    platform: "TikTok Shop",
    category: "Electronics",
    date: "Today",
    time: "2:00 PM - 5:00 PM",
    duration: "3 hours",
    rate: "$25/hr",
    total: "$75",
    status: "upcoming",
    description: "Moderate live stream selling tech gadgets. Help with Q&A and order management.",
  },
  {
    id: "2",
    streamer: "Fashion Forward",
    avatar: "",
    platform: "Whatnot",
    category: "Fashion",
    date: "Tomorrow",
    time: "10:00 AM - 2:00 PM",
    duration: "4 hours",
    rate: "$30/hr",
    total: "$120",
    status: "pending",
    description: "Fashion show livestream. Need help managing bids and customer questions.",
  },
  {
    id: "3",
    streamer: "Gadget Galaxy",
    avatar: "",
    platform: "Amazon Live",
    category: "Electronics",
    date: "Mar 28",
    time: "6:00 PM - 9:00 PM",
    duration: "3 hours",
    rate: "$28/hr",
    total: "$84",
    status: "upcoming",
    description: "Product launch stream for new smartphone accessories.",
  },
  {
    id: "4",
    streamer: "Beauty Boss",
    avatar: "",
    platform: "TikTok Shop",
    category: "Beauty",
    date: "Mar 25",
    time: "1:00 PM - 4:00 PM",
    duration: "3 hours",
    rate: "$25/hr",
    total: "$75",
    status: "completed",
    description: "Makeup tutorial and product showcase.",
  },
  {
    id: "5",
    streamer: "Home & Living",
    avatar: "",
    platform: "Facebook Live",
    category: "Home",
    date: "Mar 24",
    time: "11:00 AM - 2:00 PM",
    duration: "3 hours",
    rate: "$22/hr",
    total: "$66",
    status: "completed",
    description: "Home decor flash sale stream.",
  },
]

export default function ModeratorJobsPage() {
  const [activeTab, setActiveTab] = useState("all")

  const filteredJobs = jobs.filter((job) => {
    if (activeTab === "all") return true
    return job.status === activeTab
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Jobs"
        description="Manage your moderation jobs and bookings"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="all">All Jobs</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <Card
                key={job.id}
                className="border-border/50 bg-card/50 transition-all hover:border-primary/30"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Left Section - Streamer Info */}
                    <div className="flex items-start gap-4">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={job.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary text-lg">
                          {job.streamer.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{job.streamer}</h3>
                          <StatusBadge
                            variant={
                              job.status === "upcoming"
                                ? "info"
                                : job.status === "pending"
                                ? "warning"
                                : "success"
                            }
                          >
                            {job.status}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {job.description}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Video className="h-4 w-4" />
                            {job.platform}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            {job.category}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            {job.date}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            {job.time}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Section - Pay & Actions */}
                    <div className="flex items-center gap-4 lg:flex-col lg:items-end">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {job.total}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {job.rate} &middot; {job.duration}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {job.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" className="gap-1.5">
                              <XCircle className="h-4 w-4" />
                              Decline
                            </Button>
                            <Button size="sm" className="gap-1.5">
                              <CheckCircle2 className="h-4 w-4" />
                              Accept
                            </Button>
                          </>
                        )}
                        {job.status === "upcoming" && (
                          <Button size="sm" variant="outline" className="gap-1.5">
                            <MessageSquare className="h-4 w-4" />
                            Message
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Contact Streamer</DropdownMenuItem>
                            {job.status !== "completed" && (
                              <DropdownMenuItem className="text-destructive">
                                Cancel Job
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
