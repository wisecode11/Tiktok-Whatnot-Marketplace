"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { BRAND_NAME } from "@/lib/brand"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Video, Users, Shield, ArrowRight, Loader2 } from "lucide-react"

const roles = [
  {
    id: "streamer",
    icon: Video,
    title: "Seller / Streamer",
    description: "Stream products, manage inventory, hire moderators, and grow your live commerce business.",
    features: ["Dashboard & Analytics", "Moderator Marketplace", "Multi-platform streaming", "Team Management"],
    href: "/signup?role=streamer",
    color: "primary",
  },
  {
    id: "moderator",
    icon: Users,
    title: "Moderator",
    description: "Join our marketplace to help streamers manage their live sessions and earn money.",
    features: ["Flexible Schedule", "Secure Payments", "Build Your Profile", "Connect with Sellers"],
    href: "/signup?role=moderator",
    color: "accent",
  },
  {
    id: "admin",
    icon: Shield,
    title: "Admin",
    description: "Internal access for platform management, user oversight, and system administration.",
    features: ["User Management", "Platform Analytics", "Risk Monitoring", "System Settings"],
    href: "/signup?role=admin",
    color: "muted",
  },
]

function GetStartedContent() {
  const searchParams = useSearchParams()
  const preselectedRole = searchParams.get("role")

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Choose Your Path
        </h1>
        <p className="mt-2 text-muted-foreground">
          Select how you want to use {BRAND_NAME}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {roles.map((role) => (
          <Card
            key={role.id}
            className={`group relative overflow-hidden border-border/50 bg-card/50 transition-all hover:border-primary/50 ${
              preselectedRole === role.id ? "border-primary" : ""
            }`}
          >
            <CardContent className="flex h-full flex-col p-6">
              <div
                className={`mb-4 inline-flex self-start rounded-xl p-3 ${
                  role.color === "primary"
                    ? "bg-primary/10"
                    : role.color === "accent"
                    ? "bg-accent/10"
                    : "bg-muted"
                }`}
              >
                <role.icon
                  className={`h-6 w-6 ${
                    role.color === "primary"
                      ? "text-primary"
                      : role.color === "accent"
                      ? "text-accent"
                      : "text-muted-foreground"
                  }`}
                />
              </div>

              <h2 className="mb-2 text-xl font-semibold">{role.title}</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {role.description}
              </p>

              <ul className="mb-6 flex-1 space-y-2">
                {role.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm"
                  >
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${
                        role.color === "primary"
                          ? "bg-primary"
                          : role.color === "accent"
                          ? "bg-accent"
                          : "bg-muted-foreground"
                      }`}
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className="w-full gap-2"
                variant={role.color === "accent" ? "outline" : role.color === "muted" ? "outline" : "default"}
              >
                <Link href={role.href}>
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>

            {/* Gradient overlay */}
            <div
              className={`pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity group-hover:opacity-100 ${
                role.color === "primary"
                  ? "bg-gradient-to-br from-primary/5 via-transparent to-transparent"
                  : role.color === "accent"
                  ? "bg-gradient-to-br from-accent/5 via-transparent to-transparent"
                  : ""
              }`}
            />
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}

export default function GetStartedPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <GetStartedContent />
    </Suspense>
  )
}
