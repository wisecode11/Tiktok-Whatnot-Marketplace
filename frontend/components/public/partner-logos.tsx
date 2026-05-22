import { cn } from "@/lib/utils"

const partners = [
  {
    name: "TikTok",
    subtitle: "Live streaming & engagement",
    bg: "bg-[#FFF0F5]",
    border: "border-[#F8BBD0]",
    logo: (
      <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden>
        <rect width="40" height="40" rx="8" fill="#010101" />
        <path
          fill="#25F4EE"
          d="M25 11v5.2a5.6 5.6 0 0 0-3.8-1.5v9.7A7 7 0 1 1 9 17.7a7 7 0 0 0 1.2.1v4a3 3 0 1 0 2.1 2.8V11H25z"
          transform="translate(1.2,0.8)"
        />
        <path
          fill="#FE2C55"
          d="M25 11v5.2a5.6 5.6 0 0 0-3.8-1.5v9.7A7 7 0 1 1 9 17.7a7 7 0 0 0 1.2.1v4a3 3 0 1 0 2.1 2.8V11H25z"
          transform="translate(-1.2,-0.8)"
        />
        <path
          fill="#fff"
          d="M23.8 11v5.2a5.6 5.6 0 0 0-3.8-1.5v9.7A7 7 0 1 1 7.8 17.7a7 7 0 0 0 1.2.1v4a3 3 0 1 0 2.1 2.8V11h12.7z"
        />
      </svg>
    ),
  },
  {
    name: "Whatnot",
    subtitle: "Live selling & auctions",
    bg: "bg-[#FFFDE7]",
    border: "border-[#FFE082]",
    logo: (
      <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden>
        <circle cx="20" cy="20" r="20" fill="#0a0a0a" />
        <circle cx="20" cy="20" r="11" fill="#FFE500" />
        <path
          fill="#0a0a0a"
          d="M14.4 15h2.8l1.5 5.3 1.5-5.3h2.6l-2.6 9.2h-2.5l-1.6-5.7-1.6 5.7h-2.4l-2.7-9.2zm8.8 0h4c2 0 3.3 1.1 3.3 3 0 1.5-.8 2.5-2.1 2.9l2.2 3.4h-2.6l-1.9-3h-1v3h-2.2V15zm2.2 1.8v2.4h1.6c.8 0 1.3-.4 1.3-1.2 0-.8-.5-1.2-1.3-1.2h-1.6z"
        />
      </svg>
    ),
  },
  {
    name: "QuickBooks",
    subtitle: "Accounting & finance sync",
    bg: "bg-[#E8F5E9]",
    border: "border-[#81C784]",
    logo: (
      <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden>
        <rect width="40" height="40" rx="8" fill="#2CA01C" />
        <circle cx="20" cy="20" r="9" fill="#fff" />
        <path
          fill="#2CA01C"
          d="M16 26.5V13.5h2.8c2.2 0 3.5 1.2 3.5 3 0 1.3-.7 2.2-1.7 2.6l2.2 3.6h-2.1l-2-3.2h-1.5v3.2H16zm2 5.5h1.1c1.2 0 1.8-.6 1.8-1.5 0-.9-.6-1.5-1.8-1.5h-1.1v3zm7.2-9h3.8c1.9 0 3.2 1 3.2 2.8 0 1.4-.8 2.4-2 2.8l2.2 3.4h-2.4l-2-3.1h-1v3.1h-2.1v-9z"
        />
      </svg>
    ),
  },
] as const

export function PartnerLogos() {
  return (
    <section className="relative border-y border-border bg-background py-10 md:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Seamlessly integrated with
        </p>

        <div className="grid gap-5 md:grid-cols-3 md:gap-6">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className={cn(
                "flex flex-col rounded-2xl border-2 px-6 py-5 transition-shadow duration-300 hover:shadow-md md:px-7 md:py-6",
                partner.bg,
                partner.border,
              )}
            >
              <div className="flex items-center gap-3">
                {partner.logo}
                <h3 className="text-xl font-bold text-foreground">{partner.name}</h3>
              </div>

              <p className="mt-2.5 text-base text-foreground/90">{partner.subtitle}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
