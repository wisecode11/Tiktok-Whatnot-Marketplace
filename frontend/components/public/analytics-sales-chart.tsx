"use client"

import { useEffect, useState } from "react"
import { TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

const BAR_HEIGHTS = [32, 48, 42, 58, 52, 72, 68, 88, 95, 100]

export function AnalyticsSalesChart() {
  const [revenue, setRevenue] = useState(8420)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    let frame = 0
    const from = 8420
    const target = 12450
    const duration = 2800

    const runAnimation = () => {
      const start = performance.now()
      setRevenue(from)

      const animate = (now: number) => {
        if (cancelled) return
        const progress = Math.min((now - start) / duration, 1)
        const eased = 1 - (1 - progress) ** 3
        setRevenue(Math.round(from + (target - from) * eased))
        if (progress < 1) {
          frame = requestAnimationFrame(animate)
        }
      }

      frame = requestAnimationFrame(animate)
    }

    runAnimation()
    setAnimKey((k) => k + 1)

    const loop = window.setInterval(() => {
      setAnimKey((k) => k + 1)
      runAnimation()
    }, 5200)

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      clearInterval(loop)
    }
  }, [])

  return (
    <div className="mt-5 flex min-h-[150px] flex-1 flex-col rounded-xl border border-border/60 bg-white p-4 dark:bg-card">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Revenue today</p>
          <p className="text-2xl font-bold tabular-nums text-foreground md:text-3xl">
            ${revenue.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="h-3.5 w-3.5 animate-bounce" style={{ animationDuration: "2s" }} />
          +24%
        </div>
      </div>

      <div className="relative flex flex-1 items-end gap-1.5 sm:gap-2" aria-hidden>
        {BAR_HEIGHTS.map((height, index) => (
          <div key={`${animKey}-${index}`} className="relative flex h-24 flex-1 items-end sm:h-28">
            <div
              className={cn(
                "w-full rounded-t-md shadow-sm animate-[sales-bar-grow_2.4s_ease-out_forwards]",
                index === BAR_HEIGHTS.length - 1
                  ? "bg-gradient-to-t from-[#e6c200] to-[#ffe414]"
                  : "bg-gradient-to-t from-[#c42d62] to-[#e53775]",
              )}
              style={{
                ["--bar-height" as string]: `${height}%`,
                animationDelay: `${index * 0.08}s`,
              }}
            />
          </div>
        ))}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
        >
          <path
            d="M2 34 L12 28 L22 30 L32 22 L42 24 L52 16 L62 18 L72 10 L82 8 L98 4"
            fill="none"
            stroke="rgb(229 55 117 / 0.5)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="animate-[sales-line-draw_2.8s_ease-out_forwards]"
            style={{ strokeDasharray: 120, strokeDashoffset: 120 }}
          />
        </svg>
      </div>

      <div className="mt-2 flex justify-between text-[10px] font-medium text-muted-foreground sm:text-xs">
        <span>9 AM</span>
        <span>12 PM</span>
        <span>3 PM</span>
        <span>Now</span>
      </div>
    </div>
  )
}
