"use client"

import { useState, useEffect } from "react"
import { useAuth, useUser } from "@clerk/nextjs"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Star, Search, MoreHorizontal, Download, CheckCircle, AlertCircle } from "lucide-react"
import {
  getAdminUsers,
  updateAdminUserStatus,
  waitForSessionToken,
  getAdminModeratorReviews,
  type AdminModeratorReview,
} from "@/lib/auth"

interface UserProfile {
  _id: string
  email: string
  first_name: string
  last_name: string
  user_type: "seller" | "moderator" | "admin" | "staff"
  status: "active" | "inactive" | "pending" | "blocked" | "deleted"
  created_at: string
  updated_at: string
  profile?: {
    is_published?: boolean
    rating_from_streamers?: number
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

export default function UserProfileManagementPage() {
  const { getToken, isLoaded } = useAuth()
  const { user: clerkUser } = useUser()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [isRatingsDialogOpen, setIsRatingsDialogOpen] = useState(false)
  const [moderatorReviews, setModeratorReviews] = useState<AdminModeratorReview[]>([])
  const [moderatorStats, setModeratorStats] = useState<{
    totalReviews: number
    averageRating: number | string
    ratingDistribution: Record<number, number>
  } | null>(null)
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const [newStatus, setNewStatus] = useState<string>("")
  const [statusUpdateMessage, setStatusUpdateMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  useEffect(() => {
    if (!isLoaded) {
      return
    }
    getCurrentUser()
    fetchUsers()
  }, [isLoaded, page, userTypeFilter, statusFilter])

  const getCurrentUser = async () => {
    if (!clerkUser?.primaryEmailAddress?.emailAddress) return
    try {
      const token = await waitForSessionToken(getToken)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/api/auth/me`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      const data = await response.json()
      setCurrentUserId(data.user?.id || null)
    } catch (error) {
      console.error("Failed to fetch current user:", error)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const token = await waitForSessionToken(getToken)
      const response = await getAdminUsers(token, {
        page,
        limit: 20,
        userType: userTypeFilter === "all" ? undefined : userTypeFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
      })
      setUsers(response.data || [])
      setPagination(response.pagination)
    } catch (error) {
      console.error("Failed to fetch users:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewProfile = (user: UserProfile) => {
    setSelectedUser(user)
    setIsDetailDialogOpen(true)
  }

  const handleViewRatings = async (user: UserProfile) => {
    if (user.user_type !== "moderator") return
    setSelectedUser(user)
    setRatingsLoading(true)
    setIsRatingsDialogOpen(true)
    try {
      const token = await waitForSessionToken(getToken)
      const response = await getAdminModeratorReviews(token, user._id)
      setModeratorReviews(response.reviews || [])
      setModeratorStats(response.stats || null)
    } catch (error) {
      console.error("Failed to fetch moderator reviews:", error)
      setModeratorReviews([])
    } finally {
      setRatingsLoading(false)
    }
  }

  const handleStatusChange = (user: UserProfile, status: string) => {
    setSelectedUser(user)
    setNewStatus(status)
    setIsStatusDialogOpen(true)
  }

  const confirmStatusChange = async () => {
    if (!selectedUser) return

    try {
      const token = await waitForSessionToken(getToken)
      await updateAdminUserStatus(token, selectedUser._id, newStatus)
      setUsers(
        users.map((u) =>
          u._id === selectedUser._id ? { ...u, status: newStatus as UserProfile["status"] } : u
        )
      )
      setIsStatusDialogOpen(false)
      setSelectedUser(null)
      setStatusUpdateMessage({
        type: "success",
        text: `User status updated to ${newStatus}`,
      })
      setTimeout(() => setStatusUpdateMessage(null), 3000)
    } catch (error) {
      console.error("Failed to update status:", error)
      setStatusUpdateMessage({
        type: "error",
        text: "Failed to update user status",
      })
      setTimeout(() => setStatusUpdateMessage(null), 3000)
    }
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "default"
      case "inactive":
      case "pending":
        return "secondary"
      case "blocked":
        return "destructive"
      case "deleted":
        return "outline"
      default:
        return "default"
    }
  }

  const getUserTypeLabel = (type: string) => {
    switch (type) {
      case "seller":
        return "Streamer"
      case "moderator":
        return "Moderator"
      case "admin":
        return "Admin"
      case "staff":
        return "Staff"
      default:
        return type
    }
  }

  const filteredUsers = users
    .filter((user) => user._id !== currentUserId)
    .filter((user) =>
      searchTerm === ""
        ? true
        : user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="User Profile Management"
        description="View and manage complete customer and moderator profiles for review, verification, and compliance purposes"
      />

      {/* Users Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>User Profiles</CardTitle>
              <CardDescription>
                Manage and review all user accounts
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
            <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="User type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="seller">Streamers</SelectItem>
                <SelectItem value="moderator">Moderators</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {getInitials(user.first_name, user.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-sm font-medium">
                            {user.first_name} {user.last_name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getUserTypeLabel(user.user_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(user.status) as any}>
                          {user.status.charAt(0).toUpperCase() +
                            user.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
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
                            <DropdownMenuItem
                              onClick={() => handleViewProfile(user)}
                            >
                              View Profile
                            </DropdownMenuItem>
                            {user.user_type === "moderator" && (
                              <DropdownMenuItem
                                onClick={() => handleViewRatings(user)}
                              >
                                View Ratings
                              </DropdownMenuItem>
                            )}

                            {/* Status Change Options - Contextual based on current status */}
                            {user.status === "active" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(user, "blocked")}
                                >
                                  Block User
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(user, "inactive")}
                                >
                                  Deactivate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(user, "deleted")}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}

                            {user.status === "blocked" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(user, "active")}
                                  className="text-green-600"
                                >
                                  Unblock User
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(user, "deleted")}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}

                            {user.status === "inactive" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(user, "active")}
                                  className="text-green-600"
                                >
                                  Activate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(user, "blocked")}
                                >
                                  Block User
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(user, "deleted")}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}

                            {user.status === "deleted" && (
                              <DropdownMenuItem disabled>
                                User Deleted
                              </DropdownMenuItem>
                            )}
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
          {pagination && pagination.pages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing page {page} of {pagination.pages}
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
                  onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                  disabled={page === pagination.pages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
            <DialogDescription>
              View detailed information about this user
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg">
                    {getInitials(selectedUser.first_name, selectedUser.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">
                    {selectedUser.first_name} {selectedUser.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedUser.email}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Badge>{getUserTypeLabel(selectedUser.user_type)}</Badge>
                    <Badge variant={getStatusColor(selectedUser.status) as any}>
                      {selectedUser.status.charAt(0).toUpperCase() +
                        selectedUser.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    User Type
                  </p>
                  <p className="mt-1 text-sm">
                    {getUserTypeLabel(selectedUser.user_type)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Status
                  </p>
                  <p className="mt-1 text-sm capitalize">{selectedUser.status}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Joined Date
                  </p>
                  <p className="mt-1 text-sm">
                    {new Date(selectedUser.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Last Updated
                  </p>
                  <p className="mt-1 text-sm">
                    {new Date(selectedUser.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {selectedUser.user_type === "moderator" && selectedUser.profile && (
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="font-semibold">Moderator Information</h4>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Profile Published</span>
                      {selectedUser.profile.is_published ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                      )}
                    </div>
                    {selectedUser.profile.rating_from_streamers && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Average Rating</span>
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          {selectedUser.profile.rating_from_streamers.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Change Confirmation Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Status</DialogTitle>
            <DialogDescription>
              Are you sure you want to change this user&apos;s status to{" "}
              <strong>{newStatus}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsStatusDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmStatusChange}
              variant={newStatus === "blocked" ? "destructive" : "default"}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Moderator Ratings Dialog */}
      <Dialog open={isRatingsDialogOpen} onOpenChange={setIsRatingsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Moderator Ratings</DialogTitle>
            <DialogDescription>
              {selectedUser?.first_name} {selectedUser?.last_name}&apos;s ratings and reviews from
              streamers
            </DialogDescription>
          </DialogHeader>
          {ratingsLoading ? (
            <div className="flex justify-center py-8">
              <p className="text-muted-foreground">Loading ratings...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats */}
              {moderatorStats && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs font-medium text-muted-foreground">Total Reviews</p>
                    <p className="text-lg font-bold">{moderatorStats.totalReviews}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs font-medium text-muted-foreground">Average Rating</p>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <p className="text-lg font-bold">
                        {typeof moderatorStats.averageRating === "string"
                          ? moderatorStats.averageRating
                          : moderatorStats.averageRating.toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs font-medium text-muted-foreground">5★ Reviews</p>
                    <p className="text-lg font-bold">
                      {moderatorStats.ratingDistribution[5] || 0}
                    </p>
                  </div>
                </div>
              )}

              {/* Rating Distribution */}
              {moderatorStats && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Rating Distribution</p>
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <div key={rating} className="flex items-center gap-3">
                      <div className="flex w-12 items-center gap-1">
                        {[...Array(rating)].map((_, i) => (
                          <Star
                            key={i}
                            className="h-3 w-3 fill-yellow-400 text-yellow-400"
                          />
                        ))}
                      </div>
                      <div className="flex-1">
                        <div className="h-2 w-full rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{
                              width:
                                moderatorStats.totalReviews > 0
                                  ? `${((moderatorStats.ratingDistribution[rating] || 0) / moderatorStats.totalReviews) * 100}%`
                                  : "0%",
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-medium">
                        {moderatorStats.ratingDistribution[rating] || 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Reviews List */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Recent Reviews</p>
                {moderatorReviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reviews yet</p>
                ) : (
                  moderatorReviews.map((review) => (
                    <div key={review._id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 ${
                                    i < review.rating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-sm font-medium">{review.rating}.0</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            From: {review.streamer?.first_name} {review.streamer?.last_name}
                          </p>
                          {review.review_text && (
                            <p className="mt-2 text-sm">{review.review_text}</p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Update Toast */}
      {statusUpdateMessage && (
        <div
          className={`fixed bottom-4 right-4 rounded-lg px-4 py-3 text-white ${
            statusUpdateMessage.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {statusUpdateMessage.text}
        </div>
      )}
    </div>
  )
}
