import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { Octokit } from "@octokit/rest";

export async function GET(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Use Clerk server client to fetch the user's GitHub OAuth access token
  const client = await clerkClient();
  // Provider name should be 'github' (without oauth_ prefix per Clerk deprecation notice)
  const tokens = await client.users.getUserOauthAccessToken(userId, "github");
  const token = tokens?.data?.[0]?.token;
  // Do not log or expose the raw token

  if (!token) {
    return NextResponse.json(
      { error: "No GitHub access token available from Clerk. Ensure OAuth is configured to return access tokens and that 'repo' scope is granted." },
      { status: 400 }
    );
  }
  const octokit = new Octokit({ auth: token, userAgent: "kite-web" });

  // Get authenticated user info
  const { data: me } = await octokit.rest.users.getAuthenticated();

  // Get repositories for the authenticated user
  const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
    per_page: 100,
    sort: "updated"
  });

  // Get bio and location from 'me' object
  const bio = me.bio || null;
  const location = me.location || null;
  const avatar_url = me.avatar_url || null;


  // Get followers and following lists
  const { data: followers } = await octokit.rest.users.listFollowersForUser({
    username: me.login
  });
  const { data: following } = await octokit.rest.users.listFollowingForUser({
    username: me.login
  });

    return NextResponse.json({
      me,
      reposCount: repos.length,
      repos,
      bio,
      followersCount: followers.length,
      followingCount: following.length,
      avatar_url,
      githubUsername: me.login,
      location,
    });
  }
