import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Edge Function: trigger-funnel
 * 
 * Dispara um funil/campanha específico via HTTP request.
 * Ideal para ser chamado pelo n8n ou outras automações externas.
 * 
 * Endpoint: POST /functions/v1/trigger-funnel
 * 
 * Headers:
 *   - x-api-key: Chave de API do workspace (obrigatório para autenticação)
 *   - Content-Type: application/json
 * 
 * Body:
 *   {
 *     "workspace_id": "uuid-do-workspace",
 *     "funnel_id": "uuid-do-funil-campanha",
 *     "connection_id": "uuid-da-conexao",
 *     "conversation_id": "uuid-da-conversa",
 *     "phone": "5511999999999" // ou phone_number
 *   }
 * 
 * Resposta de sucesso:
 *   {
 *     "success": true,
 *     "message": "Funil disparado com sucesso",
 *     "campaign": { ... },
 *     "contacts_count": 10,          
 *     "triggered_at": "2024-01-01T00:00:00.000Z"
 *   }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-workspace-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Obter dados do body
    // Suporta disparo avulso para 1 contato informado no request
    // (além do modo legado por lista vinculada à campanha).
    let body: {
      workspace_id?: string;
      funnel_id?: string;
      connection_id?: string;
      conversation_id?: string;
      phone?: string;
      phone_number?: string;
      contact_name?: string;
      contact_tag?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Body inválido. Envie JSON com workspace_id e funnel_id." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const workspaceId = body.workspace_id;
    const funnelId = body.funnel_id;
    const connectionId = String(body.connection_id || "").trim();
    const conversationIdInput = String(body.conversation_id || "").trim();

    // Validar campos obrigatórios
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ success: false, error: "workspace_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!funnelId) {
      return new Response(
        JSON.stringify({ success: false, error: "funnel_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: "connection_id é obrigatório" }),
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

    // Validar conexão informada (deve pertencer ao workspace e estar conectada)
    const { data: targetConnection, error: targetConnectionError } = await supabase
      .from("connections")
      .select("id, instance_name, phone_number, status, workspace_id")
      .eq("id", connectionId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (targetConnectionError) {
      console.error("[trigger-funnel] Erro ao validar connection_id:", targetConnectionError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao validar connection_id", details: targetConnectionError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!targetConnection) {
      return new Response(
        JSON.stringify({ success: false, error: "connection_id inválida ou não pertence ao workspace" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targetConnection.status !== "connected") {
      return new Response(
        JSON.stringify({ success: false, error: "connection_id não está conectada" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetConnectionId = targetConnection.id;

    // -----------------------------
    // QUICK FUNNEL (quick_funnels)
    // -----------------------------
    const normPhone = (v: string) => String(v || "").replace(/\D/g, "");
    let phone = "";
    let contact: any = null;
    let conversationId: string | null = null;

    if (conversationIdInput) {
      const { data: conversation, error: conversationErr } = await supabase
        .from("conversations")
        .select("id, workspace_id, connection_id, contact_id")
        .eq("id", conversationIdInput)
        .maybeSingle();

      if (conversationErr) {
        console.error("[trigger-funnel] Erro ao buscar conversation_id:", conversationErr);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao buscar conversation_id", details: conversationErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!conversation) {
        return new Response(
          JSON.stringify({ success: false, error: "conversation_id não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (conversation.workspace_id !== workspaceId) {
        return new Response(
          JSON.stringify({ success: false, error: "conversation_id não pertence ao workspace" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (conversation.connection_id !== targetConnectionId) {
        return new Response(
          JSON.stringify({ success: false, error: "conversation_id não pertence à connection_id informada" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: contactData, error: contactDataErr } = await supabase
        .from("contacts")
        .select("id, phone")
        .eq("id", conversation.contact_id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (contactDataErr || !contactData) {
        console.error("[trigger-funnel] Erro ao buscar contato da conversa:", contactDataErr);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao buscar contato da conversa" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      phone = normPhone(contactData.phone);
      if (!phone) {
        return new Response(
          JSON.stringify({ success: false, error: "Contato da conversa sem phone válido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      contact = contactData;
      conversationId = conversation.id;
    } else {
      const rawPhone = String(body.phone_number || body.phone || "").trim();
      if (!rawPhone) {
        return new Response(
          JSON.stringify({ success: false, error: "phone (ou phone_number) é obrigatório para disparar Quick Funil" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      phone = normPhone(rawPhone);
      if (!phone) {
        return new Response(
          JSON.stringify({ success: false, error: "phone inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Buscar o funil em quick_funnels (é isso que a UI usa)
    const { data: funnel, error: funnelError } = await supabase
      .from("quick_funnels")
      .select("id, title, workspace_id, steps")
      .eq("id", funnelId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (funnelError) {
      console.error("[trigger-funnel] Erro ao buscar quick_funnel:", funnelError);
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

    // Proteção: impedir que enviem funil para número da própria instância
    const { data: connsForCheck, error: connsForCheckErr } = await supabase
      .from("connections")
      .select("phone_number")
      .eq("workspace_id", workspaceId);
    if (connsForCheckErr) {
      console.error("[trigger-funnel] Erro ao buscar conexões:", connsForCheckErr);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao validar número contra instâncias" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const isInstanceNumber = (connsForCheck || []).some((c: any) => {
      const p = normPhone(c?.phone_number || "");
      return p && p === phone;
    });
    if (isInstanceNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "Este número pertence a uma instância WhatsApp e não pode ser usado como contato." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!conversationId) {
      // Resolver/criar contato na tabela contacts (porque test-send-msg usa contacts)
      const contactName = String(body.contact_name || phone).trim() || phone;
      const { data: contactData, error: contactErr } = await supabase
        .from("contacts")
        .select("id, phone")
        .eq("workspace_id", workspaceId)
        .eq("phone", phone)
        .maybeSingle();
      if (contactErr) {
        console.error("[trigger-funnel] Erro ao buscar contato:", contactErr);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao buscar contato" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!contactData) {
        const { data: newContact, error: newContactErr } = await supabase
          .from("contacts")
          .insert({
            name: contactName,
            phone,
            workspace_id: workspaceId,
            extra_info: { temporary: true, source: "trigger-funnel" },
          })
          .select("id, phone")
          .single();
        if (newContactErr || !newContact) {
          console.error("[trigger-funnel] Erro ao criar contato:", newContactErr);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao criar contato" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        contact = newContact;
      } else {
        contact = contactData;
      }

      // Reutilizar conversa existente (mesma conexão, se houver)
      try {
        const convQuery = supabase
          .from("conversations")
          .select("id, connection_id")
          .eq("workspace_id", workspaceId)
          .eq("contact_id", (contact as any).id)
          .eq("connection_id", targetConnectionId)
          .order("created_at", { ascending: false })
          .limit(1);
        const { data: existingConv } = await convQuery.maybeSingle();
        if (existingConv?.id) {
          conversationId = existingConv.id;
          await supabase
            .from("conversations")
            .update({
              status: "open",
              updated_at: new Date().toISOString(),
              last_activity_at: new Date().toISOString(),
              connection_id: targetConnectionId,
              evolution_instance: (targetConnection as any)?.instance_name || null,
              instance_phone: (targetConnection as any)?.phone_number || null,
            })
            .eq("id", conversationId)
            .eq("workspace_id", workspaceId);
        }
      } catch (e) {
        console.warn("[trigger-funnel] Falha ao tentar reutilizar conversa (seguindo para criar nova):", e);
      }

      // Criar conversa se necessário
      if (!conversationId) {
        const { data: newConv, error: newConvErr } = await supabase
          .from("conversations")
          .insert({
            contact_id: (contact as any).id,
            status: "open",
            workspace_id: workspaceId,
            canal: "whatsapp",
            agente_ativo: false,
            connection_id: targetConnectionId,
            evolution_instance: (targetConnection as any)?.instance_name || null,
            instance_phone: (targetConnection as any)?.phone_number || null,
            last_activity_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (newConvErr || !newConv?.id) {
          console.error("[trigger-funnel] Erro ao criar conversa:", newConvErr);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao criar conversa" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        conversationId = newConv.id;
      }
    }

    // Enviar steps via test-send-msg (que encaminha ao n8n do workspace)
    const nowIso = new Date().toISOString();
    const sendMessageUrl = `${supabaseUrl}/functions/v1/test-send-msg`;
    const sortedSteps = [...stepsRaw].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

    const results: Array<{ order: number; type: string; item_id: string; ok: boolean; error?: string }> = [];

    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];
      const normalizedType = String(step?.type || "").toLowerCase();

      let messagePayload: any = null;

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
              messagePayload = {
                conversation_id: conversationId,
                content: msg.content,
                message_type: "text",
                clientMessageId: `qf_${funnelId}_step_${i}_${Date.now()}`,
              };
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
              messagePayload = {
                conversation_id: conversationId,
                content: "",
                message_type: "audio",
                file_url: audio.file_url,
                file_name: audio.file_name || audio.title || "audio.mp3",
                clientMessageId: `qf_${funnelId}_step_${i}_${Date.now()}`,
              };
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
              let mediaType = "image";
              if (media.file_type?.startsWith("video/")) {
                mediaType = "video";
              } else {
                const url = String(media.file_url || "").toLowerCase();
                if (url.includes(".mp4") || url.includes(".mov") || url.includes(".avi")) {
                  mediaType = "video";
                }
              }
              messagePayload = {
                conversation_id: conversationId,
                content: media.title || "",
                message_type: mediaType,
                file_url: media.file_url,
                file_name: media.file_name || media.title || (mediaType === "video" ? "video.mp4" : "image.jpg"),
                clientMessageId: `qf_${funnelId}_step_${i}_${Date.now()}`,
              };
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
              messagePayload = {
                conversation_id: conversationId,
                content: doc.title || "",
                message_type: "document",
                file_url: doc.file_url,
                file_name: doc.file_name || doc.title || "document.pdf",
                clientMessageId: `qf_${funnelId}_step_${i}_${Date.now()}`,
              };
            }
            break;
          }
          default:
            break;
        }

        if (!messagePayload) {
          results.push({ order: Number(step?.order || i), type: normalizedType, item_id: String(step?.item_id || ""), ok: false, error: "Item não encontrado/sem dados" });
          continue;
        }

        const res = await fetch(sendMessageUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messagePayload),
        });

        if (!res.ok) {
          const txt = await res.text();
          results.push({ order: Number(step?.order || i), type: normalizedType, item_id: String(step?.item_id || ""), ok: false, error: `HTTP ${res.status}: ${txt}` });
          continue;
        }

        const data = await res.json().catch(() => ({}));
        if (data?.success === false) {
          results.push({ order: Number(step?.order || i), type: normalizedType, item_id: String(step?.item_id || ""), ok: false, error: String(data?.error || "Falha ao enviar") });
        } else {
          results.push({ order: Number(step?.order || i), type: normalizedType, item_id: String(step?.item_id || ""), ok: true });
        }

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
        message: "Quick Funil disparado",
        funnel: { id: (funnel as any).id, title: (funnel as any).title },
        workspace_id: workspaceId,
        conversation_id: conversationId,
        connection_id: targetConnectionId,
        phone,
        steps_total: results.length,
        steps_sent: okCount,
        triggered_at: nowIso,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[trigger-funnel] Erro:", error);
    
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
