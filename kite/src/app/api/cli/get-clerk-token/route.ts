import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Getting Clerk JWT token for user:', userId);

    // Get the JWT token for Convex authentication
    const token = await getToken({ template: "convex" });
    
    if (token) {
      console.log('Found Clerk JWT token, length:', token.length);
      return NextResponse.json({ token });
    } else {
      console.log('No Clerk JWT token found for user');
      return NextResponse.json({ 
        error: 'Clerk JWT token not found',
        details: 'User is not properly authenticated with Clerk'
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Error getting Clerk JWT token:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get Clerk JWT token',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
