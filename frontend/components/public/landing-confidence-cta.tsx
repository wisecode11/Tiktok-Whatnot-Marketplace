import Link from "next/link"
import { ArrowRight, Clock, Shield, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"

const trustItems = [
  { icon: Shield, label: "99.9% Uptime" },
  { icon: Clock, label: "24/7 Support" },
  { icon: UserPlus, label: "500+ Sellers" },
] as const

export function LandingConfidenceCta() {
  return (
    <section className="py-10 md:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="landing-confidence-cta relative overflow-hidden rounded-3xl px-6 py-10 md:px-12 md:py-14">
          <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[1fr_auto] lg:gap-12">
            <div className="space-y-5">
              <h2 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-[2.5rem] lg:leading-tight">
                Ready to scale your live commerce business?
              </h2>
              <p className="max-w-xl text-base leading-relaxed text-white/90 md:text-lg">
                Join Marketplace Hub sellers who run TikTok Shop and Whatnot streams,
                manage orders and inventory, and hire verified moderators — all from one
                dashboard. Start your free trial in minutes.
              </p>
              <ul className="flex flex-wrap gap-x-8 gap-y-3 pt-1">
                {trustItems.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2 text-sm text-white md:text-base">
                    <Icon className="h-5 w-5 shrink-0 stroke-[1.75]" aria-hidden />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-white px-6 text-base font-semibold text-[#6d11e8] shadow-sm hover:bg-white/95"
              >
                <Link href="/get-started">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl border-0 bg-black px-6 text-base font-semibold text-white shadow-sm hover:bg-black/90"
              >
                <Link href="/contact">Talk to sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
