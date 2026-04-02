import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { PageHeader } from "@/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Eye,
  Heart,
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  BarChart3,
  LineChart,
} from "lucide-react"
import { mockDashboardStats } from "@/lib/mock-data"

export default function SellerAnalytics() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Track your performance and growth"
      >
        <Select defaultValue="7d">
          <SelectTrigger className="w-[160px] bg-muted/50">
            <SelectValue placeholder="Time period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Views"
              value={mockDashboardStats.totalViews.toLocaleString()}
              change={mockDashboardStats.viewsChange}
              icon={Eye}
            />
            <StatCard
              title="Total Likes"
              value={mockDashboardStats.totalLikes.toLocaleString()}
              change={mockDashboardStats.likesChange}
              icon={Heart}
            />
            <StatCard
              title="Followers"
              value={mockDashboardStats.followers.toLocaleString()}
              change={mockDashboardStats.followersChange}
              icon={Users}
            />
            <StatCard
              title="Engagement Rate"
              value={`${mockDashboardStats.engagementRate}%`}
              change={mockDashboardStats.engagementChange}
              icon={TrendingUp}
            />
          </div>

          {/* Charts Placeholder */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LineChart className="h-5 w-5 text-primary" />
                  Views Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-64 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground">
                  <div className="text-center">
                    <LineChart className="mx-auto mb-2 h-8 w-8" />
                    <p>Views trend chart</p>
                    <p className="text-sm">Connect data to display</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Engagement by Day
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-64 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="mx-auto mb-2 h-8 w-8" />
                    <p>Engagement chart</p>
                    <p className="text-sm">Connect data to display</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Comments"
              value="12.4K"
              change={8.5}
              icon={TrendingUp}
            />
            <StatCard
              title="Shares"
              value="3.2K"
              change={12.1}
              icon={TrendingUp}
            />
            <StatCard
              title="Saves"
              value="5.8K"
              change={-2.3}
              icon={TrendingUp}
            />
            <StatCard
              title="Avg Watch Time"
              value="4:32"
              change={5.7}
              icon={TrendingUp}
            />
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Orders"
              value={mockDashboardStats.totalOrders.toLocaleString()}
              change={mockDashboardStats.ordersChange}
              icon={ShoppingCart}
            />
            <StatCard
              title="Revenue"
              value={`$${mockDashboardStats.revenue.toLocaleString()}`}
              change={mockDashboardStats.revenueChange}
              icon={DollarSign}
            />
            <StatCard
              title="Avg Order Value"
              value={`$${mockDashboardStats.avgOrderValue}`}
              change={mockDashboardStats.aovChange}
              icon={DollarSign}
            />
            <StatCard
              title="Conversion Rate"
              value="3.2%"
              change={1.5}
              icon={TrendingUp}
            />
          </div>
        </TabsContent>

        <TabsContent value="audience" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg">Demographics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: "18-24", value: 35 },
                    { label: "25-34", value: 42 },
                    { label: "35-44", value: 15 },
                    { label: "45+", value: 8 },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{item.label}</span>
                        <span className="text-muted-foreground">
                          {item.value}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg">Top Locations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: "United States", value: 45 },
                    { label: "United Kingdom", value: 18 },
                    { label: "Canada", value: 12 },
                    { label: "Australia", value: 8 },
                    { label: "Germany", value: 6 },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{item.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
