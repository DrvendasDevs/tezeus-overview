import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RagWebhookBody = {
  workspace_id: string;
  agent_id: string;
  knowledge_file_id: string;
  text: string;
  file_name?: string | null;
  file_path?: string | null;
};

const N8N_RAG_URL = "https://n8n-n8n.upvzfg.easypanel.host/webhook/rag";

serve(async (req) => {
  const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Partial<RagWebhookBody>;

    const workspaceId = body.workspace_id;
    const agentId = body.agent_id;
    const knowledgeFileId = body.knowledge_file_id;
    const text = body.text;

    if (!workspaceId || !agentId || !knowledgeFileId || !text) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Parâmetros inválidos. Envie workspace_id, agent_id, knowledge_file_id e text.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🧠 [${requestId}] RAG webhook start`, {
      workspace_id: workspaceId,
      agent_id: agentId,
      knowledge_file_id: knowledgeFileId,
      text_length: String(text).length,
      file_name: body.file_name ?? null,
      file_path: body.file_path ?? null,
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: docRow, error: insertError } = await supabase
      .from("documents_base")
      .insert({
        text,
        metadata: {
          workspace_id: workspaceId,
          agent_id: agentId,
          knowledge_file_id: knowledgeFileId,
          file_name: body.file_name ?? null,
          file_path: body.file_path ?? null,
          source: "ai_agent_knowledge",
        },
      })
      .select("id")
      .single();

    if (insertError) {
      console.error(`❌ [${requestId}] Failed to insert documents_base`, insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message || String(insertError) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ [${requestId}] documents_base inserted`, { documents_base_id: docRow.id });

    // Disparar webhook no N8N (hardcoded)
    let n8nStatus: number | null = null;
    let n8nBody: string | null = null;

    try {
      const n8nRes = await fetch(N8N_RAG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledge_file_id: knowledgeFileId,
          workspace_id: workspaceId,
          agent_id: agentId,
          // opcional (debug/correlação)
          documents_base_id: docRow.id,
        }),
      });

      n8nStatus = n8nRes.status;
      n8nBody = await n8nRes.text().catch(() => null);

      if (!n8nRes.ok) {
        console.error(`❌ [${requestId}] N8N webhook failed`, { n8nStatus, n8nBody });
      } else {
        console.log(`✅ [${requestId}] N8N webhook ok`, { n8nStatus });
      }
    } catch (e) {
      console.error(`❌ [${requestId}] N8N webhook error`, e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        knowledge_file_id: knowledgeFileId,
        documents_base_id: docRow.id,
        n8n_status: n8nStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`❌ [${requestId}] Error in rag-webhook`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


