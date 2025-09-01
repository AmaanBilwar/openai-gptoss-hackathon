import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { TokenStore } from '../../../../backend/tokenStore';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json({ error: 'Convex token is required' }, { status: 400 });
    }

    // Save the Convex token using TokenStore
    const tokenStore = new TokenStore();
    await tokenStore.saveConvexToken(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving Convex token:', error);
    return NextResponse.json(
      { error: 'Failed to save Convex token' }, 
      { status: 500 }
    );
  }
}
