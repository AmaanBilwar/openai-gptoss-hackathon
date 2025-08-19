import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Getting OAuth tokens for user:', userId);

    // Use Clerk server client to fetch the user's GitHub OAuth access token
    const client = await clerkClient();
    // Provider name should be 'github' (without oauth_ prefix per Clerk deprecation notice)
    const tokens = await client.users.getUserOauthAccessToken(userId, "github");
    const token = tokens?.data?.[0]?.token;
    
    console.log('OAuth tokens response:', tokens);
    
    if (token) {
      console.log('Found GitHub token, length:', token.length);
      return NextResponse.json({ token });
    } else {
      console.log('No GitHub OAuth tokens found for user');
      return NextResponse.json({ 
        error: 'GitHub OAuth token not found',
        details: 'User has not connected their GitHub account to Clerk'
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Error getting GitHub token:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get GitHub token',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
