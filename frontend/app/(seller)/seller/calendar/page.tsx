"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, CalendarDays, List, Clock, Video, MoreHorizontal, Edit, Trash2 } from "lucide-react"
import { mockUpcomingStreams } from "@/lib/mock-data"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function SellerCalendar() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Schedule and manage your streams"
      >
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Schedule Stream
        </Button>
      </PageHeader>

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            List
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
          {/* Upcoming Streams */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Streams</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockUpcomingStreams.map((stream) => (
                  <div
                    key={stream.id}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <Video className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{stream.title}</div>
                        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {stream.scheduledAt}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {stream.duration}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs uppercase">
                        {stream.platform}
                      </span>
                      <StatusBadge
                        variant={
                          stream.status === "scheduled" ? "info" : "default"
                        }
                      >
                        {stream.status}
                      </StatusBadge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Video className="mr-2 h-4 w-4" />
                            Go Live Now
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Cancel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Past Streams */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Past Streams</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    title: "Weekend Sale Event",
                    date: "Apr 1, 2024",
                    duration: "3:45:00",
                    views: 8500,
                    orders: 124,
                  },
                  {
                    title: "New Arrivals Showcase",
                    date: "Mar 29, 2024",
                    duration: "2:30:00",
                    views: 6200,
                    orders: 89,
                  },
                  {
                    title: "Flash Friday",
                    date: "Mar 22, 2024",
                    duration: "4:00:00",
                    views: 12400,
                    orders: 256,
                  },
                ].map((stream) => (
                  <div
                    key={stream.title}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-4"
                  >
                    <div>
                      <div className="font-medium">{stream.title}</div>
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{stream.date}</span>
                        <span>{stream.duration}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <div className="font-medium">
                          {stream.views.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">views</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{stream.orders}</div>
                        <div className="text-xs text-muted-foreground">orders</div>
                      </div>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-6">
              <div className="flex h-96 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground">
                <div className="text-center">
                  <CalendarDays className="mx-auto mb-2 h-12 w-12" />
                  <p className="text-lg font-medium">Calendar View</p>
                  <p className="text-sm">
                    Full calendar component will be displayed here
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
