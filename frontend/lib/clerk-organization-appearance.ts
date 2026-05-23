import type { Appearance } from "@clerk/types"

const clerkOrgElements = {
  rootBox: "w-full",
  cardBox: "w-full shadow-none",
  card: "w-full max-w-none border-0 bg-transparent shadow-none",
  navbar: "rounded-xl border border-border/60 bg-muted/25 p-2 gap-1",
  navbarButton:
    "rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground",
  navbarButtonIcon: "text-muted-foreground",
  pageScrollBox: "px-0 md:px-2",
  headerTitle: "text-xl font-semibold tracking-tight text-foreground",
  headerSubtitle: "text-sm text-muted-foreground",
  profileSection: "rounded-xl border border-border/60 bg-background/90 shadow-sm overflow-hidden",
  profileSectionTitle: "text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground px-5 pt-4",
  profileSectionContent: "px-5 pb-4",
  profileSectionPrimaryButton:
    "text-sm font-semibold text-primary hover:text-primary/90 transition-colors",
  profileSectionDangerButton:
    "text-sm font-semibold text-destructive hover:text-destructive/90 transition-colors",
  accordionTriggerButton:
    "rounded-lg border border-border/60 bg-muted/20 px-4 py-3 hover:bg-muted/40 transition-colors",
  formButtonPrimary:
    "rounded-lg bg-primary text-primary-foreground font-semibold shadow-[0_12px_28px_-18px_var(--color-primary)] hover:opacity-95",
  formButtonReset: "rounded-lg border border-border bg-background text-foreground hover:bg-muted",
  formFieldInput:
    "rounded-lg border border-border bg-background text-foreground shadow-none focus:ring-2 focus:ring-ring",
  formFieldLabel: "text-sm font-medium text-foreground",
  tableHead: "text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground",
  badge:
    "rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-medium",
  footer: "hidden",
  footerAction: "hidden",
  footerActionLink: "hidden",
} as const

export const sellerClerkOrganizationAppearance: Appearance = {
  variables: {
    colorPrimary: "oklch(0.61 0.24 283)",
    colorDanger: "oklch(0.61 0.24 24)",
    colorSuccess: "oklch(0.65 0.18 155)",
    colorWarning: "oklch(0.75 0.15 85)",
    colorNeutral: "oklch(0.57 0.015 278)",
    borderRadius: "0.75rem",
    fontSize: "0.875rem",
  },
  elements: clerkOrgElements,
}

export const sellerClerkCreateOrganizationAppearance: Appearance = {
  ...sellerClerkOrganizationAppearance,
  elements: {
    ...clerkOrgElements,
    headerTitle: "text-2xl font-bold tracking-tight text-foreground",
    headerSubtitle: "text-sm text-muted-foreground max-w-md",
  },
}
