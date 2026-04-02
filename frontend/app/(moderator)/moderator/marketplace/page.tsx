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
  Calendar,
  Clock,
  DollarSign,
  Filter,
  Search,
  Star,
  Users,
  Video,
  Zap,
} from "lucide-react"

const jobListings = [
  {
    id: "1",
    streamer: "TechStyle Live",
    avatar: "",
    verified: true,
    rating: 4.9,
    reviews: 128,
    platform: "TikTok Shop",
    category: "Electronics",
    title: "Looking for experienced moderator for tech stream",
    description: "Need a moderator familiar with tech products. Must be able to handle high-volume chat and manage orders efficiently.",
    date: "Mar 30, 2024",
    time: "2:00 PM - 6:00 PM",
    duration: "4 hours",
    rate: "$28/hr",
    requirements: ["2+ years experience", "Tech knowledge", "Fast typing"],
    urgent: true,
  },
  {
    id: "2",
    streamer: "Fashion Forward",
    avatar: "",
    verified: true,
    rating: 4.8,
    reviews: 95,
    platform: "Whatnot",
    category: "Fashion",
    title: "Fashion show moderator needed",
    description: "Weekly fashion livestream needs a dedicated moderator. Great opportunity for long-term collaboration.",
    date: "Every Saturday",
    time: "10:00 AM - 2:00 PM",
    duration: "4 hours",
    rate: "$30/hr",
    requirements: ["Fashion knowledge", "Customer service skills"],
    urgent: false,
  },
  {
    id: "3",
    streamer: "Beauty Boss",
    avatar: "",
    verified: false,
    rating: 4.7,
    reviews: 42,
    platform: "Instagram Live",
    category: "Beauty",
    title: "Beauty stream assistant moderator",
    description: "Looking for someone to help moderate beauty tutorials and product launches.",
    date: "Apr 2, 2024",
    time: "3:00 PM - 6:00 PM",
    duration: "3 hours",
    rate: "$25/hr",
    requirements: ["Beauty industry knowledge", "Bilingual preferred"],
    urgent: false,
  },
  {
    id: "4",
    streamer: "Gadget Galaxy",
    avatar: "",
    verified: true,
    rating: 5.0,
    reviews: 67,
    platform: "Amazon Live",
    category: "Electronics",
    title: "Product launch event moderator",
    description: "Big product launch coming up! Need experienced moderator for high-traffic stream.",
    date: "Apr 5, 2024",
    time: "6:00 PM - 10:00 PM",
    duration: "4 hours",
    rate: "$35/hr",
    requirements: ["Experience with launches", "Crisis management", "Available for rehearsal"],
    urgent: true,
  },
]

export default function ModeratorMarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [platformFilter, setPlatformFilter] = useState("all")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find Work"
        description="Browse available moderation opportunities from top streamers"
      />

      {/* Filters */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search jobs, streamers, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/50"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px] bg-muted/50">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="fashion">Fashion</SelectItem>
                  <SelectItem value="beauty">Beauty</SelectItem>
                  <SelectItem value="home">Home & Living</SelectItem>
                </SelectContent>
              </Select>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-[140px] bg-muted/50">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="tiktok">TikTok Shop</SelectItem>
                  <SelectItem value="whatnot">Whatnot</SelectItem>
                  <SelectItem value="amazon">Amazon Live</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
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

      {/* Job Listings */}
      <div className="space-y-4">
        {jobListings.map((job) => (
          <Card
            key={job.id}
            className="border-border/50 bg-card/50 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
          >
            <CardContent className="p-6">
              <div className="flex flex-col gap-6 lg:flex-row">
                {/* Streamer Info */}
                <div className="flex items-start gap-4 lg:w-64 lg:shrink-0">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={job.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {job.streamer.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{job.streamer}</span>
                      {job.verified && (
                        <StatusBadge variant="info" size="sm">Verified</StatusBadge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-sm">
                      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                      <span className="font-medium">{job.rating}</span>
                      <span className="text-muted-foreground">
                        ({job.reviews} reviews)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Video className="h-3.5 w-3.5" />
                      {job.platform}
                    </div>
                  </div>
                </div>

                {/* Job Details */}
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{job.title}</h3>
                        {job.urgent && (
                          <StatusBadge variant="destructive" size="sm">
                            <Zap className="mr-1 h-3 w-3" />
                            Urgent
                          </StatusBadge>
                        )}
                      </div>
                      <p className="mt-2 text-muted-foreground">
                        {job.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-primary">
                        {job.rate}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {job.duration}
                      </div>
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      {job.date}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      {job.time}
                    </span>
                    <StatusBadge variant="secondary" size="sm">
                      {job.category}
                    </StatusBadge>
                  </div>

                  {/* Requirements */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.requirements.map((req) => (
                      <span
                        key={req}
                        className="rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground"
                      >
                        {req}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2">
                    <Button className="gap-2">
                      Apply Now
                    </Button>
                    <Button variant="outline">
                      Save Job
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
