"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

export default function DebugGitHubPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkGitHubConnection = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/cli/check-github-connection");
      const data = await response.json();
      setConnectionStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const testGitHubToken = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/cli/get-github-token");
      const data = await response.json();
      setConnectionStatus({ tokenTest: data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      checkGitHubConnection();
    }
  }, [isLoaded, isSignedIn]);

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

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">GitHub OAuth Debug</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Information</h2>
          <div className="space-y-2">
            <p>
              <strong>User ID:</strong> {user.id}
            </p>
            <p>
              <strong>Email:</strong> {user.primaryEmailAddress?.emailAddress}
            </p>
            <p>
              <strong>Name:</strong> {user.firstName} {user.lastName}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            GitHub Connection Status
          </h2>

          <div className="space-y-4">
            <button
              onClick={checkGitHubConnection}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded"
            >
              {loading ? "Checking..." : "Check GitHub Connection"}
            </button>

            <button
              onClick={testGitHubToken}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded ml-2"
            >
              {loading ? "Testing..." : "Test GitHub Token"}
            </button>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <strong>Error:</strong> {error}
              </div>
            )}

            {connectionStatus && (
              <div className="bg-gray-100 p-4 rounded">
                <h3 className="font-semibold mb-2">Status:</h3>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(connectionStatus, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Troubleshooting</h2>
          <div className="space-y-2 text-sm">
            <p>
              • If GitHub is not connected, you need to sign in with GitHub
              first
            </p>
            <p>
              • Make sure GitHub OAuth is configured in your Clerk dashboard
            </p>
            <p>
              • Check that the GitHub OAuth app has the correct redirect URLs
            </p>
            <p>• Verify that the user has authorized the GitHub OAuth app</p>
          </div>
        </div>
      </div>
    </main>
  );
}
