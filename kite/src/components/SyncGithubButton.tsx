"use client";

import React from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function SyncGithubButton() {
  const addRepo = useMutation(api.repositories.addRepository);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const onSync = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/github/sync");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Sync failed with status ${res.status}`);
      }
      const { me, repos, reposCount, tokenUsed, avatar_url, bio, followers, following, location } = await res.json();

        console.log("GitHub user:", me);
        console.log("GitHub token used:", tokenUsed);
        console.log("GitHub avatar URL:", avatar_url);
        console.log("GitHub repos count:", reposCount);
        console.log("GitHub bio:", bio);
        console.log("GitHub followers:", followers);
        console.log("GitHub following:", following);
        console.log("GitHub location:", location);

      // Save repos to Convex (idempotent via mutation check)
      const promises: Promise<any>[] = [];
      for (const r of repos as any[]) {
        promises.push(
          addRepo({
            name: r.name,
            fullName: r.full_name,
            url: r.html_url,
            description: r.description ?? undefined,
            isPrivate: !!r.private,
          })
        );
      }
      await Promise.allSettled(promises);
      setMessage(`Synced ${repos.length} repositories for @${me.login}.`);
    } catch (e: any) {
      setMessage(e.message || "Sync failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onSync}
        disabled={loading}
        className="bg-black text-white px-4 py-2 rounded-md disabled:opacity-60"
      >
        {loading ? "Syncing GitHub…" : "Sync GitHub"}
      </button>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
