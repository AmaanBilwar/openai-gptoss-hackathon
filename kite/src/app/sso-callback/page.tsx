"use client";

import React, { useEffect } from "react";
import { AuthenticateWithRedirectCallback, useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";

export default function SSOCallbackPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      // Check if this was a CLI-initiated auth
      const fromCLI = searchParams.get('from_cli') === 'true';
      
      if (fromCLI) {
        // Redirect to CLI auth success page
        router.replace('/cli-auth-success');
      } else {
        // Normal web flow - redirect to dashboard
        router.replace('/dashboard');
      }
    }
  }, [isLoaded, isSignedIn, router, searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <AuthenticateWithRedirectCallback />
    </main>
  );
}
