import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isAdminRoute = createRouteMatcher(["/admin(.*)"])
const isProtectedAppRoute = createRouteMatcher(["/seller(.*)", "/staff(.*)", "/moderator(.*)", "/launch-pad(.*)"])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()

  if (!userId && isAdminRoute(req)) {
    return NextResponse.redirect(new URL("/admin-login", req.url))
  }

  if (!userId && isProtectedAppRoute(req)) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
