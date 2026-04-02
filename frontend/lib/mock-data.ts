// Mock data for the marketplace platform
// This file contains placeholder data for UI development

export const mockUser = {
  id: "user_1",
  name: "Alex Chen",
  email: "alex@example.com",
  avatar: "/avatars/alex.jpg",
  role: "seller" as const,
  workspaceId: "ws_1",
}

export const mockSeller = {
  id: "seller_1",
  userId: "user_1",
  storeName: "TechStyle Live",
  bio: "Premium tech and lifestyle products for the modern consumer.",
  followers: 125000,
  totalViews: 2450000,
  totalOrders: 15200,
  rating: 4.9,
  subscriptionTier: "pro" as const,
  subscriptionStatus: "active" as const,
  connectedPlatforms: ["tiktok", "whatnot"] as const,
  kycStatus: "verified" as const,
  createdAt: "2024-01-15",
}

export const mockModerator = {
  id: "mod_1",
  userId: "user_2",
  name: "Jordan Smith",
  avatar: "/avatars/jordan.jpg",
  bio: "Experienced live commerce moderator with 5+ years in streaming. Specializing in tech, fashion, and collectibles.",
  skills: ["Chat Moderation", "Order Management", "Customer Support", "Multi-language"],
  languages: ["English", "Spanish", "Mandarin"],
  rating: 4.8,
  reviewCount: 142,
  completedJobs: 320,
  hourlyRate: 25,
  availability: "available" as const,
  kycStatus: "verified" as const,
  responseTime: "< 1 hour",
  joinedDate: "2023-06-20",
}

export const mockModerators = [
  mockModerator,
  {
    id: "mod_2",
    userId: "user_3",
    name: "Sarah Williams",
    avatar: "/avatars/sarah.jpg",
    bio: "Top-rated moderator specializing in beauty and fashion streams.",
    skills: ["Chat Moderation", "Product Knowledge", "Engagement"],
    languages: ["English", "French"],
    rating: 4.9,
    reviewCount: 89,
    completedJobs: 185,
    hourlyRate: 30,
    availability: "busy" as const,
    kycStatus: "verified" as const,
    responseTime: "< 30 min",
    joinedDate: "2023-08-15",
  },
  {
    id: "mod_3",
    userId: "user_4",
    name: "Mike Johnson",
    avatar: "/avatars/mike.jpg",
    bio: "Collectibles expert with deep knowledge in sports cards and memorabilia.",
    skills: ["Product Authentication", "Auction Management", "Chat Moderation"],
    languages: ["English"],
    rating: 4.7,
    reviewCount: 56,
    completedJobs: 98,
    hourlyRate: 35,
    availability: "available" as const,
    kycStatus: "pending" as const,
    responseTime: "< 2 hours",
    joinedDate: "2024-01-10",
  },
]

export const mockDashboardStats = {
  totalViews: 45200,
  viewsChange: 12.5,
  totalLikes: 8900,
  likesChange: 8.3,
  engagementRate: 4.2,
  engagementChange: -1.2,
  followers: 125000,
  followersChange: 5.8,
  streamDuration: "24:35:00",
  durationChange: 15.2,
  totalOrders: 342,
  ordersChange: 22.1,
  revenue: 12450,
  revenueChange: 18.5,
  avgOrderValue: 36.4,
  aovChange: -3.2,
}

export const mockProducts = [
  {
    id: "prod_1",
    name: "Wireless Earbuds Pro",
    sku: "WEP-001",
    price: 89.99,
    stock: 145,
    status: "active" as const,
    category: "Electronics",
    image: "/products/earbuds.jpg",
  },
  {
    id: "prod_2",
    name: "Smart Watch Series X",
    sku: "SWX-002",
    price: 299.99,
    stock: 52,
    status: "active" as const,
    category: "Electronics",
    image: "/products/smartwatch.jpg",
  },
  {
    id: "prod_3",
    name: "Premium Leather Wallet",
    sku: "PLW-003",
    price: 49.99,
    stock: 0,
    status: "out_of_stock" as const,
    category: "Accessories",
    image: "/products/wallet.jpg",
  },
  {
    id: "prod_4",
    name: "Minimalist Backpack",
    sku: "MBP-004",
    price: 79.99,
    stock: 28,
    status: "low_stock" as const,
    category: "Bags",
    image: "/products/backpack.jpg",
  },
]

export const mockTeamMembers = [
  {
    id: "tm_1",
    name: "Emily Davis",
    email: "emily@example.com",
    role: "moderator" as const,
    avatar: "/avatars/emily.jpg",
    status: "active" as const,
    joinedDate: "2024-02-01",
  },
  {
    id: "tm_2",
    name: "James Wilson",
    email: "james@example.com",
    role: "assistant" as const,
    avatar: "/avatars/james.jpg",
    status: "active" as const,
    joinedDate: "2024-03-15",
  },
  {
    id: "tm_3",
    name: "Lisa Chen",
    email: "lisa@example.com",
    role: "moderator" as const,
    avatar: "/avatars/lisa.jpg",
    status: "pending" as const,
    joinedDate: "2024-04-01",
  },
]

export const mockRecentActivity = [
  {
    id: "act_1",
    type: "order" as const,
    message: "New order #12345 from @techfan99",
    timestamp: "2 minutes ago",
  },
  {
    id: "act_2",
    type: "follow" as const,
    message: "You gained 50 new followers",
    timestamp: "15 minutes ago",
  },
  {
    id: "act_3",
    type: "comment" as const,
    message: '@beautylover22: "Love your products!"',
    timestamp: "32 minutes ago",
  },
  {
    id: "act_4",
    type: "stream" as const,
    message: "Your last stream reached 5.2K peak viewers",
    timestamp: "1 hour ago",
  },
  {
    id: "act_5",
    type: "order" as const,
    message: "Order #12344 has been shipped",
    timestamp: "2 hours ago",
  },
]

export const mockUpcomingStreams = [
  {
    id: "stream_1",
    title: "Spring Collection Launch",
    platform: "tiktok" as const,
    scheduledAt: "Today, 7:00 PM",
    duration: "2 hours",
    status: "scheduled" as const,
  },
  {
    id: "stream_2",
    title: "Flash Sale Friday",
    platform: "whatnot" as const,
    scheduledAt: "Tomorrow, 3:00 PM",
    duration: "3 hours",
    status: "scheduled" as const,
  },
  {
    id: "stream_3",
    title: "Tech Tuesday Showcase",
    platform: "tiktok" as const,
    scheduledAt: "Apr 8, 6:00 PM",
    duration: "2.5 hours",
    status: "draft" as const,
  },
]

export const mockBookings = [
  {
    id: "book_1",
    sellerName: "TechStyle Live",
    sellerAvatar: "/avatars/seller1.jpg",
    date: "Apr 5, 2024",
    time: "7:00 PM - 10:00 PM",
    duration: "3 hours",
    status: "confirmed" as const,
    payout: 75,
  },
  {
    id: "book_2",
    sellerName: "Fashion Forward",
    sellerAvatar: "/avatars/seller2.jpg",
    date: "Apr 7, 2024",
    time: "2:00 PM - 5:00 PM",
    duration: "3 hours",
    status: "pending" as const,
    payout: 75,
  },
  {
    id: "book_3",
    sellerName: "Collectibles Corner",
    sellerAvatar: "/avatars/seller3.jpg",
    date: "Apr 10, 2024",
    time: "8:00 PM - 11:00 PM",
    duration: "3 hours",
    status: "completed" as const,
    payout: 105,
  },
]

export const mockEarnings = {
  totalEarnings: 4250,
  pendingPayout: 850,
  lastPayout: 1200,
  lastPayoutDate: "Mar 28, 2024",
  monthlyEarnings: [
    { month: "Jan", amount: 1200 },
    { month: "Feb", amount: 1650 },
    { month: "Mar", amount: 2100 },
    { month: "Apr", amount: 850 },
  ],
}

export const mockAdminStats = {
  totalUsers: 45200,
  usersChange: 8.5,
  activeSellers: 2340,
  sellersChange: 12.3,
  activeModerators: 890,
  moderatorsChange: 15.7,
  totalTransactions: 125000,
  transactionsChange: 22.4,
  platformRevenue: 456000,
  revenueChange: 18.9,
  openReports: 23,
  reportsChange: -15.2,
}

export const mockReports = [
  {
    id: "rep_1",
    type: "content" as const,
    reportedUser: "user_123",
    reportedBy: "user_456",
    reason: "Inappropriate content during stream",
    status: "open" as const,
    priority: "high" as const,
    createdAt: "2 hours ago",
  },
  {
    id: "rep_2",
    type: "payment" as const,
    reportedUser: "user_789",
    reportedBy: "user_012",
    reason: "Dispute over refund",
    status: "investigating" as const,
    priority: "medium" as const,
    createdAt: "5 hours ago",
  },
  {
    id: "rep_3",
    type: "behavior" as const,
    reportedUser: "user_345",
    reportedBy: "user_678",
    reason: "Harassment in comments",
    status: "resolved" as const,
    priority: "high" as const,
    createdAt: "1 day ago",
  },
]

export const mockPricingPlans = [
  {
    id: "plan_free",
    name: "Starter",
    price: 0,
    period: "forever",
    features: [
      "Up to 5 products",
      "Basic analytics",
      "1 team member",
      "Community support",
    ],
    limitations: [
      "No moderator marketplace",
      "Limited stream history",
    ],
    recommended: false,
  },
  {
    id: "plan_pro",
    name: "Professional",
    price: 49,
    period: "month",
    features: [
      "Unlimited products",
      "Advanced analytics",
      "Up to 5 team members",
      "Moderator marketplace access",
      "Priority support",
      "AI tools access",
      "Multi-platform streaming",
    ],
    limitations: [],
    recommended: true,
  },
  {
    id: "plan_enterprise",
    name: "Enterprise",
    price: 199,
    period: "month",
    features: [
      "Everything in Professional",
      "Unlimited team members",
      "Custom integrations",
      "Dedicated account manager",
      "White-label options",
      "API access",
      "SLA guarantee",
    ],
    limitations: [],
    recommended: false,
  },
]

export const mockFAQs = [
  {
    question: "How does the moderator marketplace work?",
    answer: "Our marketplace connects live commerce streamers with professional moderators. Sellers can browse moderator profiles, check availability, and book moderators for their streams. Moderators handle chat management, order processing, and customer engagement during live sessions.",
  },
  {
    question: "What platforms do you support?",
    answer: "We currently support TikTok Shop and Whatnot, with more platforms coming soon. Our unified dashboard lets you manage streams across all connected platforms from a single interface.",
  },
  {
    question: "How do payments work for moderators?",
    answer: "Moderators set their own hourly or per-session rates. Payments are processed securely through our platform after each completed session. Payouts are available weekly via direct deposit or PayPal.",
  },
  {
    question: "What is the KYC process for moderators?",
    answer: "To ensure platform safety, all moderators must complete identity verification (KYC) before accepting bookings. This includes ID verification and a brief video interview. The process typically takes 24-48 hours.",
  },
  {
    question: "Can I cancel a booking?",
    answer: "Yes, bookings can be cancelled up to 24 hours before the scheduled time without penalty. Late cancellations may incur a fee. Check our terms of service for full details.",
  },
]
