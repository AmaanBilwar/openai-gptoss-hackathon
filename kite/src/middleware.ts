import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Authentication middleware for Kite application
 * 
 * Public routes:
 * - "/" - Landing/login page (redirects authenticated users to dashboard)
 * - "/sign-in" - Clerk sign-in pages
 * - "/sign-up" - Clerk sign-up pages  
 * - "/sso-callback" - OAuth callback from GitHub/other providers
 * - "/cli-auth-success" - CLI authentication success page
 * 
 * Protected routes:
 * - "/dashboard" and all sub-routes - Main application dashboard
 * - "/debug-github" - GitHub debug page
 * - "/api" routes - Protected by individual route handlers
 * 
 * Behavior:
 * - Unauthenticated users accessing protected routes → Redirect to "/"
 * - Authenticated users accessing "/" → Redirect to "/dashboard" (unless from CLI)
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)", // Clerk OAuth callback must be public
  "/cli-auth-success(.*)", // CLI auth success page
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();
  const url = request.nextUrl;
  
  // If it's a protected route and user is not authenticated
  if (!isPublicRoute(request) && !userId) {
    // Redirect to root page for authentication
    return NextResponse.redirect(new URL("/", request.url));
  }
  
  // If user is authenticated and tries to access root, redirect to dashboard
  // BUT preserve CLI auth flow by checking for from_cli parameter
  if (isPublicRoute(request) && userId && url.pathname === "/") {
    const fromCLI = url.searchParams.get("from_cli");
    if (fromCLI === "true") {
      // Let the client-side handle CLI auth flow
      return;
    }
    // Otherwise redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
