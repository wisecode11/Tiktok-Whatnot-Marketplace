import { syncSellerActiveOrganization, waitForSessionToken } from "@/lib/auth"

export const SELLER_ORGANIZATION_SWITCHED_EVENT = "seller-organization-switched"

type SetActiveFn = (params: { organization: string; redirectUrl?: string }) => Promise<void>

function resolveOrganizationSwitchRedirectUrl(redirectUrl?: string) {
  if (redirectUrl) {
    return redirectUrl
  }

  if (typeof window === "undefined") {
    return "/seller/organization"
  }

  const path = window.location.pathname
  const search = window.location.search

  if (path.startsWith("/seller/") || path === "/seller") {
    return `${path}${search}`
  }

  return "/seller/organization"
}

/** Switch Clerk org + backend workspace without signing out or leaving the seller app. */
export async function switchSellerOrganization({
  clerkOrganizationId,
  getToken,
  setActive,
  redirectUrl,
}: {
  clerkOrganizationId: string
  getToken: () => Promise<string | null>
  setActive: SetActiveFn
  redirectUrl?: string
}) {
  const token = await waitForSessionToken(getToken)
  await syncSellerActiveOrganization(token, clerkOrganizationId)

  await setActive({
    organization: clerkOrganizationId,
    redirectUrl: resolveOrganizationSwitchRedirectUrl(redirectUrl),
  })

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SELLER_ORGANIZATION_SWITCHED_EVENT, {
        detail: { clerkOrganizationId },
      }),
    )
  }
}
