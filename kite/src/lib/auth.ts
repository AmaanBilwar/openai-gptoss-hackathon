import { convexAdapter } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { betterAuthComponent } from "../../convex/auth";
import { type MutationCtx } from "../../convex/_generated/server.js";

export const createAuth = (ctx: MutationCtx) =>
  // Configure your Better Auth instance here
  betterAuth({
    // All auth requests will be proxied through your next.js server
    baseURL: process.env.NODE_ENV === "development" ? "http://localhost:3000" : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    database: convexAdapter(ctx, betterAuthComponent),

    // Simple non-verified email/password to get started
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    
    // Optional: Add social providers if you have credentials
    socialProviders: {
      github: { 
        clientId: process.env.GITHUB_CLIENT_ID || "", 
        clientSecret: process.env.GITHUB_CLIENT_SECRET || "", 
      }, 
    },
    
    plugins: [
      // The Convex plugin is required
      convex(),
    ],
  });