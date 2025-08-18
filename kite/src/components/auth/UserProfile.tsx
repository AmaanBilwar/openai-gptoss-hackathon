import { Button } from "@/components/ui/button";
import { useConvexAuth } from "@/lib/use-convex-auth";

export function UserProfile() {
  const { user, session, signOut, loading } = useConvexAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !session) {
    return null;
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center space-x-4 mb-4">
        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
          <span className="text-lg font-semibold">
            {user.username?.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <h2 className="text-xl font-semibold">{user.username}</h2>
          <p className="text-gray-600">{user.email}</p>
        </div>
      </div>
      
      {user.githubUsername && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">GitHub Information</h3>
          <div className="space-y-1 text-sm">
            <p><span className="font-medium">Username:</span> {user.githubUsername}</p>
            <p><span className="font-medium">GitHub ID:</span> {user.githubId}</p>
            <p><span className="font-medium">GitHub Email:</span> {user.githubEmail}</p>
            {user.githubAccessToken && (
              <p><span className="font-medium">Access Token:</span> 
                <span className="text-green-600 ml-1">✓ Available</span>
              </p>
            )}
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Member since {new Date(user.createdAt).toLocaleDateString()}
        </div>
        <Button 
          onClick={signOut}
          variant="outline"
          size="sm"
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}
