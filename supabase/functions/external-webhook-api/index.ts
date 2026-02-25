import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =========================
   CORS
========================= */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/* =========================
   TYPES
========================= */
interface RequestPayload {
  action: "create_contact_with_card";
  workspace_id: string;
  contact: {
  name: string;
  phone?: string;
  email?: string;
  };
  card: {
  pipeline_id: string;
  column_id: string;
  value?: number;
    queue_id?: string;
  };
  conversation?: {
    create?: boolean;
  };
}

/* =========================
   INTERNAL EDGE CALLS ✅
========================= */
async function assignConversationToQueue(
  conversationId: string,
  queueId?: string
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const internalSecret = Deno.env.get("INTERNAL_EDGE_SECRET")!;

  const res = await fetch(
    `${supabaseUrl}/functions/v1/assign-conversation-to-queue`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Autorização exigida pelo gateway de funções
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        // Cabeçalho interno opcional (caso você queira validar na função de fila)
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        queue_id: queueId ?? null,
      }),
    }
  );

  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
    } catch {
    parsed = text;
  }

  if (!res.ok || parsed?.error) {
    return { success: false, error: parsed };
  }

  return { success: true };
}

// Disparar automações de coluna como se o card tivesse entrado na coluna
async function triggerColumnAutomationsForCard(
  cardId: string,
  workspaceId: string,
  columnId: string,
  pipelineId: string
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Usuário "sistema" para contexto das automações
  const systemUserId =
    Deno.env.get("INTERNAL_SYSTEM_USER_ID") || "external-webhook-system-user";
  const systemUserEmail =
    Deno.env.get("INTERNAL_SYSTEM_USER_EMAIL") ||
    "external-webhook-system-user@tezeus.local";

  const url = `${supabaseUrl}/functions/v1/pipeline-management/cards?id=${cardId}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "x-workspace-id": workspaceId,
      "x-system-user-id": systemUserId,
      "x-system-user-email": systemUserEmail,
      // Forçar execução das automações de "entrada na coluna" mesmo para cards recém-criados
      "x-force-column-automation": "true",
    },
              body: JSON.stringify({
      column_id: columnId,
      pipeline_id: pipelineId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(
      "[triggerColumnAutomationsForCard] Erro ao chamar pipeline-management/cards:",
      res.status,
      text
    );
  }
}

/* =========================
   SERVER
========================= */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as RequestPayload;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    /* =====================
       CREATE CONTACT
    ===================== */
    const { data: contact } = await supabase
              .from("contacts")
      .insert({
        name: payload.contact.name,
        phone: payload.contact.phone,
        email: payload.contact.email ?? null,
        workspace_id: payload.workspace_id,
      })
                .select("id")
      .single();

    /* =====================
       CREATE CONVERSATION
    ===================== */
    let conversationId: string | null = null;

    if (payload.conversation?.create && contact) {
      const { data: conv } = await supabase
        .from("conversations")
        .insert({
          contact_id: contact.id,
                  workspace_id: payload.workspace_id,
                  status: "open",
                  canal: "whatsapp",
        })
                  .select("id")
                  .single();

      conversationId = conv?.id || null;
    }

    /* =====================
       CREATE CARD
    ===================== */
    if (!contact) {
      return new Response(
        JSON.stringify({ success: false, error: "CONTACT_NOT_FOUND" }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    const { data: card } = await supabase
      .from("pipeline_cards")
      .insert({
        contact_id: contact.id,
        conversation_id: conversationId,
        pipeline_id: payload.card.pipeline_id,
        column_id: payload.card.column_id,
        value: payload.card.value ?? 0,
        status: "aberto",
        moved_to_column_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    /* =====================
       ASSIGN QUEUE ✅
    ===================== */
    if (payload.card.queue_id && conversationId) {
      const queueResult = await assignConversationToQueue(
        conversationId,
        payload.card.queue_id
      );

      if (!queueResult.success) {
        return new Response(
          JSON.stringify({
          success: false,
            error: "QUEUE_ASSIGNMENT_FAILED",
            details: queueResult.error,
          }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    /* =====================
       COLUMN AUTOMATIONS ✅
       Disparar automações "ao entrar na coluna"
    ===================== */
    if (card) {
      try {
        await triggerColumnAutomationsForCard(
          card.id,
          payload.workspace_id,
          payload.card.column_id,
          payload.card.pipeline_id
        );
      } catch (automationError) {
        console.error(
          "[external-webhook-api] Erro ao disparar automações de coluna para card criado via webhook:",
          automationError
        );
        // Não bloqueia a resposta da webhook
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          contact_id: contact.id,
          conversation_id: conversationId,
          card_id: card?.id || null,
        },
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
      success: false,
      error: "INTERNAL_ERROR",
        message: err?.message ?? String(err),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});