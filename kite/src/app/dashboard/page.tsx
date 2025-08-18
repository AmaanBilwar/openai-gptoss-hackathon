"use client";

import React from 'react';
import { useConvexAuth } from '@/lib/use-convex-auth';
import { UserProfile } from '@/components/auth/UserProfile';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user, isAuthenticated, loading } = useConvexAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Dashboard
            </h1>
            <p className="text-gray-600">
              Welcome back, {user?.username || 'User'}!
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <UserProfile />
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">GitHub Access</h2>
              {user?.githubAccessToken ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="font-medium text-green-800 mb-2">
                      ✓ GitHub Access Granted
                    </h3>
                    <p className="text-sm text-green-700">
                      You have read and write access to your GitHub repositories.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-800">Available Actions:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Read your repositories</li>
                      <li>• Create new repositories</li>
                      <li>• Push code changes</li>
                      <li>• Manage issues and pull requests</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h3 className="font-medium text-yellow-800 mb-2">
                    ⚠️ GitHub Access Required
                  </h3>
                  <p className="text-sm text-yellow-700">
                    Please sign in with GitHub to access repository features.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
