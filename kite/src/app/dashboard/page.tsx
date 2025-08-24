"use client";

import React from "react";
import { useUser, SignOutButton } from "@clerk/nextjs";

export default function DashboardPage() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading…</div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">
          You must be signed in to view the dashboard.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-gray-700">
        Welcome, {user.firstName || user.primaryEmailAddress?.emailAddress}
      </p>
      {/* GitHub sync now runs automatically after authentication */}
      <SignOutButton>
        <button className="bg-gray-800 hover:bg-gray-700 cursor-pointer text-white px-6 py-3 rounded-lg font-medium transition-colors">
          Sign Out
        </button>
      </SignOutButton>
    </main>
  );
}
