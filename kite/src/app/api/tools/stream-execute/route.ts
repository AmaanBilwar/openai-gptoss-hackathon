import { NextRequest, NextResponse } from 'next/server';
import { GPTOSSToolCaller } from '@/backend/toolCalling';
import { IntelligentCommitSplitter } from '@/backend/intelligentCommitSplitter';

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

    // Only support intelligent_commit_split for streaming
    if (tool !== 'intelligent_commit_split') {
      return NextResponse.json(
        { success: false, error: 'Only intelligent_commit_split tool supports streaming' },
        { status: 400 }
      );
    }

    // Create a readable stream for real-time progress updates
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        
        // Send initial message
        controller.enqueue(encoder.encode('data: {"type":"start","message":"Starting intelligent commit splitting..."}\n\n'));

        // Execute the intelligent commit split with streaming progress
        executeIntelligentCommitSplitWithStreaming(parameters, controller, encoder)
          .then((result) => {
            // Send final result
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`));
            controller.close();
          })
          .catch((error) => {
            // Send error
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`));
            controller.close();
          });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    console.error('Streaming tool execution error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

async function executeIntelligentCommitSplitWithStreaming(
  parameters: Record<string, any>,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  const commitMessage = parameters.commit_message;
  const branch = parameters.branch || null;
  const files = parameters.files || null;
  const autoPush = parameters.auto_push || false;
  const dryRun = parameters.dry_run || false;
  const forceIntelligentSplit = parameters.force_intelligent_split || false;

  // Get Cerebras API key
  const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
  if (!cerebrasApiKey) {
    throw new Error('CEREBRAS_API_KEY environment variable not set');
  }

  // Create progress callback that streams messages
  const progressCallback = (message: string, type?: 'info' | 'success' | 'warning' | 'error') => {
    const progressData = {
      type: 'progress',
      message: message,
      messageType: type || 'info'
    };
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`));
  };

  const splitter = new IntelligentCommitSplitter(cerebrasApiKey, progressCallback);
  
  if (dryRun) {
    const commitGroups = await splitter.runIntelligentSplitting(false);
    return {
      success: true,
      dry_run: true,
      commit_groups_count: commitGroups.length,
      commit_groups: commitGroups.map(group => ({
        feature_name: group.feature_name,
        commit_title: group.commit_title,
        commit_message: group.commit_message,
        files: group.files.map(f => f.file_path)
      })),
      message: `Analysis complete! Found ${commitGroups.length} logical commit groups. No commits were created (dry run mode).`
    };
  } else {
    const commitGroups = await splitter.runIntelligentSplitting(autoPush);
    return {
      success: true,
      action: 'intelligent_split',
      auto_push: autoPush,
      commit_groups_count: commitGroups.length,
      commit_groups: commitGroups.map(group => ({
        feature_name: group.feature_name,
        commit_title: group.commit_title,
        commit_message: group.commit_message,
        files: group.files.map(f => f.file_path)
      })),
      message: `Successfully created ${commitGroups.length} logical commits${autoPush ? ' and pushed to remote' : ''}`
    };
  }
}
