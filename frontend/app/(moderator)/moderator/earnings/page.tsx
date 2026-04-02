import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { StatCard } from "@/components/ui/stat-card"
import { PageHeader } from "@/components/page-header"
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CreditCard,
  DollarSign,
  Download,
  TrendingUp,
  Wallet,
} from "lucide-react"

const transactions = [
  {
    id: "1",
    type: "earning",
    description: "TechStyle Live - 3hr stream",
    amount: "+$75.00",
    date: "Mar 26, 2024",
    status: "completed",
  },
  {
    id: "2",
    type: "earning",
    description: "Fashion Forward - 4hr stream",
    amount: "+$120.00",
    date: "Mar 25, 2024",
    status: "completed",
  },
  {
    id: "3",
    type: "withdrawal",
    description: "Bank transfer to ****4521",
    amount: "-$500.00",
    date: "Mar 24, 2024",
    status: "completed",
  },
  {
    id: "4",
    type: "earning",
    description: "Beauty Boss - 3hr stream",
    amount: "+$75.00",
    date: "Mar 23, 2024",
    status: "pending",
  },
  {
    id: "5",
    type: "earning",
    description: "Gadget Galaxy - 4hr stream",
    amount: "+$112.00",
    date: "Mar 22, 2024",
    status: "completed",
  },
  {
    id: "6",
    type: "bonus",
    description: "Performance bonus - March",
    amount: "+$50.00",
    date: "Mar 20, 2024",
    status: "completed",
  },
]

const monthlyEarnings = [
  { month: "Jan", amount: 1850 },
  { month: "Feb", amount: 2100 },
  { month: "Mar", amount: 2450 },
]

export default function ModeratorEarningsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Earnings"
        description="Track your income and manage withdrawals"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button className="gap-2">
              <Wallet className="h-4 w-4" />
              Withdraw
            </Button>
          </div>
        }
      />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Available Balance"
          value="$1,245.00"
          icon={Wallet}
          iconColor="text-primary"
        />
        <StatCard
          title="This Month"
          value="$2,450.00"
          change="+18%"
          changeType="positive"
          icon={TrendingUp}
        />
        <StatCard
          title="Pending"
          value="$75.00"
          icon={Calendar}
          iconColor="text-warning"
        />
        <StatCard
          title="Total Earned"
          value="$12,850.00"
          icon={DollarSign}
          iconColor="text-success"
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Transactions */}
        <Card className="border-border/50 bg-card/50 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl bg-muted/50 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        tx.type === "earning"
                          ? "bg-success/15"
                          : tx.type === "bonus"
                          ? "bg-primary/15"
                          : "bg-muted"
                      }`}
                    >
                      {tx.type === "earning" ? (
                        <ArrowDownRight className="h-5 w-5 text-success" />
                      ) : tx.type === "bonus" ? (
                        <TrendingUp className="h-5 w-5 text-primary" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{tx.description}</p>
                      <p className="text-sm text-muted-foreground">{tx.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-semibold ${
                        tx.amount.startsWith("+")
                          ? "text-success"
                          : "text-muted-foreground"
                      }`}
                    >
                      {tx.amount}
                    </span>
                    <StatusBadge
                      variant={tx.status === "completed" ? "success" : "warning"}
                      size="sm"
                    >
                      {tx.status}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Monthly Summary */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Monthly Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {monthlyEarnings.map((month) => (
                <div key={month.month} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{month.month} 2024</span>
                    <span className="font-medium">${month.amount.toLocaleString()}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(month.amount / 3000) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 rounded-xl bg-muted/50 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Bank Account</p>
                  <p className="text-sm text-muted-foreground">****4521</p>
                </div>
                <Button variant="ghost" size="sm">
                  Change
                </Button>
              </div>
              <Button variant="outline" className="mt-4 w-full">
                Add Payment Method
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
