import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub({
      profile(githubProfile, tokens) {
        return {
          id: githubProfile.id.toString(),
          name: githubProfile.name,
          email: githubProfile.email,
          image: githubProfile.picture as string | null,
        };
      },
    }),
  ],
  callbacks: {
    async redirect({ redirectTo }) {
      // Allow localhost and your Convex deployment
      if (
        redirectTo === "http://localhost:3000" ||
        redirectTo === "http://localhost:3000/" ||
        redirectTo === "https://merry-heron-559.convex.cloud" ||
        redirectTo === "https://merry-heron-559.convex.cloud/"
      ) {
        return redirectTo;
      }
      // Default fallback
      return "http://localhost:3000";
    },
  },
});

// Get current authenticated user
export const getUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    return identity;
  },
});
