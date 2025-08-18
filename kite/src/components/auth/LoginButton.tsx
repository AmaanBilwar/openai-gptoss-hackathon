import { Button } from "@/components/ui/button";
import { useConvexAuth } from "@/lib/use-convex-auth";

export function LoginButton() {
  const { signInWithGitHub, loading } = useConvexAuth();

  const handleGitHubLogin = async () => {
    try {
      await signInWithGitHub();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <Button 
      onClick={handleGitHubLogin} 
      disabled={loading}
      className="w-full"
    >
      {loading ? "Loading..." : "Sign in with GitHub"}
    </Button>
  );
}
