"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

export default function CLIAuthSuccessPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCLIAuth = async () => {
      if (!isLoaded || !isSignedIn) return;

      try {
        // Get the GitHub OAuth token from Clerk using the backend API
        const response = await fetch("/api/cli/get-github-token", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.details || errorData.error || "Failed to get GitHub token"
          );
        }

        const { token } = await response.json();

        if (token) {
          // Save the token locally for CLI use
          const saveResponse = await fetch("/api/cli/save-token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token }),
          });

          if (!saveResponse.ok) {
            throw new Error("Failed to save token");
          }

          setIsProcessing(false);
        } else {
          setError(
            "GitHub OAuth token not found. This usually means your GitHub account is not connected to Clerk. Please visit the debug page to check your connection status."
          );
        }
      } catch (err) {
        console.error("Error processing CLI auth:", err);
        setError("Failed to process authentication. Please try again.");
      }
    };

    processCLIAuth();
  }, [isLoaded, isSignedIn, user]);

  if (!isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">
          You must be signed in to view this page.
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">❌ {error}</div>
          <div className="space-y-2">
            <button
              onClick={() => (window.location.href = "/")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors mr-2"
            >
              Try Again
            </button>
            <button
              onClick={() => (window.location.href = "/debug-github")}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Debug GitHub Connection
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (isProcessing) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Processing authentication...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="text-green-600 text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Authentication Successful!
        </h1>
        <p className="text-gray-600 mb-6">
          You've successfully signed in to Kite CLI. You can now return to your
          terminal and continue using the CLI.
        </p>
        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <p className="text-sm text-gray-700 font-mono">bun run chat</p>
        </div>
        <p className="text-sm text-gray-500">
          Welcome, {user.firstName || user.primaryEmailAddress?.emailAddress}!
        </p>
      </div>
    </main>
  );
}
