import type { Metadata } from "next"
import { BRAND_NAME } from "@/lib/brand"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "Moderator",
  description:
    "Manage moderator dashboard, bookings, availability, and profile settings.",
  alternates: {
    canonical: "/moderator",
  },
}

const moderatorStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: `${BRAND_NAME} Moderator Dashboard`,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Moderator workspace to manage live-commerce bookings, availability, and profile operations.",
  url: "/moderator",
}

export default function ModeratorRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(moderatorStructuredData) }}
      />
      {children}
    </>
  )
}
