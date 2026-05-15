"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@clerk/nextjs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/page-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Star, Search, MoreHorizontal, Download } from "lucide-react"
import {
  getAdminReviews,
  getAdminReviewStats,
  getAdminUserProfileById,
  waitForSessionToken,
  type AdminReviewItem,
  type AdminUserProfileDetailResponse,
} from "@/lib/auth"

type Review = AdminReviewItem

interface ReviewStats {
  totalReviews: number
  averageRating: number
  ratingDistribution: Record<number, number>
  totalModerators: number
  totalStreamers: number
}

export default function FeedbackMonitoringPage() {
  const { getToken, isLoaded } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [ratingFilter, setRatingFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [activeDialog, setActiveDialog] = useState<"details" | "moderator" | "streamer" | null>(null)
  const [selectedUserProfile, setSelectedUserProfile] = useState<AdminUserProfileDetailResponse | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState("")

  useEffect(() => {
    if (!isLoaded) {
      return
    }
    fetchReviews()
    fetchStats()
  }, [isLoaded, page, ratingFilter])

  const fetchReviews = async () => {
    try {
      setLoading(true)
      const token = await waitForSessionToken(getToken)
      const response = await getAdminReviews(token, {
        page,
        limit: 20,
        ratingFilter: ratingFilter === "all" ? undefined : ratingFilter,
      })
      setReviews(response.data || [])
      setTotalPages(response.pagination?.pages || 1)
    } catch (error) {
      console.error("Failed to fetch reviews:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const token = await waitForSessionToken(getToken)
      const response = await getAdminReviewStats(token)
      setStats(response)
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    }
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase()
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
      </div>
    )
  }

  const openDetailsDialog = (review: Review) => {
    setSelectedReview(review)
    setActiveDialog("details")
  }

  const fetchAndOpenUserProfileDialog = async (
    review: Review,
    type: "moderator" | "streamer",
  ) => {
    const userId = type === "moderator" ? review.moderator_user_id : review.streamer_user_id

    setSelectedReview(review)
    setSelectedUserProfile(null)
    setProfileError("")
    setProfileLoading(true)
    setActiveDialog(type)

    try {
      const token = await waitForSessionToken(getToken)
      const profileResponse = await getAdminUserProfileById(token, userId)
      setSelectedUserProfile(profileResponse)
    } catch (error) {
      console.error(`Failed to fetch ${type} profile:`, error)
      setProfileError(`Failed to load ${type} profile details.`)
    } finally {
      setProfileLoading(false)
    }
  }

  const openModeratorProfileDialog = (review: Review) => {
    void fetchAndOpenUserProfileDialog(review, "moderator")
  }

  const openStreamerProfileDialog = (review: Review) => {
    void fetchAndOpenUserProfileDialog(review, "streamer")
  }

  const formatProfileLabel = (key: string) => {
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }

  const formatProfileValue = (value: unknown): string => {
    if (value === null || value === undefined || value === "") {
      return "—"
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No"
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : "—"
    }

    if (typeof value === "string") {
      return value
    }

    if (Array.isArray(value)) {
      return value.length ? value.join(", ") : "—"
    }

    try {
      return JSON.stringify(value)
    } catch {
      return "—"
    }
  }

  const moderatorProfileEntries = useMemo(() => {
    const profile = selectedUserProfile?.profile

    if (!profile) {
      return [] as Array<[string, unknown]>
    }

    const hiddenKeys = new Set(["_id", "__v", "user_id", "created_at", "updated_at"])

    return Object.entries(profile).filter(([key, value]) => {
      if (hiddenKeys.has(key)) {
        return false
      }
      return value !== null && value !== undefined && value !== ""
    })
  }, [selectedUserProfile])

  const filteredReviews = reviews.filter((review) =>
    searchTerm === ""
      ? true
      : review.moderator?.first_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        review.moderator?.last_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        review.streamer?.first_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        review.streamer?.last_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Feedback Monitoring"
        description="Access and monitor all ratings and reviews submitted for both customers and moderators"
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReviews}</div>
              <p className="text-xs text-muted-foreground">across all users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.averageRating.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">
                out of 5.0
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Moderators</CardTitle>
              <span className="text-2xl">👤</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalModerators}</div>
              <p className="text-xs text-muted-foreground">with profiles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Streamers</CardTitle>
              <span className="text-2xl">📺</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStreamers}</div>
              <p className="text-xs text-muted-foreground">verified</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">5⭐ Reviews</CardTitle>
              <Star className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.ratingDistribution[5] || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalReviews > 0
                  ? `${(((stats.ratingDistribution[5] || 0) / stats.totalReviews) * 100).toFixed(0)}%`
                  : "0%"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reviews Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>All Reviews</CardTitle>
              <CardDescription>
                Monitor and manage customer and moderator feedback
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Filter by rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                <SelectItem value="5">⭐⭐⭐⭐⭐ 5 stars</SelectItem>
                <SelectItem value="4">⭐⭐⭐⭐ 4 stars</SelectItem>
                <SelectItem value="3">⭐⭐⭐ 3 stars</SelectItem>
                <SelectItem value="2">⭐⭐ 2 stars</SelectItem>
                <SelectItem value="1">⭐ 1 star</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reviews Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Moderator</TableHead>
                  <TableHead>Streamer</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="max-w-xs">Review</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      Loading reviews...
                    </TableCell>
                  </TableRow>
                ) : filteredReviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      No reviews found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReviews.map((review) => (
                    <TableRow key={review._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {getInitials(
                                review.moderator?.first_name,
                                review.moderator?.last_name
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-sm">
                            <p className="font-medium">
                              {review.moderator?.first_name}{" "}
                              {review.moderator?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {review.moderator?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">
                            {review.streamer?.first_name}{" "}
                            {review.streamer?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {review.streamer?.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {renderStars(review.rating)}
                          <span className="text-sm font-medium">
                            {review.rating}.0
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {review.review_text || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={review.is_public ? "default" : "secondary"}>
                          {review.is_public ? "Public" : "Private"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(review.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetailsDialog(review)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openModeratorProfileDialog(review)}>
                              View Moderator Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openStreamerProfileDialog(review)}>
                              View Streamer Profile
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={activeDialog === "details"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
            <DialogDescription>
              Complete feedback information for this booking review.
            </DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Booking ID</p>
                  <p className="font-medium">{selectedReview.booking_id || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Submitted On</p>
                  <p className="font-medium">{new Date(selectedReview.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Visibility</p>
                  <p className="font-medium">{selectedReview.is_public ? "Public" : "Private"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Rating</p>
                  <div className="flex items-center gap-2">
                    {renderStars(selectedReview.rating)}
                    <span className="font-medium">{selectedReview.rating}.0</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground">Moderator</p>
                <p className="font-medium">
                  {selectedReview.moderator?.first_name} {selectedReview.moderator?.last_name}
                </p>
                <p className="text-xs text-muted-foreground">{selectedReview.moderator?.email || "—"}</p>
              </div>

              <div>
                <p className="text-muted-foreground">Streamer</p>
                <p className="font-medium">
                  {selectedReview.streamer?.first_name} {selectedReview.streamer?.last_name}
                </p>
                <p className="text-xs text-muted-foreground">{selectedReview.streamer?.email || "—"}</p>
              </div>

              <div>
                <p className="text-muted-foreground">Review Text</p>
                <p className="rounded-md border bg-muted/30 p-3">{selectedReview.review_text || "No written review provided."}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "moderator"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto pr-2">
          <DialogHeader>
            <DialogTitle>Moderator Profile</DialogTitle>
            <DialogDescription>
              Basic moderator information linked to this review.
            </DialogDescription>
          </DialogHeader>
          {profileLoading ? (
            <p className="text-sm text-muted-foreground">Loading moderator details...</p>
          ) : profileError ? (
            <p className="text-sm text-destructive">{profileError}</p>
          ) : selectedReview && selectedUserProfile ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    {getInitials(selectedUserProfile.user.first_name, selectedUserProfile.user.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">
                    {selectedUserProfile.user.first_name} {selectedUserProfile.user.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedUserProfile.user.email || "—"}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Role</p>
                  <p className="font-medium capitalize">{selectedUserProfile.user.user_type}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{selectedUserProfile.user.status}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Joined Date</p>
                  <p className="font-medium">{new Date(selectedUserProfile.user.created_at).toLocaleDateString()}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{new Date(selectedUserProfile.user.updated_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <p className="text-muted-foreground">Moderator User ID</p>
                <p className="font-medium break-all">{selectedReview.moderator_user_id}</p>
              </div> */}

              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Profile Published</p>
                  <p className="font-medium">
                    {selectedUserProfile.profile?.is_published ? "Yes" : "No"}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Rating from Streamers</p>
                  <p className="font-medium">
                    {typeof selectedUserProfile.profile?.rating_from_streamers === "number"
                      ? selectedUserProfile.profile.rating_from_streamers.toFixed(1)
                      : "—"}
                  </p>
                </div>
              </div>

              {moderatorProfileEntries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Complete Moderator Profile</p>
                  <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    {moderatorProfileEntries.map(([key, value]) => (
                      <div key={key} className="rounded-md border bg-muted/20 p-3">
                        <p className="text-muted-foreground">{formatProfileLabel(key)}</p>
                        <p className="font-medium break-words whitespace-pre-wrap leading-relaxed">
                          {formatProfileValue(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <p className="text-muted-foreground">Recent Reviews</p>
                <p className="font-medium">{selectedUserProfile.recentReviews?.length || 0} found</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "streamer"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto pr-2">
          <DialogHeader>
            <DialogTitle>Streamer Profile</DialogTitle>
            <DialogDescription>
              Basic streamer information linked to this review.
            </DialogDescription>
          </DialogHeader>
          {profileLoading ? (
            <p className="text-sm text-muted-foreground">Loading streamer details...</p>
          ) : profileError ? (
            <p className="text-sm text-destructive">{profileError}</p>
          ) : selectedReview && selectedUserProfile ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    {getInitials(selectedUserProfile.user.first_name, selectedUserProfile.user.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">
                    {selectedUserProfile.user.first_name} {selectedUserProfile.user.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedUserProfile.user.email || "—"}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Role</p>
                  <p className="font-medium capitalize">{selectedUserProfile.user.user_type}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{selectedUserProfile.user.status}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Joined Date</p>
                  <p className="font-medium">{new Date(selectedUserProfile.user.created_at).toLocaleDateString()}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{new Date(selectedUserProfile.user.updated_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <p className="text-muted-foreground">Streamer User ID</p>
                <p className="font-medium break-all">{selectedReview.streamer_user_id}</p>
              </div> */}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
