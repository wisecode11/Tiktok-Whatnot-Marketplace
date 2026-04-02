import Link from "next/link"

import { BrandLogo } from "@/components/brand-logo"
import { BRAND_NAME } from "@/lib/brand"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-10rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl dark:bg-primary/18" />
        <div className="absolute bottom-[-12rem] right-[-8rem] h-[22rem] w-[22rem] rounded-full bg-accent/10 blur-3xl dark:bg-accent/18" />
        <div className="absolute left-[-6rem] top-1/3 h-[18rem] w-[18rem] rounded-full bg-sky-400/8 blur-3xl dark:bg-sky-500/10" />
        <div
          className="absolute inset-0 opacity-[0.7] dark:opacity-[0.08]"
          style={{
            backgroundImage: `linear-gradient(rgba(95, 99, 255, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(95, 99, 255, 0.06) 1px, transparent 1px)`,
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(circle at center, black 35%, transparent 88%)",
          }}
        />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <BrandLogo
          href="/"
          className="transition-opacity hover:opacity-80"
          textClassName="text-sm font-semibold tracking-[0.24em] text-muted-foreground uppercase"
        />

        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10 pt-2 sm:px-6">
        {children}
      </main>

      <footer className="relative z-10 px-6 pb-6 pt-2 text-center text-sm text-muted-foreground sm:px-10">
        <div className="flex items-center justify-center gap-6">
          <span>&copy; {new Date().getFullYear()} {BRAND_NAME}</span>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
        </div>
      </footer>
    </div>
  )
}
