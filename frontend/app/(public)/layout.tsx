import { PublicNavbar } from "@/components/public/navbar"
import { PublicFooter } from "@/components/public/footer"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicNavbar />
      <main className="flex-1 bg-background">{children}</main>
      <PublicFooter />
    </div>
  )
}
