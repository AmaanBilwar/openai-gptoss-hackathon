"use client";

import React from "react";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <AuthenticateWithRedirectCallback />
    </main>
  );
}
