import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

export interface User {
  _id: string;
  username: string;
  email: string;
  githubId?: string;
  githubUsername?: string;
  githubAccessToken?: string;
  githubEmail?: string;
  createdAt: number;
  updatedAt: number;
}

export function useConvexAuth() {
  const { signIn, signOut } = useAuthActions();
  
  // Get current user from Convex Auth
  const user = useQuery(api.auth.getUser);
  
  // Get additional user data from our users table
  const userData = useQuery(api.users.getCurrentUser);
  
  const isAuthenticated = !!user;
  const loading = user === undefined;

  const signInWithGitHub = async () => {
    try {
      await signIn("github");
    } catch (error) {
      console.error("GitHub sign-in error:", error);
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign-out error:", error);
      throw error;
    }
  };

  return {
    user: userData,
    session: user,
    isAuthenticated,
    loading,
    signInWithGitHub,
    signOut: handleSignOut,
  };
}
