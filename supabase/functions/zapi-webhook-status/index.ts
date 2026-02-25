import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para normalizar status do Z-API para o formato padrão
function normalizeZapiStatus(zapiStatus: string): string {
  const statusMap: Record<string, string> = {
    SENT: "sent",
    DELIVERED: "delivered",
    READ: "read",
    FAILED: "failed",
    PENDING: "sending",
  };

  return statusMap[zapiStatus] || zapiStatus.toLowerCase();
}

function extractProviderMessageId(data: any): string | null {
  // Z-API status callback geralmente traz: ids[0]
  if (Array.isArray(data?.ids) && data.ids.length > 0) return String(data.ids[0]);
  // Alguns formatos trazem messageId/id
  if (data?.messageId) return String(data.messageId);
  if (data?.id) return String(data.id);
  return null;
}

serve(async (req) => {
  const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`🔥 [${id}] Z-API WEBHOOK STATUS - Method: ${req.method}`);

  try {
    const data = await req.json();
    console.log(`📦 [${id}] Data (raw):`, JSON.stringify(data, null, 2));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Z-API pode enviar instanceName OU instanceId
    const instanceName = data.instanceName || data.instance || data.instanceId;

    if (!instanceName) {
      console.error(`❌ [${id}] No instance identifier found in payload`);
      return new Response(JSON.stringify({ success: false, error: "No instance name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providerMessageId = extractProviderMessageId(data);
    const rawStatus = data?.status;
    if (!providerMessageId || !rawStatus) {
      console.warn(`⚠️ [${id}] Ignoring non-status or incomplete payload`, {
        instanceName,
        hasProviderMessageId: !!providerMessageId,
        hasStatus: !!rawStatus,
        type: data?.type,
        event: data?.event,
      });
      // Retorna 200 para evitar retries desnecessários do provider
      return new Response(JSON.stringify({ success: true, ignored: true, id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = typeof rawStatus === "string" ? normalizeZapiStatus(rawStatus) : String(rawStatus);
    console.log(`✅ [${id}] Status callback`, {
      instanceName,
      providerMessageId,
      rawStatus,
      status,
      type: data?.type,
      event: data?.event,
    });

    // Buscar conexão pelo instance_name OU instance_id (para Z-API)
    const { data: conn, error: connError } = await supabase
      .from("connections")
      .select("id, workspace_id, instance_name, metadata, provider_id")
      .or(`instance_name.eq.${instanceName},metadata->>instanceId.eq.${instanceName}`)
      .maybeSingle();

    if (connError) {
      console.error(`❌ [${id}] Database error:`, connError);
    }

    if (!conn) {
      console.error(`❌ [${id}] Connection not found for instance: ${instanceName}`);
      return new Response(JSON.stringify({ success: false, error: "Connection not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ [${id}] Connection resolved`, {
      connection_id: conn.id,
      workspace_id: conn.workspace_id,
      instance_name: conn.instance_name,
    });

    // Status callbacks devem ir para um workflow dedicado (hardcoded)
    const n8nUrl = "https://n8n-n8n.upvzfg.easypanel.host/webhook/status-tezeus";

    const n8nPayload = {
      event_type: data?.event || data?.type || "MessageStatusCallback",
      provider: "zapi",
      instance_name: conn.instance_name || instanceName,
      workspace_id: conn.workspace_id,
      connection_id: conn.id,
      external_id: providerMessageId,
      status,
      timestamp: new Date().toISOString(),
      webhook_data: data,
    };

    console.log(`🚀 [${id}] Forwarding status payload to N8N`, {
      n8nUrl,
      external_id: providerMessageId,
      status,
    });

    try {
      const n8nResponse = await fetch(n8nUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(n8nPayload),
      });

      const statusCode = n8nResponse.status;
      if (!n8nResponse.ok) {
        const text = await n8nResponse.text().catch(() => "");
        console.error(`❌ [${id}] N8N webhook failed: ${statusCode}`, text);
      } else {
        console.log(`✅ [${id}] N8N: ${statusCode}`);
      }
    } catch (e) {
      console.error(`❌ [${id}] N8N error:`, e);
    }

    return new Response(JSON.stringify({ success: true, id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`❌ [${id}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


