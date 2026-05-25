"use client"

import { useMemo } from "react"

const PINK = "#e53775"
const YELLOW = "#ffe414"

type RainDrop = {
  id: number
  left: string
  top: string
  size: number
  delay: number
  duration: number
  opacity: number
  color: string
}

/** Sparse, tiny droplets — subtle background only */
function createDrops(count: number): RainDrop[] {
  return Array.from({ length: count }, (_, id) => {
    const isPink = id % 2 === 0
    return {
      id,
      left: `${(id * 13.7 + (id % 7) * 9) % 98}%`,
      top: `${(id * 5.1) % 35}%`,
      size: 3 + (id % 3),
      delay: (id % 10) * 0.55,
      duration: 4.5 + (id % 5) * 0.8,
      opacity: 0.04 + (id % 3) * 0.02,
      color: isPink ? PINK : YELLOW,
    }
  })
}

export function FeaturesHeroRain() {
  const drops = useMemo(() => createDrops(18), [])

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#e53775]/[0.015] via-transparent to-background" />

      <div className="absolute inset-0">
        {drops.map((drop) => (
          <span
            key={drop.id}
            className="absolute animate-[feature-rain-fall_linear_infinite] rounded-full"
            style={{
              left: drop.left,
              top: drop.top,
              width: drop.size,
              height: drop.size + 4,
              backgroundColor: drop.color,
              opacity: drop.opacity,
              animationDelay: `${drop.delay}s`,
              animationDuration: `${drop.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </div>
  )
}
