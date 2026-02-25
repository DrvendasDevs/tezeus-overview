import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const getEnvOrThrow = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${key}`);
  }
  return value;
};

interface ActivityData {
  id: string;
  workspace_id: string;
  responsible_id: string | null;
  subject: string;
  description: string | null;
  scheduled_for: string;
  duration_minutes: number | null;
  google_calendar_event_id: string | null;
  contact_id?: string | null;
  pipeline_card_id?: string | null;
}

interface GoogleCalendarAuthorization {
  id: string;
  user_id: string;
  workspace_id: string;
  refresh_token: string;
  google_email: string;
  revoked_at: string | null;
}

interface WebhookSettings {
  webhook_url: string;
  google_calendar_webhook_url: string | null;
  webhook_secret: string;
}

const getWebhookUrl = async (
  client: SupabaseClient<any>,
  workspaceId: string,
): Promise<string | null> => {
  // 1. Buscar webhook do workspace (específico ou padrão)
  const { data, error } = await client
    .from("workspace_webhook_settings")
    .select("webhook_url, google_calendar_webhook_url")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("❌ Erro ao buscar webhook settings:", error);
  } else {
    // Priorizar webhook específico do Google Calendar, senão usar o padrão do workspace
    const workspaceWebhook = data?.google_calendar_webhook_url || data?.webhook_url;
    if (workspaceWebhook) {
      return workspaceWebhook;
    }
  }

  // 2. Se não encontrou no workspace, buscar URL global do system_google_calendar_settings
  const { data: globalSettings, error: globalError } = await client
    .from("system_google_calendar_settings")
    .select("webhook_url")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (globalError) {
    console.error("❌ Erro ao buscar webhook global do Google Calendar:", globalError);
    return null;
  }

  // Retornar URL global como último fallback
  return globalSettings?.webhook_url || null;
};

const getGoogleCalendarAuthorization = async (
  client: SupabaseClient<any>,
  userId: string,
  workspaceId: string,
): Promise<GoogleCalendarAuthorization | null> => {
  const { data, error } = await client
    .from("google_calendar_authorizations")
    .select("*")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    console.error("❌ Erro ao buscar autorização Google Calendar:", error);
    return null;
  }

  return data as GoogleCalendarAuthorization | null;
};

const getActivityData = async (
  client: SupabaseClient<any>,
  activityId: string,
): Promise<ActivityData | null> => {
  const { data, error } = await client
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .maybeSingle();

  if (error) {
    console.error("❌ Erro ao buscar atividade:", error);
    return null;
  }

  return data as ActivityData | null;
};

const buildEventData = (activity: ActivityData, appUrl: string) => {
  const startDate = new Date(activity.scheduled_for);
  const durationMinutes = activity.duration_minutes || 30;
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  // Formatar datas no formato RFC3339 para Google Calendar
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/\.\d{3}Z$/, "Z");
  };

  let description = activity.description || "";
  
  // Adicionar link para a atividade se disponível
  if (activity.id) {
    const activityLink = `${appUrl}/administracao-google-agenda`;
    description += description ? `\n\nLink: ${activityLink}` : `Link: ${activityLink}`;
  }

  return {
    summary: activity.subject,
    description: description.trim() || activity.subject,
    start: {
      dateTime: formatDate(startDate),
      timeZone: "America/Sao_Paulo",
    },
    end: {
      dateTime: formatDate(endDate),
      timeZone: "America/Sao_Paulo",
    },
  };
};

const callN8NWebhook = async (
  webhookUrl: string,
  payload: Record<string, unknown>,
  retryCount = 0,
): Promise<{ success: boolean; google_event_id?: string; error?: string }> => {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ N8N retornou erro ${response.status}:`, errorText);
      
      // Retry uma vez após 5 segundos se falhar
      if (retryCount === 0 && response.status >= 500) {
        console.log("🔄 Tentando novamente após 5 segundos...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return callN8NWebhook(webhookUrl, payload, 1);
      }
      
      return {
        success: false,
        error: `N8N retornou status ${response.status}: ${errorText}`,
      };
    }

    const result = await response.json().catch(() => ({}));
    return {
      success: true,
      google_event_id: result.google_event_id || result.eventId || undefined,
    };
  } catch (error) {
    console.error("❌ Erro ao chamar webhook N8N:", error);
    
    // Retry uma vez após 5 segundos se for erro de rede
    if (retryCount === 0) {
      console.log("🔄 Tentando novamente após 5 segundos...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return callN8NWebhook(webhookUrl, payload, 1);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const respond = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const handleCreateOrUpdateEvent = async (
  client: SupabaseClient<any>,
  activity: ActivityData,
  action: "create" | "update",
  appUrl: string,
) => {
  // Validar dados básicos
  if (!activity.responsible_id) {
    console.log("ℹ️ Atividade sem responsible_id, ignorando Google Calendar");
    return respond({ success: false, reason: "no_responsible_user" }, 200);
  }

  if (!activity.subject || !activity.scheduled_for) {
    console.log("ℹ️ Atividade sem subject ou scheduled_for, ignorando Google Calendar");
    return respond({ success: false, reason: "missing_required_fields" }, 200);
  }

  // Verificar se usuário tem Google Calendar autorizado
  const authorization = await getGoogleCalendarAuthorization(
    client,
    activity.responsible_id,
    activity.workspace_id,
  );

  if (!authorization) {
    console.log(
      `ℹ️ Usuário ${activity.responsible_id} não tem Google Calendar autorizado`,
    );
    return respond({ success: false, reason: "user_not_authorized" }, 200);
  }

  // Buscar webhook URL
  const webhookUrl = await getWebhookUrl(client, activity.workspace_id);
  if (!webhookUrl) {
    console.log(`ℹ️ Workspace ${activity.workspace_id} não tem webhook configurado`);
    return respond({ success: false, reason: "no_webhook_configured" }, 200);
  }

  // Construir payload para N8N
  const eventData = buildEventData(activity, appUrl);
  const payload = {
    action,
    activity_id: activity.id,
    responsible_user_id: activity.responsible_id,
    refresh_token: authorization.refresh_token,
    event_data: eventData,
    google_event_id: activity.google_calendar_event_id || undefined,
  };

  console.log(`📤 Chamando N8N para ${action} evento:`, {
    activity_id: activity.id,
    user_id: activity.responsible_id,
    has_event_id: !!activity.google_calendar_event_id,
  });

  // Chamar N8N
  const result = await callN8NWebhook(webhookUrl, payload);

  if (result.success && result.google_event_id) {
    // Atualizar atividade com google_event_id
    const { error: updateError } = await client
      .from("activities")
      .update({ google_calendar_event_id: result.google_event_id })
      .eq("id", activity.id);

    if (updateError) {
      console.error("⚠️ Erro ao atualizar google_calendar_event_id:", updateError);
    } else {
      console.log(`✅ google_calendar_event_id salvo: ${result.google_event_id}`);
    }
  }

  return respond({
    success: result.success,
    google_event_id: result.google_event_id,
    error: result.error,
  });
};

const handleDeleteEvent = async (
  client: SupabaseClient<any>,
  activityId: string,
  googleEventId: string | null,
  workspaceId: string,
  responsibleId: string | null,
) => {
  if (!googleEventId) {
    console.log("ℹ️ Atividade não tem google_calendar_event_id, ignorando delete");
    return respond({ success: true, reason: "no_event_id" }, 200);
  }

  if (!responsibleId) {
    console.log("ℹ️ Atividade sem responsible_id, ignorando delete");
    return respond({ success: true, reason: "no_responsible_user" }, 200);
  }

  // Verificar se usuário tem Google Calendar autorizado
  const authorization = await getGoogleCalendarAuthorization(
    client,
    responsibleId,
    workspaceId,
  );

  if (!authorization) {
    console.log(`ℹ️ Usuário ${responsibleId} não tem Google Calendar autorizado`);
    return respond({ success: true, reason: "user_not_authorized" }, 200);
  }

  // Buscar webhook URL
  const webhookUrl = await getWebhookUrl(client, workspaceId);
  if (!webhookUrl) {
    console.log(`ℹ️ Workspace ${workspaceId} não tem webhook configurado`);
    return respond({ success: true, reason: "no_webhook_configured" }, 200);
  }

  // Construir payload para N8N
  const payload = {
    action: "delete",
    activity_id: activityId,
    responsible_user_id: responsibleId,
    refresh_token: authorization.refresh_token,
    google_event_id: googleEventId,
  };

  console.log(`📤 Chamando N8N para deletar evento:`, {
    activity_id: activityId,
    google_event_id: googleEventId,
  });

  // Chamar N8N
  const result = await callN8NWebhook(webhookUrl, payload);

  return respond({
    success: result.success,
    error: result.error,
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      getEnvOrThrow("SUPABASE_URL"),
      getEnvOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    const body = await req.json().catch(() => ({}));
    const { activity_id, action, activity_data } = body;

    // Determinar ação: create, update ou delete
    const eventAction = action || (activity_data ? "create" : "update");

    // Para delete, precisamos dos dados básicos
    if (eventAction === "delete") {
      const { google_event_id, workspace_id, responsible_id } = body;
      
      if (!activity_id || !google_event_id || !workspace_id) {
        return respond(
          { error: "activity_id, google_event_id e workspace_id são obrigatórios para delete" },
          400,
        );
      }

      return await handleDeleteEvent(
        supabaseClient,
        activity_id,
        google_event_id,
        workspace_id,
        responsible_id || null,
      );
    }

    // Para create/update, buscar dados da atividade
    let activity: ActivityData | null = null;

    if (activity_data) {
      // Dados fornecidos diretamente (do trigger)
      activity = activity_data as ActivityData;
    } else if (activity_id) {
      // Buscar atividade pelo ID
      activity = await getActivityData(supabaseClient, activity_id);
      if (!activity) {
        return respond({ error: "Atividade não encontrada" }, 404);
      }
    } else {
      return respond(
        { error: "activity_id ou activity_data é obrigatório" },
        400,
      );
    }

    // Obter URL da aplicação (para links nos eventos)
    const appUrl = body.app_url || "https://app.tezeus.com"; // Default, pode ser configurável

    return await handleCreateOrUpdateEvent(
      supabaseClient,
      activity,
      eventAction as "create" | "update",
      appUrl,
    );
  } catch (error) {
    console.error("❌ Erro na função create-google-calendar-event", error);
    return respond(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});

