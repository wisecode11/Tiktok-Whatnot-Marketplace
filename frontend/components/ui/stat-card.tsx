import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight, LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  change?: string | number
  changeLabel?: string
  icon?: LucideIcon
  iconColor?: string
  className?: string
  trend?: "up" | "down" | "neutral"
  changeType?: "positive" | "negative" | "neutral"
}

export function StatCard({
  title,
  value,
  change,
  changeLabel = "vs last period",
  icon: Icon,
  iconColor,
  className,
  trend,
  changeType,
}: StatCardProps) {
  const numericChange =
    typeof change === "number"
      ? change
      : typeof change === "string"
        ? Number.parseFloat(change.replace(/[^\d.-]/g, ""))
        : undefined

  const trendDirection =
    trend ??
    (changeType === "positive"
      ? "up"
      : changeType === "negative"
        ? "down"
        : numericChange !== undefined
          ? numericChange >= 0
            ? "up"
            : "down"
          : "neutral")
  const isPositive = trendDirection === "up"
  const changeText = typeof change === "string" ? change : numericChange !== undefined ? `${Math.abs(numericChange)}%` : undefined
  
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className={cn("h-4 w-4 text-primary", iconColor)} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {changeText !== undefined && (
          <div className="mt-1 flex items-center gap-1 text-xs">
            <span
              className={cn(
                "flex items-center gap-0.5 font-medium",
                trendDirection === "neutral"
                  ? "text-muted-foreground"
                  : isPositive
                    ? "text-emerald-400"
                    : "text-rose-400"
              )}
            >
              {trendDirection === "neutral" ? null : isPositive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {changeText}
            </span>
            <span className="text-muted-foreground">{changeLabel}</span>
          </div>
        )}
      </CardContent>
      {/* Subtle gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
    </Card>
  )
}
