import type { Metadata } from "next"
import { ModeratorLayoutShell } from "@/components/dashboard/moderator-layout-shell"
import { BRAND_NAME } from "@/lib/brand"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: {
    default: `Moderator Dashboard | ${BRAND_NAME}`,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    "Moderator control center for bookings, availability, and public profile management.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function ModeratorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ModeratorLayoutShell>{children}</ModeratorLayoutShell>
}
