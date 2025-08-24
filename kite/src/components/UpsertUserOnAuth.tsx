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
  const addRepo = useMutation(api.repositories.addRepository);
  const syncedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    // undefined = loading, null = not found
    if (currentUser === undefined) return;
    if (syncedRef.current) return;

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

    (async () => {
      try {
        // First ensure the user exists in Convex with base info
        await upsertUser({ name, email, avatar });

        // Then fetch GitHub data from our server route and sync to Convex
        const res = await fetch("/api/github/sync");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `GitHub sync failed with status ${res.status}`);
        }
        const data = await res.json();
        const me = data.me;
        const repos: any[] = data.repos ?? [];

        // Patch user with richer GitHub profile fields
        await upsertUser({
          name,
          email,
          avatar: data.avatar_url || avatar,
          bio: data.bio || undefined,
          location: data.location || undefined,
          followers: data.followersCount ?? undefined,
          following: data.followingCount ?? undefined,
          githubUsername: data.githubUsername || me?.login || undefined,
        });

        // Save repositories (idempotent)
        await Promise.allSettled(
          repos.map((r) =>
            addRepo({
              name: r.name,
              fullName: r.full_name,
              url: r.html_url,
              description: r.description ?? undefined,
              isPrivate: !!r.private,
            })
          )
        );
      } catch (err) {
        console.error("Auth-time GitHub sync failed:", err);
      } finally {
        syncedRef.current = true;
      }
    })();
  }, [isLoaded, isSignedIn, user, currentUser, upsertUser, addRepo]);

  return null;
}
