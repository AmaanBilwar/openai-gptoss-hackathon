import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Checking GitHub connection for user:', userId);

    // Get user details to see connected accounts
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    
    console.log('User external accounts:', user.externalAccounts);
    
    // Check if GitHub is connected
    const githubAccount = user.externalAccounts?.find(account => account.provider === 'github');
    
    if (githubAccount) {
      console.log('GitHub account found:', {
        id: githubAccount.id,
        provider: githubAccount.provider,
      });
      
      return NextResponse.json({ 
        connected: true, 
        account: {
          id: githubAccount.id,
          provider: githubAccount.provider,
        }
      });
    } else {
      console.log("No GitHub account connected");
      return NextResponse.json({ 
        connected: false,
        message: "GitHub account not connected to Clerk"
      });
    }
  } catch (error) {
    console.error('Error checking GitHub connection:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check GitHub connection',
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    );
  }
}
