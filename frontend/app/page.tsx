"use client";

import {
  Authenticated,
  Unauthenticated,
  useQuery,
  useMutation,
} from "convex/react";
import { api } from "../convex/_generated/api";
import { UserButton, useUser, useSignIn } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            <h1 className="text-base font-semibold text-slate-900 tracking-tight">App</h1>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-16">
        <Authenticated>
          <AuthenticatedContent />
        </Authenticated>
        <Unauthenticated>
          <UnauthenticatedContent />
        </Unauthenticated>
      </main>
    </div>
  );
}

function UnauthenticatedContent() {
  const { isLoaded, signIn } = useSignIn();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGithubSignIn = async () => {
    if (!isLoaded || isRedirecting) return;
    setError(null);
    setIsRedirecting(true);
    try {
      await signIn?.authenticateWithRedirect({
        strategy: "oauth_github",
        redirectUrl: "/",
        redirectUrlComplete: "/",
      });
      // Control passes to OAuth provider.
    } catch {
      setIsRedirecting(false);
      setError("Unable to start GitHub sign-in. Please try again.");
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-slate-900">Welcome</h2>
          <p className="text-slate-600 mt-1">Sign in to continue</p>
        </div>

        <button
          onClick={handleGithubSignIn}
          disabled={!isLoaded || isRedirecting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-900 text-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M12 0C5.37 0 0 5.37 0 12a12 12 0 008.205 11.387c.6.111.82-.258.82-.577 0-.285-.011-1.04-.017-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.388-1.334-1.758-1.334-1.758-1.091-.746.083-.73.083-.73 1.206.085 1.84 1.238 1.84 1.238 1.073 1.839 2.814 1.307 3.5.999.108-.777.42-1.307.763-1.607-2.665-.305-5.466-1.333-5.466-5.93 0-1.31.469-2.381 1.237-3.221-.124-.304-.536-1.53.117-3.187 0 0 1.008-.322 3.3 1.23A11.5 11.5 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.296-1.23 3.296-1.23.655 1.657.243 2.883.119 3.187.77.84 1.235 1.911 1.235 3.221 0 4.61-2.805 5.624-5.476 5.921.431.372.816 1.102.816 2.223 0 1.606-.015 2.9-.015 3.294 0 .321.216.694.826.576A12.004 12.004 0 0024 12c0-6.63-5.37-12-12-12z" clipRule="evenodd" />
          </svg>
          {isRedirecting ? "Redirecting…" : "Continue with GitHub"}
        </button>

        {error && (
          <p className="mt-3 text-sm text-red-600 text-center" role="alert">
            {error}
          </p>
        )}

        <p className="text-xs text-center text-slate-500 mt-6">
          By continuing, you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

function AuthenticatedContent() {
  const { user } = useUser();
  const currentUser = useQuery(api.myFunctions.getCurrentUser);
  const upsertUser = useMutation(api.myFunctions.upsertUser);

  useEffect(() => {
    if (user && !currentUser) {
      upsertUser({
        name: user.fullName || user.username || "Unknown User",
        email: user.primaryEmailAddress?.emailAddress || "",
        avatar: user.imageUrl,
      });
    }
  }, [user, currentUser, upsertUser]);

  if (currentUser === undefined) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
        <p className="mt-2 text-slate-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center gap-4">
          {user?.imageUrl && (
            <img src={user.imageUrl} alt="" className="h-12 w-12 rounded-full" />
          )}
          <div>
            <p className="text-sm text-slate-600">Signed in as</p>
            <h2 className="text-lg font-semibold text-slate-900">
              {user?.fullName || user?.username}
            </h2>
          </div>
        </div>

        {currentUser && (
          <div className="mt-4 rounded-md bg-slate-50 border p-3 text-sm text-slate-700">
            Profile saved in Convex with id: {currentUser._id}
          </div>
        )}
      </div>
    </div>
  );
}
