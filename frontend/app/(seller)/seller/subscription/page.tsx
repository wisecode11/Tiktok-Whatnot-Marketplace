import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Progress } from "@/components/ui/progress"
import { Check, Zap, CreditCard, ArrowRight } from "lucide-react"
import { mockPricingPlans } from "@/lib/mock-data"

export default function SellerSubscription() {
  const currentPlan = mockPricingPlans[1] // Pro plan

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription"
        description="Manage your subscription and billing"
      />

      {/* Current Plan */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-primary" />
                {currentPlan.name} Plan
              </CardTitle>
              <CardDescription>
                Your current subscription plan
              </CardDescription>
            </div>
            <StatusBadge variant="success" dot pulse>
              Active
            </StatusBadge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-4">
                <div className="text-3xl font-bold">
                  ${currentPlan.price}
                  <span className="text-lg font-normal text-muted-foreground">
                    /{currentPlan.period}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Billed monthly. Next billing date: May 1, 2024
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">Manage Billing</Button>
                <Button variant="outline">Download Invoice</Button>
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">Usage This Month</div>
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>Products</span>
                    <span className="text-muted-foreground">
                      45 / Unlimited
                    </span>
                  </div>
                  <Progress value={45} className="h-2" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>Team Members</span>
                    <span className="text-muted-foreground">3 / 5</span>
                  </div>
                  <Progress value={60} className="h-2" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>AI Credits</span>
                    <span className="text-muted-foreground">750 / 1000</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Compare Plans</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {mockPricingPlans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                plan.recommended
                  ? "border-primary bg-gradient-to-b from-primary/10 to-transparent"
                  : "border-border/50 bg-card/50"
              }`}
            >
              {plan.recommended && (
                <div className="absolute right-4 top-4">
                  <StatusBadge variant="info">Current</StatusBadge>
                </div>
              )}
              <CardHeader className="pb-4">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">${plan.price}</span>
                  {plan.period !== "forever" && (
                    <span className="text-muted-foreground">
                      /{plan.period}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.recommended ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : plan.price > currentPlan.price ? (
                  <Button className="w-full gap-2">
                    Upgrade
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full">
                    Downgrade
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* Payment Method */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="font-medium">Visa ending in 4242</div>
                <div className="text-sm text-muted-foreground">
                  Expires 12/2025
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Update
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
