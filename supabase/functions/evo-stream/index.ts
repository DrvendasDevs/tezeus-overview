import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PUBLIC_APP_URL = Deno.env.get('PUBLIC_APP_URL');

const corsHeaders = {
  'Access-Control-Allow-Origin': PUBLIC_APP_URL || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Access global SSE connections from webhook function
declare const globalThis: {
  sseConnections?: Map<string, any[]>;
  broadcastToInstance?: (instance: string, event: string, data: any) => void;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const instance = url.searchParams.get('instance');
  
  if (!instance) {
    return new Response(JSON.stringify({ error: 'Instance parameter required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`Starting SSE stream for instance: ${instance}`);

  // Initialize global SSE connections if not exists
  if (!globalThis.sseConnections) {
    globalThis.sseConnections = new Map();
  }

  const sseConnections = globalThis.sseConnections;

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Add this connection to the instance connections
      if (!sseConnections.has(instance)) {
        sseConnections.set(instance, []);
      }
      
      const connections = sseConnections.get(instance)!;
      const connectionId = Date.now() + Math.random();
      const connection = { id: connectionId, controller, cleanup: undefined as any };
      connections.push(connection);

      console.log(`SSE connection ${connectionId} added for instance ${instance}. Total: ${connections.length}`);

      // Send initial connection message
      try {
        controller.enqueue(`event: connected\ndata: ${JSON.stringify({ instance, timestamp: Date.now() })}\n\n`);
      } catch (error) {
        console.error('Error sending initial message:', error);
      }

      // Setup keep-alive ping every 15 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(`event: ping\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
        } catch (error) {
          console.error('Error sending keep-alive:', error);
          clearInterval(keepAlive);
        }
      }, 15000);

      // Cleanup on stream close
      const cleanup = () => {
        clearInterval(keepAlive);
        const connections = sseConnections.get(instance) || [];
        const index = connections.findIndex(conn => conn.id === connectionId);
        if (index > -1) {
          connections.splice(index, 1);
          console.log(`SSE connection ${connectionId} removed for instance ${instance}. Remaining: ${connections.length}`);
        }
      };

      // Handle stream abort/close
      const abortController = new AbortController();
      abortController.signal.addEventListener('abort', cleanup);
      
      // Store cleanup function for later use
      connection.cleanup = cleanup;
    },
    
    cancel() {
      console.log(`SSE stream cancelled for instance: ${instance}`);
    }
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
});
