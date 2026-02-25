import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: trigger-funnel-lab
 * 
 * Dispara um funil/campanha específico no chat do Laboratório (painel master).
 * Similar ao trigger-funnel, mas em vez de enviar via WhatsApp, insere diretamente
 * na tabela lab_messages para aparecer no chat do Lab.
 * 
 * Endpoint: POST /functions/v1/trigger-funnel-lab
 * 
 * Headers:
 *   - x-api-key: Chave de API do workspace (obrigatório para autenticação)
 *   - Content-Type: application/json
 * 
 * Body:
 *   {
 *     "workspace_id": "uuid-do-workspace",
 *     "session_id": "uuid-da-sessao-lab",
 *     "funnel_id": "uuid-do-funil"
 *   }
 * 
 * Resposta de sucesso:
 *   {
 *     "success": true,
 *     "message": "Funil disparado no Lab",
 *     "funnel": { ... },
 *     "session_id": "...",
 *     "steps_total": 3,
 *     "steps_sent": 3,
 *     "triggered_at": "2026-02-04T00:00:00.000Z"
 *   }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-workspace-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Obter dados do body
    let body: {
      workspace_id?: string;
      session_id?: string;
      funnel_id?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Body inválido. Envie JSON com workspace_id, session_id e funnel_id." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const workspaceId = body.workspace_id;
    const sessionId = body.session_id;
    const funnelId = body.funnel_id;

    // Validar campos obrigatórios
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ success: false, error: "workspace_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sessionId) {
      return new Response(
        JSON.stringify({ success: false, error: "session_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!funnelId) {
      return new Response(
        JSON.stringify({ success: false, error: "funnel_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Autenticação via API Key do workspace
    const apiKey = req.headers.get("x-api-key");
    
    if (apiKey) {
      // Validar API key
      const { data: apiKeyData, error: apiKeyError } = await supabase
        .from("workspace_api_keys")
        .select("id, workspace_id, is_active")
        .eq("api_key", apiKey)
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .maybeSingle();

      if (apiKeyError || !apiKeyData) {
        return new Response(
          JSON.stringify({ success: false, error: "API Key inválida ou não autorizada para este workspace" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Se não tem API key, verificar secret alternativo
      const webhookSecret = req.headers.get("x-webhook-secret") || req.headers.get("x-secret");
      const configuredSecret = Deno.env.get("TRIGGER_FUNNEL_SECRET") || Deno.env.get("N8N_WEBHOOK_SECRET");
      
      if (!configuredSecret || webhookSecret !== configuredSecret) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Autenticação necessária. Envie x-api-key (API Key do workspace) ou x-webhook-secret." 
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Buscar a sessão do laboratório
    const { data: labSession, error: sessionError } = await supabase
      .from("lab_sessions")
      .select("id, workspace_id, is_active, contact_name, contact_phone")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error("[trigger-funnel-lab] Erro ao buscar sessão:", sessionError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar sessão do Lab", details: sessionError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!labSession) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão do Lab não encontrada", session_id: sessionId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!labSession.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão do Lab não está ativa", session_id: sessionId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se a sessão pertence ao workspace
    if (labSession.workspace_id !== workspaceId) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão não pertence a este workspace" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar o funil em quick_funnels
    const { data: funnel, error: funnelError } = await supabase
      .from("quick_funnels")
      .select("id, title, workspace_id, steps")
      .eq("id", funnelId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (funnelError) {
      console.error("[trigger-funnel-lab] Erro ao buscar quick_funnel:", funnelError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar funil", details: funnelError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!funnel) {
      return new Response(
        JSON.stringify({ success: false, error: "Funil não encontrado (quick_funnels)", funnel_id: funnelId, workspace_id: workspaceId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stepsRaw: any[] = Array.isArray((funnel as any).steps) ? ((funnel as any).steps as any[]) : [];
    if (stepsRaw.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Funil sem etapas (steps)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Processar steps e inserir em lab_messages
    const nowIso = new Date().toISOString();
    const sortedSteps = [...stepsRaw].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

    const results: Array<{ order: number; type: string; item_id: string; ok: boolean; error?: string }> = [];

    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];
      const normalizedType = String(step?.type || "").toLowerCase();

      let messageContent: string | null = null;

      try {
        switch (normalizedType) {
          case "message":
          case "messages":
          case "mensagens": {
            const { data: msg } = await supabase
              .from("quick_messages")
              .select("content")
              .eq("id", step.item_id)
              .maybeSingle();
            if (msg?.content) {
              messageContent = msg.content;
            }
            break;
          }
          case "audio":
          case "audios": {
            const { data: audio } = await supabase
              .from("quick_audios")
              .select("file_url, file_name, title")
              .eq("id", step.item_id)
              .maybeSingle();
            if (audio?.file_url) {
              const fileName = audio.file_name || audio.title || "audio.mp3";
              messageContent = `[ÁUDIO: ${fileName}]\n${audio.file_url}`;
            }
            break;
          }
          case "media":
          case "midias": {
            const { data: media } = await supabase
              .from("quick_media")
              .select("file_url, file_name, file_type, title")
              .eq("id", step.item_id)
              .maybeSingle();
            if (media?.file_url) {
              let mediaType = "IMAGEM";
              if (media.file_type?.startsWith("video/")) {
                mediaType = "VÍDEO";
              } else {
                const url = String(media.file_url || "").toLowerCase();
                if (url.includes(".mp4") || url.includes(".mov") || url.includes(".avi")) {
                  mediaType = "VÍDEO";
                }
              }
              const fileName = media.file_name || media.title || (mediaType === "VÍDEO" ? "video.mp4" : "imagem.jpg");
              const caption = media.title ? `\n${media.title}` : "";
              messageContent = `[${mediaType}: ${fileName}]\n${media.file_url}${caption}`;
            }
            break;
          }
          case "document":
          case "documents":
          case "documentos": {
            const { data: doc } = await supabase
              .from("quick_documents")
              .select("file_url, file_name, title")
              .eq("id", step.item_id)
              .maybeSingle();
            if (doc?.file_url) {
              const fileName = doc.file_name || doc.title || "documento.pdf";
              const caption = doc.title ? `\n${doc.title}` : "";
              messageContent = `[DOCUMENTO: ${fileName}]\n${doc.file_url}${caption}`;
            }
            break;
          }
          default:
            break;
        }

        if (!messageContent) {
          results.push({ order: Number(step?.order || i), type: normalizedType, item_id: String(step?.item_id || ""), ok: false, error: "Item não encontrado/sem dados" });
          continue;
        }

        // Inserir mensagem na tabela lab_messages
        const { error: insertError } = await supabase
          .from("lab_messages")
          .insert({
            session_id: sessionId,
            sender_type: "agent",
            content: messageContent
          });

        if (insertError) {
          console.error("[trigger-funnel-lab] Erro ao inserir mensagem:", insertError);
          results.push({ order: Number(step?.order || i), type: normalizedType, item_id: String(step?.item_id || ""), ok: false, error: `Erro ao salvar: ${insertError.message}` });
          continue;
        }

        results.push({ order: Number(step?.order || i), type: normalizedType, item_id: String(step?.item_id || ""), ok: true });

        // Delay antes do próximo step
        const delaySeconds = Number(step?.delay_seconds || 0);
        if (delaySeconds > 0 && i < sortedSteps.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
        }
      } catch (e: any) {
        results.push({ order: Number(step?.order || i), type: normalizedType, item_id: String(step?.item_id || ""), ok: false, error: e?.message || String(e) });
      }
    }

    const okCount = results.filter((r) => r.ok).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Funil disparado no Lab",
        funnel: { id: (funnel as any).id, title: (funnel as any).title },
        session_id: sessionId,
        workspace_id: workspaceId,
        steps_total: results.length,
        steps_sent: okCount,
        triggered_at: nowIso,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[trigger-funnel-lab] Erro:", error);
    
    let errorMessage = "Erro interno";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
