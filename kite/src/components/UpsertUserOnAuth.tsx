"use client";

import React from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Upserts the current Clerk user into Convex after login.
 * Runs only when:
 * - Clerk is loaded and signed in
 * - The Convex user doesn't exist yet (query returns null, not undefined/loading)
 */
export default function UpsertUserOnAuth() {
  const { isLoaded, isSignedIn, user } = useUser();
  const currentUser = useQuery(api.users.getCurrentUser);
  const upsertUser = useMutation(api.users.upsertUser);

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    // undefined = loading, null = not found
    if (currentUser === undefined) return;
    if (currentUser !== null) return;

    // github external account info
    const githubAccount = user?.externalAccounts?.find(
      // Clerk provider id can be 'github' or 'oauth_github' depending on SDK/version
      (account: any) => account.provider === "github" || account.provider === "oauth_github"
    );
    // Prefer GitHub fields when present, fall back to Clerk profile
    const name =
      githubAccount?.username ||
      user?.fullName ||
      user?.firstName ||
      user?.username ||
      "Unknown";
    const email =
      (githubAccount as any)?.emailAddress ||
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      "";
    const avatar =
      (githubAccount as any)?.imageUrl ||
      user?.imageUrl;
    console.log("Upserting user into Convex", {
      provider: githubAccount?.provider,
      name,
      email,
      avatar,
    });

    upsertUser({ name, email, avatar }).catch((err) => {
      // Best-effort logging; avoid throwing in effect
      console.error("Failed to upsert user into Convex:", err);
    });
  }, [isLoaded, isSignedIn, user, currentUser, upsertUser]);

  return null;
}
