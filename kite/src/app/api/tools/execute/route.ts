import { NextRequest, NextResponse } from 'next/server';
import { GPTOSSToolCaller } from '@/backend/toolCalling';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, parameters } = body;

    if (!tool || typeof tool !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Tool name is required and must be a string' },
        { status: 400 }
      );
    }

    if (!parameters || typeof parameters !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Parameters are required and must be an object' },
        { status: 400 }
      );
    }

    // Initialize the tool caller
    const toolCaller = new GPTOSSToolCaller();

    // Execute the tool
    const result = await toolCaller.executeTool(tool, parameters);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Tool execution error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}
