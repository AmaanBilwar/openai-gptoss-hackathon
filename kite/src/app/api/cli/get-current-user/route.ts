import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ 
        success: false,
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    console.log('Getting current user ID:', userId);
    
    return NextResponse.json({ 
      success: true, 
      user: {
        id: userId,
        name: "Authenticated User",
        type: "authenticated"
      }
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get current user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
